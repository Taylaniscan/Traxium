import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey as getEnvSupabaseAnonKey,
  getSupabaseProjectUrl as getEnvSupabaseProjectUrl,
  getSupabaseServiceRoleKey as getEnvSupabaseServiceRoleKey,
} from "@/lib/env";

type SupabaseJwtClaims = {
  role?: string;
  ref?: string;
};

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1] ?? "";

  return JSON.parse(
    Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="),
      "base64"
    ).toString()
  ) as SupabaseJwtClaims;
}

function validateSupabaseJwtRole({
  name,
  token,
  expectedRole,
  expectedUrl,
}: {
  name: string;
  token: string;
  expectedRole: "anon" | "service_role";
  expectedUrl?: string;
}) {
  let claims: SupabaseJwtClaims;

  try {
    claims = decodeJwtPayload(token);
  } catch {
    throw new Error(`${name} is not a valid JWT`);
  }

  if (claims.role !== expectedRole) {
    throw new Error(`${name} has role "${claims.role || "unknown"}", but "${expectedRole}" is required.`);
  }

  if (expectedUrl && claims.ref) {
    const urlHost = new URL(expectedUrl).hostname;
    const urlProjectRef = urlHost.split(".")[0];
    if (claims.ref !== urlProjectRef) {
      throw new Error(`${name} project mismatch: URL is ${urlHost}, key is for project ${claims.ref}.`);
    }
  }
}

export function getSupabaseUrl() {
  return getEnvSupabaseProjectUrl();
}

export function getSupabaseAnonKey() {
  const url = getSupabaseUrl();
  const key = getEnvSupabaseAnonKey();

  validateSupabaseJwtRole({
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    token: key,
    expectedRole: "anon",
    expectedUrl: url,
  });

  return key;
}

export function getSupabaseServiceRoleKey() {
  const key = getEnvSupabaseServiceRoleKey();

  validateSupabaseJwtRole({
    name: "SUPABASE_SERVICE_ROLE_KEY",
    token: key,
    expectedRole: "service_role",
  });

  return key;
}

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabasePublicClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
