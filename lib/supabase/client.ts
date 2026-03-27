"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseProjectUrl } from "@/lib/env";

function decodeJwtPayload(token: string) {
  const [_, payload = ""] = token.split(".");
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    "="
  );

  return JSON.parse(atob(normalizedPayload)) as { role?: string; ref?: string };
}

function validateAnonKey(token: string, expectedUrl: string) {
  let claims: { role?: string; ref?: string };

  try {
    claims = decodeJwtPayload(token);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not a valid JWT");
  }

  if (claims.role !== "anon") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_ANON_KEY has role "${claims.role || "unknown"}", but must be an anon key.`
    );
  }

  if (claims.ref) {
    const parsedUrl = new URL(expectedUrl);
    const hostRef = parsedUrl.hostname.split(".")[0];

    if (claims.ref !== hostRef) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_ANON_KEY project mismatch. URL is ${parsedUrl.hostname}, key is for project ${claims.ref}.`
      );
    }
  }
}

export function createSupabaseBrowserClient() {
  const url = getSupabaseProjectUrl();
  const anonKey = getSupabaseAnonKey();

  validateAnonKey(anonKey, url);

  return createBrowserClient(url, anonKey);
}
