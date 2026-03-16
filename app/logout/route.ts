import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function logoutAndRedirect(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  return logoutAndRedirect(request);
}

export async function POST(request: Request) {
  return logoutAndRedirect(request);
}