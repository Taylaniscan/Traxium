import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("traxium-user");
}

export async function POST(request: Request) {
  await clearSession();

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  await clearSession();

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}
