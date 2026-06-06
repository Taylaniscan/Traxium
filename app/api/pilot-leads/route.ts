import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { captureException, trackServerEvent } from "@/lib/observability";
import {
  pilotLeadHoneypotSchema,
  pilotLeadSubmissionSchema,
  pilotLeadSuccessMessage,
} from "@/lib/pilot-leads/validation";
import { storePilotLead } from "@/lib/pilot-leads/service";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";

function successResponse(status = 201) {
  return NextResponse.json(
    {
      success: true,
      message: pilotLeadSuccessMessage,
    },
    { status }
  );
}

function validationErrorResponse(error: ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field =
      typeof issue.path[0] === "string" ? issue.path[0] : "form";

    fieldErrors[field] ??= issue.message;
  }

  return NextResponse.json(
    {
      error: "Review the highlighted fields and try again.",
      fieldErrors,
    },
    { status: 400 }
  );
}

async function readJsonBody(request: Request) {
  try {
    return {
      ok: true as const,
      data: await request.json(),
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      ),
    };
  }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      policy: "pilotLeadSubmission",
      request,
      action: "public.pilot-lead.submit",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const honeypot = pilotLeadHoneypotSchema.safeParse(body.data);
    const honeypotValue = honeypot.success
      ? honeypot.data.websiteUrl
      : null;

    if (
      honeypotValue !== undefined &&
      honeypotValue !== null &&
      String(honeypotValue).trim() !== ""
    ) {
      trackServerEvent({
        event: "pilot_lead.honeypot_accepted",
        route: "/api/pilot-leads",
        method: "POST",
        status: 200,
      });
      return successResponse(200);
    }

    const payload = pilotLeadSubmissionSchema.parse(body.data);
    const result = await storePilotLead(payload, request);

    trackServerEvent({
      event: result.created
        ? "pilot_lead.created"
        : "pilot_lead.duplicate_accepted",
      route: "/api/pilot-leads",
      method: "POST",
      status: result.created ? 201 : 200,
      payload: {
        leadId: result.lead.id,
      },
    });

    return successResponse(result.created ? 201 : 200);
  } catch (error) {
    if (error instanceof ZodError) {
      return validationErrorResponse(error);
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    captureException(error, {
      event: "pilot_lead.submission_failed",
      route: "/api/pilot-leads",
      method: "POST",
      status: 500,
    });

    return NextResponse.json(
      {
        error:
          "Your pilot request could not be submitted right now. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}
