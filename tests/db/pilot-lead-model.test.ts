import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("PilotLead schema", () => {
  it("defines status, privacy metadata, defaults, and review indexes", () => {
    const schema = fs.readFileSync(
      path.join(process.cwd(), "prisma/schema.prisma"),
      "utf8"
    );
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260605190000_add_pilot_leads/migration.sql"
      ),
      "utf8"
    );

    expect(schema).toContain("enum PilotLeadStatus");
    expect(schema).toContain("model PilotLead");
    expect(schema).toContain("status            PilotLeadStatus @default(NEW)");
    expect(schema).toContain('country           String          @default("United States")');
    expect(schema).toContain("ipHash            String?");
    expect(schema).toContain("userAgentHash     String?");
    expect(schema).toContain("@@index([dedupeKey, createdAt])");
    expect(schema).toContain("@@index([status, createdAt])");
    expect(migration).toContain('CREATE TABLE "PilotLead"');
    expect(migration).not.toContain('"ipAddress"');
  });
});
