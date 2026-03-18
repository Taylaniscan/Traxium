import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getSupabaseUrl() {
  const url = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");

  try {
    new URL(url);
  } catch {
    throw new Error(`Malformed NEXT_PUBLIC_SUPABASE_URL: ${url}`);
  }

  return url;
}

function getSupabaseAnonKey() {
  return readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function getSupabaseServiceRoleKey() {
  return readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Some Server Component contexts cannot set cookies here.
              // Middleware handles refresh separately.
            }
          });
        },
      },
    }
  );
}

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
