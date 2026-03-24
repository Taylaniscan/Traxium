import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  createOrganizationInvitation,
  InvitationError,
} from "@/lib/invitations";

const invitationRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

const invitationCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Invitation email is required.")
    .email("Invitation email must be valid."),
  role: invitationRoleSchema,
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, data: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: jsonError("Request body must be valid JSON.", 400),
    };
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireOrganization({ redirectTo: null });
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = invitationCreateSchema.parse(body.data);
    const invitation = await createOrganizationInvitation(user, payload);

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          invitedByUserId: invitation.invitedByUserId,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          organization: invitation.organization,
          invitedBy: invitation.invitedBy,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Invitation payload is invalid.",
        422
      );
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof InvitationError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be created.",
      500
    );
  }
}
