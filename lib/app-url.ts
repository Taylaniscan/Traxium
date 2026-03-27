function normalizeAppUrl(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

export function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    throw new Error(
      "Missing NEXT_PUBLIC_APP_URL. Set it to the public base URL used in Supabase auth email redirects."
    );
  }

  try {
    return normalizeAppUrl(new URL(value).toString());
  } catch {
    throw new Error(`Malformed NEXT_PUBLIC_APP_URL: ${value}`);
  }
}

export function buildAppUrl(pathname: string) {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getAppUrl()}${normalizedPathname}`;
}
