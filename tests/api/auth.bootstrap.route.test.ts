import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionUser } from "../helpers/security-fixtures";

const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

import { POST } from "@/app/api/auth/bootstrap/route";

describe("auth bootstrap route", () => {
  const request = new Request("http://localhost/api/auth/bootstrap", {
    method: "POST",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated session", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is required.",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authenticated session is required.",
      code: "UNAUTHENTICATED",
    });
  });

  it("returns 403 when the authenticated account should continue into workspace onboarding", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message:
        "Your account is authenticated but does not yet belong to a Traxium workspace.",
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your account is authenticated but does not yet belong to a Traxium workspace.",
      code: "ORGANIZATION_ACCESS_REQUIRED",
    });
  });

  it("returns 403 when the account is authenticated but has no active organization membership", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your account is not an active member of any Traxium organization.",
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Your account is not an active member of any Traxium organization.",
      code: "ORGANIZATION_ACCESS_REQUIRED",
    });
  });

  it("returns 402 when the authenticated workspace is billing-blocked", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "BILLING_REQUIRED",
      message:
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
      accessState: {
        accessState: "blocked_unpaid",
        reasonCode: "unpaid",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
      code: "BILLING_REQUIRED",
      accessState: "blocked_unpaid",
      reasonCode: "unpaid",
      billingRequiredPath: "/billing-required",
    });
  });

  it("returns the resolved workspace user when bootstrap succeeds", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: true,
      user: createSessionUser(),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      repaired: true,
      user: createSessionUser(),
    });
  });

  it("returns 500 JSON when bootstrap throws unexpectedly", async () => {
    bootstrapCurrentUserMock.mockRejectedValueOnce(new Error("Missing User.activeOrganizationId column"));

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing User.activeOrganizationId column",
    });
  });
});
