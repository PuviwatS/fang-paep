import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...&next=/
 * Where the confirmation email (and later Google sign-in) sends players back. Exchanges the
 * one-time code for a session cookie, then continues to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(`${safeNext}${safeNext.includes("?") ? "&" : "?"}welcome=1`, url.origin),
      );
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
