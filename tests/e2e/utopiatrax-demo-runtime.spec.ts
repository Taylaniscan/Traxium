import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

import { UTOPIATRAX_SHOWCASE_CARD_TITLE } from "../../scripts/utopiatrax-demo-contract";
import { loginAs } from "./support/auth";
import { personas } from "./support/personas";
import { installRuntimeWatchdog } from "./support/runtime-watchdog";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("UtopiaTrax demo routes are populated and controller outputs are usable", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const watchdog = installRuntimeWatchdog(page);
  const workspace = await prisma.organization.findUnique({
    where: { slug: "utopiatrax" },
    select: {
      savingCards: {
        where: { title: UTOPIATRAX_SHOWCASE_CARD_TITLE },
        select: {
          id: true,
          title: true,
          evidence: {
            orderBy: { uploadedAt: "asc" },
            take: 1,
            select: { id: true, fileName: true },
          },
        },
      },
    },
  });
  const showcase = workspace?.savingCards[0];
  const evidence = showcase?.evidence[0];
  expect(showcase).toBeTruthy();
  expect(evidence).toBeTruthy();

  await loginAs(page, personas.owner);

  await page.goto("/dashboard");
  await expect(page.getByText("No live saving cards yet.")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-chart-frame="Savings by Phase"]')).toBeVisible();
  await expect(
    page.locator('[data-dashboard-chart-frame="Savings by Phase"] svg')
  ).toBeVisible();
  await watchdog.checkpoint("UtopiaTrax dashboard");

  await page.goto("/saving-cards");
  await expect(page.getByText(UTOPIATRAX_SHOWCASE_CARD_TITLE)).toBeVisible();
  await watchdog.checkpoint("UtopiaTrax saving cards");

  await page.goto(`/saving-cards/${showcase?.id}`);
  await expect(
    page.getByRole("heading", { name: UTOPIATRAX_SHOWCASE_CARD_TITLE })
  ).toBeVisible();
  await expect(page.getByText(evidence?.fileName ?? "__missing__")).toBeVisible();
  await watchdog.checkpoint("UtopiaTrax showcase detail");

  const evidenceResponse = await page.request.get(
    `/api/evidence/${evidence?.id}/download`
  );
  expect(evidenceResponse.status()).toBe(200);
  expect((await evidenceResponse.body()).byteLength).toBeGreaterThan(0);

  for (const route of ["/open-actions", "/command-center", "/timeline", "/reports"]) {
    await page.goto(route);
    await expect(page.locator("main, body")).not.toContainText(
      /No live saving cards yet|No open actions|No timeline data|Reporting is ready to launch/i
    );
    await watchdog.checkpoint(`UtopiaTrax ${route}`);
  }

  const exportResponse = await page.request.get("/api/export");
  expect(exportResponse.status()).toBe(200);
  const workbook = XLSX.read(await exportResponse.body(), { type: "buffer" });
  expect(workbook.SheetNames).toEqual(
    expect.arrayContaining([
      "Portfolio Summary",
      "Saving Cards",
      "Data Dictionary",
      "Import Template",
    ])
  );
  const exportedText = JSON.stringify(
    workbook.SheetNames.map((sheetName) =>
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })
    )
  );
  expect(exportedText).toContain(UTOPIATRAX_SHOWCASE_CARD_TITLE);
  expect(exportedText).not.toContain("storagePath");
  expect(exportedText).not.toContain("storageBucket");
  expect(exportedText).not.toContain("signedUrl");
});
