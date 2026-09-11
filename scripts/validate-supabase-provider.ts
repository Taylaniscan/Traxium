import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";

type SupabaseJwtClaims = {
  ref?: string;
  role?: string;
};

type CheckResult = {
  details?: Record<string, unknown>;
  name: string;
  status: "passed" | "failed" | "blocked";
};

const DEFAULT_EVIDENCE_BUCKET = "evidence-private";

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1] ?? "";
  const normalizedPayload = payload
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");

  return JSON.parse(Buffer.from(normalizedPayload, "base64").toString()) as SupabaseJwtClaims;
}

function getProjectRefFromUrl(url: string) {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function getTokenClaims(name: string, token: string) {
  try {
    return decodeJwtPayload(token);
  } catch {
    throw new Error(`${name} is not a valid JWT.`);
  }
}

function stableHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function buildResult(
  name: string,
  status: CheckResult["status"],
  details?: Record<string, unknown>
): CheckResult {
  return {
    name,
    status,
    ...(details ? { details } : {}),
  };
}

function assertManagedEvidencePath(storagePath: string) {
  const segments = storagePath.trim().replace(/^\/+|\/+$/g, "").split("/");

  return (
    segments.length === 6 &&
    segments[0] === "organizations" &&
    Boolean(segments[1]) &&
    segments[2] === "saving-cards" &&
    Boolean(segments[3]) &&
    segments[4] === "evidence" &&
    Boolean(segments[5]) &&
    !segments.some((segment) => segment === "." || segment === ".." || segment.includes("\\"))
  );
}

async function main() {
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl = readRequiredEnv("NEXT_PUBLIC_APP_URL");
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_EVIDENCE_BUCKET;
  const projectRef = getProjectRefFromUrl(supabaseUrl);
  const anonClaims = getTokenClaims("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
  const serviceClaims = getTokenClaims("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
  const results: CheckResult[] = [];

  results.push(
    buildResult("supabase_env_project_alignment", "passed", {
      projectRef,
      anonRole: anonClaims.role,
      serviceRole: serviceClaims.role,
      anonProjectMatchesUrl: !anonClaims.ref || anonClaims.ref === projectRef,
      appUrlOrigin: new URL(appUrl).origin,
    })
  );

  if (anonClaims.role !== "anon") {
    results.push(
      buildResult("anon_key_role", "failed", {
        expected: "anon",
        actual: anonClaims.role ?? "unknown",
      })
    );
  }

  if (serviceClaims.role !== "service_role") {
    results.push(
      buildResult("service_role_key_role", "failed", {
        expected: "service_role",
        actual: serviceClaims.role ?? "unknown",
      })
    );
  }

  if (anonClaims.ref && anonClaims.ref !== projectRef) {
    results.push(
      buildResult("anon_key_project_ref", "failed", {
        expected: projectRef,
        actual: anonClaims.ref,
      })
    );
  }

  if (serviceClaims.ref && serviceClaims.ref !== projectRef) {
    results.push(
      buildResult("service_role_key_project_ref", "failed", {
        expected: projectRef,
        actual: serviceClaims.ref,
      })
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  results.push(
    usersResult.error
      ? buildResult("service_role_auth_admin_read", "failed", {
          error: usersResult.error.message,
        })
      : buildResult("service_role_auth_admin_read", "passed", {
          observedUsers: usersResult.data.users.length,
        })
  );

  const bucketResult = await admin.storage.getBucket(storageBucket);
  results.push(
    bucketResult.error
      ? buildResult("private_evidence_bucket", "failed", {
          bucket: storageBucket,
          error: bucketResult.error.message,
        })
      : buildResult("private_evidence_bucket", bucketResult.data.public ? "failed" : "passed", {
          bucket: bucketResult.data.name,
          public: bucketResult.data.public,
        })
  );

  const evidence = await prisma.savingCardEvidence.findFirst({
    orderBy: {
      uploadedAt: "desc",
    },
    select: {
      storageBucket: true,
      storagePath: true,
    },
  });

  if (!evidence) {
    results.push(
      buildResult("provider_signed_url_existing_evidence", "blocked", {
        reason: "No SavingCardEvidence row exists in the configured database.",
      })
    );
  } else {
    const managedPath = assertManagedEvidencePath(evidence.storagePath);
    const bucketMatchesConfig = evidence.storageBucket === storageBucket;
    results.push(
      buildResult("database_evidence_storage_contract", managedPath && bucketMatchesConfig ? "passed" : "failed", {
        bucketMatchesConfig,
        managedPath,
        storagePathHash: stableHash(evidence.storagePath),
      })
    );

    const signedUrlResult = await admin.storage
      .from(evidence.storageBucket)
      .createSignedUrl(evidence.storagePath, 60);
    const signedUrl = signedUrlResult.data?.signedUrl ?? null;

    if (!signedUrl || signedUrlResult.error) {
      results.push(
        buildResult("service_role_signed_url", "failed", {
          error: signedUrlResult.error?.message ?? "Signed URL was not returned.",
        })
      );
    } else {
      const response = await fetch(signedUrl, { method: "HEAD" });
      results.push(
        buildResult("service_role_signed_url", response.ok ? "passed" : "failed", {
          ttlSeconds: 60,
          headStatus: response.status,
        })
      );
    }

    const anonSignedUrlResult = await anon.storage
      .from(evidence.storageBucket)
      .createSignedUrl(evidence.storagePath, 60);
    results.push(
      buildResult(
        "anon_cannot_create_evidence_signed_url",
        anonSignedUrlResult.data?.signedUrl ? "failed" : "passed",
        {
          error: anonSignedUrlResult.error?.message ?? null,
        }
      )
    );

    const anonDownloadResult = await anon.storage
      .from(evidence.storageBucket)
      .download(evidence.storagePath);
    results.push(
      buildResult(
        "anon_cannot_download_evidence_object",
        anonDownloadResult.data && !anonDownloadResult.error ? "failed" : "passed",
        {
          error: anonDownloadResult.error?.message ?? null,
        }
      )
    );

    const publicUrl = admin.storage.from(evidence.storageBucket).getPublicUrl(evidence.storagePath).data.publicUrl;
    const publicUrlResponse = await fetch(publicUrl, { method: "HEAD" });
    results.push(
      buildResult("public_storage_url_is_not_readable", publicUrlResponse.ok ? "failed" : "passed", {
        headStatus: publicUrlResponse.status,
      })
    );
  }

  results.push(
    buildResult("auth_redirect_allow_list", "blocked", {
      reason:
        "Supabase project redirect allow-list cannot be read with anon or service-role application keys. Verify in the Supabase dashboard or Management API with an access token.",
      expectedRedirects: [
        `${new URL(appUrl).origin}/invite/*`,
        `${new URL(appUrl).origin}/reset-password`,
        `${new URL(appUrl).origin}/auth/bootstrap`,
      ],
    })
  );

  const failed = results.filter((result) => result.status === "failed");
  const blocked = results.filter((result) => result.status === "blocked");
  const summary = {
    event: failed.length ? "supabase.provider.validation.failed" : "supabase.provider.validation.completed",
    projectRef,
    storageBucket,
    passed: results.filter((result) => result.status === "passed").length,
    failed: failed.length,
    blocked: blocked.length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          event: "supabase.provider.validation.error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
