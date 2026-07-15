import type { SupabaseClient } from "@supabase/supabase-js";

// Narrow, non-sensitive scope: the app can only see/manage files *it* creates
// in the user's Drive, not their whole Drive. Doesn't require Google's
// security-assessment review the way the full `drive` scope would.
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const BACKUP_FOLDER_NAME = "StockPro Backups";

export function googleOAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES,
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces a fresh refresh_token even on reconnect
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token exchange failed.");
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Failed to refresh Google access token.");
  return data.access_token as string;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Failed to fetch Google account email.");
  return data.email as string;
}

export async function createBackupFolder(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Failed to create Google Drive backup folder.");
  return data.id as string;
}

// Best-effort: called from runOrgBackup after the Supabase Storage backup
// (the reliable copy) already succeeded. A Drive failure here is logged and
// swallowed by the caller so it never blocks the primary backup.
export async function uploadBackupToDrive(admin: SupabaseClient, orgId: string, filename: string, content: string) {
  const { data: conn } = await admin
    .from("google_drive_connections")
    .select("refresh_token, folder_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!conn) return { uploaded: false as const };

  const accessToken = await refreshAccessToken(conn.refresh_token);

  const boundary = "stockpro_backup_boundary";
  const metadata = { name: filename, parents: [conn.folder_id] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "Google Drive upload failed.");
  }
  return { uploaded: true as const };
}

export async function disconnectGoogleDrive(admin: SupabaseClient, orgId: string) {
  await admin.from("google_drive_connections").delete().eq("organization_id", orgId);
}

// Tolerates the table not existing yet (migration not applied) so a
// deploy of this code ahead of the migration can't take Settings down again.
export async function getGoogleDriveConnection(admin: SupabaseClient, orgId: string) {
  const { data, error } = await admin
    .from("google_drive_connections")
    .select("connected_email, connected_at")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return null;
  return data;
}
