import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseProjectUrl as getEnvSupabaseProjectUrl,
  getSupabasePublishableKey as getEnvSupabasePublishableKey,
  getSupabaseSecretKey as getEnvSupabaseSecretKey,
} from "@/lib/env";
import {
  validateSupabasePublicApiKey,
  validateSupabaseSecretApiKey,
} from "@/lib/supabase/api-key";

export function getSupabaseUrl() {
  return getEnvSupabaseProjectUrl();
}

export function getSupabasePublishableKey() {
  const url = getSupabaseUrl();
  const key = getEnvSupabasePublishableKey();

  validateSupabasePublicApiKey({
    expectedUrl: url,
    key,
  });

  return key;
}

export function getSupabaseAnonKey() {
  return getSupabasePublishableKey();
}

export function getSupabaseSecretKey() {
  const url = getSupabaseUrl();
  const key = getEnvSupabaseSecretKey();

  validateSupabaseSecretApiKey({
    expectedUrl: url,
    key,
  });

  return key;
}

export function getSupabaseServiceRoleKey() {
  return getSupabaseSecretKey();
}

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabasePublicClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
