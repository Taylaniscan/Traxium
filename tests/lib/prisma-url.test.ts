import { describe, expect, it } from "vitest";

import { withDefaultPrismaConnectionLimit } from "@/lib/prisma-url";

describe("Prisma URL helpers", () => {
  it("adds a default connection limit for Supabase pooler URLs", () => {
    const url =
      "postgresql://postgres.localdev:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30";

    expect(withDefaultPrismaConnectionLimit(url)).toBe(
      "postgresql://postgres.localdev:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30&connection_limit=1"
    );
  });

  it("keeps an explicit connection limit unchanged", () => {
    const url =
      "postgresql://postgres.localdev:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30&connection_limit=3";

    expect(withDefaultPrismaConnectionLimit(url)).toBe(url);
  });

  it("does not alter non-pooler database URLs", () => {
    const url =
      "postgresql://postgres.localdev:password@db.localdev.supabase.co:5432/postgres?sslmode=require&connect_timeout=30";

    expect(withDefaultPrismaConnectionLimit(url)).toBe(url);
  });
});
