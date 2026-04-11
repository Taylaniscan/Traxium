import { MembershipStatus, OrganizationRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const loadFirstValueSampleDataMock = vi.hoisted(() => vi.fn());
const trackEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/first-value", () => ({
  FirstValueError: class MockFirstValueError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 401 | 403 | 404 | 409 = 400
    ) {
      super(message);
      this.name = "FirstValueError";
    }
  },
  loadFirstValueSampleData: loadFirstValueSampleDataMock,
}));

vi.mock("@/lib/analytics", () => ({
  analyticsEventNames: {
    WORKSPACE_SAMPLE_DATA_LOADED: "workspace.sample_data_loaded",
  },
  trackEvent: trackEventMock,
}));

import { POST } from "@/app/api/onboarding/sample-data/route";

describe("sample data telemetry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthGuardErrorResponseMock.mockReturnValue(null);
  });

  it("emits workspace.sample_data_loaded with tenant-scoped metadata", async () => {
    requireUserMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    loadFirstValueSampleDataMock.mockResolvedValueOnce({
      organizationId: DEFAULT_ORGANIZATION_ID,
      createdCardsCount: 2,
      createdSavingCards: [
        {
          id: "card-1",
          title: "PET Resin Renegotiation Wave 1",
          phase: "VALIDATED",
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/onboarding/sample-data", {
        method: "POST",
      })
    );

    expect(response.status).toBe(201);
    expect(trackEventMock).toHaveBeenCalledWith({
      event: "workspace.sample_data_loaded",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        createdCardsCount: 2,
      },
    });
  });
});
