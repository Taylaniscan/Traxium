import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma, UsageFeature, UsageWindow } from "@prisma/client";
import { describe, expect, it } from "vitest";

function getSchemaContents() {
  return readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
}

function getModel(name: string) {
  const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);

  if (!model) {
    throw new Error(`Model ${name} not found in Prisma DMMF.`);
  }

  return model;
}

function getField(modelName: string, fieldName: string) {
  const field = getModel(modelName).fields.find((candidate) => candidate.name === fieldName);

  if (!field) {
    throw new Error(`Field ${modelName}.${fieldName} not found in Prisma DMMF.`);
  }

  return field;
}

describe("Usage schema", () => {
  it("relates append-only usage events back to an organization", () => {
    const usageEventModel = getModel("UsageEvent");
    const organizationUsageEvents = getField("Organization", "usageEvents");
    const createdAtField = getField("UsageEvent", "createdAt");

    expect(usageEventModel.uniqueFields).not.toContainEqual([
      "organizationId",
      "feature",
      "window",
      "periodStart",
      "periodEnd",
    ]);
    expect(organizationUsageEvents).toMatchObject({
      kind: "object",
      type: "UsageEvent",
      isList: true,
    });
    expect(getField("UsageEvent", "organization")).toMatchObject({
      kind: "object",
      type: "Organization",
      isRequired: true,
    });
    expect(createdAtField).toMatchObject({
      kind: "scalar",
      type: "DateTime",
      isRequired: true,
      hasDefaultValue: true,
    });
  });

  it("protects usage counters with a single row per organization, feature, window, and period", () => {
    const schema = getSchemaContents();
    const usageCounterModel = getModel("UsageCounter");

    expect(usageCounterModel.uniqueIndexes).toContainEqual({
      name: null,
      fields: ["organizationId", "feature", "window", "periodStart", "periodEnd"],
    });
    expect(schema).toContain(
      "@@unique([organizationId, feature, window, periodStart, periodEnd])"
    );
    expect(schema).toContain(
      "@@index([organizationId, feature, window, periodStart])"
    );
  });

  it("stores quota snapshots for manual organization limits", () => {
    const schema = getSchemaContents();
    const quotaSnapshotModel = getModel("QuotaSnapshot");
    const limitQuantityField = getField("QuotaSnapshot", "limitQuantity");
    const sourceField = getField("QuotaSnapshot", "source");

    expect(quotaSnapshotModel.uniqueIndexes).toContainEqual({
      name: null,
      fields: ["organizationId", "feature", "window", "periodStart", "periodEnd"],
    });
    expect(limitQuantityField).toMatchObject({
      kind: "scalar",
      type: "Int",
      isRequired: false,
    });
    expect(sourceField).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      hasDefaultValue: true,
    });
    expect(schema).toContain('source         String       @default("manual")');
  });

  it("defines feature and window enums for usage enforcement and reporting", () => {
    expect(Object.values(UsageFeature)).toEqual([
      "SAVING_CARDS",
      "ACTIVE_MEMBERS",
      "INVITATIONS_SENT",
      "EVIDENCE_UPLOADS",
      "API_REQUESTS",
      "JOB_EXECUTIONS",
    ]);
    expect(Object.values(UsageWindow)).toEqual([
      "LIFETIME",
      "DAY",
      "WEEK",
      "MONTH",
      "QUARTER",
      "YEAR",
    ]);
  });
});
