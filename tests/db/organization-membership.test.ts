import { readFileSync } from "node:fs";
import path from "node:path";

import { MembershipStatus, OrganizationRole, Prisma } from "@prisma/client";
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

describe("OrganizationMembership schema", () => {
  it("allows a single user to belong to multiple organizations", () => {
    const membershipModel = getModel("OrganizationMembership");
    const userMemberships = getField("User", "memberships");
    const organizationMemberships = getField("Organization", "memberships");

    expect(membershipModel.uniqueFields).toContainEqual(["userId", "organizationId"]);
    expect(membershipModel.uniqueFields).not.toContainEqual(["userId"]);
    expect(membershipModel.uniqueFields).not.toContainEqual(["organizationId"]);
    expect(userMemberships).toMatchObject({
      kind: "object",
      type: "OrganizationMembership",
      isList: true,
    });
    expect(organizationMemberships).toMatchObject({
      kind: "object",
      type: "OrganizationMembership",
      isList: true,
    });
  });

  it("prevents duplicate membership rows for the same user and organization", () => {
    const schema = getSchemaContents();
    const membershipModel = getModel("OrganizationMembership");

    expect(membershipModel.uniqueIndexes).toContainEqual({
      name: null,
      fields: ["userId", "organizationId"],
    });
    expect(schema).toContain("@@unique([userId, organizationId])");
  });

  it("stores membership role and status with explicit defaults", () => {
    const schema = getSchemaContents();
    const roleField = getField("OrganizationMembership", "role");
    const statusField = getField("OrganizationMembership", "status");

    expect(roleField).toMatchObject({
      kind: "enum",
      type: "OrganizationRole",
      isRequired: true,
      hasDefaultValue: true,
    });
    expect(statusField).toMatchObject({
      kind: "enum",
      type: "MembershipStatus",
      isRequired: true,
      hasDefaultValue: true,
    });
    expect(Object.values(OrganizationRole)).toEqual(["OWNER", "ADMIN", "MEMBER"]);
    expect(Object.values(MembershipStatus)).toEqual(["ACTIVE", "INVITED", "SUSPENDED"]);
    expect(schema).toContain("@@index([organizationId, role])");
  });
});
