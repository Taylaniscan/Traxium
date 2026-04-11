import { NextResponse, type NextRequest } from "next/server";

import {
  buildLoginHref,
  resolveInviteNextPath,
} from "@/lib/auth-navigation";
import { bootstrapCurrentUserFromAuthUser } from "@/lib/auth";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

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

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const redirectUrl = new URL(pathname, request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl, 303);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

function readTrimmedFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readRawFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function resolvePostLoginDestination(input: {
  nextPath: string | null;
  bootstrapResult: Awaited<ReturnType<typeof bootstrapCurrentUserFromAuthUser>>;
}) {
  if (!input.bootstrapResult.ok) {
    if (input.bootstrapResult.code === "ORGANIZATION_ACCESS_REQUIRED") {
      return "/onboarding";
    }

    if (input.bootstrapResult.code === "BILLING_REQUIRED") {
      return "/billing-required";
    }

    return null;
  }

  return input.nextPath ?? "/dashboard";
}

export async function POST(request: NextRequest) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "auth.login.requested",
  });

  let response = NextResponse.next({
    request,
  });
  let nextPath: string | null = null;
  let email = "";

  try {
    const formData = await request.formData();
    email = readTrimmedFormValue(formData, "email");
    const password = readRawFormValue(formData, "password");
    nextPath = resolveInviteNextPath(readTrimmedFormValue(formData, "next"));

    if (!email || !password) {
      trackServerEvent(
        {
          ...requestContext,
          event: "auth.login.rejected",
          message: "Missing email or password.",
          status: 303,
          payload: {
            hasInviteNextPath: Boolean(nextPath),
            reason: "missing_credentials",
          },
        },
        "warn"
      );

      return redirectWithCookies(
        request,
        response,
        buildLoginHref({
          nextPath,
          email,
          message: "signin-retry",
        })
      );
    }

    const supabase = createSupabaseRouteClient({
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
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      trackServerEvent(
        {
          ...requestContext,
          event: "auth.login.rejected",
          message: error?.message ?? "Invalid email or password.",
          status: 303,
          payload: {
            hasInviteNextPath: Boolean(nextPath),
            reason: "invalid_credentials",
          },
        },
        "warn"
      );

      return redirectWithCookies(
        request,
        response,
        buildLoginHref({
          nextPath,
          email,
          message: "invalid-credentials",
        })
      );
    }

    const bootstrapResult = await bootstrapCurrentUserFromAuthUser(data.user);
    const redirectTo = resolvePostLoginDestination({
      nextPath,
      bootstrapResult,
    });

    if (!redirectTo) {
      const resolutionFailureMessage = bootstrapResult.ok
        ? "Post-login destination could not be resolved."
        : bootstrapResult.message;
      const resolutionFailureCode = bootstrapResult.ok
        ? null
        : bootstrapResult.code;

      trackServerEvent(
        {
          ...requestContext,
          event: "auth.login.post_login_resolution_failed",
          message: resolutionFailureMessage,
          status: 303,
          userId: data.user.id,
          payload: {
            code: resolutionFailureCode,
            hasInviteNextPath: Boolean(nextPath),
          },
        },
        "warn"
      );

      return redirectWithCookies(
        request,
        response,
        buildLoginHref({
          nextPath,
          email,
          message: "signin-retry",
        })
      );
    }

    trackServerEvent({
      ...requestContext,
      event: "auth.login.succeeded",
      status: 303,
      userId: data.user?.id ?? null,
      payload: {
        hasInviteNextPath: Boolean(nextPath),
        redirectTo,
      },
    });

    return redirectWithCookies(request, response, redirectTo);
  } catch (error) {
    captureException(error, {
      ...requestContext,
      event: "auth.login.failed",
      status: 500,
      payload: {
        hasInviteNextPath: Boolean(nextPath),
      },
    });

    return redirectWithCookies(
      request,
      response,
      buildLoginHref({
        nextPath,
        email,
        message: "signin-retry",
      })
    );
  }
}
