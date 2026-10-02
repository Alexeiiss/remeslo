import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

// Sem vede odkaz z potvrzovacího e-mailu Supabase
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("dalsi") || "/";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safe}`);
  }
  return NextResponse.redirect(`${origin}/prihlaseni?chyba=${encodeURIComponent("Odkaz je neplatný nebo vypršel.")}`);
}
