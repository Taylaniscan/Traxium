import { expect, test } from "@playwright/test";

import { loginAs } from "./support/auth";
import { personas } from "./support/personas";

test("mutation APIs reject unauthenticated, malformed, and unsupported requests", async ({
  page,
}) => {
  for (const probe of [
    page.request.post("/api/saving-cards", { data: {} }),
    page.request.patch("/api/admin/settings", { data: {} }),
    page.request.post("/api/upload/evidence", { data: {} }),
  ]) {
    expect((await probe).status()).toBe(401);
  }

  const malformedJson = await page.request.post("/api/pilot-leads", {
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.221",
    },
    data: "malformed JSON",
  });
  expect(malformedJson.status()).toBe(400);

  const unexpectedField = await page.request.post("/api/pilot-leads", {
    headers: { "x-forwarded-for": "198.51.100.222" },
    data: {
      fullName: "Fuzz Tester",
      workEmail: "fuzz@example.com",
      companyName: "Fuzz Manufacturing",
      hasSavingsTracker: false,
      websiteUrl: "",
      unexpectedField: true,
    },
  });
  expect(unexpectedField.status()).toBe(400);

  const unsupportedMethod = await page.request.fetch("/api/pilot-leads", {
    method: "PUT",
    data: {},
  });
  expect(unsupportedMethod.status()).toBe(405);
});

test("authenticated APIs reject invalid IDs, enums, and traversal-shaped paths", async ({
  page,
}) => {
  await loginAs(page, personas.owner);

  const invalidEvidenceId = await page.request.get(
    "/api/evidence/not-a-valid-id/download"
  );
  expect(invalidEvidenceId.status()).toBe(422);

  const invalidPhase = await page.request.post("/api/phase-change-request", {
    data: {
      savingCardId: "not-a-valid-id",
      requestedPhase: "DROP_TABLE",
      comment: "fuzz",
    },
  });
  expect(invalidPhase.status()).toBe(400);

  const traversal = await page.request.get(
    "/api/evidence/%2F..%2Fsecrets/download",
    { maxRedirects: 0 }
  );
  expect([404, 422]).toContain(traversal.status());
  expect(await traversal.text()).not.toMatch(/storagePath|storageBucket|service_role/i);
});
