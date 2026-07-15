import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, fetchGoogleEmail, createBackupFolder } from "@/lib/google-drive";

const STATE_COOKIE = "gdrive_oauth_state";

export async function GET(req: NextRequest) {
  const settingsUrl = new URL("/settings", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    settingsUrl.searchParams.set("gdrive_error", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  const expectedNonce = req.cookies.get(STATE_COOKIE)?.value;
  const [nonce, orgId] = (state || "").split(".");
  if (!code || !orgId || !nonce || nonce !== expectedNonce) {
    settingsUrl.searchParams.set("gdrive_error", "Invalid or expired connection request — please try again.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = new URL("/api/google-drive/callback", req.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      throw new Error("Google didn't return a refresh token — try disconnecting this app's access in your Google Account and reconnecting.");
    }

    const email = await fetchGoogleEmail(tokens.access_token);
    const folderId = await createBackupFolder(tokens.access_token);

    const admin = createAdminClient();
    const { error } = await admin.from("google_drive_connections").upsert({
      organization_id: orgId,
      connected_email: email,
      refresh_token: tokens.refresh_token,
      folder_id: folderId,
      connected_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    settingsUrl.searchParams.set("gdrive_connected", "1");
  } catch (e) {
    settingsUrl.searchParams.set("gdrive_error", e instanceof Error ? e.message : "Failed to connect Google Drive.");
  }

  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
