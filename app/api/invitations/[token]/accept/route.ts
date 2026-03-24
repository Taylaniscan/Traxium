import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  acceptInvitationForCurrentUser,
  createAuthGuardErrorResponse,
} from "@/lib/auth";
import { InvitationError } from "@/lib/invitations";

const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required."),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = invitationTokenParamsSchema.parse(await params);
    const result = await acceptInvitationForCurrentUser(token);

    return NextResponse.json({
      success: true,
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.role,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
        organization: result.invitation.organization,
        invitedBy: result.invitation.invitedBy,
      },
      membership: result.membership,
      activeOrganizationId: result.activeOrganizationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Invitation token is invalid.",
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
      error instanceof Error ? error.message : "Invitation could not be accepted.",
      500
    );
  }
}
