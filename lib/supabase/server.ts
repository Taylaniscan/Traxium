import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import {
  createSupabaseAdminClient,
  createSupabasePublicClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/supabase/service";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

type SupabaseCookieAdapter = {
  getAll(): {
    name: string;
    value: string;
  }[];
  setAll(cookiesToSet: CookieToSet[]): void;
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseRouteClient({
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
  });
}

export function createSupabaseRouteClient(cookies: SupabaseCookieAdapter) {
  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies,
    }
  );
}

export { createSupabaseAdminClient, createSupabasePublicClient };
