import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl, isProductionEnvironment } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function assertPrismaConnectionEnvironment() {
  const databaseUrl = getDatabaseUrl();

  if (databaseUrl.startsWith("ppostgresql://")) {
    throw new Error(
      'DATABASE_URL starts with "ppostgresql://". Use "postgresql://" instead.'
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid PostgreSQL connection string."
    );
  }

  if (!["postgresql:", "postgres:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "DATABASE_URL must start with postgresql:// or postgres://."
    );
  }

  const isSupabasePooler = parsedUrl.hostname.endsWith(".pooler.supabase.com");
  const isTransactionPooler = parsedUrl.port === "6543";

  if (
    isSupabasePooler &&
    isTransactionPooler &&
    parsedUrl.searchParams.get("pgbouncer") !== "true"
  ) {
    throw new Error(
      "DATABASE_URL uses the Supabase transaction pooler on port 6543 without pgbouncer=true. Add pgbouncer=true&connection_limit=1 or switch to the session pooler on port 5432."
    );
  }
}

assertPrismaConnectionEnvironment();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (!isProductionEnvironment()) globalForPrisma.prisma = prisma;
