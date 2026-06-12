import { beforeEach, describe, expect, it, vi } from "vitest";

const getJobRunnerSecretMock = vi.hoisted(() => vi.fn());
const registerDefaultJobHandlersMock = vi.hoisted(() => vi.fn());
const runJobLoopMock = vi.hoisted(() => vi.fn());
const recordJobRunnerHeartbeatMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  getJobRunnerSecret: getJobRunnerSecretMock,
}));

vi.mock("@/lib/job-handlers", () => ({
  registerDefaultJobHandlers: registerDefaultJobHandlersMock,
}));

vi.mock("@/lib/job-runner", () => ({
  runJobLoop: runJobLoopMock,
}));

vi.mock("@/lib/jobs", () => ({
  recordJobRunnerHeartbeat: recordJobRunnerHeartbeatMock,
}));

vi.mock("@/lib/observability", () => ({
  trackServerEvent: vi.fn(),
  captureException: vi.fn(),
  createRouteObservabilityContext: vi.fn(() => ({})),
}));

import { GET, POST } from "@/app/api/jobs/run/route";

const SECRET = "job-runner-secret-123";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/jobs/run", { headers });
}

describe("/api/jobs/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJobRunnerSecretMock.mockReturnValue(SECRET);
    runJobLoopMock.mockResolvedValue({ processedJobs: 3, idle: true });
    recordJobRunnerHeartbeatMock.mockResolvedValue(undefined);
  });

  it("rejects a request with no secret", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(runJobLoopMock).not.toHaveBeenCalled();
    expect(recordJobRunnerHeartbeatMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(request({ authorization: "Bearer wrong-secret" }));

    expect(response.status).toBe(401);
    expect(runJobLoopMock).not.toHaveBeenCalled();
  });

  it("is disabled (503) when no secret is configured", async () => {
    getJobRunnerSecretMock.mockReturnValue("");

    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(503);
    expect(runJobLoopMock).not.toHaveBeenCalled();
  });

  it("processes queued jobs with a valid Bearer secret and records a heartbeat", async () => {
    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(registerDefaultJobHandlersMock).toHaveBeenCalledTimes(1);
    expect(runJobLoopMock).toHaveBeenCalledTimes(1);
    expect(body.processedJobs).toBe(3);
    expect(recordJobRunnerHeartbeatMock).toHaveBeenCalledWith(
      expect.objectContaining({ processedJobs: 3 })
    );
  });

  it("also accepts the x-job-runner-secret header", async () => {
    const response = await POST(request({ "x-job-runner-secret": SECRET }));

    expect(response.status).toBe(200);
    expect(runJobLoopMock).toHaveBeenCalledTimes(1);
  });

  it("runs a bounded pass that respects max-jobs and max-duration budgets", async () => {
    await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(runJobLoopMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxJobs: 25,
        maxDurationMs: 50_000,
        stopWhenIdle: true,
      })
    );
  });
});
