import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assertPredeployConfiguration } from "@/scripts/predeploy-check";

function createJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

function createDeployEnv(
  overrides: Record<string, string | undefined> = {}
) {
  const projectRef = overrides.PROJECT_REF ?? "previewproj";
  const source: Record<string, string | undefined> = {
    APP_ENV: "preview",
    NEXT_PUBLIC_APP_URL: "https://preview-traxium.vercel.app",
    DATABASE_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    DIRECT_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: createJwt({
      role: "anon",
      ref: projectRef,
    }),
    SUPABASE_SERVICE_ROLE_KEY: createJwt({
      role: "service_role",
      ref: projectRef,
    }),
    STRIPE_SECRET_KEY:
      "sk_test_previewcibillingsecretkey000000000000000000000000",
    STRIPE_WEBHOOK_SECRET:
      "whsec_previewcibillingwebhooksecret000000000000000000000000",
    STRIPE_PORTAL_RETURN_URL: "https://preview-traxium.vercel.app/admin/settings",
    STRIPE_CHECKOUT_SUCCESS_URL:
      "https://preview-traxium.vercel.app/admin/settings?checkout=success",
    STRIPE_CHECKOUT_CANCEL_URL:
      "https://preview-traxium.vercel.app/admin/settings?checkout=cancelled",
    STRIPE_STARTER_PRODUCT_ID: "prod_previewcistarter2026",
    STRIPE_STARTER_BASE_PRICE_ID: "price_previewcistartermonthly2026",
    STRIPE_STARTER_METERED_PRICE_ID: "price_previewcistarterusage2026",
    STRIPE_GROWTH_PRODUCT_ID: "prod_previewcigrowth2026",
    STRIPE_GROWTH_BASE_PRICE_ID: "price_previewcigrowthmonthly2026",
    STRIPE_GROWTH_METERED_PRICE_ID: "price_previewcigrowthusage2026",
    VERCEL_ENV: "preview",
    VERCEL_URL: "preview-traxium.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "app.traxium.com",
    ...overrides,
  };

  delete source.PROJECT_REF;

  return source;
}

describe("deploy guard", () => {
  it("fails when a production deploy is missing critical env", () => {
    expect(() =>
      assertPredeployConfiguration(
        createDeployEnv({
          APP_ENV: "production",
          VERCEL_ENV: "production",
          NEXT_PUBLIC_APP_URL: "https://app.traxium.com",
          PROJECT_REF: "prodproj",
          SUPABASE_SERVICE_ROLE_KEY: undefined,
        })
      )
    ).toThrow(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Supabase service role key. Required in development, preview, and production environments. Current environment: production."
    );
  });

  it("fails when preview billing config is incomplete", () => {
    expect(() =>
      assertPredeployConfiguration(
        createDeployEnv({
          STRIPE_WEBHOOK_SECRET: undefined,
        })
      )
    ).toThrow(
      "Missing STRIPE_WEBHOOK_SECRET. Stripe webhook signing secret. Required in development, preview, and production environments. Current environment: preview."
    );
  });

  it("allows preview deployments only when they stay separate from the production domain", () => {
    expect(
      assertPredeployConfiguration(
        createDeployEnv({
          APP_ENV: "preview",
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_APP_URL: "https://preview-traxium.vercel.app",
        })
      )
    ).toEqual({
      appEnvironment: "preview",
      hostingEnvironment: "preview",
      appHost: "preview-traxium.vercel.app",
      supabaseProjectRef: "previewproj",
      databaseHost: "aws-1-eu-central-1.pooler.supabase.com",
      directHost: "aws-1-eu-central-1.pooler.supabase.com",
      productionAliasHost: "app.traxium.com",
    });

    expect(() =>
      assertPredeployConfiguration(
        createDeployEnv({
          NEXT_PUBLIC_APP_URL: "https://app.traxium.com",
        })
      )
    ).toThrow("Preview deployments must not use the production application domain.");
  });

  it("keeps migrate deploy as the documented release strategy", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "package.json"),
        "utf8"
      )
    ) as {
      scripts?: Record<string, string>;
    };
    const deploymentStrategy = fs.readFileSync(
      path.join(process.cwd(), "docs/deployment-strategy.md"),
      "utf8"
    );
    const vercelConfig = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "vercel.json"),
        "utf8"
      )
    ) as {
      buildCommand?: string;
    };

    expect(packageJson.scripts?.["db:migrate:deploy"]).toBe(
      "npm run db:check && prisma migrate deploy"
    );
    expect(packageJson.scripts?.["release:migrate"]).toBe(
      "npm run predeploy && npm run db:migrate:deploy"
    );
    expect(deploymentStrategy).toContain("prisma migrate deploy");
    expect(deploymentStrategy).toContain("Never use `prisma migrate dev`");
    expect(vercelConfig.buildCommand).toBe("npm run predeploy && npm run build");
  });
});
