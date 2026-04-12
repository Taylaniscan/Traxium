import { JobStatus, type Job, type Prisma } from "@prisma/client";

import {
  getScopedCachedValue,
  invalidateScopedCache,
} from "@/lib/cache";
import { sanitizeForLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RESERVATION_SCAN_ATTEMPTS = 5;
const MAX_ERROR_LENGTH = 2_000;
const DEFAULT_ADMIN_JOBS_TAKE = 20;
const MAX_ADMIN_JOBS_TAKE = 50;
const ADMIN_JOBS_CACHE_TTL_MS = 1_500;
const SENSITIVE_JOB_PAYLOAD_KEY_PATTERN =
  /(password|passwd|token|secret|authorization|auth(?:[_ -]?header)|raw(?:[_ -]?auth[_ -]?header)|email)/iu;

type JobClient = Pick<typeof prisma, "job">;

const organizationJobSelect = {
  id: true,
  organizationId: true,
  type: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  scheduledAt: true,
  reservedAt: true,
  processedAt: true,
  error: true,
  createdAt: true,
  updatedAt: true,
  payload: true,
} satisfies Prisma.JobSelect;

export const jobTypes = {
  INVITATION_EMAIL_DELIVERY: "auth_email.invitation_delivery",
  PASSWORD_RECOVERY_EMAIL_DELIVERY: "auth_email.password_recovery_delivery",
  ANALYTICS_TRACK: "analytics.track",
  ANALYTICS_IDENTIFY: "analytics.identify",
  OBSERVABILITY_MESSAGE: "observability.message",
  OBSERVABILITY_EXCEPTION: "observability.exception",
} as const;

export type JobPayload = Record<string, unknown>;

export type EnqueueJobInput = {
  type: string;
  payload?: JobPayload | null;
  organizationId?: string | null;
  scheduledAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string | null;
};

export type ReserveNextJobInput = {
  now?: Date;
  organizationId?: string | null;
  types?: string[];
  maxScanAttempts?: number;
};

export type MarkJobFailedInput = {
  retryAt?: Date;
  retryDelayMs?: number;
  disableAutoRetry?: boolean;
};

type OrganizationJobRecord = Prisma.JobGetPayload<{
  select: typeof organizationJobSelect;
}>;

export class JobAdminError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "JobAdminError";
  }
}

export type OrganizationAdminJob = {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  reservedAt: Date | null;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  payloadKeys: string[];
  retryable: boolean;
};

export type OrganizationJobStatusSummary = {
  queued: number;
  running: number;
  failed: number;
  completed: number;
  canceled: number;
};

export type OrganizationJobsOverview = {
  summary: OrganizationJobStatusSummary;
  jobs: OrganizationAdminJob[];
};

export type RetryOrganizationJobResult = {
  changed: boolean;
  job: OrganizationAdminJob;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeJobType(type: string) {
  const normalized = type.trim();

  if (!normalized) {
    throw new Error("Job type is required.");
  }

  return normalized;
}

function normalizeOrganizationId(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function requireOrganizationId(value?: string | null) {
  const normalized = normalizeOrganizationId(value);

  if (!normalized) {
    throw new JobAdminError("Organization context is required.", 422);
  }

  return normalized;
}

function normalizeIdempotencyKey(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeMaxAttempts(value?: number) {
  const normalized = Math.trunc(value ?? DEFAULT_MAX_ATTEMPTS);
  return normalized >= 1 ? normalized : DEFAULT_MAX_ATTEMPTS;
}

function normalizeTypes(types?: string[]) {
  const normalized = (types ?? [])
    .map((type) => type.trim())
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
}

function normalizeTake(take?: number) {
  return Math.max(
    1,
    Math.min(
      Math.trunc(take ?? DEFAULT_ADMIN_JOBS_TAKE) || DEFAULT_ADMIN_JOBS_TAKE,
      MAX_ADMIN_JOBS_TAKE
    )
  );
}

function normalizeJobPayload(
  payload?: JobPayload | null
): Prisma.InputJsonValue {
  const normalizedPayload = sanitizeForLog(payload ?? {});

  if (!isPlainObject(normalizedPayload)) {
    return {};
  }

  return normalizedPayload as Prisma.InputJsonValue;
}

function normalizeJobError(error: unknown) {
  if (error instanceof Error) {
    const sanitizedMessage = sanitizeForLog(error.message);

    if (typeof sanitizedMessage === "string") {
      return sanitizedMessage.slice(0, MAX_ERROR_LENGTH);
    }
  }

  if (typeof error === "string") {
    const sanitizedMessage = sanitizeForLog(error);

    if (typeof sanitizedMessage === "string") {
      return sanitizedMessage.slice(0, MAX_ERROR_LENGTH);
    }
  }

  return "Unexpected job failure.";
}

function normalizeJobId(jobId: string) {
  const normalized = jobId.trim();

  if (!normalized) {
    throw new JobAdminError("Job id is required.", 422);
  }

  return normalized;
}

function resolveRetryAt(
  job: Pick<Job, "attempts">,
  input: MarkJobFailedInput,
  processedAt: Date
) {
  if (input.retryAt) {
    return input.retryAt;
  }

  if (input.retryDelayMs !== undefined) {
    return new Date(processedAt.getTime() + input.retryDelayMs);
  }

  return new Date(processedAt.getTime() + getRetryDelayMs(job.attempts));
}

function buildReservationWhere(input: ReserveNextJobInput, now: Date): Prisma.JobWhereInput {
  const normalizedTypes = normalizeTypes(input.types);
  const organizationId = input.organizationId;

  return {
    status: JobStatus.QUEUED,
    scheduledAt: {
      lte: now,
    },
    ...(normalizedTypes
      ? {
          type: {
            in: normalizedTypes,
          },
        }
      : {}),
    ...(organizationId === undefined ? {} : { organizationId }),
  };
}

async function getJobById(jobId: string, client: JobClient = prisma) {
  return client.job.findUnique({
    where: {
      id: jobId,
    },
  });
}

function buildEmptyJobStatusSummary(): OrganizationJobStatusSummary {
  return {
    queued: 0,
    running: 0,
    failed: 0,
    completed: 0,
    canceled: 0,
  };
}

function mapJobStatusSummary(
  rows: Array<{
    status: JobStatus;
    _count: {
      _all: number;
    };
  }>
): OrganizationJobStatusSummary {
  const summary = buildEmptyJobStatusSummary();

  for (const row of rows) {
    switch (row.status) {
      case JobStatus.QUEUED:
        summary.queued = row._count._all;
        break;
      case JobStatus.RUNNING:
        summary.running = row._count._all;
        break;
      case JobStatus.FAILED:
        summary.failed = row._count._all;
        break;
      case JobStatus.COMPLETED:
        summary.completed = row._count._all;
        break;
      case JobStatus.CANCELED:
        summary.canceled = row._count._all;
        break;
      default:
        break;
    }
  }

  return summary;
}

function readPayloadKeys(payload: Prisma.JsonValue): string[] {
  const sanitizedPayload = sanitizeForLog(payload);

  if (!isPlainObject(sanitizedPayload)) {
    return [];
  }

  return Object.keys(sanitizedPayload)
    .filter((key) => !SENSITIVE_JOB_PAYLOAD_KEY_PATTERN.test(key))
    .sort()
    .slice(0, 6);
}

function mapOrganizationAdminJob(
  job: OrganizationJobRecord
): OrganizationAdminJob {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    scheduledAt: job.scheduledAt,
    reservedAt: job.reservedAt,
    processedAt: job.processedAt,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    payloadKeys: readPayloadKeys(job.payload),
    retryable:
      job.status === JobStatus.FAILED || job.status === JobStatus.CANCELED,
  };
}

function invalidateOrganizationJobsCache(organizationId: string) {
  invalidateScopedCache({
    namespace: "organization-jobs",
    organizationId,
  });
}

export function getRetryDelayMs(attempts: number) {
  const safeAttempts = Math.max(1, Math.trunc(attempts) || 1);
  return Math.min(2 ** (safeAttempts - 1) * 60_000, 15 * 60_000);
}

export async function enqueueJob(
  input: EnqueueJobInput,
  client: JobClient = prisma
): Promise<Job> {
  const type = normalizeJobType(input.type);
  const organizationId = normalizeOrganizationId(input.organizationId);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const scheduledAt = input.scheduledAt ?? new Date();
  const maxAttempts = normalizeMaxAttempts(input.maxAttempts);
  const payload = normalizeJobPayload(input.payload);

  if (idempotencyKey) {
    const job = await client.job.upsert({
      where: {
        type_idempotencyKey: {
          type,
          idempotencyKey,
        },
      },
      update: {},
      create: {
        type,
        idempotencyKey,
        organizationId,
        payload,
        scheduledAt,
        maxAttempts,
      },
    });

    if (job.organizationId) {
      invalidateOrganizationJobsCache(job.organizationId);
    }

    return job;
  }

  const job = await client.job.create({
    data: {
      type,
      organizationId,
      payload,
      scheduledAt,
      maxAttempts,
    },
  });

  if (job.organizationId) {
    invalidateOrganizationJobsCache(job.organizationId);
  }

  return job;
}

export async function reserveNextJob(
  input: ReserveNextJobInput = {},
  client: JobClient = prisma
): Promise<Job | null> {
  const now = input.now ?? new Date();
  const maxScanAttempts = Math.max(
    1,
    Math.trunc(input.maxScanAttempts ?? DEFAULT_RESERVATION_SCAN_ATTEMPTS) || 1
  );

  for (let scanAttempt = 0; scanAttempt < maxScanAttempts; scanAttempt += 1) {
    const candidate = await client.job.findFirst({
      where: buildReservationWhere(input, now),
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    });

    if (!candidate) {
      return null;
    }

    const reservedAt = new Date();
    const reservation = await client.job.updateMany({
      where: {
        id: candidate.id,
        status: JobStatus.QUEUED,
        attempts: candidate.attempts,
      },
      data: {
        status: JobStatus.RUNNING,
        attempts: {
          increment: 1,
        },
        reservedAt,
        processedAt: null,
        error: null,
      },
    });

    if (!reservation.count) {
      continue;
    }

    const job = await getJobById(candidate.id, client);

    if (job?.organizationId) {
      invalidateOrganizationJobsCache(job.organizationId);
    }

    return job;
  }

  return null;
}

export async function markJobCompleted(
  jobId: string,
  client: JobClient = prisma
): Promise<Job | null> {
  const processedAt = new Date();
  const completion = await client.job.updateMany({
    where: {
      id: jobId,
      status: JobStatus.RUNNING,
    },
    data: {
      status: JobStatus.COMPLETED,
      processedAt,
      reservedAt: null,
      error: null,
    },
  });

  const job = await getJobById(jobId, client);

  if (job?.organizationId) {
    invalidateOrganizationJobsCache(job.organizationId);
  }

  return job;
}

export async function markJobFailed(
  jobId: string,
  error: unknown,
  input: MarkJobFailedInput = {},
  client: JobClient = prisma
): Promise<Job | null> {
  const job = await getJobById(jobId, client);

  if (!job) {
    return null;
  }

  if (job.status !== JobStatus.RUNNING) {
    return job;
  }

  const processedAt = new Date();
  const shouldRetry =
    !input.disableAutoRetry && job.attempts < job.maxAttempts;
  const retryAt = resolveRetryAt(job, input, processedAt);

  await client.job.updateMany({
    where: {
      id: job.id,
      status: JobStatus.RUNNING,
    },
    data: {
      status: shouldRetry ? JobStatus.QUEUED : JobStatus.FAILED,
      scheduledAt: shouldRetry ? retryAt : job.scheduledAt,
      processedAt,
      reservedAt: null,
      error: normalizeJobError(error),
    },
  });

  const updatedJob = await getJobById(job.id, client);

  if (updatedJob?.organizationId) {
    invalidateOrganizationJobsCache(updatedJob.organizationId);
  }

  return updatedJob;
}

export async function retryJob(
  jobId: string,
  scheduledAt = new Date(),
  client: JobClient = prisma
): Promise<Job | null> {
  const retry = await client.job.updateMany({
    where: {
      id: jobId,
      status: {
        in: [JobStatus.FAILED, JobStatus.CANCELED],
      },
    },
    data: {
      status: JobStatus.QUEUED,
      attempts: 0,
      scheduledAt,
      reservedAt: null,
      processedAt: null,
      error: null,
    },
  });

  const job = await getJobById(jobId, client);

  if (job?.organizationId) {
    invalidateOrganizationJobsCache(job.organizationId);
  }

  return job;
}

export async function getOrganizationJobsOverview(
  organizationId: string,
  take = DEFAULT_ADMIN_JOBS_TAKE,
  client: JobClient = prisma
): Promise<OrganizationJobsOverview> {
  const normalizedOrganizationId = requireOrganizationId(organizationId);
  const normalizedTake = normalizeTake(take);

  return getScopedCachedValue(
    {
      namespace: "organization-jobs",
      organizationId: normalizedOrganizationId,
      key: `take:${normalizedTake}`,
      ttlMs: ADMIN_JOBS_CACHE_TTL_MS,
    },
    async () => {
      const [statusRows, jobs] = await Promise.all([
        client.job.groupBy({
          by: ["status"],
          where: {
            organizationId: normalizedOrganizationId,
          },
          orderBy: {
            status: "asc",
          },
          _count: {
            _all: true,
          },
        }),
        client.job.findMany({
          where: {
            organizationId: normalizedOrganizationId,
          },
          select: organizationJobSelect,
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: normalizedTake,
        }),
      ]);

      return {
        summary: mapJobStatusSummary(statusRows),
        jobs: jobs.map(mapOrganizationAdminJob),
      };
    }
  );
}

export async function retryOrganizationJob(input: {
  jobId: string;
  organizationId: string;
  scheduledAt?: Date;
  client?: JobClient;
}): Promise<RetryOrganizationJobResult> {
  const jobId = normalizeJobId(input.jobId);
  const organizationId = requireOrganizationId(input.organizationId);
  const client = input.client ?? prisma;
  const job = await client.job.findUnique({
    where: {
      id: jobId,
    },
    select: organizationJobSelect,
  });

  if (!job || job.organizationId !== organizationId) {
    throw new JobAdminError("Job not found in the active organization.", 404);
  }

  if (job.status !== JobStatus.FAILED && job.status !== JobStatus.CANCELED) {
    return {
      changed: false,
      job: mapOrganizationAdminJob(job),
    };
  }

  const scheduledAt = input.scheduledAt ?? new Date();
  const retry = await client.job.updateMany({
    where: {
      id: jobId,
      organizationId,
      status: {
        in: [JobStatus.FAILED, JobStatus.CANCELED],
      },
    },
    data: {
      status: JobStatus.QUEUED,
      attempts: 0,
      scheduledAt,
      reservedAt: null,
      processedAt: null,
      error: null,
    },
  });
  const retriedJob = await client.job.findUnique({
    where: {
      id: jobId,
    },
    select: organizationJobSelect,
  });

  if (!retriedJob || retriedJob.organizationId !== organizationId) {
    throw new JobAdminError("Job retry could not be scheduled.", 409);
  }

  invalidateOrganizationJobsCache(organizationId);

  return {
    changed: retry.count > 0,
    job: mapOrganizationAdminJob(retriedJob),
  };
}
