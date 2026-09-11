import { expect, type Page, type Request, type Response } from "@playwright/test";

const ALLOWED_CONSOLE_ERRORS: RegExp[] = [];

type RuntimeWatchdogOptions = {
  allowedAbortedGetPaths?: readonly string[];
};

type CheckpointOptions = {
  allowedFailures?: readonly RegExp[];
};

function isAllowed(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function isExpectedNavigationCancellation(
  page: Page,
  request: Request,
  allowedAbortedGetPaths: readonly string[]
) {
  const failure = request.failure()?.errorText ?? "";

  if (request.method() !== "GET" || failure !== "net::ERR_ABORTED") {
    return false;
  }

  const requestUrl = new URL(request.url());
  const pageUrl = page.url() === "about:blank" ? null : new URL(page.url());
  const isSameOrigin = !pageUrl || requestUrl.origin === pageUrl.origin;
  const isRscRequest = requestUrl.searchParams.has("_rsc");
  const isNextStaticAsset = requestUrl.pathname.startsWith("/_next/static/");
  const isExplicitlyAllowed = allowedAbortedGetPaths.includes(
    requestUrl.pathname
  );

  return isSameOrigin && (isRscRequest || isNextStaticAsset || isExplicitlyAllowed);
}

export function installRuntimeWatchdog(
  page: Page,
  options: RuntimeWatchdogOptions = {}
) {
  const failures: string[] = [];
  const allowedAbortedGetPaths = options.allowedAbortedGetPaths ?? [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (!isAllowed(text, ALLOWED_CONSOLE_ERRORS)) {
      failures.push(`console.error: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("requestfailed", (request: Request) => {
    const detail = `${request.method()} ${request.url()} ${
      request.failure()?.errorText ?? "failed"
    }`;
    if (
      !isExpectedNavigationCancellation(page, request, allowedAbortedGetPaths)
    ) {
      failures.push(`requestfailed: ${detail}`);
    }
  });

  page.on("response", (response: Response) => {
    if (response.status() >= 500) {
      failures.push(
        `http ${response.status()}: ${response.request().method()} ${response.url()}`
      );
    }
  });

  return {
    async checkpoint(label: string, options: CheckpointOptions = {}) {
      const bodyText = (await page.locator("body").innerText()).trim();
      const overlayCount = await page
        .locator("nextjs-portal, [data-nextjs-dialog-overlay]")
        .count();

      expect(bodyText.length, `${label}: blank page at ${page.url()}`).toBeGreaterThan(
        20
      );
      expect(
        overlayCount,
        `${label}: visible Next.js error overlay at ${page.url()}`
      ).toBe(0);

      const hydrationText = bodyText.match(
        /hydration failed|hydration mismatch|server rendered html did not match/i
      );
      if (hydrationText) {
        failures.push(`${label}: hydration failure text: ${hydrationText[0]}`);
      }

      const currentFailures = failures.splice(0);
      const unexpectedFailures = currentFailures.filter(
        (failure) => !isAllowed(failure, options.allowedFailures ?? [])
      );
      expect(
        unexpectedFailures,
        `${label}: runtime failures at ${page.url()}`
      ).toEqual([]);
    },
  };
}
