import { describe, expect, it, vi } from "vitest";

import {
  buildPostdeploySmokeChecks,
  resolvePostdeployBaseUrl,
  resolvePostdeployPendingWorkflowExpectation,
  resolvePostdeploySessionCookie,
  runPostdeploySmoke,
} from "@/scripts/postdeploy-smoke";

function createResponse(
  status: number,
  options?: {
    headers?: Record<string, string>;
    body?: string;
  }
) {
  return new Response(options?.body ?? null, {
    status,
    headers: options?.headers,
  });
}

describe("postdeploy smoke contract", () => {
  it("covers the required release-risk categories", () => {
    const checks = buildPostdeploySmokeChecks();
    const authenticatedChecks = buildPostdeploySmokeChecks({
      includeAuthenticatedPortfolioChecks: true,
      expectPendingPhaseRequest: true,
    });

    expect(checks.map((check) => check.category)).toEqual(
      expect.arrayContaining([
        "auth",
        "onboarding",
        "invite",
        "admin",
        "observability",
        "jobs",
      ])
    );
    expect(authenticatedChecks.map((check) => check.category)).toEqual(
      expect.arrayContaining(["portfolio"])
    );
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/login",
          method: "GET",
          expectedStatuses: [200],
        }),
        expect.objectContaining({
          path: "/api/auth/forgot-password",
          method: "POST",
          expectedStatuses: [422],
        }),
        expect.objectContaining({
          path: "/onboarding",
          expectedLocationIncludes: "/login",
        }),
        expect.objectContaining({
          path: "/admin/members",
          expectedLocationIncludes: "/login",
        }),
        expect.objectContaining({
          path: "/admin/settings",
          expectedLocationIncludes: "/login",
        }),
        expect.objectContaining({
          path: "/api/admin/insights",
          expectedStatuses: [401, 403],
        }),
        expect.objectContaining({
          path: "/api/admin/jobs",
          expectedStatuses: [401, 403],
        }),
      ])
    );
    expect(authenticatedChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/dashboard",
          method: "GET",
          expectedStatuses: [200],
          expectedBodyIncludes: expect.arrayContaining([
            "Savings by Phase",
            "Savings by Category",
            "Savings Forecast",
          ]),
          expectedBodyExcludes: expect.arrayContaining([
            "No live saving cards yet.",
          ]),
          requiresSession: true,
        }),
        expect.objectContaining({
          path: "/kanban",
          method: "GET",
          expectedStatuses: [200],
          expectedBodyIncludes: expect.arrayContaining([
            "Kanban Board",
            "Idea",
            "Validated",
          ]),
          expectedBodyExcludes: expect.arrayContaining([
            "No board activity yet",
          ]),
          requiresSession: true,
        }),
        expect.objectContaining({
          path: "/kanban",
          method: "GET",
          expectedBodyIncludes: expect.arrayContaining([
            "Pending approval",
            "Card remains in",
          ]),
          requiresSession: true,
        }),
      ])
    );
  });

  it("resolves the deployment base URL from CLI args or env", () => {
    expect(
      resolvePostdeployBaseUrl([
        "node",
        "scripts/postdeploy-smoke.ts",
        "--base-url",
        "https://preview.traxium.com/",
      ])
    ).toBe("https://preview.traxium.com");

    expect(
      resolvePostdeployBaseUrl(
        ["node", "scripts/postdeploy-smoke.ts"],
        {
          POSTDEPLOY_BASE_URL: "https://app.traxium.com/",
        }
      )
    ).toBe("https://app.traxium.com");
  });

  it("resolves optional portfolio smoke session flags from env", () => {
    expect(
      resolvePostdeploySessionCookie({
        POSTDEPLOY_SESSION_COOKIE: "sb-access-token=abc; sb-refresh-token=def",
      })
    ).toBe("sb-access-token=abc; sb-refresh-token=def");
    expect(
      resolvePostdeployPendingWorkflowExpectation({
        POSTDEPLOY_EXPECT_PENDING_PHASE_REQUEST: "true",
      })
    ).toBe(true);
    expect(resolvePostdeploySessionCookie({})).toBeNull();
    expect(resolvePostdeployPendingWorkflowExpectation({})).toBe(false);
  });

  it("runs the scripted checks and enforces redirect/status contracts", async () => {
    const checks = buildPostdeploySmokeChecks();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const check = checks.find((entry) => entry.path === url.pathname);

      if (!check) {
        throw new Error(`Unexpected smoke request for ${url.pathname}`);
      }

      if (check.expectedLocationIncludes) {
        return createResponse(check.expectedStatuses[0]!, {
          headers: {
            location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
          },
        });
      }

      return createResponse(check.expectedStatuses[0]!);
    });

    const summary = await runPostdeploySmoke({
      baseUrl: "https://preview.traxium.com",
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 500,
    });

    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(checks.length);
    expect(fetchImpl).toHaveBeenCalledTimes(checks.length);
  });

  it("runs authenticated dashboard and kanban smoke checks when a release-validation session cookie is provided", async () => {
    const sessionCookie = "sb-access-token=abc; sb-refresh-token=def";
    const checks = buildPostdeploySmokeChecks({
      includeAuthenticatedPortfolioChecks: true,
      expectPendingPhaseRequest: true,
    });
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const check = checks.find((entry) => entry.path === url.pathname);

        if (!check) {
          throw new Error(`Unexpected smoke request for ${url.pathname}`);
        }

        if (check.requiresSession) {
          expect(init?.headers).toBeInstanceOf(Headers);
          expect((init?.headers as Headers).get("cookie")).toBe(sessionCookie);
        }

        if (url.pathname === "/dashboard") {
          return createResponse(200, {
            body: [
              "Dashboard",
              "Savings by Phase",
              "Savings by Category",
              "Savings Forecast",
              "Pipeline Savings",
            ].join(" "),
          });
        }

        if (url.pathname === "/kanban") {
          return createResponse(200, {
            body: [
              "Kanban Board",
              "Idea",
              "Validated",
              "Realised",
              "Achieved",
              "Cancelled",
              "Pending approval",
              "Card remains in Idea until approval completes.",
            ].join(" "),
          });
        }

        if (check.expectedLocationIncludes) {
          return createResponse(check.expectedStatuses[0]!, {
            headers: {
              location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
            },
          });
        }

        return createResponse(check.expectedStatuses[0]!);
      }
    );

    const summary = await runPostdeploySmoke({
      baseUrl: "https://preview.traxium.com",
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 500,
      sessionCookie,
      expectPendingPhaseRequest: true,
    });

    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(checks.length);
  });

  it("fails a check when a protected route stops redirecting to login", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname === "/admin/jobs") {
        return createResponse(200);
      }

      const check = buildPostdeploySmokeChecks().find(
        (entry) => entry.path === url.pathname
      );

      if (!check) {
        throw new Error(`Unexpected smoke request for ${url.pathname}`);
      }

      if (check.expectedLocationIncludes) {
        return createResponse(check.expectedStatuses[0]!, {
          headers: {
            location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
          },
        });
      }

      return createResponse(check.expectedStatuses[0]!);
    });

    const summary = await runPostdeploySmoke({
      baseUrl: "https://preview.traxium.com",
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 500,
    });
    const jobsResult = summary.results.find(
      (result) => result.check.path === "/admin/jobs"
    );

    expect(summary.failed).toBe(1);
    expect(jobsResult).toEqual(
      expect.objectContaining({
        ok: false,
        status: 200,
      })
    );
  });

  it("fails the authenticated dashboard smoke when live portfolio content regresses to the empty fallback", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname === "/dashboard") {
        return createResponse(200, {
          body: "Dashboard No live saving cards yet.",
        });
      }

      if (url.pathname === "/kanban") {
        return createResponse(200, {
          body: "Kanban Board Idea Validated Realised Achieved Cancelled",
        });
      }

      const check = buildPostdeploySmokeChecks({
        includeAuthenticatedPortfolioChecks: true,
      }).find((entry) => entry.path === url.pathname);

      if (!check) {
        throw new Error(`Unexpected smoke request for ${url.pathname}`);
      }

      if (check.expectedLocationIncludes) {
        return createResponse(check.expectedStatuses[0]!, {
          headers: {
            location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
          },
        });
      }

      return createResponse(check.expectedStatuses[0]!);
    });

    const summary = await runPostdeploySmoke({
      baseUrl: "https://preview.traxium.com",
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 500,
      sessionCookie: "sb-access-token=abc",
    });
    const dashboardResult = summary.results.find(
      (result) => result.check.path === "/dashboard"
    );

    expect(summary.failed).toBe(1);
    expect(dashboardResult).toEqual(
      expect.objectContaining({
        ok: false,
        status: 200,
      })
    );
  });
});
