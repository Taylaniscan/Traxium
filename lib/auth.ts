import { cookies } from "next/headers";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const email = cookieStore.get("traxium-user")?.value;

  if (!email) {
    return null;
  }

  return {
    id: "demo-user",
    name: "Taylan Iscan",
    email,
    role: "HEAD_OF_GLOBAL_PROCUREMENT",
  };
}