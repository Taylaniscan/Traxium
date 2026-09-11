import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TimelinePage from "@/app/(app)/timeline/page";

describe("timeline page (legacy redirect)", () => {
  it("redirects the old timeline route to the reports timeline view", () => {
    TimelinePage();
    expect(redirectMock).toHaveBeenCalledWith("/reports/timeline");
  });
});
