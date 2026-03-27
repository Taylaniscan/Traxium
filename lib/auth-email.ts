import type { OrganizationRole } from "@prisma/client";

import { buildAppUrl, getAppUrl } from "@/lib/app-url";
import { jobTypes, enqueueJob } from "@/lib/jobs";
import { trackServerEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseAdminClient,
  createSupabasePublicClient,
} from "@/lib/supabase/server";
import {
  organizationInvitationSelect,
  type OrganizationInvitationRecord,
} from "@/lib/types";

export type GeneratedAuthActionLink = {
  actionLink: string;
  redirectTo: string;
  verificationType: "invite" | "magiclink" | "recovery";
};

export type QueuedDeliveryResult = {
  transport: "job-queued";
  state: "queued";
  jobId: string;
};

export type QueueUnavailableDeliveryResult = {
  transport: "queue-unavailable";
  state: "unavailable";
};

export type HostedInvitationDeliveryResult = {
  channel: "invite" | "magic_link";
  redirectTo: string;
  transport: "supabase-auth" | "generated-link";
  actionLink?: string;
  requiresManualDelivery?: boolean;
};

export type HostedRecoveryDeliveryResult = {
  transport: "supabase-auth" | "generated-link";
  actionLink?: string;
  requiresManualDelivery?: boolean;
};

type InvitationEmailJobPayload = {
  invitationId: string;
};

type PasswordRecoveryEmailJobPayload = {
  email: string;
  redirectTo: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function formatInvitationRoleLabel(role: OrganizationRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildInvitationRedirectTo(
  invitation: Pick<OrganizationInvitationRecord, "token">,
  mode: "setup" | "accept"
) {
  return buildAppUrl(`/invite/${invitation.token}?mode=${mode}`);
}

function buildInvitationMetadata(
  invitation: Pick<
    OrganizationInvitationRecord,
    "email" | "expiresAt" | "role" | "token"
  > & {
    organization: Pick<OrganizationInvitationRecord["organization"], "name" | "slug">;
  }
) {
  return {
    invitation_email: invitation.email,
    invitation_role: invitation.role,
    invitation_role_label: formatInvitationRoleLabel(invitation.role),
    invitation_expires_at: invitation.expiresAt.toISOString(),
    invitation_workspace_name: invitation.organization.name,
    invitation_workspace_slug: invitation.organization.slug,
    invitation_token: invitation.token,
  };
}

function isExistingAuthUserErrorMessage(message: string) {
  return /already\s+(registered|exists|been\s+registered)/iu.test(message);
}

function readStringValue(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function readInvitationEmailJobPayload(payload: unknown): InvitationEmailJobPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invitation email job payload is invalid.");
  }

  return {
    invitationId: readStringValue(
      (payload as Record<string, unknown>).invitationId,
      "Invitation id"
    ),
  };
}

function readPasswordRecoveryEmailJobPayload(
  payload: unknown
): PasswordRecoveryEmailJobPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Password recovery job payload is invalid.");
  }

  return {
    email: normalizeEmail(
      readStringValue((payload as Record<string, unknown>).email, "Email")
    ),
    redirectTo: readStringValue(
      (payload as Record<string, unknown>).redirectTo,
      "Redirect URL"
    ),
  };
}

function buildPasswordRecoveryIdempotencyKey(email: string, redirectTo: string) {
  return [
    "password-recovery",
    normalizeEmail(email),
    redirectTo.trim(),
    Math.floor(Date.now() / 60_000),
  ].join(":");
}

export function isAuthEmailRateLimitError(message: string) {
  return /rate limit/i.test(message);
}

export function isAuthEmailFallbackEligibleError(message: string) {
  return (
    isAuthEmailRateLimitError(message) ||
    /email address not authorized/i.test(message)
  );
}

export function canExposeDevelopmentAuthLinks() {
  try {
    const appUrl = new URL(getAppUrl());
    return (
      appUrl.hostname === "localhost" ||
      appUrl.hostname === "127.0.0.1"
    );
  } catch {
    return process.env.NODE_ENV !== "production";
  }
}

async function generateAuthActionLink(input: {
  type: "invite" | "magiclink" | "recovery";
  email: string;
  redirectTo: string;
  data?: object;
}): Promise<GeneratedAuthActionLink> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: input.type,
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
      ...(input.data ? { data: input.data } : {}),
    },
  });

  if (error || !data.properties.action_link) {
    throw new Error(
      error?.message ?? "Supabase auth action link could not be generated."
    );
  }

  return {
    actionLink: data.properties.action_link,
    redirectTo: data.properties.redirect_to,
    verificationType: data.properties.verification_type as
      | "invite"
      | "magiclink"
      | "recovery",
  };
}

export function generateInvitationActionLink(input: {
  type: "invite" | "magiclink";
  email: string;
  redirectTo: string;
  data?: object;
}) {
  return generateAuthActionLink(input);
}

export function generateRecoveryActionLink(input: {
  email: string;
  redirectTo: string;
}) {
  return generateAuthActionLink({
    type: "recovery",
    email: input.email,
    redirectTo: input.redirectTo,
  });
}

export async function deliverOrganizationInvitationEmail(
  invitation: OrganizationInvitationRecord,
  options: {
    allowManualFallback?: boolean;
  } = {}
): Promise<HostedInvitationDeliveryResult> {
  const allowManualFallback = options.allowManualFallback ?? true;
  const invitationMetadata = buildInvitationMetadata(invitation);
  const setupRedirectTo = buildInvitationRedirectTo(invitation, "setup");
  const acceptRedirectTo = buildInvitationRedirectTo(invitation, "accept");
  const supabaseAdmin = createSupabaseAdminClient();

  async function createGeneratedDelivery(input: {
    channel: "invite" | "magic_link";
    type: "invite" | "magiclink";
    redirectTo: string;
    data?: object;
  }): Promise<HostedInvitationDeliveryResult> {
    const generatedLink = await generateInvitationActionLink({
      type: input.type,
      email: invitation.email,
      redirectTo: input.redirectTo,
      data: input.data,
    });

    return {
      channel: input.channel,
      redirectTo: input.redirectTo,
      transport: "generated-link",
      actionLink: generatedLink.actionLink,
      requiresManualDelivery: true,
    };
  }

  const inviteResponse = await supabaseAdmin.auth.admin.inviteUserByEmail(
    invitation.email,
    {
      redirectTo: setupRedirectTo,
      data: invitationMetadata,
    }
  );

  if (!inviteResponse.error) {
    return {
      channel: "invite",
      redirectTo: setupRedirectTo,
      transport: "supabase-auth",
    };
  }

  if (isAuthEmailFallbackEligibleError(inviteResponse.error.message)) {
    if (!allowManualFallback) {
      throw new Error(inviteResponse.error.message);
    }

    return createGeneratedDelivery({
      channel: "invite",
      type: "invite",
      redirectTo: setupRedirectTo,
      data: invitationMetadata,
    });
  }

  if (!isExistingAuthUserErrorMessage(inviteResponse.error.message)) {
    throw new Error(inviteResponse.error.message);
  }

  const supabasePublic = createSupabasePublicClient();
  const magicLinkResponse = await supabasePublic.auth.signInWithOtp({
    email: invitation.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: acceptRedirectTo,
    },
  });

  if (magicLinkResponse.error) {
    if (isAuthEmailFallbackEligibleError(magicLinkResponse.error.message)) {
      if (!allowManualFallback) {
        throw new Error(magicLinkResponse.error.message);
      }

      return createGeneratedDelivery({
        channel: "magic_link",
        type: "magiclink",
        redirectTo: acceptRedirectTo,
      });
    }

    throw new Error(magicLinkResponse.error.message);
  }

  return {
    channel: "magic_link",
    redirectTo: acceptRedirectTo,
    transport: "supabase-auth",
  };
}

export async function sendPasswordRecoveryEmail(
  input: PasswordRecoveryEmailJobPayload,
  options: {
    allowManualFallback?: boolean;
  } = {}
): Promise<HostedRecoveryDeliveryResult> {
  const allowManualFallback = options.allowManualFallback ?? true;
  const supabase = createSupabasePublicClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  });

  if (!error) {
    return {
      transport: "supabase-auth",
    };
  }

  if (
    allowManualFallback &&
    isAuthEmailFallbackEligibleError(error.message) &&
    canExposeDevelopmentAuthLinks()
  ) {
    const generatedLink = await generateRecoveryActionLink({
      email: input.email,
      redirectTo: input.redirectTo,
    });

    return {
      transport: "generated-link",
      actionLink: generatedLink.actionLink,
      requiresManualDelivery: true,
    };
  }

  throw new Error(error.message);
}

export async function queueInvitationEmailJob(input: {
  invitationId: string;
  organizationId?: string | null;
  idempotencyKey?: string | null;
}): Promise<QueuedDeliveryResult> {
  const invitationId = readStringValue(input.invitationId, "Invitation id");
  const job = await enqueueJob({
    type: jobTypes.INVITATION_EMAIL_DELIVERY,
    organizationId: input.organizationId ?? null,
    payload: {
      invitationId,
    },
    idempotencyKey:
      input.idempotencyKey?.trim() || `invitation-delivery:${invitationId}`,
  });

  return {
    transport: "job-queued",
    state: "queued",
    jobId: job.id,
  };
}

export async function queueInvitationEmailJobSafely(input: {
  invitationId: string;
  organizationId?: string | null;
  idempotencyKey?: string | null;
}): Promise<QueuedDeliveryResult | QueueUnavailableDeliveryResult> {
  try {
    return await queueInvitationEmailJob(input);
  } catch (error) {
    trackServerEvent(
      {
        event: "jobs.auth_email.invitation_delivery.enqueue_failed",
        organizationId: input.organizationId ?? null,
        status: 202,
        payload: {
          invitationId: input.invitationId,
          reason: "queue_unavailable",
        },
      },
      "warn"
    );

    return {
      transport: "queue-unavailable",
      state: "unavailable",
    };
  }
}

export async function queuePasswordRecoveryEmailJob(input: {
  email: string;
  redirectTo: string;
  idempotencyKey?: string | null;
}): Promise<QueuedDeliveryResult> {
  const email = normalizeEmail(input.email);
  const redirectTo = readStringValue(input.redirectTo, "Redirect URL");
  const job = await enqueueJob({
    type: jobTypes.PASSWORD_RECOVERY_EMAIL_DELIVERY,
    payload: {
      email,
      redirectTo,
    },
    idempotencyKey:
      input.idempotencyKey?.trim() ||
      buildPasswordRecoveryIdempotencyKey(email, redirectTo),
  });

  return {
    transport: "job-queued",
    state: "queued",
    jobId: job.id,
  };
}

export async function queuePasswordRecoveryEmailJobSafely(input: {
  email: string;
  redirectTo: string;
  idempotencyKey?: string | null;
}): Promise<QueuedDeliveryResult | QueueUnavailableDeliveryResult> {
  try {
    return await queuePasswordRecoveryEmailJob(input);
  } catch (error) {
    trackServerEvent(
      {
        event: "jobs.auth_email.password_recovery_delivery.enqueue_failed",
        status: 202,
        payload: {
          reason: "queue_unavailable",
        },
      },
      "warn"
    );

    return {
      transport: "queue-unavailable",
      state: "unavailable",
    };
  }
}

export async function processInvitationEmailJob({
  job,
}: {
  job: {
    id: string;
    organizationId: string | null;
    payload: unknown;
  };
}) {
  const payload = readInvitationEmailJobPayload(job.payload);
  const invitation = await prisma.invitation.findUnique({
    where: {
      id: payload.invitationId,
    },
    select: organizationInvitationSelect,
  });

  if (!invitation) {
    trackServerEvent(
      {
        event: "jobs.auth_email.invitation_delivery.skipped",
        organizationId: job.organizationId,
        status: 200,
        payload: {
          jobId: job.id,
          invitationId: payload.invitationId,
          reason: "invitation_not_found",
        },
      },
      "warn"
    );
    return;
  }

  if (
    job.organizationId !== null &&
    invitation.organizationId !== job.organizationId
  ) {
    throw new Error("Invitation delivery job organization mismatch.");
  }

  if (invitation.status !== "PENDING") {
    trackServerEvent({
      event: "jobs.auth_email.invitation_delivery.skipped",
      organizationId: invitation.organizationId,
      status: 200,
      payload: {
        jobId: job.id,
        invitationId: invitation.id,
        reason: "invitation_not_pending",
        invitationStatus: invitation.status,
      },
    });
    return;
  }

  const delivery = await deliverOrganizationInvitationEmail(invitation, {
    allowManualFallback: false,
  });

  trackServerEvent({
    event: "jobs.auth_email.invitation_delivery.completed",
    organizationId: invitation.organizationId,
    status: 200,
    payload: {
      jobId: job.id,
      invitationId: invitation.id,
      deliveryChannel: delivery.channel,
      deliveryTransport: delivery.transport,
    },
  });
}

export async function processPasswordRecoveryEmailJob({
  job,
}: {
  job: {
    id: string;
    payload: unknown;
  };
}) {
  const payload = readPasswordRecoveryEmailJobPayload(job.payload);
  const delivery = await sendPasswordRecoveryEmail(payload, {
    allowManualFallback: false,
  });

  trackServerEvent({
    event: "jobs.auth_email.password_recovery_delivery.completed",
    status: 200,
    payload: {
      jobId: job.id,
      deliveryTransport: delivery.transport,
    },
  });
}
