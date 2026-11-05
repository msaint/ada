import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/auth";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/app", req.url));
  }
  return NextResponse.redirect(new URL("/login?error=signin", req.url));
}
