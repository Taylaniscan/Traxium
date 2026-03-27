import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BillingInterval,
  PriceType,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
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

describe("Billing schema", () => {
  it("allows each organization to own a single billing customer record", () => {
    const billingCustomerOrganization = getField("BillingCustomer", "organization");
    const organizationBillingCustomer = getField("Organization", "billingCustomer");
    const organizationIdField = getField("BillingCustomer", "organizationId");

    expect(billingCustomerOrganization).toMatchObject({
      kind: "object",
      type: "Organization",
      isRequired: true,
    });
    expect(organizationBillingCustomer).toMatchObject({
      kind: "object",
      type: "BillingCustomer",
      isList: false,
    });
    expect(organizationIdField).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      isUnique: true,
    });
  });

  it("prevents duplicate Stripe identifiers across plans, prices, customers, subscriptions, and webhooks", () => {
    const schema = getSchemaContents();

    expect(getField("ProductPlan", "stripeProductId")).toMatchObject({
      kind: "scalar",
      type: "String",
      isUnique: true,
    });
    expect(getField("PlanPrice", "stripePriceId")).toMatchObject({
      kind: "scalar",
      type: "String",
      isUnique: true,
    });
    expect(getField("BillingCustomer", "stripeCustomerId")).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      isUnique: true,
    });
    expect(getField("Subscription", "stripeSubscriptionId")).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      isUnique: true,
    });
    expect(getField("WebhookEvent", "stripeEventId")).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      isUnique: true,
    });

    expect(schema).toContain("stripeProductId String?  @unique");
    expect(schema).toContain("stripePriceId String?         @unique");
    expect(schema).toContain("stripeCustomerId String   @unique");
    expect(schema).toContain("stripeSubscriptionId String             @unique");
    expect(schema).toContain("stripeEventId   String   @unique");
  });

  it("relates subscriptions back to the organization, billing customer, plan, and price catalog", () => {
    const organizationSubscriptions = getField("Organization", "subscriptions");
    const subscriptionOrganization = getField("Subscription", "organization");
    const subscriptionBillingCustomer = getField("Subscription", "billingCustomer");
    const productPlanSubscriptions = getField("ProductPlan", "subscriptions");
    const planPriceSubscriptions = getField("PlanPrice", "subscriptions");

    expect(organizationSubscriptions).toMatchObject({
      kind: "object",
      type: "Subscription",
      isList: true,
    });
    expect(subscriptionOrganization).toMatchObject({
      kind: "object",
      type: "Organization",
      isRequired: true,
    });
    expect(subscriptionBillingCustomer).toMatchObject({
      kind: "object",
      type: "BillingCustomer",
      isRequired: true,
    });
    expect(productPlanSubscriptions).toMatchObject({
      kind: "object",
      type: "Subscription",
      isList: true,
    });
    expect(planPriceSubscriptions).toMatchObject({
      kind: "object",
      type: "Subscription",
      isList: true,
    });
  });

  it("protects webhook replay handling with a unique Stripe event constraint", () => {
    const schema = getSchemaContents();
    const webhookEventField = getField("WebhookEvent", "stripeEventId");
    const webhookOrganization = getField("Organization", "webhookEvents");

    expect(webhookEventField).toMatchObject({
      kind: "scalar",
      type: "String",
      isRequired: true,
      isUnique: true,
    });
    expect(webhookOrganization).toMatchObject({
      kind: "object",
      type: "WebhookEvent",
      isList: true,
    });
    expect(schema).toContain("stripeEventId   String   @unique");
  });

  it("defines explicit billing enums for recurring and usage-based subscription lifecycle control", () => {
    expect(Object.values(BillingInterval)).toEqual(["MONTH", "YEAR"]);
    expect(Object.values(PriceType)).toEqual(["LICENSED", "METERED"]);
    expect(Object.values(SubscriptionStatus)).toEqual([
      "INCOMPLETE",
      "INCOMPLETE_EXPIRED",
      "TRIALING",
      "ACTIVE",
      "PAST_DUE",
      "CANCELED",
      "UNPAID",
      "PAUSED",
    ]);
  });
});
