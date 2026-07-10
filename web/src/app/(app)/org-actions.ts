"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Membership = {
  organization_id: string;
  role: string;
  organizations: { id: string; name: string; slug: string; license_status: string } | null;
};

export async function getMyMemberships(): Promise<{ memberships: Membership[]; currentOrgId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { memberships: [], currentOrgId: null };

  const { data: memberships } = await supabase
    .from("org_memberships")
    .select("organization_id, role, organizations(id, name, slug, license_status)")
    .eq("user_id", user.id);

  const currentOrgId = (user.app_metadata as { organization_id?: string })?.organization_id ?? null;
  return { memberships: (memberships ?? []) as unknown as Membership[], currentOrgId };
}

// Returns a result object rather than throwing: Next.js redacts thrown Server
// Action errors in production builds (replaced with a generic "error occurred
// in the Server Components render" message with no detail), which made real
// failures here impossible to diagnose from the client. Returning the failure
// as plain data sidesteps that redaction entirely.
export async function switchOrganization(targetOrgId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", targetOrgId)
    .single();
  if (!membership) return { ok: false, message: "You are not a member of that organization." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      message: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set in this deployment's environment variables.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { organization_id: targetOrgId, role: membership.role },
  });
  if (error) return { ok: false, message: error.message };

  await admin.from("profiles").update({ organization_id: targetOrgId, role: membership.role }).eq("id", user.id);

  return { ok: true };
}
