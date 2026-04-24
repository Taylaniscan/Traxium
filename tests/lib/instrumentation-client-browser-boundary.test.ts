import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobsModuleLoaded = vi.hoisted(() => vi.fn());
const sentryState = vi.hoisted(() => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureRequestError: vi.fn(),
  withScope: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    fmt: vi.fn(),
  },
}));

vi.mock("@/lib/jobs", () => {
  jobsModuleLoaded();

  return {
    enqueueJob: vi.fn(),
    jobTypes: {
      OBSERVABILITY_MESSAGE: "observability.message",
      OBSERVABILITY_EXCEPTION: "observability.exception",
    },
  };
});

vi.mock("@sentry/nextjs", () => sentryState);

describe("instrumentation client browser boundary", () => {
  const globals = globalThis as Record<string, unknown> & {
    window?: {
      location?: {
        href?: string;
      };
    };
  };
  const hadWindow = "window" in globals;
  const originalWindow = globals.window;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (hadWindow) {
      globals.window = originalWindow;
      return;
    }

    delete (globals as { window?: unknown }).window;
  });

  it("keeps the client instrumentation import graph free of static jobs and prisma imports", () => {
    const instrumentationSource = readFileSync(
      resolve(process.cwd(), "instrumentation-client.ts"),
      "utf8"
    );
    const observabilitySource = readFileSync(
      resolve(process.cwd(), "lib/observability.ts"),
      "utf8"
    );

    expect(instrumentationSource).not.toMatch(/from ["']@\/lib\/jobs["']/);
    expect(instrumentationSource).not.toMatch(/from ["']@\/lib\/prisma["']/);
    expect(observabilitySource).not.toMatch(/from ["']@\/lib\/jobs["']/);
    expect(observabilitySource).not.toMatch(/from ["']@\/lib\/prisma["']/);
  });

  it("initializes client instrumentation without loading the jobs module in a browser-like runtime", async () => {
    globals.window = {
      location: {
        href: "http://localhost/dashboard",
      },
    };

    await expect(import("@/instrumentation-client")).resolves.toMatchObject({
      onRouterTransitionStart: sentryState.captureRouterTransitionStart,
    });

    expect(sentryState.init).toHaveBeenCalledTimes(1);
    expect(jobsModuleLoaded).not.toHaveBeenCalled();
  });
});
