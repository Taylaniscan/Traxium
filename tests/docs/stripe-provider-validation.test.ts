import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("stripe provider validation docs", () => {
  it("documents the provider validation script, state matrix, and webhook blocker", () => {
    const docs = readProjectFile("docs/stripe-provider-validation.md");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["stripe:validate"]).toContain(
      "scripts/validate-stripe-provider.ts"
    );
    expect(docs).toContain("npm run stripe:validate");
    expect(docs).toContain("--exercise-provider-flows");
    expect(docs).toContain("subscription-mode Checkout Session");
    expect(docs).toContain("Billing Portal Session");
    expect(docs).toContain("`STRIPE_WEBHOOK_SECRET` is empty");
    expect(docs).toContain("checkout.session.completed");
    expect(docs).toContain("customer.subscription.updated");

    for (const state of [
      "`active`",
      "`trialing`",
      "`past_due`",
      "`unpaid`",
      "`canceled`",
      "`paused`",
      "`incomplete`",
      "`incomplete_expired`",
      "no subscription row",
    ]) {
      expect(docs).toContain(state);
    }

    for (const testFile of [
      "tests/lib/stripe-config.test.ts",
      "tests/lib/billing-access.test.ts",
      "tests/api/billing-checkout.test.ts",
      "tests/api/billing-recover.route.test.ts",
      "tests/api/stripe-webhook.test.ts",
      "tests/integration/subscription-gating-regression.test.ts",
    ]) {
      expect(docs).toContain(testFile);
    }

    expect(docs).not.toContain("TODO");
    expect(docs).not.toContain("TBD");
  });
});
