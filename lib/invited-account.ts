import { Prisma, Role } from "@prisma/client";

import {
  acceptOrganizationInvitation,
  getInvitationByToken,
  type InvitationAcceptanceResult,
  InvitationError,
} from "@/lib/invitations";
import { prisma } from "@/lib/prisma";
import { getPasswordValidationError } from "@/lib/passwords";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const DEFAULT_INVITED_USER_ROLE: Role = "TACTICAL_BUYER";

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  activeOrganizationId: true,
} satisfies Prisma.UserSelect;

type SessionUserRecord = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;

type AuthSessionUser = {
  id: string;
  email?: string | null;
  app_metadata?: unknown;
  user_metadata?: unknown;
};

export class InvitationAccountError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 422 = 400
  ) {
    super(message);
    this.name = "InvitationAccountError";
  }
}

export type InvitationAccountSetupResult = InvitationAcceptanceResult & {
  email: string;
  userId: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readMetadataValue(source: unknown, keys: readonly string[]) {
  const record = asRecord(source);

  for (const key of keys) {
    const value = normalizeString(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

async function getAuthenticatedAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    supabase,
    authUser: user as AuthSessionUser,
  };
}

function isExistingAuthUserErrorMessage(message: string) {
  return /already\s+(registered|exists|been\s+registered)/iu.test(message);
}

async function findAuthUserByEmail(email: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new InvitationAccountError(
        `Unable to verify invited account: ${error.message}`,
        422
      );
    }

    const matchedUser =
      data.users.find((user) => normalizeEmail(user.email) === email) ?? null;

    if (matchedUser) {
      return matchedUser;
    }

    if (!data.nextPage || data.nextPage === page) {
      return null;
    }

    page = data.nextPage;
  }
}

async function findWorkspaceUsersByEmail(email: string) {
  return prisma.user.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: sessionUserSelect,
    orderBy: [{ id: "asc" }],
    take: 2,
  });
}

async function ensureWorkspaceUserForInvitation(input: {
  email: string;
  name: string;
  organizationId: string;
}) {
  const candidates = await findWorkspaceUsersByEmail(input.email);

  if (candidates.length > 1) {
    throw new InvitationAccountError(
      "Your invitation email matches multiple Traxium users. Contact a workspace admin to complete setup.",
      409
    );
  }

  if (candidates[0]) {
    return candidates[0];
  }

  return prisma.user.create({
    data: {
      organizationId: input.organizationId,
      activeOrganizationId: input.organizationId,
      name: input.name,
      email: input.email,
      role: DEFAULT_INVITED_USER_ROLE,
    },
    select: sessionUserSelect,
  });
}

async function updateAuthSessionContext(
  authUser: AuthSessionUser,
  context: {
    userId: string;
    activeOrganizationId: string;
  }
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const currentMetadata = asRecord(authUser.app_metadata);
  const {
    organizationId: _legacyOrganizationId,
    organization_id: _legacyOrganizationIdSnakeCase,
    ...nextMetadata
  } = currentMetadata;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: {
      ...nextMetadata,
      userId: context.userId,
      activeOrganizationId: context.activeOrganizationId,
    },
  });

  if (error) {
    throw new InvitationAccountError(
      `Unable to update account workspace context: ${error.message}`,
      409
    );
  }
}

async function createAuthUserForInvitation(input: {
  email: string;
  password: string;
  name: string;
  userId: string;
  activeOrganizationId: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      full_name: input.name,
    },
    app_metadata: {
      userId: input.userId,
      activeOrganizationId: input.activeOrganizationId,
    },
  });

  if (error) {
    if (isExistingAuthUserErrorMessage(error.message)) {
      throw new InvitationAccountError(
        `An account already exists for ${input.email}. Sign in with that email to accept the invitation.`,
        409
      );
    }

    throw new InvitationAccountError(
      `Invitation account could not be created: ${error.message}`,
      422
    );
  }

  if (!data.user) {
    throw new InvitationAccountError(
      "Invitation account could not be created.",
      422
    );
  }

  return data.user as AuthSessionUser;
}

export async function completeInvitationAccountSetup(input: {
  token: string;
  name: string;
  password: string;
}) : Promise<InvitationAccountSetupResult> {
  const normalizedName = input.name.trim();
  const passwordError = getPasswordValidationError(input.password);

  if (!normalizedName) {
    throw new InvitationAccountError("Full name is required.", 422);
  }

  if (passwordError) {
    throw new InvitationAccountError(passwordError, 422);
  }

  const invitation = await getInvitationByToken(input.token);

  if (!invitation) {
    throw new InvitationError("Invitation not found.", 404);
  }

  const invitationEmail = normalizeEmail(invitation.email);

  if (!invitationEmail) {
    throw new InvitationAccountError("Invitation email is invalid.", 422);
  }

  const authenticatedContext = await getAuthenticatedAuthUser();

  if (authenticatedContext) {
    const authenticatedEmail = normalizeEmail(authenticatedContext.authUser.email);

    if (!authenticatedEmail) {
      throw new InvitationAccountError(
        "The authenticated invitation session is missing an email address.",
        401
      );
    }

    if (authenticatedEmail !== invitationEmail) {
      throw new InvitationAccountError(
        `This invitation belongs to ${invitation.email}. Sign in with that email to continue.`,
        403
      );
    }
  } else {
    const existingAuthUser = await findAuthUserByEmail(invitationEmail);

    if (existingAuthUser) {
      throw new InvitationAccountError(
        `An account already exists for ${invitation.email}. Sign in with that email to accept the invitation.`,
        409
      );
    }
  }

  const metadataName =
    normalizedName ||
    readMetadataValue(authenticatedContext?.authUser.user_metadata, ["name", "full_name"]) ||
    invitation.email;
  const workspaceUser = await ensureWorkspaceUserForInvitation({
    email: invitationEmail,
    name: metadataName,
    organizationId: invitation.organizationId,
  });
  const initialActiveOrganizationId =
    normalizeString(workspaceUser.activeOrganizationId) ?? invitation.organizationId;

  let authUserForContext: AuthSessionUser | null = null;

  if (authenticatedContext) {
    const { error: updateUserError } = await authenticatedContext.supabase.auth.updateUser({
      password: input.password,
      data: {
        name: metadataName,
        full_name: metadataName,
      },
    });

    if (updateUserError) {
      throw new InvitationAccountError(updateUserError.message, 422);
    }

    authUserForContext = authenticatedContext.authUser;
  } else {
    authUserForContext = await createAuthUserForInvitation({
      email: invitationEmail,
      password: input.password,
      name: metadataName,
      userId: workspaceUser.id,
      activeOrganizationId: initialActiveOrganizationId,
    });
  }

  const result = await acceptOrganizationInvitation({
    token: input.token,
    userId: workspaceUser.id,
    userEmail: invitationEmail,
    activeOrganizationId: workspaceUser.activeOrganizationId,
    source: "invited_account_setup",
  });

  if (
    authUserForContext &&
    (Boolean(authenticatedContext) ||
      result.activeOrganizationId !== initialActiveOrganizationId)
  ) {
    await updateAuthSessionContext(authUserForContext, {
      userId: workspaceUser.id,
      activeOrganizationId: result.activeOrganizationId,
    });
  }

  return {
    ...result,
    email: invitationEmail,
    userId: workspaceUser.id,
  };
}
