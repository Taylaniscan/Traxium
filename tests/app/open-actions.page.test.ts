import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import OpenActionsPage from "@/app/(app)/open-actions/page";

describe("open actions page (legacy redirect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects the old open-actions route to the action center", async () => {
    await OpenActionsPage({ searchParams: Promise.resolve({}) });
    expect(redirectMock).toHaveBeenCalledWith("/command-center");
  });

  it("preserves the all-actions view when redirecting", async () => {
    await OpenActionsPage({ searchParams: Promise.resolve({ view: "all" }) });
    expect(redirectMock).toHaveBeenCalledWith("/command-center?view=all");
  });
});
