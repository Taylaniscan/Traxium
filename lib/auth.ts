import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const email = cookieStore.get("traxium-user")?.value;

  const fallbackEmail = process.env.DEFAULT_USER_EMAIL ?? "sophie@traxium.local";
  const userEmail = email ?? fallbackEmail;

  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  });

  if (user) {
    return user;
  }

  if (userEmail !== fallbackEmail) {
    return prisma.user.findUnique({
      where: { email: fallbackEmail }
    });
  }

  return null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No user found. Seed the database first.");
  }

  return user;
}
