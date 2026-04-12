import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const SECURITY_HEADER_SOURCE = "/:path*";

function normalizeOrigin(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

function normalizeSentryOrigin(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

function uniqueSources(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isDevelopmentLikeEnvironment() {
  const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();
  const nodeEnvironment = process.env.NODE_ENV?.trim().toLowerCase();

  if (appEnvironment === "development" || appEnvironment === "local") {
    return true;
  }

  return nodeEnvironment !== "production" && appEnvironment !== "preview";
}

export function buildContentSecurityPolicy() {
  const isDevelopment = isDevelopmentLikeEnvironment();
  const supabaseOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const analyticsOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_ANALYTICS_HOST);
  const sentryOrigin = normalizeSentryOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const connectSources = uniqueSources([
    "'self'",
    supabaseOrigin,
    analyticsOrigin,
    sentryOrigin,
    isDevelopment ? "http://localhost:*" : null,
    isDevelopment ? "http://127.0.0.1:*" : null,
    isDevelopment ? "ws://localhost:*" : null,
    isDevelopment ? "ws://127.0.0.1:*" : null,
  ]);
  const scriptSources = uniqueSources([
    "'self'",
    "'unsafe-inline'",
    isDevelopment ? "'unsafe-eval'" : null,
  ]);

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `form-action 'self'`,
    `manifest-src 'self'`,
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src ${connectSources.join(" ")}`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `child-src 'self' blob:`,
    isDevelopment ? null : "upgrade-insecure-requests",
  ];

  return directives.filter(Boolean).join("; ");
}

export function buildSecurityHeaders() {
  const isDevelopment = isDevelopmentLikeEnvironment();
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "autoplay=()",
        "camera=()",
        "display-capture=()",
        "geolocation=()",
        "gyroscope=()",
        "microphone=()",
        "payment=()",
        "usb=()",
        "browsing-topics=()",
      ].join(", "),
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-origin",
    },
  ];

  if (!isDevelopment) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  // COEP is intentionally omitted. The app does not require cross-origin isolation,
  // and enabling it would break third-party downloads and embedded browser flows.
  return [
    {
      source: SECURITY_HEADER_SOURCE,
      headers,
    },
  ];
}

const nextConfig: NextConfig = {
  experimental: {
    devtoolSegmentExplorer: false,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  async headers() {
    return buildSecurityHeaders();
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
