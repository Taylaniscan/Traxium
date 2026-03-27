import { getPublicAppUrl } from "@/lib/env";

export function getAppUrl() {
  return getPublicAppUrl();
}

export function buildAppUrl(pathname: string) {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getAppUrl()}${normalizedPathname}`;
}
