import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

export type SessionUser = {
id: string;
name: string;
email: string;
role: Role;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
const cookieStore = await cookies();
const email = cookieStore.get("traxium-user")?.value;

if (!email) {
return null;
}

return {
id: "demo-user",
name: "Taylan Iscan",
email,
role: "HEAD_OF_GLOBAL_PROCUREMENT" as Role,
};
}

export async function requireUser(): Promise<SessionUser> {
const user = await getCurrentUser();

if (!user) {
redirect("/login");
}

return user;
}
