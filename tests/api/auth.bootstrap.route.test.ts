import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionUser } from "../helpers/security-fixtures";

const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

import { POST } from "@/app/api/auth/bootstrap/route";

describe("auth bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated session", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is required.",
    });

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authenticated session is required.",
    });
  });

  it("returns 403 when the authenticated account is not provisioned in Traxium", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "USER_NOT_PROVISIONED",
      message:
        "Your account is authenticated, but no Traxium workspace user is provisioned for this email.",
    });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your account is authenticated, but no Traxium workspace user is provisioned for this email.",
    });
  });

  it("returns the resolved workspace user when bootstrap succeeds", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: true,
      user: createSessionUser(),
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      repaired: true,
      user: createSessionUser(),
    });
  });

  it("returns 500 JSON when bootstrap throws unexpectedly", async () => {
    bootstrapCurrentUserMock.mockRejectedValueOnce(new Error("Missing User.activeOrganizationId column"));

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing User.activeOrganizationId column",
    });
  });
});
