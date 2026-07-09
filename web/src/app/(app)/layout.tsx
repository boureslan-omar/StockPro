import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import LogoutButton from "@/components/logout-button";
import AppShell from "./app-shell";
import { getMyMemberships } from "./org-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // License gate: JWT app_metadata carries the current org. No row (stale
  // pre-tenant session) or a non-active license both block access.
  const org = await getCurrentOrg(supabase);

  if (!org || org.license_status !== "active") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <h1 className="text-xl font-bold mb-2">
            {org ? "Subscription inactive" : "Session refresh needed"}
          </h1>
          <p className="text-sm text-zinc-500 mb-4">
            {org
              ? `The ${org.name} subscription is currently ${org.license_status}. Please contact your provider to restore access.`
              : "Your account was updated. Please log out and sign in again to continue."}
          </p>
          <LogoutButton />
        </div>
      </main>
    );
  }

  const [{ memberships, currentOrgId }, { count: memberCount }] = await Promise.all([
    getMyMemberships(),
    supabase.from("org_memberships").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
  ]);

  return (
    <AppShell
      userLabel={`${profile?.full_name || user.email}${profile?.role ? ` · ${profile.role}` : ""}`}
      memberships={memberships}
      currentOrgId={currentOrgId}
      orgName={org.name}
      licenseStatus={org.license_status}
      memberCount={memberCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
