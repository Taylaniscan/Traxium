import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobsModuleLoaded = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs", () => {
  jobsModuleLoaded();

  return {
    enqueueJob: vi.fn(),
    jobTypes: {
      INVITATION_EMAIL_DELIVERY: "auth_email.invitation_delivery",
      PASSWORD_RECOVERY_EMAIL_DELIVERY: "auth_email.password_recovery_delivery",
      ANALYTICS_TRACK: "analytics.track",
      ANALYTICS_IDENTIFY: "analytics.identify",
      OBSERVABILITY_MESSAGE: "observability.message",
      OBSERVABILITY_EXCEPTION: "observability.exception",
    },
  };
});

import {
  resetAnalyticsProviderForTests,
  trackSuccessfulLogin,
} from "@/lib/analytics";

describe("analytics browser boundary", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPublicAnalyticsHost = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
  const originalPublicAnalyticsKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsProviderForTests();
    jobsModuleLoaded.mockClear();
    env.NODE_ENV = "test";
    env.NEXT_PUBLIC_ANALYTICS_HOST = undefined;
    env.NEXT_PUBLIC_ANALYTICS_KEY = undefined;
  });

  afterEach(() => {
    resetAnalyticsProviderForTests();
    env.NODE_ENV = originalNodeEnv;
    env.NEXT_PUBLIC_ANALYTICS_HOST = originalPublicAnalyticsHost;
    env.NEXT_PUBLIC_ANALYTICS_KEY = originalPublicAnalyticsKey;
  });

  it("keeps the Kanban client import graph free of static jobs and prisma imports", () => {
    const analyticsSource = readFileSync(
      resolve(process.cwd(), "lib/analytics.ts"),
      "utf8"
    );
    const kanbanSource = readFileSync(
      resolve(process.cwd(), "components/kanban/kanban-board.tsx"),
      "utf8"
    );

    expect(analyticsSource).not.toMatch(/from ["']@\/lib\/jobs["']/);
    expect(analyticsSource).not.toMatch(/from ["']@\/lib\/prisma["']/);
    expect(analyticsSource).not.toMatch(
      /import\s*{[^}]*isJobWorkerProcess[^}]*}\s*from ["']@\/lib\/env["']/s
    );
    expect(kanbanSource).not.toMatch(/from ["']@\/lib\/jobs["']/);
    expect(kanbanSource).not.toMatch(/from ["']@\/lib\/prisma["']/);
    expect(kanbanSource).not.toMatch(/from ["']@\/lib\/env["']/);
  });

  it("does not load the jobs module when analytics runs in the browser runtime", async () => {
    await trackSuccessfulLogin({
      runtime: "client",
      userId: "user-1",
      organizationId: "org-1",
      appRole: "HEAD_OF_GLOBAL_PROCUREMENT",
      membershipRole: "ADMIN",
      hasInviteNextPath: false,
      destination: "dashboard",
    });

    expect(jobsModuleLoaded).not.toHaveBeenCalled();
  });
});
