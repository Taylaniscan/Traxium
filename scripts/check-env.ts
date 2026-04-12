import { pathToFileURL } from "node:url";

import { assertEnvironmentConfiguration } from "../lib/env";
import {
  assertStripeBillingConfiguration,
  hasAnyStripeBillingValue,
} from "../lib/billing/config";
import { resolveAppEnvironment } from "../lib/env";

type EnvSource = Record<string, string | undefined>;

export type CliEnvironmentCheckResult = ReturnType<
  typeof assertEnvironmentConfiguration
> & {
  billing: ReturnType<typeof assertStripeBillingConfiguration> | null;
};

export function assertCliEnvironmentConfiguration(
  source: EnvSource = process.env
): CliEnvironmentCheckResult {
  const result = assertEnvironmentConfiguration(source);
  const appEnvironment = resolveAppEnvironment(source);
  const shouldValidateBilling =
    appEnvironment === "preview" ||
    appEnvironment === "production" ||
    hasAnyStripeBillingValue(source);

  return {
    ...result,
    billing: shouldValidateBilling
      ? assertStripeBillingConfiguration(source)
      : null,
  };
}

function runCliCheck() {
  try {
    const result = assertCliEnvironmentConfiguration();

    console.info(
      JSON.stringify({
        event: "env.check.passed",
        ...result,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "env.check.failed",
        error:
          error instanceof Error
            ? error.message
            : "Environment validation failed.",
      })
    );
    process.exitCode = 1;
  }
}

const isCliExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliExecution) {
  runCliCheck();
}
