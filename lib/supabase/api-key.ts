type SupabaseJwtClaims = {
  role?: string;
  ref?: string;
};

export type SupabasePublicApiKeyValidation =
  | {
      kind: "publishable";
    }
  | {
      claims: SupabaseJwtClaims;
      kind: "legacy-anon";
    };

export type SupabaseSecretApiKeyValidation =
  | {
      kind: "secret";
    }
  | {
      claims: SupabaseJwtClaims;
      kind: "legacy-service-role";
    };

function decodeJwtPayload(token: string) {
  const [, payload = ""] = token.split(".");
  const normalizedPayload = payload
    .replace(/-/gu, "+")
    .replace(/_/gu, "/")
    .padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "="
    );

  return JSON.parse(atob(normalizedPayload)) as SupabaseJwtClaims;
}

export function validateSupabasePublicApiKey(input: {
  expectedUrl: string;
  key: string;
}): SupabasePublicApiKeyValidation {
  if (input.key.startsWith("sb_publishable_")) {
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/u.test(input.key)) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a valid Supabase publishable key."
      );
    }

    return {
      kind: "publishable",
    };
  }

  let claims: SupabaseJwtClaims;

  try {
    claims = decodeJwtPayload(input.key);
  } catch {
    throw new Error(
      "The configured Supabase public key is neither a valid publishable key nor a legacy anon JWT."
    );
  }

  if (claims.role !== "anon") {
    throw new Error(
      `The configured legacy Supabase key has role "${claims.role || "unknown"}", but must be an anon key.`
    );
  }

  if (claims.ref) {
    const parsedUrl = new URL(input.expectedUrl);
    const hostRef = parsedUrl.hostname.split(".")[0];

    if (claims.ref !== hostRef) {
      throw new Error(
        `Supabase public key project mismatch. URL is ${parsedUrl.hostname}, key is for project ${claims.ref}.`
      );
    }
  }

  return {
    claims,
    kind: "legacy-anon",
  };
}

export function validateSupabaseSecretApiKey(input: {
  expectedUrl: string;
  key: string;
}): SupabaseSecretApiKeyValidation {
  if (input.key.startsWith("sb_secret_")) {
    if (!/^sb_secret_[A-Za-z0-9_-]+$/u.test(input.key)) {
      throw new Error(
        "SUPABASE_SECRET_KEY is not a valid Supabase secret key."
      );
    }

    return {
      kind: "secret",
    };
  }

  let claims: SupabaseJwtClaims;

  try {
    claims = decodeJwtPayload(input.key);
  } catch {
    throw new Error(
      "The configured Supabase server key is neither a valid secret key nor a legacy service_role JWT."
    );
  }

  if (claims.role !== "service_role") {
    throw new Error(
      `The configured legacy Supabase server key has role "${claims.role || "unknown"}", but must be a service_role key.`
    );
  }

  if (claims.ref) {
    const parsedUrl = new URL(input.expectedUrl);
    const hostRef = parsedUrl.hostname.split(".")[0];

    if (claims.ref !== hostRef) {
      throw new Error(
        `Supabase server key project mismatch. URL is ${parsedUrl.hostname}, key is for project ${claims.ref}.`
      );
    }
  }

  return {
    claims,
    kind: "legacy-service-role",
  };
}
