import type { SupabaseClient } from "@supabase/supabase-js";

// Fetches exactly the caller's *currently active* organization (the one baked
// into their JWT app_metadata). Since a user can now belong to more than one
// org (org_memberships), RLS on `organizations` allows reading every org a
// user is a member of — so any query here MUST filter by this id explicitly;
// relying on RLS + .single()/.maybeSingle() to narrow to "the" org is no
// longer safe once a user has more than one membership.
export async function getCurrentOrg(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
