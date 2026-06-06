import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./support/auth";
import { personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

async function assertMemberRestrictions(
  page: Page,
  persona: { email: string; password: string }
) {
  const watchdog = installRuntimeWatchdog(page);
  await loginAs(page, persona);

  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/billing");
  await expect(
    page.getByText("Billing is managed by workspace owners and admins.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /manage billing|open billing|start subscription/i })
  ).toHaveCount(0);

  const memberResponse = await page.request.get("/api/admin/members");
  expect(memberResponse.status()).toBe(403);

  const inviteResponse = await page.request.post("/api/invitations", {
    data: {
      email: `blocked-${Date.now()}@example.com`,
      role: "MEMBER",
    },
  });
  expect(inviteResponse.status()).toBe(403);

  const billingResponse = await page.request.post("/billing/recover", {
    form: {
      intent: "open_billing_portal",
    },
    maxRedirects: 0,
  });
  expect(billingResponse.status()).toBe(303);
  expect(billingResponse.headers().location).toContain(
    "recovery=admin_required"
  );
  await watchdog.checkpoint(`member restrictions for ${persona.email}`);
}

test("Owner/Admin can reach member and billing administration", async ({ page }) => {
  const watchdog = installRuntimeWatchdog(page);
  await loginAs(page, personas.owner);

  await page.goto("/admin/members");
  await expect(
    page.getByRole("heading", { name: "Members", exact: true })
  ).toBeVisible();

  await page.goto("/settings/billing");
  await expect(
    page.getByRole("heading", { name: "Workspace billing", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Billing & subscription")).toBeVisible();
  await watchdog.checkpoint("owner admin and billing access");
});

test("Finance Reviewer without admin membership cannot mutate admin or billing", async ({
  page,
}) => {
  await assertMemberRestrictions(page, personas.financeMember);

  const settingsResponse = await page.request.patch("/api/admin/settings", {
    data: {
      name: "Unauthorized finance rename",
      description: "This must not be applied.",
    },
  });
  expect(settingsResponse.status()).toBe(403);
});

test("Category Owner membership cannot manage users or billing", async ({ page }) => {
  await assertMemberRestrictions(page, personas.categoryOwner);
});

test("Buyer membership cannot manage users or billing", async ({ page }) => {
  await assertMemberRestrictions(page, personas.buyer);
});

test("Normal Member cannot manage users, settings, or billing", async ({ page }) => {
  await assertMemberRestrictions(page, personas.normalMember);

  const settingsResponse = await page.request.patch("/api/admin/settings", {
    data: {
      name: "Unauthorized member rename",
      description: "This must not be applied.",
    },
  });
  expect(settingsResponse.status()).toBe(403);
});

test("unauthenticated visitor is denied protected pages and mutation APIs", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);

  const response = await page.request.post("/api/saving-cards", {
    data: {},
  });
  expect(response.status()).toBe(401);
});
