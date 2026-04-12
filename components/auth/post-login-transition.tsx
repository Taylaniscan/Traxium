"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  trackSuccessfulLogin,
  type SuccessfulLoginAnalyticsInput,
} from "@/lib/analytics";
import {
  buildLoginHref,
  executePostLoginBootstrap,
  resolveInviteNextPath,
  type LoginBootstrapPayload,
  type PostLoginBootstrapResult,
  resolvePostLoginTransitionAction,
} from "@/lib/auth-navigation";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";

type PostLoginTransitionProps = {
  nextPath: string | null;
};

const POST_LOGIN_BOOTSTRAP_REQUEST_TIMEOUT_MS = 1_500;
const POST_LOGIN_TRANSITION_TIMEOUT_MS = 6_000;
const DEFAULT_POST_LOGIN_ERROR_MESSAGE =
  "We couldn't finish signing you in. Please try again.";

type ResolvedPostLoginBootstrapResult = Awaited<
  ReturnType<typeof executePostLoginBootstrap>
>;

type SuccessfulBootstrapUser = NonNullable<LoginBootstrapPayload["user"]>;

function waitForDelay(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function readNonEmptyString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function fetchBootstrapResult(): Promise<PostLoginBootstrapResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    POST_LOGIN_BOOTSTRAP_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/auth/bootstrap", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    const bootstrapPayload = (await response.json().catch(() => null)) as
      | LoginBootstrapPayload
      | null;

    return {
      status: response.status,
      bootstrapPayload,
      bootstrapSucceeded: response.ok,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function buildSuccessfulLoginAnalyticsInput(input: {
  nextPath: string | null;
  user: SuccessfulBootstrapUser | null | undefined;
}): SuccessfulLoginAnalyticsInput | null {
  const userId = readNonEmptyString(input.user?.id);
  const appRole = readNonEmptyString(input.user?.role);
  const organizationId = readNonEmptyString(
    input.user?.activeOrganization?.organizationId
  );
  const membershipRole = readNonEmptyString(
    input.user?.activeOrganization?.membershipRole
  );
  const inviteNextPath = resolveInviteNextPath(input.nextPath);

  if (!userId || !appRole || !organizationId || !membershipRole) {
    return null;
  }

  return {
    runtime: "client",
    userId,
    organizationId,
    appRole,
    membershipRole,
    hasInviteNextPath: Boolean(inviteNextPath),
    destination: inviteNextPath ? "invite" : "dashboard",
  };
}

export function resolvePostLoginRedirectHref(input: {
  nextPath: string | null;
  loginHref: string;
  bootstrapResult: ResolvedPostLoginBootstrapResult;
}) {
  return resolvePostLoginTransitionAction({
    nextPath: input.nextPath,
    loginHref: input.loginHref,
    bootstrapPayload: input.bootstrapResult.bootstrapPayload,
    bootstrapSucceeded: input.bootstrapResult.bootstrapSucceeded,
  });
}

export function PostLoginTransition({
  nextPath,
}: PostLoginTransitionProps) {
  const [error, setError] = useState<string | null>(null);
  const settledRef = useRef(false);
  const redirectStartedRef = useRef(false);
  const loginHref = buildLoginHref({
    nextPath,
    message: "signin-retry",
  });

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;
    settledRef.current = false;
    redirectStartedRef.current = false;

    function clearTransitionTimeout() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    }

    function showError(message: string) {
      if (!active || settledRef.current) {
        return;
      }

      settledRef.current = true;
      clearTransitionTimeout();
      setError(message);
    }

    function redirectTo(href: string, user?: LoginBootstrapPayload["user"]) {
      if (!active || settledRef.current || redirectStartedRef.current) {
        return;
      }

      settledRef.current = true;
      redirectStartedRef.current = true;
      clearTransitionTimeout();

      const analyticsInput = buildSuccessfulLoginAnalyticsInput({
        user,
        nextPath,
      });

      window.location.replace(href);

      if (analyticsInput) {
        queueMicrotask(() => {
          void trackSuccessfulLogin(analyticsInput);
        });
      }
    }

    timeoutId = window.setTimeout(() => {
      trackClientEvent(
        {
          event: "auth.post_login.bootstrap_timed_out",
          message: DEFAULT_POST_LOGIN_ERROR_MESSAGE,
          payload: {
            hasInviteNextPath: Boolean(nextPath),
          },
        },
        "warn"
      );
      showError(DEFAULT_POST_LOGIN_ERROR_MESSAGE);
    }, POST_LOGIN_TRANSITION_TIMEOUT_MS);

    async function runTransition() {
      let bootstrapResult: Awaited<ReturnType<typeof executePostLoginBootstrap>>;

      try {
        bootstrapResult = await executePostLoginBootstrap({
          fetchBootstrap: fetchBootstrapResult,
          waitFor: waitForDelay,
        });
      } catch (error) {
        captureException(error, {
          event: "auth.post_login.bootstrap_failed",
          runtime: "client",
          payload: {
            hasInviteNextPath: Boolean(nextPath),
          },
        });

        showError(DEFAULT_POST_LOGIN_ERROR_MESSAGE);
        return;
      }

      if (!active || settledRef.current) {
        return;
      }

      try {
        const action = resolvePostLoginRedirectHref({
          nextPath,
          loginHref,
          bootstrapResult,
        });

        if (action.type === "redirect") {
          redirectTo(action.href, bootstrapResult.bootstrapPayload?.user);
          return;
        }

        if (action.type === "return_to_login") {
          redirectTo(action.href);
          return;
        }

        trackClientEvent(
          {
            event: "auth.post_login.bootstrap_failed",
            message: action.message,
            payload: {
              status: bootstrapResult.status,
              attempts: bootstrapResult.attempts,
              code: bootstrapResult.bootstrapPayload?.code ?? null,
              hasInviteNextPath: Boolean(nextPath),
            },
          },
          "warn"
        );
        showError(action.message);
      } catch (error) {
        captureException(error, {
          event: "auth.post_login.transition_failed",
          runtime: "client",
          payload: {
            status: bootstrapResult.status,
            attempts: bootstrapResult.attempts,
            code: bootstrapResult.bootstrapPayload?.code ?? null,
            hasInviteNextPath: Boolean(nextPath),
          },
        });
        showError(DEFAULT_POST_LOGIN_ERROR_MESSAGE);
      }
    }

    void runTransition();

    return () => {
      active = false;
      clearTransitionTimeout();
    };
  }, [loginHref, nextPath]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>
            {error ? "We couldn't finish sign-in" : "Finishing sign-in"}
          </CardTitle>
          <CardDescription>
            {error
              ? "Traxium could not complete your authenticated workspace bootstrap."
              : "Preparing your workspace access and sending you to the correct destination."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <>
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>

              <Link
                href={loginHref}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Return to sign in
              </Link>
            </>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Completing secure session bootstrap...
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
