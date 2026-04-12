import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@/lib/observability";

Sentry.init(buildSentryInitOptions("client"));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
