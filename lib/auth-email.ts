import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

export type GeneratedAuthActionLink = {
  actionLink: string;
  redirectTo: string;
  verificationType: "invite" | "magiclink" | "recovery";
};

export function isAuthEmailRateLimitError(message: string) {
  return /rate limit/i.test(message);
}

export function isAuthEmailFallbackEligibleError(message: string) {
  return (
    isAuthEmailRateLimitError(message) ||
    /email address not authorized/i.test(message)
  );
}

export function canExposeDevelopmentAuthLinks() {
  try {
    const appUrl = new URL(getAppUrl());
    return (
      appUrl.hostname === "localhost" ||
      appUrl.hostname === "127.0.0.1"
    );
  } catch {
    return process.env.NODE_ENV !== "production";
  }
}

async function generateAuthActionLink(input: {
  type: "invite" | "magiclink" | "recovery";
  email: string;
  redirectTo: string;
  data?: object;
}): Promise<GeneratedAuthActionLink> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: input.type,
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
      ...(input.data ? { data: input.data } : {}),
    },
  });

  if (error || !data.properties.action_link) {
    throw new Error(
      error?.message ?? "Supabase auth action link could not be generated."
    );
  }

  return {
    actionLink: data.properties.action_link,
    redirectTo: data.properties.redirect_to,
    verificationType: data.properties.verification_type as
      | "invite"
      | "magiclink"
      | "recovery",
  };
}

export function generateInvitationActionLink(input: {
  type: "invite" | "magiclink";
  email: string;
  redirectTo: string;
  data?: object;
}) {
  return generateAuthActionLink(input);
}

export function generateRecoveryActionLink(input: {
  email: string;
  redirectTo: string;
}) {
  return generateAuthActionLink({
    type: "recovery",
    email: input.email,
    redirectTo: input.redirectTo,
  });
}
