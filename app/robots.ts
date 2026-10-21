import type { MetadataRoute } from "next";

import { getPublicAppUrl, resolveAppEnvironment } from "@/lib/env";

// Authenticated product surfaces, auth flows, and API routes are never useful in
// search results; invitation and reset links can also carry single-use tokens.
const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/auth/",
  "/billing",
  "/command-center",
  "/dashboard",
  "/forgot-password",
  "/invite/",
  "/kanban",
  "/logout",
  "/monthly-close",
  "/onboarding",
  "/open-actions",
  "/profile",
  "/reports",
  "/reset-password",
  "/saving-cards",
  "/settings",
  "/timeline",
];

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();

  // Preview deployments must never be indexed.
  if (resolveAppEnvironment() !== "production") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: new URL("/sitemap.xml", appUrl).toString(),
  };
}
