import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const AUTHENTICATED_HOME_PATH = "/dashboard";
const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/command-center",
  "/dashboard",
  "/kanban",
  "/open-actions",
  "/profile",
  "/reports",
  "/saving-cards",
  "/timeline",
] as const;

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none" | boolean;
    secure?: boolean;
  };
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    return null;
  }

  return { url, anonKey };
}

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const redirectUrl = new URL(pathname, request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const env = getSupabaseEnv();

  if (!env) {
    return response;
  }

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user && request.nextUrl.pathname === LOGIN_PATH) {
      return redirectWithCookies(request, response, AUTHENTICATED_HOME_PATH);
    }

    if ((error || !user) && isProtectedRoute(request.nextUrl.pathname)) {
      return redirectWithCookies(request, response, LOGIN_PATH);
    }

    return response;
  } catch (error) {
    console.error("Supabase middleware init failed:", error);
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
