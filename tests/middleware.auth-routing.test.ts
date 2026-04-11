import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import { config, middleware } from "@/middleware";

describe("middleware auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates every request to updateSession without adding auth redirects", async () => {
    const response = NextResponse.next();
    updateSessionMock.mockResolvedValueOnce(response);
    const request = new NextRequest("http://localhost:3000/dashboard");

    await expect(middleware(request)).resolves.toBe(response);
    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });

  it("does not special-case public auth routes in middleware anymore", async () => {
    const response = NextResponse.next();
    updateSessionMock.mockResolvedValueOnce(response);
    const request = new NextRequest("http://localhost:3000/login");

    await expect(middleware(request)).resolves.toBe(response);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });

  it("keeps the existing matcher unchanged", () => {
    expect(config).toEqual({
      matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
      ],
    });
  });
});
