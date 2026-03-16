"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  console.log("SUPABASE_URL_FROM_CLIENT", url);

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Malformed NEXT_PUBLIC_SUPABASE_URL: ${url}`);
  }

  return createBrowserClient(url, anonKey);
}