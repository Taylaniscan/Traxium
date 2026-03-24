import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  getInvitationByToken,
  getInvitationReadError,
} from "@/lib/invitations";

const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required."),
});

function jsonError(error: string, status: number, invitation?: Record<string, unknown>) {
  return NextResponse.json(
    invitation
      ? {
          error,
          invitation,
        }
      : {
          error,
        },
    { status }
  );
}

function toInvitationResponse(invitation: NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    organization: invitation.organization,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = invitationTokenParamsSchema.parse(await params);
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return jsonError("Invitation not found.", 404);
    }

    const invitationError = getInvitationReadError(invitation);
    const responseInvitation = toInvitationResponse(invitation);

    if (invitationError) {
      return jsonError(
        invitationError.message,
        invitationError.status,
        responseInvitation
      );
    }

    return NextResponse.json({
      invitation: responseInvitation,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Invitation token is invalid.",
        422
      );
    }

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be loaded.",
      500
    );
  }
}
