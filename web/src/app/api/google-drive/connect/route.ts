import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { googleOAuthUrl } from "@/lib/google-drive";

const STATE_COOKIE = "gdrive_oauth_state";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const org = await getCurrentOrg(supabase);
  if (!org) return NextResponse.redirect(new URL("/login", req.url));

  const nonce = crypto.randomUUID();
  const state = `${nonce}.${org.id}`;
  const redirectUri = new URL("/api/google-drive/callback", req.url).toString();

  const res = NextResponse.redirect(googleOAuthUrl(redirectUri, state));
  res.cookies.set(STATE_COOKIE, nonce, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });
  return res;
}
