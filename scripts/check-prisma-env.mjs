import fs from "node:fs";
import path from "node:path";

const envFilePath = path.join(process.cwd(), ".env");

function parseDotEnv(source) {
  const entries = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    entries[key] = value;
  }

  return entries;
}

function loadLocalEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(envFilePath, "utf8"));
}

function getEnvValue(name, fileEnv) {
  const runtimeValue = process.env[name]?.trim();

  if (runtimeValue) {
    return runtimeValue;
  }

  return fileEnv[name]?.trim() ?? "";
}

function parsePostgresUrl(name, value) {
  if (!value) {
    throw new Error(
      `${name} is missing. Set it to the Supabase session pooler URL on port 5432 for local development.`
    );
  }

  if (value.startsWith("ppostgresql://")) {
    throw new Error(
      `${name} starts with "ppostgresql://". Use "postgresql://" instead.`
    );
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid PostgreSQL connection string.`);
  }

  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error(
      `${name} must start with postgresql:// or postgres://.`
    );
  }

  return url;
}

function validateSupabaseUrl(name, url, warnings) {
  const isPooler = url.hostname.endsWith(".pooler.supabase.com");
  const isDirectHost = /^db\./u.test(url.hostname) && url.hostname.endsWith(".supabase.co");
  const isTransactionPooler = isPooler && url.port === "6543";

  if (!url.searchParams.has("connect_timeout")) {
    warnings.push(
      `${name} is missing connect_timeout. Add connect_timeout=30 to avoid hanging local connection attempts.`
    );
  }

  if (url.searchParams.get("sslmode") !== "require") {
    warnings.push(
      `${name} should include sslmode=require for Supabase PostgreSQL connections.`
    );
  }

  if (isTransactionPooler && url.searchParams.get("pgbouncer") !== "true") {
    throw new Error(
      `${name} uses the Supabase transaction pooler on port 6543 without pgbouncer=true. Add pgbouncer=true&connection_limit=1 or switch to the session pooler on port 5432.`
    );
  }

  if (isTransactionPooler && !url.searchParams.has("connection_limit")) {
    warnings.push(
      `${name} uses the transaction pooler on port 6543 without connection_limit=1. Prisma is more stable with connection_limit=1 in this mode.`
    );
  }

  if (isDirectHost) {
    warnings.push(
      `${name} points at db.<project-ref>.supabase.co. That direct host often fails locally on IPv6-restricted networks. Prefer the session pooler on port 5432 for local development.`
    );
  }
}

function main() {
  const fileEnv = loadLocalEnv();
  const warnings = [];
  const databaseUrlValue = getEnvValue("DATABASE_URL", fileEnv);
  const directUrlValue = getEnvValue("DIRECT_URL", fileEnv);

  const databaseUrl = parsePostgresUrl("DATABASE_URL", databaseUrlValue);
  validateSupabaseUrl("DATABASE_URL", databaseUrl, warnings);

  if (directUrlValue) {
    const directUrl = parsePostgresUrl("DIRECT_URL", directUrlValue);
    validateSupabaseUrl("DIRECT_URL", directUrl, warnings);

    const databaseUrlIsPooler = databaseUrl.hostname.endsWith(".pooler.supabase.com");
    const directUrlIsDirectHost =
      /^db\./u.test(directUrl.hostname) && directUrl.hostname.endsWith(".supabase.co");

    if (databaseUrlIsPooler && directUrlIsDirectHost) {
      warnings.push(
        "DIRECT_URL points at the Supabase direct host while DATABASE_URL uses the session pooler. Prisma Migrate will prefer DIRECT_URL and may hit P1001 locally. For local development, keep DIRECT_URL equal to DATABASE_URL unless the direct host is reachable from your network."
      );
    }
  }

  if (warnings.length) {
    console.warn("Prisma/Supabase env check warnings:");

    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  console.log(
    "Prisma/Supabase connection env looks consistent for local development."
  );
}

try {
  main();
} catch (error) {
  console.error("Prisma/Supabase env check failed.");
  console.error(
    error instanceof Error ? error.message : "Unknown environment error."
  );
  process.exit(1);
}
