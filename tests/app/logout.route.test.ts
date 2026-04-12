import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

import { GET, POST } from "@/app/logout/route";

describe("logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    });
  });

  it("supports GET logout for direct clickable navigation", async () => {
    const response = await GET(new Request("http://localhost/logout"));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("continues to support POST logout", async () => {
    const response = await POST(new Request("http://localhost/logout"));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
