import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
} as const;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
};

function readOrganizationId(source: unknown): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of ["organizationId", "organization_id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getAuthOrganizationId(authUser: {
  app_metadata?: unknown;
  user_metadata?: unknown;
}): string | null {
  return readOrganizationId(authUser.app_metadata) ?? readOrganizationId(authUser.user_metadata);
}

async function findSessionUser(email: string, organizationId: string | null): Promise<SessionUser | null> {
  if (organizationId) {
    return prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email,
        },
      },
      select: sessionUserSelect,
    });
  }

  const matches = await prisma.user.findMany({
    where: {
      email,
    },
    select: sessionUserSelect,
    take: 2,
  });

  if (matches.length !== 1) {
    if (matches.length > 1) {
      console.error("Ambiguous auth user lookup for email:", email);
    }

    return null;
  }

  return matches[0];
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return null;
  }

  const email = authUser.email.trim();
  if (!email) {
    return null;
  }

  return findSessionUser(email, getAuthOrganizationId(authUser));
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(roles: readonly Role[]): Promise<SessionUser> {
  const user = await requireUser();

  if (!roles.length || !hasAnyRole(user.role, roles)) {
    throw new Error("Forbidden");
  }

  return user;
}
