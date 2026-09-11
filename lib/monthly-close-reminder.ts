import { Role } from "@prisma/client";

import type { JobHandlerContext } from "@/lib/job-runner";
import { enqueueJob, jobTypes } from "@/lib/jobs";
import {
  lastCompletedMonthStart,
  monthKey,
  parseMonthKey,
} from "@/lib/monthly-close";
import { getMonthlyCloseSummary } from "@/lib/monthly-close-data";
import { buildOrganizationUserWhere } from "@/lib/organizations";
import { hasAnyPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** Roles allowed to drive the monthly close (enter actuals / lock finance). */
const REMINDER_ROLES: Role[] = Object.values(Role).filter((role) =>
  hasAnyPermission(role, ["manageSavingCards", "lockFinance"])
);

/** Stable per-org, per-month key so the jobs upsert dedupes a re-run. */
export function buildMonthlyCloseReminderKey(
  organizationId: string,
  month: string
): string {
  return `${jobTypes.MONTHLY_CLOSE_REMINDER}:${organizationId}:${month}`;
}

type MonthlyCloseReminderPayload = {
  organizationId: string;
  month: string;
};

/**
 * Enqueue one idempotent monthly-close reminder per organization for the prior
 * (just-completed) month. Only acts on the first day of the month; every other
 * day is a no-op so the existing worker/cron pass can call it unconditionally.
 */
export async function enqueueDueMonthlyCloseReminders(input?: {
  now?: Date;
}): Promise<{ due: boolean; enqueued: number; month?: string }> {
  const now = input?.now ?? new Date();
  if (now.getUTCDate() !== 1) {
    return { due: false, enqueued: 0 };
  }

  const month = monthKey(lastCompletedMonthStart(now));
  const organizations = await prisma.organization.findMany({
    select: { id: true },
  });

  for (const organization of organizations) {
    await enqueueJob({
      type: jobTypes.MONTHLY_CLOSE_REMINDER,
      organizationId: organization.id,
      idempotencyKey: buildMonthlyCloseReminderKey(organization.id, month),
      payload: { organizationId: organization.id, month },
    });
  }

  return { due: true, enqueued: organizations.length, month };
}

/**
 * Handle one reminder job: assemble the close for the org/month and notify the
 * finance/owner recipients when actuals or finance review are still outstanding.
 */
export async function processMonthlyCloseReminderJob(
  context: JobHandlerContext
): Promise<void> {
  const payload = (context.job.payload ?? {}) as Partial<MonthlyCloseReminderPayload>;
  const organizationId = payload.organizationId ?? context.job.organizationId;
  const monthStart = parseMonthKey(payload.month);
  if (!organizationId || !monthStart || !payload.month) {
    return;
  }

  const summary = await getMonthlyCloseSummary(organizationId, monthStart);
  const outstanding =
    summary.missingActualsCount + summary.needsFinanceReviewCount;
  if (outstanding <= 0) {
    return;
  }

  const recipients = await prisma.user.findMany({
    where: buildOrganizationUserWhere(organizationId, {
      role: { in: REMINDER_ROLES },
    }),
    select: { id: true },
  });
  if (recipients.length === 0) {
    return;
  }

  const monthName = summary.monthLabel.split(" ")[0];
  const message = `${monthName} close: ${summary.missingActualsCount} cards need actuals, ${summary.needsFinanceReviewCount} need finance review.`;
  const href = `/monthly-close?month=${payload.month}`;

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      organizationId,
      userId: recipient.id,
      title: `${monthName} close`,
      message,
      href,
    })),
  });
}
