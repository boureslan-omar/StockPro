import type { SupabaseClient, User } from "@supabase/supabase-js";

// Fetches exactly the caller's *currently active* organization (the one baked
// into their JWT app_metadata). Since a user can now belong to more than one
// org (org_memberships), RLS on `organizations` allows reading every org a
// user is a member of — so any query here MUST filter by this id explicitly;
// relying on RLS + .single()/.maybeSingle() to narrow to "the" org is no
// longer safe once a user has more than one membership.
//
// Accepts an already-resolved `user` (optional) so hot paths that already
// called getUser() this request — the app layout runs on every navigation —
// don't pay for a second Auth network round-trip just to fetch the org.
export async function getCurrentOrg(supabase: SupabaseClient, knownUser?: User | null) {
  const user = knownUser ?? (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const orgId = (user.app_metadata as { organization_id?: string })?.organization_id;
  if (!orgId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, license_status")
    .eq("id", orgId)
    .maybeSingle();
  return org;
}
