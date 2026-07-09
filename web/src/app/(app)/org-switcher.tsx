"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { switchOrganization, type Membership } from "./org-actions";

export default function OrgSwitcher({ memberships, currentOrgId }: { memberships: Membership[]; currentOrgId: string | null }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const current = memberships.find((m) => m.organization_id === currentOrgId);

  async function pick(orgId: string) {
    setOpen(false);
    if (orgId === currentOrgId) return;
    setSwitching(true);
    try {
      await switchOrganization(orgId);
      const supabase = createClient();
      await supabase.auth.refreshSession();
      router.refresh();
      window.location.href = "/";
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to switch organization");
      setSwitching(false);
    }
  }

  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <span className={`h-2 w-2 rounded-full ${current?.organizations?.license_status === "active" ? "bg-green-500" : "bg-red-500"}`} />
        <span className="font-medium truncate max-w-[160px]">{current?.organizations?.name ?? "—"}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
      >
        <span className={`h-2 w-2 rounded-full ${current?.organizations?.license_status === "active" ? "bg-green-500" : "bg-red-500"}`} />
        <span className="font-medium truncate max-w-[160px]">{switching ? "Switching…" : current?.organizations?.name ?? "Select organization"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-50 overflow-hidden">
          {memberships.map((m) => (
            <button
              key={m.organization_id}
              onClick={() => pick(m.organization_id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className={`h-2 w-2 rounded-full ${m.organizations?.license_status === "active" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="flex-1 truncate">
                <span className="font-medium">{m.organizations?.name}</span>
                <span className="block text-xs text-zinc-500 capitalize">
                  {m.role} · {m.organizations?.license_status}
                </span>
              </span>
              {m.organization_id === currentOrgId && <Check className="h-4 w-4 text-green-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
