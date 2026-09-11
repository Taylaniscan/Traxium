import { expect, test } from "@playwright/test";

import { loginAs, logout } from "./support/auth";
import { personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const publicRoutes = [
  {
    path: "/",
    expected: "Finance-trusted savings governance for US manufacturing SMEs.",
  },
  {
    path: "/pilot",
    expected: "Request a guided Traxium paid pilot",
  },
  {
    path: "/trust",
    expected: "Trust & security for guided pilots",
  },
  {
    path: "/login",
    expected: "Sign in to Traxium",
  },
  {
    path: "/forgot-password",
    expected: "Reset your password",
  },
] as const;

const protectedRoutes = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/saving-cards", heading: "Saving Cards" },
  { path: "/saving-cards/new", heading: "New Saving Card" },
  { path: "/kanban", heading: "Kanban Board" },
  { path: "/open-actions", heading: "Open Actions" },
  { path: "/command-center", heading: "Command Center" },
  { path: "/timeline", heading: "Timeline" },
  { path: "/reports", heading: "Reports" },
  { path: "/admin/members", heading: "Members" },
  { path: "/admin/settings", heading: "Workspace Settings" },
  { path: "/settings/billing", heading: "Workspace billing" },
] as const;

test("public primary routes render without runtime failures", async ({ page }) => {
  const watchdog = installRuntimeWatchdog(page);

  for (const route of publicRoutes) {
    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} returned an unexpected status`).toBe(
      200
    );
    await expect(page.getByText(route.expected, { exact: false })).toBeVisible();
    await watchdog.checkpoint(route.path);
  }

  await page.goto("/request-demo");
  await expect(page).toHaveURL(/\/pilot$/);
  await expect(
    page.getByRole("heading", { name: "Request a guided Traxium paid pilot" })
  ).toBeVisible();
  await watchdog.checkpoint("/request-demo intended redirect");
});

test("owner can render every protected primary route cleanly", async ({ page }) => {
  test.setTimeout(300_000);
  const watchdog = installRuntimeWatchdog(page);
  await loginAs(page, personas.owner);
  await watchdog.checkpoint("owner login");

  for (const route of protectedRoutes) {
    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} returned an unexpected status`).toBe(
      200
    );
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }).last()
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}$`));
    await watchdog.checkpoint(route.path);
  }

  const onboardingResponse = await page.goto("/onboarding");
  expect(onboardingResponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", {
      name: "Set up UtopiaTrax for first value",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create first saving card", exact: true }).first()
  ).toBeVisible();
  await watchdog.checkpoint("/onboarding");

  await page.getByRole("link", { name: "Saving Cards", exact: true }).click();
  await expect(page).toHaveURL(/\/saving-cards$/);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await watchdog.checkpoint("client-side primary navigation");
});

test("logout clears the session and protected routes redirect to login", async ({
  page,
}) => {
  const watchdog = installRuntimeWatchdog(page, {
    allowedAbortedGetPaths: ["/api/pending-approvals"],
  });
  await loginAs(page, personas.owner);
  await logout(page);
  await expect(page.getByText("Sign in to Traxium")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await watchdog.checkpoint("logout and protected redirect");
});
