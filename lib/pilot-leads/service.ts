import { createHash, createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { PilotLeadSubmission } from "@/lib/pilot-leads/validation";

const RECENT_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

type PilotLeadClient = Pick<typeof prisma, "pilotLead">;

function normalizeCompanyName(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

export function buildPilotLeadDedupeKey(
  workEmail: string,
  companyName: string
) {
  const normalized = [
    workEmail.trim().toLowerCase(),
    normalizeCompanyName(companyName).toLowerCase(),
  ].join("\u0000");

  return createHash("sha256").update(normalized).digest("hex");
}

function resolveRequestIp(request: Request) {
  for (const headerName of [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-vercel-forwarded-for",
  ]) {
    const rawValue = request.headers.get(headerName)?.trim();

    if (!rawValue) continue;

    const [firstHop = ""] = rawValue.split(",");
    const normalized = firstHop.trim();

    if (normalized) return normalized;
  }

  return null;
}

function hashPrivateRequestValue(value: string | null) {
  const secret = process.env.PILOT_LEAD_HASH_SECRET?.trim();

  if (!value || !secret) {
    return null;
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

export function getPilotLeadRequestHashes(request: Request) {
  return {
    ipHash: hashPrivateRequestValue(resolveRequestIp(request)),
    userAgentHash: hashPrivateRequestValue(
      request.headers.get("user-agent")?.trim() || null
    ),
  };
}

export async function storePilotLead(
  payload: PilotLeadSubmission,
  request: Request,
  input: {
    client?: PilotLeadClient;
    now?: Date;
  } = {}
) {
  const client = input.client ?? prisma;
  const now = input.now ?? new Date();
  const companyName = normalizeCompanyName(payload.companyName);
  const dedupeKey = buildPilotLeadDedupeKey(
    payload.workEmail,
    companyName
  );
  const existing = await client.pilotLead.findFirst({
    where: {
      dedupeKey,
      createdAt: {
        gte: new Date(now.getTime() - RECENT_DUPLICATE_WINDOW_MS),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (existing) {
    return {
      created: false as const,
      lead: existing,
    };
  }

  const requestHashes = getPilotLeadRequestHashes(request);
  const lead = await client.pilotLead.create({
    data: {
      fullName: payload.fullName,
      workEmail: payload.workEmail,
      companyName,
      jobTitle: normalizeOptionalText(payload.jobTitle),
      companySize: payload.companySize ?? null,
      industry: payload.industry ?? null,
      currentTracking: payload.currentTracking ?? null,
      savingsPain: normalizeOptionalText(payload.savingsPain),
      hasSavingsTracker: payload.hasSavingsTracker,
      timeline: payload.timeline ?? null,
      message: normalizeOptionalText(payload.message),
      source: "public_pilot_form",
      dedupeKey,
      ipHash: requestHashes.ipHash,
      userAgentHash: requestHashes.userAgentHash,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return {
    created: true as const,
    lead,
  };
}
