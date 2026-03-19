import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getCommandCenterDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/data", () => ({
  getCommandCenterData: getCommandCenterDataMock,
}));

import { GET as getCommandCenterRoute } from "@/app/api/command-center/route";

describe("command center API route", () => {
  beforeEach(() => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
  });

  it("returns 401 JSON for unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);

    const response = await getCommandCenterRoute(new Request("http://localhost/api/command-center"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(getCommandCenterDataMock).not.toHaveBeenCalled();
  });

  it("returns 400 for duplicate query parameters", async () => {
    const response = await getCommandCenterRoute(
      new Request("http://localhost/api/command-center?buyerId=buyer-1&buyerId=buyer-2")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Query parameter "buyerId" must only be provided once.',
    });
    expect(getCommandCenterDataMock).not.toHaveBeenCalled();
  });

  it("returns the analytics payload on success", async () => {
    getCommandCenterDataMock.mockResolvedValueOnce({
      filters: { buyerId: "buyer-1" },
      kpis: {
        totalPipelineSavings: 100,
        realisedSavings: 20,
        achievedSavings: 10,
        savingsForecast: 40,
        activeProjects: 3,
        pendingApprovals: 1,
      },
      pipelineByPhase: [],
      forecastCurve: [],
      topSuppliers: [],
      benchmarkOpportunities: [],
      savingsByRiskLevel: [],
      savingsByQualificationStatus: [],
    });

    const response = await getCommandCenterRoute(
      new Request("http://localhost/api/command-center?buyerId=buyer-1")
    );

    expect(getCommandCenterDataMock).toHaveBeenCalledWith("org-1", { buyerId: "buyer-1" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      filters: { buyerId: "buyer-1" },
      kpis: {
        totalPipelineSavings: 100,
        realisedSavings: 20,
        achievedSavings: 10,
        savingsForecast: 40,
        activeProjects: 3,
        pendingApprovals: 1,
      },
      pipelineByPhase: [],
      forecastCurve: [],
      topSuppliers: [],
      benchmarkOpportunities: [],
      savingsByRiskLevel: [],
      savingsByQualificationStatus: [],
    });
  });
});
