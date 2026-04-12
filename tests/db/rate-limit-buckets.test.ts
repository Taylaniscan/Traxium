import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function getSchemaContents() {
  return readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
}

describe("Rate limit bucket schema", () => {
  it("defines a shared bucket model for distributed request throttling", () => {
    const schema = getSchemaContents();

    expect(schema).toContain("model RateLimitBucket");
    expect(schema).toContain("bucketKey       String   @id");
    expect(schema).toContain("policy          String");
    expect(schema).toContain("action          String?");
    expect(schema).toContain("scope           String");
    expect(schema).toContain("hits            Int");
    expect(schema).toContain("windowStartedAt DateTime");
    expect(schema).toContain("expiresAt       DateTime");
    expect(schema).toContain("@@index([expiresAt])");
    expect(schema).toContain("@@index([policy, action, expiresAt])");
  });
});
