export type LoginBootstrapPayload = {
  error?: string;
  code?: string;
  billingRequiredPath?: string | null;
  user?: {
    id: string;
    role: string;
    activeOrganization: {
      organizationId: string;
      membershipRole: string;
    };
  };
};

export type PostLoginBootstrapResult = {
  status: number;
  bootstrapPayload: LoginBootstrapPayload | null;
  bootstrapSucceeded: boolean;
};

export const postLoginBootstrapRetryDelaysMs = [0, 150, 250, 400] as const;

export function resolveInviteNextPath(
  value: string | string[] | null | undefined
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.startsWith("//") ||
    !normalized.startsWith("/invite/")
  ) {
    return null;
  }

  return normalized;
}

export function buildPostLoginTransitionHref(nextPath: string | null) {
  if (!nextPath) {
    return "/auth/bootstrap";
  }

  const params = new URLSearchParams({
    next: nextPath,
  });

  return `/auth/bootstrap?${params.toString()}`;
}

export function buildLoginHref(input: {
  nextPath: string | null;
  message?: string | null;
  email?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.nextPath) {
    params.set("next", input.nextPath);
  }

  if (input.message) {
    params.set("message", input.message);
  }

  if (input.email) {
    params.set("email", input.email);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function resolvePostLoginPath(input: {
  nextPath: string | null;
  bootstrapPayload: LoginBootstrapPayload | null;
  bootstrapSucceeded: boolean;
}) {
  if (input.bootstrapSucceeded) {
    return input.nextPath ?? "/dashboard";
  }

  if (input.bootstrapPayload?.code === "ORGANIZATION_ACCESS_REQUIRED") {
    return "/onboarding";
  }

  if (input.bootstrapPayload?.code === "BILLING_REQUIRED") {
    return input.bootstrapPayload.billingRequiredPath ?? "/billing-required";
  }

  return null;
}

export function shouldRetryPostLoginBootstrap(
  input: PostLoginBootstrapResult
) {
  return (
    !input.bootstrapSucceeded &&
    input.status === 401 &&
    input.bootstrapPayload?.code === "UNAUTHENTICATED"
  );
}

export async function executePostLoginBootstrap(input: {
  fetchBootstrap: () => Promise<PostLoginBootstrapResult>;
  waitFor: (delayMs: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
}) {
  const retryDelaysMs =
    input.retryDelaysMs && input.retryDelaysMs.length
      ? input.retryDelaysMs
      : postLoginBootstrapRetryDelaysMs;

  let lastResult: PostLoginBootstrapResult | null = null;

  for (let attemptIndex = 0; attemptIndex < retryDelaysMs.length; attemptIndex += 1) {
    if (attemptIndex > 0) {
      const delayMs = retryDelaysMs[attemptIndex] ?? 0;

      if (delayMs > 0) {
        await input.waitFor(delayMs);
      }
    }

    lastResult = await input.fetchBootstrap();

    if (!shouldRetryPostLoginBootstrap(lastResult)) {
      return {
        ...lastResult,
        attempts: attemptIndex + 1,
      };
    }
  }

  return {
    ...(lastResult ?? {
      status: 401,
      bootstrapPayload: {
        code: "UNAUTHENTICATED",
        error: "Authenticated session is required.",
      },
      bootstrapSucceeded: false,
    }),
    attempts: retryDelaysMs.length,
  };
}

export function resolveLoginErrorMessage(value: string | null) {
  switch (value) {
    case "invalid-credentials":
      return "Invalid email or password.";
    case "signin-retry":
      return "We couldn't sign you in. Please try again.";
    default:
      return null;
  }
}

export function resolvePostLoginTransitionAction(input: {
  nextPath: string | null;
  loginHref: string;
  bootstrapPayload: LoginBootstrapPayload | null;
  bootstrapSucceeded: boolean;
}) {
  const postLoginPath = resolvePostLoginPath({
    nextPath: input.nextPath,
    bootstrapPayload: input.bootstrapPayload,
    bootstrapSucceeded: input.bootstrapSucceeded,
  });

  if (postLoginPath) {
    return {
      type: "redirect" as const,
      href: postLoginPath,
    };
  }

  if (input.bootstrapPayload?.code === "UNAUTHENTICATED") {
    return {
      type: "return_to_login" as const,
      href: input.loginHref,
    };
  }

  return {
    type: "show_error" as const,
    message:
      input.bootstrapPayload?.error ??
      "We couldn't finish signing you in. Please try again.",
  };
}
