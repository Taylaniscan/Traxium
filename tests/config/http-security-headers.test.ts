import { afterEach, beforeEach, describe, expect, it } from "vitest";

import nextConfig, {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/next.config";

const ORIGINAL_ENV = { ...process.env };

function findHeader(name: string, headers: Array<{ key: string; value: string }>) {
  return headers.find((header) => header.key === name)?.value ?? null;
}

function getHeaderEntries() {
  return buildSecurityHeaders();
}

function getGlobalHeaders() {
  return getHeaderEntries()[0]?.headers ?? [];
}

describe("http security headers", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds a production-grade header set with CSP, HSTS, and clickjacking protection", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://atlas.supabase.co";
    process.env.NEXT_PUBLIC_ANALYTICS_HOST = "https://analytics.traxium.app";
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@example.ingest.sentry.io/123456";

    const headerEntries = getHeaderEntries();
    const configHeaders = await nextConfig.headers?.();
    const globalHeaders = getGlobalHeaders();
    const csp = findHeader("Content-Security-Policy", globalHeaders);

    expect(headerEntries[0]?.source).toBe("/:path*");
    expect(headerEntries).toHaveLength(1);
    expect(configHeaders).toEqual(headerEntries);
    expect(
      new Set(globalHeaders.map((header) => header.key)).size
    ).toBe(globalHeaders.length);
    expect(globalHeaders.every((header) => header.value.trim().length > 0)).toBe(
      true
    );
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self' https://atlas.supabase.co https://analytics.traxium.app https://example.ingest.sentry.io");
    expect(findHeader("Strict-Transport-Security", globalHeaders)).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
    expect(findHeader("X-Frame-Options", globalHeaders)).toBe("DENY");
    expect(findHeader("X-Content-Type-Options", globalHeaders)).toBe("nosniff");
    expect(findHeader("Referrer-Policy", globalHeaders)).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(findHeader("Permissions-Policy", globalHeaders)).toContain(
      "microphone=()"
    );
    expect(findHeader("Cross-Origin-Opener-Policy", globalHeaders)).toBe(
      "same-origin"
    );
    expect(findHeader("Cross-Origin-Resource-Policy", globalHeaders)).toBe(
      "same-origin"
    );
  });

  it("keeps development CSP compatible with local Next.js tooling", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.APP_ENV = "development";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    const csp = buildContentSecurityPolicy();
    const globalHeaders = getGlobalHeaders();

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws://localhost:*");
    expect(csp).toContain("http://127.0.0.1:*");
    expect(findHeader("Strict-Transport-Security", globalHeaders)).toBeNull();
  });

  it("treats preview as a hardened environment instead of a local-development exception", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.APP_ENV = "preview";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://previewci.supabase.co";

    const csp = buildContentSecurityPolicy();
    const globalHeaders = getGlobalHeaders();

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws://localhost:*");
    expect(csp).not.toContain("http://127.0.0.1:*");
    expect(findHeader("Strict-Transport-Security", globalHeaders)).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
  });

  it("deduplicates normalized CSP origins and drops invalid external origins", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_ANALYTICS_HOST = "https://analytics.traxium.app";
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@analytics.traxium.app/123456";

    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("connect-src 'self' https://analytics.traxium.app");
    expect(csp.match(/https:\/\/analytics\.traxium\.app/g)).toHaveLength(1);
    expect(csp).not.toContain("not-a-url");
  });
});
