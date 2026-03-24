import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSessionUser } from "./helpers/security-fixtures";

const getUserMock = vi.hoisted(() => vi.fn());
const createServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { middleware } from "@/middleware";

describe("middleware auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");

    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not redirect /login when a Supabase session exists", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: createAuthSessionUser() },
      error: null,
    });

    const response = await middleware(new NextRequest("http://localhost:3000/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated protected requests to /login", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await middleware(new NextRequest("http://localhost:3000/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
