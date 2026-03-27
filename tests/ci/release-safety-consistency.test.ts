import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assertPredeployConfiguration } from "@/scripts/predeploy-check";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function createJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

function findWorkflowLineIndex(workflow: string, line: string) {
  return workflow.indexOf(`\n        ${line}\n`);
}

describe("release safety consistency", () => {
  it("keeps .env.example complete and free from placeholder markers", () => {
    const envExample = readProjectFile(".env.example");

    for (const requiredKey of [
      "APP_ENV",
      "NEXT_PUBLIC_APP_URL",
      "DATABASE_URL",
      "DIRECT_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_STORAGE_BUCKET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PORTAL_RETURN_URL",
      "STRIPE_CHECKOUT_SUCCESS_URL",
      "STRIPE_CHECKOUT_CANCEL_URL",
      "STRIPE_STARTER_PRODUCT_ID",
      "STRIPE_STARTER_BASE_PRICE_ID",
      "STRIPE_STARTER_METERED_PRICE_ID",
      "STRIPE_GROWTH_PRODUCT_ID",
      "STRIPE_GROWTH_BASE_PRICE_ID",
      "STRIPE_GROWTH_METERED_PRICE_ID",
      "SENTRY_DSN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "NEXT_PUBLIC_ANALYTICS_HOST",
      "NEXT_PUBLIC_ANALYTICS_KEY",
      "ANALYTICS_HOST",
      "ANALYTICS_KEY",
      "JOB_WORKER_ONCE",
      "JOB_WORKER_MAX_JOBS",
      "JOB_WORKER_IDLE_DELAY_MS",
    ]) {
      expect(envExample).toContain(`${requiredKey}=`);
    }

    expect(envExample).not.toMatch(/\[(?:PROJECT-REF|PASSWORD|REGION)\]/u);
    expect(envExample).not.toMatch(/\[YOUR_[A-Z_]+\]/u);
  });

  it("keeps the CI workflow aligned with package scripts and non-placeholder envs", () => {
    const workflow = readProjectFile(".github/workflows/ci.yml");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    const expectedScripts = [
      "env:check",
      "db:generate",
      "db:validate",
      "test:ci:smoke",
      "typecheck",
      "test",
      "build",
    ];

    for (const scriptName of expectedScripts) {
      expect(packageJson.scripts?.[scriptName]).toBeTruthy();
      expect(workflow).toContain(`run: npm run ${scriptName}`);
    }

    expect(findWorkflowLineIndex(workflow, "run: npm ci")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run env:check")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run env:check")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run db:generate")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run db:generate")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run db:validate")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run db:validate")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run test:ci:smoke")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run test:ci:smoke")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run typecheck")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run typecheck")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run test")
    );
    expect(findWorkflowLineIndex(workflow, "run: npm run test")).toBeLessThan(
      findWorkflowLineIndex(workflow, "run: npm run build")
    );

    expect(workflow).toContain(
      "NEXT_PUBLIC_SUPABASE_URL: https://previewci.supabase.co"
    );
    expect(workflow).toContain("STRIPE_SECRET_KEY: sk_test_previewcibillingsecretkey");
    expect(workflow).toContain("STRIPE_WEBHOOK_SECRET: whsec_previewcibillingwebhooksecret");
    expect(workflow).toContain("STRIPE_PORTAL_RETURN_URL: https://preview-ci.traxium.test/admin/settings");
    expect(workflow).toContain("STRIPE_CHECKOUT_SUCCESS_URL: https://preview-ci.traxium.test/admin/settings?checkout=success");
    expect(workflow).toContain("STRIPE_STARTER_PRODUCT_ID: prod_previewcistarter2026");
    expect(workflow).toContain("STRIPE_GROWTH_BASE_PRICE_ID: price_previewcigrowthmonthly2026");
    expect(workflow).toContain("postgresql://postgres.previewci:");
    expect(workflow).not.toContain("https://example.supabase.co");
    expect(workflow).not.toContain("postgres.example");
  });

  it("keeps next config and release docs aligned with the repo contracts", () => {
    const nextConfig = readProjectFile("next.config.ts");
    const environmentSetup = readProjectFile("docs/environment-setup.md");
    const releaseChecklist = readProjectFile("docs/release-checklist.md");
    const deploymentStrategy = readProjectFile("docs/deployment-strategy.md");
    const operationsRunbook = readProjectFile("docs/operations-runbook.md");
    const smokeTests = readProjectFile("docs/post-release-smoke-tests.md");

    expect(nextConfig).not.toMatch(/\benv\s*:/u);
    expect(nextConfig).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(nextConfig).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    expect(environmentSetup).toContain("npm run env:check");
    expect(environmentSetup).toContain("npm run build");
    expect(environmentSetup).toContain("STRIPE_SECRET_KEY");
    expect(environmentSetup).toContain("STRIPE_WEBHOOK_SECRET");
    expect(environmentSetup).toContain("STRIPE_STARTER_BASE_PRICE_ID");
    expect(releaseChecklist).toContain("npm run db:generate");
    expect(releaseChecklist).toContain("npm run db:validate");
    expect(releaseChecklist).toContain("npm run test");
    expect(releaseChecklist).toContain("npm run build");
    expect(releaseChecklist).toContain("STRIPE_SECRET_KEY");
    expect(releaseChecklist).toContain("STRIPE_GROWTH_METERED_PRICE_ID");
    expect(deploymentStrategy).toContain("npm run predeploy");
    expect(deploymentStrategy).toContain("npm run release:verify");
    expect(deploymentStrategy).toContain("npm run release:migrate");
    expect(deploymentStrategy).toContain("prisma migrate deploy");
    expect(deploymentStrategy).toContain("STRIPE_SECRET_KEY");
    expect(deploymentStrategy).toContain("STRIPE_GROWTH_BASE_PRICE_ID");
    expect(operationsRunbook).toContain("auth");
    expect(operationsRunbook).toContain("onboarding");
    expect(operationsRunbook).toContain("Invitation Incident Flow");
    expect(operationsRunbook).toContain("Admin / RBAC Incident Flow");
    expect(operationsRunbook).toContain("Observability / Analytics Incident Flow");
    expect(operationsRunbook).toContain("Jobs / Worker Incident Flow");
    expect(smokeTests).toContain("/login");
    expect(smokeTests).toContain("/onboarding");
    expect(smokeTests).toContain("/admin/members");
    expect(smokeTests).toContain("/admin/settings");
    expect(smokeTests).toContain("/admin/insights");
    expect(smokeTests).toContain("/admin/jobs");
    expect(smokeTests).toContain("npm run jobs:worker:once");
  });

  it("keeps predeploy summaries secret-safe while accepting preview-safe config", () => {
    const anonKey = createJwt({
      role: "anon",
      ref: "previewci",
    });
    const serviceRoleKey = createJwt({
      role: "service_role",
      ref: "previewci",
    });
    const result = assertPredeployConfiguration({
      APP_ENV: "preview",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-traxium.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "app.traxium.com",
      NEXT_PUBLIC_APP_URL: "https://preview-traxium.vercel.app",
      DATABASE_URL:
        "postgresql://postgres.previewci:preview-ci-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30",
      DIRECT_URL:
        "postgresql://postgres.previewci:preview-ci-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30",
      NEXT_PUBLIC_SUPABASE_URL: "https://previewci.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
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
    });
    const serializedResult = JSON.stringify(result);

    expect(result).toEqual({
      appEnvironment: "preview",
      hostingEnvironment: "preview",
      appHost: "preview-traxium.vercel.app",
      supabaseProjectRef: "previewci",
      databaseHost: "aws-1-eu-central-1.pooler.supabase.com",
      directHost: "aws-1-eu-central-1.pooler.supabase.com",
      productionAliasHost: "app.traxium.com",
    });
    expect(serializedResult).not.toContain(anonKey);
    expect(serializedResult).not.toContain(serviceRoleKey);
    expect(serializedResult).not.toContain("preview-ci-password");
  });
});
