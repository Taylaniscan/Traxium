import { describe, expect, it, vi } from "vitest";

import {
  buildPostdeploySmokeChecks,
  resolvePostdeployBaseUrl,
  runPostdeploySmoke,
} from "@/scripts/postdeploy-smoke";

function createResponse(status: number, headers?: Record<string, string>) {
  return new Response(null, {
    status,
    headers,
  });
}

describe("postdeploy smoke contract", () => {
  it("covers the required release-risk categories", () => {
    const checks = buildPostdeploySmokeChecks();

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
          location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
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
          location: `https://preview.traxium.com${check.expectedLocationIncludes}`,
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
});
