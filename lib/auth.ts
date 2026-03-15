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

  const dbUser = await prisma.user.findUnique({
    where: {
      email: authUser.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!dbUser) {
    return null;
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