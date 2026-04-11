import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionUser } from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import BillingReturnPage from "@/app/settings/billing/page";

function createBlockedBillingResult() {
  return {
    ok: false as const,
    code: "BILLING_REQUIRED" as const,
    message:
      "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
    accessState: {
      accessState: "blocked_unpaid",
      reasonCode: "unpaid",
    },
  };
}

describe("settings billing return page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects restored subscriptions to the dashboard", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser(),
    });

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({ checkout: "success" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("routes successful Stripe returns back into billing recovery processing when the workspace is still blocked", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({ checkout: "success" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required?recovery=processing");
  });

  it("routes cancelled checkout returns back into billing recovery", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({ checkout: "cancelled" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required?recovery=checkout_cancelled");
  });

  it("redirects blocked workspace returns without checkout state to the billing-required page", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required");
  });
});
