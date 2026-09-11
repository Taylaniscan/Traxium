import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

import { loginAs } from "./support/auth";
import { personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("foreign workspace cannot read, mutate, download, or export UtopiaTrax data", async ({
  page,
}) => {
  const target = await prisma.organization.findUnique({
    where: { slug: "utopiatrax" },
    select: {
      savingCards: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          title: true,
          evidence: {
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  const targetCard = target?.savingCards[0];

  expect(targetCard, "UtopiaTrax target card must exist").toBeTruthy();
  const watchdog = installRuntimeWatchdog(page);
  await loginAs(page, personas.foreignOwner);

  const listResponse = await page.request.get("/api/saving-cards");
  expect(listResponse.status()).toBe(200);
  const listPayload = (await listResponse.json()) as Array<{ title?: string }>;
  expect(listPayload.some((card) => card.title === targetCard?.title)).toBe(false);

  const detailResponse = await page.goto(`/saving-cards/${targetCard?.id}`);
  expect(detailResponse?.status()).toBe(404);
  await expect(page.getByText(targetCard?.title ?? "__missing__")).toHaveCount(0);

  const financeLockResponse = await page.request.post(
    `/api/saving-cards/${targetCard?.id}`,
    {
      data: {
        action: "finance-lock",
        locked: true,
      },
    }
  );
  expect(financeLockResponse.status()).toBe(404);
  expect(await financeLockResponse.text()).not.toContain(targetCard?.title ?? "");

  const phaseResponse = await page.request.post("/api/phase-change-request", {
    data: {
      savingCardId: targetCard?.id,
      requestedPhase: "VALIDATED",
      comment: "Cross-tenant attack",
    },
  });
  expect(phaseResponse.status()).toBe(404);
  expect(await phaseResponse.text()).not.toContain(targetCard?.title ?? "");

  const evidenceId = targetCard?.evidence[0]?.id;
  expect(evidenceId, "UtopiaTrax evidence target must exist").toBeTruthy();
  const evidenceResponse = await page.request.get(
    `/api/evidence/${evidenceId}/download`,
    {
      maxRedirects: 0,
    }
  );
  expect(evidenceResponse.status()).toBe(404);
  expect(await evidenceResponse.text()).not.toContain("storagePath");
  expect(await evidenceResponse.text()).not.toContain("storageBucket");

  const exportResponse = await page.request.get("/api/export");
  expect(exportResponse.status()).toBe(200);
  const workbook = XLSX.read(await exportResponse.body(), { type: "buffer" });
  const savingCardsSheet = workbook.Sheets["Saving Cards"];
  expect(savingCardsSheet).toBeTruthy();
  const exportedText = JSON.stringify(
    XLSX.utils.sheet_to_json(savingCardsSheet, { header: 1 })
  );
  expect(exportedText).not.toContain(targetCard?.title ?? "");
  expect(exportedText).not.toContain("storagePath");
  expect(exportedText).not.toContain("storageBucket");
  expect(exportedText).not.toContain("signedUrl");

  await watchdog.checkpoint("foreign tenant attack suite", {
    allowedFailures: [
      /^console\.error: Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
    ],
  });
});
