import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { loginAs } from "./support/auth";
import { E2E_FOREIGN_WORKSPACE_SLUG, personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("fresh workspace creates its first saving card with inline master data", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const watchdog = installRuntimeWatchdog(page);
  await loginAs(page, personas.foreignOwner);

  await page.goto("/onboarding");
  await expect(
    page.getByRole("link", { name: "Create first saving card" }).first()
  ).toBeVisible();
  await watchdog.checkpoint("fresh workspace onboarding");

  await page.goto("/saving-cards/new");
  await page.getByPlaceholder("Enter initiative title").fill("E2E resin recovery");
  await page
    .getByPlaceholder(
      "Summarize the sourcing opportunity, business case, and expected impact."
    )
    .fill("Renegotiate resin pricing against the current annual demand baseline.");
  await page.getByPlaceholder("Enter first buyer name").fill("E2E Buyer");
  await page
    .getByPlaceholder("Enter first current supplier name")
    .fill("E2E Supplier");
  await page
    .getByPlaceholder("Enter first current material name")
    .fill("E2E Resin");
  await page.getByPlaceholder("Enter first category name").fill("E2E Resins");
  await page.getByRole("button", { name: "Next" }).click();

  const financialInputs = page.locator('input[type="number"]');
  await expect(financialInputs).toHaveCount(4);
  await financialInputs.nth(0).fill("12");
  await financialInputs.nth(1).fill("10");
  await financialInputs.nth(2).fill("10000");
  await financialInputs.nth(3).fill("1");
  await expect(page.getByText("Calculated Savings: €20k")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByPlaceholder("Enter first plant name").fill("E2E Plant");
  await page
    .getByPlaceholder("Enter first business unit name")
    .fill("E2E Components");
  const dateInputs = page.locator('input[type="date"]');
  await expect(dateInputs).toHaveCount(4);
  await dateInputs.nth(0).fill("2026-06-01");
  await dateInputs.nth(1).fill("2026-12-31");
  await dateInputs.nth(2).fill("2026-07-01");
  await dateInputs.nth(3).fill("2027-06-30");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/saving-cards\/[^/?]+\?created=1$/, {
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", { name: "E2E resin recovery" })
  ).toBeVisible();
  await expect(page.getByText("First saving card created")).toBeVisible();
  await expect(page.getByRole("link", { name: "Attach evidence" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request validation" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open dashboard" })).toBeVisible();
  await watchdog.checkpoint("first saving card detail");

  const workspace = await prisma.organization.findUnique({
    where: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
    select: {
      savingCards: {
        where: { title: "E2E resin recovery" },
        select: {
          calculatedSavings: true,
          phase: true,
          buyer: { select: { name: true } },
          supplier: { select: { name: true } },
          material: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
  });
  expect(workspace?.savingCards).toEqual([
    expect.objectContaining({
      calculatedSavings: 20_000,
      phase: "IDEA",
      buyer: { name: "E2E Buyer" },
      supplier: { name: "E2E Supplier" },
      material: { name: "E2E Resin" },
      category: { name: "E2E Resins" },
    }),
  ]);

  await page.getByRole("link", { name: "Open dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("€20k").first()).toBeVisible();
  await watchdog.checkpoint("first card reflected on dashboard");
});
