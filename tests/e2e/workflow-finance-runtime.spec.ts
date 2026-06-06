import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { loginAs, logout } from "./support/auth";
import { E2E_FOREIGN_WORKSPACE_SLUG, personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("phase approval requires assigned roles and finance lock disables assumptions", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const workspace = await prisma.organization.findUnique({
    where: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
    select: {
      savingCards: {
        where: { title: "E2E resin recovery" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const cardId = workspace?.savingCards[0]?.id;
  expect(cardId, "first-value runtime card must exist").toBeTruthy();

  await loginAs(page, personas.foreignOwner);
  const requestResponse = await page.request.post("/api/phase-change-request", {
    data: {
      savingCardId: cardId,
      requestedPhase: "VALIDATED",
      comment: "Ready for finance validation.",
    },
  });
  expect(requestResponse.status()).toBe(201);
  const request = (await requestResponse.json()) as { id: string };

  await logout(page);
  await loginAs(page, personas.normalMember);
  const wrongRoleResponse = await page.request.post(
    "/api/approve-phase-change",
    {
      data: {
        requestId: request.id,
        approved: true,
        comment: "Unauthorized approval attempt.",
      },
    }
  );
  expect(wrongRoleResponse.status()).toBe(403);

  await logout(page);
  await loginAs(page, personas.foreignOwner);
  const procurementApproval = await page.request.post(
    "/api/approve-phase-change",
    {
      data: {
        requestId: request.id,
        approved: true,
        comment: "Procurement approval.",
      },
    }
  );
  expect(procurementApproval.status()).toBe(200);
  expect((await procurementApproval.json()).approvalStatus).toBe("PENDING");

  await logout(page);
  await loginAs(page, personas.financeMember);
  const financeApproval = await page.request.post("/api/approve-phase-change", {
    data: {
      requestId: request.id,
      approved: true,
      comment: "Finance approval.",
    },
  });
  expect(financeApproval.status()).toBe(200);
  expect((await financeApproval.json()).approvalStatus).toBe("APPROVED");

  const financeLock = await page.request.post(`/api/saving-cards/${cardId}`, {
    data: {
      action: "finance-lock",
      locked: true,
    },
  });
  expect(financeLock.status()).toBe(200);

  await page.goto(`/saving-cards/${cardId}/edit`);
  await expect(page.getByText("Finance lock active").first()).toBeVisible();
  for (const input of await page.locator('input[type="number"]').all()) {
    await expect(input).toBeDisabled();
  }
  const watchdog = installRuntimeWatchdog(page);
  await watchdog.checkpoint("finance-locked saving card edit");

  const persisted = await prisma.savingCard.findFirst({
    where: {
      id: cardId,
      organization: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
    },
    select: {
      phase: true,
      financeLocked: true,
      phaseHistory: { select: { toPhase: true } },
      phaseChangeRequests: {
        where: { id: request.id },
        select: {
          approvalStatus: true,
          approvals: { select: { status: true } },
        },
      },
    },
  });
  expect(persisted).toEqual(
    expect.objectContaining({
      phase: "VALIDATED",
      financeLocked: true,
    })
  );
  expect(persisted?.phaseHistory.some((item) => item.toPhase === "VALIDATED")).toBe(
    true
  );
  expect(persisted?.phaseChangeRequests[0]).toEqual({
    approvalStatus: "APPROVED",
    approvals: expect.arrayContaining([
      { status: "APPROVED" },
      { status: "APPROVED" },
    ]),
  });
});
