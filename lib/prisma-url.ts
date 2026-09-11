export function withDefaultPrismaConnectionLimit(
  databaseUrl: string,
  connectionLimit = "1",
  poolTimeout = "30"
) {
  const parsedUrl = new URL(databaseUrl);
  const isSupabasePooler = parsedUrl.hostname.endsWith(".pooler.supabase.com");

  if (!isSupabasePooler) {
    return databaseUrl;
  }

  if (!parsedUrl.searchParams.has("connection_limit")) {
    parsedUrl.searchParams.set("connection_limit", connectionLimit);
  }

  if (!parsedUrl.searchParams.has("pool_timeout")) {
    parsedUrl.searchParams.set("pool_timeout", poolTimeout);
  }

  return parsedUrl.toString();
}
