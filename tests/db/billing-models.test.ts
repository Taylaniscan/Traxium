import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BillingInterval,
  PriceType,
  SubscriptionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

function getSchemaContents() {
  return readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
}

function getModelBlock(name: string) {
  const schema = getSchemaContents();
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, "m"));

  if (!match) {
    throw new Error(`Model ${name} not found in prisma/schema.prisma.`);
  }

  return match[1];
}

function expectModelLine(modelName: string, linePattern: RegExp) {
  expect(getModelBlock(modelName)).toMatch(linePattern);
}

describe("Billing schema", () => {
  it("allows each organization to own a single billing customer record", () => {
    expectModelLine(
      "Organization",
      /^\s*billingCustomer\s+BillingCustomer\?\s*$/m
    );
    expectModelLine(
      "BillingCustomer",
      /^\s*organizationId\s+String\s+@unique\s*$/m
    );
    expectModelLine(
      "BillingCustomer",
      /^\s*organization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)\s*$/m
    );
  });

  it("prevents duplicate Stripe identifiers across plans, prices, customers, subscriptions, and webhooks", () => {
    expectModelLine(
      "ProductPlan",
      /^\s*stripeProductId\s+String\?\s+@unique\s*$/m
    );
    expectModelLine(
      "PlanPrice",
      /^\s*stripePriceId\s+String\?\s+@unique\s*$/m
    );
    expectModelLine(
      "BillingCustomer",
      /^\s*stripeCustomerId\s+String\s+@unique\s*$/m
    );
    expectModelLine(
      "Subscription",
      /^\s*stripeSubscriptionId\s+String\s+@unique\s*$/m
    );
    expectModelLine(
      "WebhookEvent",
      /^\s*stripeEventId\s+String\s+@unique\s*$/m
    );
  });

  it("relates subscriptions back to the organization, billing customer, plan, and price catalog", () => {
    expectModelLine(
      "Organization",
      /^\s*subscriptions\s+Subscription\[\]\s*$/m
    );
    expectModelLine(
      "Subscription",
      /^\s*organization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)\s*$/m
    );
    expectModelLine(
      "Subscription",
      /^\s*billingCustomer\s+BillingCustomer\s+@relation\(fields: \[billingCustomerId\], references: \[id\], onDelete: Cascade\)\s*$/m
    );
    expectModelLine(
      "ProductPlan",
      /^\s*subscriptions\s+Subscription\[\]\s*$/m
    );
    expectModelLine(
      "PlanPrice",
      /^\s*subscriptions\s+Subscription\[\]\s*$/m
    );
  });

  it("protects webhook replay handling with a unique Stripe event constraint", () => {
    expectModelLine(
      "Organization",
      /^\s*webhookEvents\s+WebhookEvent\[\]\s*$/m
    );
    expectModelLine(
      "WebhookEvent",
      /^\s*stripeEventId\s+String\s+@unique\s*$/m
    );
    expectModelLine(
      "WebhookEvent",
      /^\s*organization\s+Organization\?\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: SetNull\)\s*$/m
    );
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
