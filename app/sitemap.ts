import type { MetadataRoute } from "next";

import { getPublicAppUrl, resolveAppEnvironment } from "@/lib/env";

const PUBLIC_PAGES: Array<{
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly";
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pilot", priority: 0.8, changeFrequency: "monthly" },
  { path: "/trust", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (resolveAppEnvironment() !== "production") {
    return [];
  }

  const appUrl = getPublicAppUrl();

  return PUBLIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: new URL(path, appUrl).toString(),
    changeFrequency,
    priority,
  }));
}
