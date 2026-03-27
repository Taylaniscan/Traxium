import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@/lib/observability";

Sentry.init(buildSentryInitOptions("server"));
