import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const prisma = new PrismaClient();
const workEmail = "traxium.e2e.pilot@example.com";

test.beforeEach(async () => {
  await prisma.pilotLead.deleteMany({ where: { workEmail } });
});

test.afterAll(async () => {
  await prisma.pilotLead.deleteMany({ where: { workEmail } });
  await prisma.$disconnect();
});

test("public CTA validates and persists a paid-pilot request without provisioning access", async ({
  page,
}) => {
  const watchdog = installRuntimeWatchdog(page);
  const userCountBefore = await prisma.user.count();
  const workspaceCountBefore = await prisma.organization.count();

  await page.goto("/");
  await page.getByRole("link", { name: "Request paid pilot" }).first().click();
  await expect(page).toHaveURL(/\/pilot$/);

  await page.getByRole("button", { name: "Request paid pilot" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Work email *").fill("not-an-email");
  await page.getByRole("button", { name: "Request paid pilot" }).click();
  await expect(page.getByText("Enter a valid work email.")).toBeVisible();

  await page.getByLabel("Full name *").fill("E2E Procurement Lead");
  await page.getByLabel("Work email *").fill(workEmail);
  await page.getByLabel("Company name *").fill("Runtime Manufacturing LLC");
  await page.getByLabel("Job title").fill("Procurement Manager");
  await page.getByLabel("Company size").selectOption("100-249");
  await page.getByLabel("Industry").selectOption("manufacturing");
  await page
    .getByLabel("How do you track procurement savings today?")
    .selectOption("excel");
  await page
    .getByLabel("Biggest savings review or reporting pain")
    .fill("Finance cannot trace assumptions to evidence.");
  await page.getByLabel("Pilot timing").selectOption("0-30_days");
  await page.getByRole("button", { name: "Request paid pilot" }).click();

  await expect(page.getByText("Request received")).toBeVisible();
  await expect(
    page.getByText("No account or workspace has been created.")
  ).toBeVisible();
  await watchdog.checkpoint("paid-pilot lead submission");

  await expect
    .poll(() => prisma.pilotLead.count({ where: { workEmail } }))
    .toBe(1);
  expect(await prisma.user.count()).toBe(userCountBefore);
  expect(await prisma.organization.count()).toBe(workspaceCountBefore);

  const duplicateResponse = await page.request.post("/api/pilot-leads", {
    data: {
      fullName: "E2E Procurement Lead",
      workEmail,
      companyName: "Runtime Manufacturing LLC",
      hasSavingsTracker: false,
      websiteUrl: "",
    },
  });
  expect(duplicateResponse.status()).toBe(200);
  expect(await prisma.pilotLead.count({ where: { workEmail } })).toBe(1);

  const honeypotResponse = await page.request.post("/api/pilot-leads", {
    headers: { "x-forwarded-for": "198.51.100.211" },
    data: {
      fullName: "Automated Bot",
      workEmail: "traxium.e2e.bot@example.com",
      companyName: "Bot Company",
      hasSavingsTracker: false,
      websiteUrl: "https://spam.example",
    },
  });
  expect(honeypotResponse.status()).toBe(200);
  expect(
    await prisma.pilotLead.count({
      where: { workEmail: "traxium.e2e.bot@example.com" },
    })
  ).toBe(0);

  const limitedStatuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await page.request.post("/api/pilot-leads", {
      headers: { "x-forwarded-for": "198.51.100.212" },
      data: {
        fullName: "Rate Limit Bot",
        workEmail: "traxium.e2e.rate-limit@example.com",
        companyName: "Rate Limit Bot Company",
        hasSavingsTracker: false,
        websiteUrl: "https://spam.example",
      },
    });
    limitedStatuses.push(response.status());
  }
  expect(limitedStatuses).toEqual([200, 200, 200, 200, 200, 429]);
});
