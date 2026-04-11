import { pathToFileURL } from "node:url";

export type PostdeploySmokeCategory =
  | "auth"
  | "onboarding"
  | "invite"
  | "admin"
  | "observability"
  | "jobs"
  | "portfolio";

export type PostdeploySmokeCheck = {
  category: PostdeploySmokeCategory;
  name: string;
  method: "GET" | "POST";
  path: string;
  expectedStatuses: number[];
  expectedLocationIncludes?: string;
  expectedBodyIncludes?: string[];
  expectedBodyExcludes?: string[];
  body?: Record<string, unknown>;
  requiresSession?: boolean;
};

export type PostdeploySmokeResult = {
  check: PostdeploySmokeCheck;
  url: string;
  status: number | null;
  ok: boolean;
  location: string | null;
  error: string | null;
};

export type PostdeploySmokeSummary = {
  baseUrl: string;
  total: number;
  passed: number;
  failed: number;
  results: PostdeploySmokeResult[];
};

const DEFAULT_TIMEOUT_MS = 8_000;

function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim();

  if (!normalized) {
    throw new Error(
      "A deployment base URL is required. Use --base-url or POSTDEPLOY_BASE_URL."
    );
  }

  try {
    const url = new URL(normalized);
    return url.toString().replace(/\/+$/u, "");
  } catch {
    throw new Error(`Invalid deployment base URL: ${baseUrl}`);
  }
}

export function resolvePostdeployBaseUrl(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
) {
  const baseUrlFlagIndex = argv.findIndex((value) => value === "--base-url");
  const cliValue =
    baseUrlFlagIndex >= 0 ? argv[baseUrlFlagIndex + 1] ?? "" : "";
  const envValue = env.POSTDEPLOY_BASE_URL ?? "";

  return normalizeBaseUrl(cliValue || envValue);
}

export function resolvePostdeploySessionCookie(
  env: Record<string, string | undefined> = process.env
) {
  return env.POSTDEPLOY_SESSION_COOKIE?.trim() || null;
}

export function resolvePostdeployPendingWorkflowExpectation(
  env: Record<string, string | undefined> = process.env
) {
  return env.POSTDEPLOY_EXPECT_PENDING_PHASE_REQUEST === "true";
}

export function buildPostdeploySmokeChecks(input?: {
  includeAuthenticatedPortfolioChecks?: boolean;
  expectPendingPhaseRequest?: boolean;
}): PostdeploySmokeCheck[] {
  const checks: PostdeploySmokeCheck[] = [
    {
      category: "auth",
      name: "Login page responds",
      method: "GET",
      path: "/login",
      expectedStatuses: [200],
    },
    {
      category: "auth",
      name: "Forgot-password page responds",
      method: "GET",
      path: "/forgot-password",
      expectedStatuses: [200],
    },
    {
      category: "auth",
      name: "Forgot-password validation stays controlled",
      method: "POST",
      path: "/api/auth/forgot-password",
      expectedStatuses: [422],
      body: {
        email: "not-an-email",
      },
    },
    {
      category: "onboarding",
      name: "Unauthenticated onboarding redirects to login",
      method: "GET",
      path: "/onboarding",
      expectedStatuses: [302, 303, 307, 308],
      expectedLocationIncludes: "/login",
    },
    {
      category: "onboarding",
      name: "Auth bootstrap fails closed instead of 500 without a session",
      method: "POST",
      path: "/api/auth/bootstrap",
      expectedStatuses: [401, 403],
    },
    {
      category: "invite",
      name: "Invitation lookup for an invalid token stays controlled",
      method: "GET",
      path: "/api/invitations/postdeploy-invalid-token",
      expectedStatuses: [404],
    },
    {
      category: "admin",
      name: "Members page stays protected",
      method: "GET",
      path: "/admin/members",
      expectedStatuses: [302, 303, 307, 308],
      expectedLocationIncludes: "/login",
    },
    {
      category: "admin",
      name: "Settings page stays protected",
      method: "GET",
      path: "/admin/settings",
      expectedStatuses: [302, 303, 307, 308],
      expectedLocationIncludes: "/login",
    },
    {
      category: "observability",
      name: "Admin insights API blocks unauthenticated access cleanly",
      method: "GET",
      path: "/api/admin/insights",
      expectedStatuses: [401, 403],
    },
    {
      category: "observability",
      name: "Admin audit API blocks unauthenticated access cleanly",
      method: "GET",
      path: "/api/admin/audit",
      expectedStatuses: [401, 403],
    },
    {
      category: "jobs",
      name: "Jobs page stays protected",
      method: "GET",
      path: "/admin/jobs",
      expectedStatuses: [302, 303, 307, 308],
      expectedLocationIncludes: "/login",
    },
    {
      category: "jobs",
      name: "Jobs API blocks unauthenticated access cleanly",
      method: "GET",
      path: "/api/admin/jobs",
      expectedStatuses: [401, 403],
    },
  ];

  if (input?.includeAuthenticatedPortfolioChecks) {
    checks.push(
      {
        category: "portfolio",
        name: "Dashboard page renders live portfolio sections for a seeded workspace session",
        method: "GET",
        path: "/dashboard",
        expectedStatuses: [200],
        expectedBodyIncludes: [
          "Dashboard",
          "Savings by Phase",
          "Savings by Category",
          "Savings Forecast",
        ],
        expectedBodyExcludes: [
          "No live saving cards yet.",
          "Dashboard charts are unavailable",
        ],
        requiresSession: true,
      },
      {
        category: "portfolio",
        name: "Kanban page renders persisted workflow columns for a seeded workspace session",
        method: "GET",
        path: "/kanban",
        expectedStatuses: [200],
        expectedBodyIncludes: [
          "Kanban Board",
          "Idea",
          "Validated",
          "Realised",
          "Achieved",
          "Cancelled",
        ],
        expectedBodyExcludes: [
          "No board activity yet",
          "Kanban board is unavailable",
        ],
        requiresSession: true,
      }
    );

    if (input.expectPendingPhaseRequest) {
      checks.push({
        category: "portfolio",
        name: "Kanban keeps pending workflow requests visibly pending instead of rendering them as moved",
        method: "GET",
        path: "/kanban",
        expectedStatuses: [200],
        expectedBodyIncludes: [
          "Pending approval",
          "Card remains in",
        ],
        requiresSession: true,
      });
    }
  }

  return checks;
}

function buildRequestInit(
  check: PostdeploySmokeCheck,
  timeoutMs: number,
  sessionCookie?: string | null
): RequestInit {
  const headers = new Headers();

  if (check.body) {
    headers.set("content-type", "application/json");
  }

  if (check.requiresSession && sessionCookie) {
    headers.set("cookie", sessionCookie);
  }

  return {
    method: check.method,
    headers,
    body: check.body ? JSON.stringify(check.body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export async function executePostdeploySmokeCheck(
  baseUrl: string,
  check: PostdeploySmokeCheck,
  input: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    sessionCookie?: string | null;
  } = {}
): Promise<PostdeploySmokeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const url = new URL(check.path, normalizedBaseUrl).toString();

  try {
    const response = await fetchImpl(
      url,
      buildRequestInit(check, timeoutMs, input.sessionCookie)
    );
    const location = response.headers.get("location");
    const statusMatches = check.expectedStatuses.includes(response.status);
    const locationMatches = check.expectedLocationIncludes
      ? (location ?? "").includes(check.expectedLocationIncludes)
      : true;
    const shouldInspectBody = Boolean(
      check.expectedBodyIncludes?.length || check.expectedBodyExcludes?.length
    );
    const responseBody = shouldInspectBody ? await response.text() : "";
    const bodyIncludesMatch =
      check.expectedBodyIncludes?.every((snippet) =>
        responseBody.includes(snippet)
      ) ?? true;
    const bodyExcludesMatch =
      check.expectedBodyExcludes?.every((snippet) =>
        !responseBody.includes(snippet)
      ) ?? true;

    return {
      check,
      url,
      status: response.status,
      ok: statusMatches && locationMatches && bodyIncludesMatch && bodyExcludesMatch,
      location,
      error:
        statusMatches && locationMatches && bodyIncludesMatch && bodyExcludesMatch
          ? null
          : `Expected ${check.expectedStatuses.join(", ")}${check.expectedLocationIncludes ? ` with redirect containing ${check.expectedLocationIncludes}` : ""}${check.expectedBodyIncludes?.length ? ` with body containing ${check.expectedBodyIncludes.join(", ")}` : ""}${check.expectedBodyExcludes?.length ? ` and excluding ${check.expectedBodyExcludes.join(", ")}` : ""}, received ${response.status}${location ? ` (${location})` : ""}.`,
    };
  } catch (error) {
    return {
      check,
      url,
      status: null,
      ok: false,
      location: null,
      error:
        error instanceof Error
          ? error.message
          : "Postdeploy smoke request failed.",
    };
  }
}

export async function runPostdeploySmoke(input: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sessionCookie?: string | null;
  expectPendingPhaseRequest?: boolean;
}): Promise<PostdeploySmokeSummary> {
  const checks = buildPostdeploySmokeChecks({
    includeAuthenticatedPortfolioChecks: Boolean(input.sessionCookie),
    expectPendingPhaseRequest: input.expectPendingPhaseRequest,
  });
  const results: PostdeploySmokeResult[] = [];

  for (const check of checks) {
    results.push(
      await executePostdeploySmokeCheck(input.baseUrl, check, {
        fetchImpl: input.fetchImpl,
        timeoutMs: input.timeoutMs,
        sessionCookie: input.sessionCookie,
      })
    );
  }

  const passed = results.filter((result) => result.ok).length;

  return {
    baseUrl: normalizeBaseUrl(input.baseUrl),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

function printSummary(summary: PostdeploySmokeSummary) {
  for (const result of summary.results) {
    const statusLabel = result.status === null ? "ERR" : String(result.status);

    if (result.ok) {
      console.info(
        `PASS [${result.check.category}] ${result.check.name} -> ${statusLabel}`
      );
      continue;
    }

    console.error(
      `FAIL [${result.check.category}] ${result.check.name} -> ${statusLabel} ${result.error ?? ""}`.trim()
    );
  }

  console.info(
    `Postdeploy smoke summary: ${summary.passed}/${summary.total} checks passed for ${summary.baseUrl}.`
  );
}

async function runCli() {
  try {
    const baseUrl = resolvePostdeployBaseUrl();
    const sessionCookie = resolvePostdeploySessionCookie();
    const expectPendingPhaseRequest =
      resolvePostdeployPendingWorkflowExpectation();
    const summary = await runPostdeploySmoke({
      baseUrl,
      sessionCookie,
      expectPendingPhaseRequest,
    });

    printSummary(summary);

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Postdeploy smoke run failed."
    );
    process.exitCode = 1;
  }
}

const isCliExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliExecution) {
  void runCli();
}
