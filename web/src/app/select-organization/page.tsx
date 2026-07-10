"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMyMemberships, switchOrganization, type Membership } from "../(app)/org-actions";

function SelectOrganizationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    getMyMemberships().then(({ memberships, currentOrgId }) => {
      if (memberships.length <= 1) {
        router.replace(redirectTo);
        return;
      }
      setMemberships(memberships);
      setCurrentOrgId(currentOrgId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(orgId: string) {
    setSwitching(orgId);
    setError(null);
    try {
      if (orgId !== currentOrgId) {
        const result = await switchOrganization(orgId);
        if (!result.ok) {
          setError(result.message ?? "Failed to select organization");
          setSwitching(null);
          return;
        }
        const supabase = createClient();
        await supabase.auth.refreshSession();
      }
      window.location.href = redirectTo;
    } catch {
      setError("Failed to select organization — please try again.");
      setSwitching(null);
    }
  }

  if (!memberships) {
    return <p className="text-sm text-zinc-500">Loading your organizations…</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      {memberships.map((m) => (
        <button
          key={m.organization_id}
          onClick={() => pick(m.organization_id)}
          disabled={!!switching}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-left disabled:opacity-50 transition"
        >
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${m.organizations?.license_status === "active" ? "bg-green-500" : "bg-red-500"}`} />
          <span className="flex-1">
            <span className="font-medium block">{m.organizations?.name}</span>
            <span className="text-xs text-zinc-500 capitalize">
              {m.role} · {m.organizations?.license_status}
            </span>
          </span>
          {switching === m.organization_id && <span className="text-xs text-zinc-500">Entering…</span>}
        </button>
      ))}
    </div>
  );
}

export default function SelectOrganizationPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Choose an organization</h1>
        <p className="text-sm text-zinc-500 mb-6">Your account has access to more than one business. Pick which one to open.</p>
        <Suspense>
          <SelectOrganizationInner />
        </Suspense>
      </div>
    </main>
  );
}
