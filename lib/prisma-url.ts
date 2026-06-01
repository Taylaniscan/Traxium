export function withDefaultPrismaConnectionLimit(
  databaseUrl: string,
  connectionLimit = "1"
) {
  const parsedUrl = new URL(databaseUrl);
  const isSupabasePooler = parsedUrl.hostname.endsWith(".pooler.supabase.com");

  if (!isSupabasePooler || parsedUrl.searchParams.has("connection_limit")) {
    return databaseUrl;
  }

  parsedUrl.searchParams.set("connection_limit", connectionLimit);

  return parsedUrl.toString();
}
