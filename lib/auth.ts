import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return null;
  }

  // Try to find an existing Prisma user by email
  let dbUser = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: { id: true, name: true, email: true, role: true },
  });

  // If no Prisma user exists yet, auto-provision one.
  // This handles real signups via Supabase Auth.
  if (!dbUser) {
    // Derive a display name from user metadata or fall back to the email prefix
    const fullName =
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      authUser.email.split("@")[0];

    dbUser = await prisma.user.create({
      data: {
        email: authUser.email,
        name: fullName,
        // New users start as PROCUREMENT_ANALYST — adjust default role as needed
        role: Role.PROCUREMENT_ANALYST,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  return dbUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }

  return user;
}