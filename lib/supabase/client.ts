"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseProjectUrl, getSupabasePublishableKey } from "@/lib/env";
import { validateSupabasePublicApiKey } from "@/lib/supabase/api-key";

export function createSupabaseBrowserClient() {
  const url = getSupabaseProjectUrl();
  const publishableKey = getSupabasePublishableKey();

  validateSupabasePublicApiKey({
    expectedUrl: url,
    key: publishableKey,
  });

  return createBrowserClient(url, publishableKey);
}
