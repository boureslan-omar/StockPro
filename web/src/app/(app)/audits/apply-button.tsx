"use client";

import { applyAudit } from "./actions";

export default function ApplyButton({ auditId }: { auditId: number }) {
  return (
    <button
      onClick={async () => {
        if (!confirm("Apply these adjustments? Product stock will be updated to match physical counts.")) return;
        await applyAudit(auditId);
      }}
      className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2"
    >
      Apply Stock Adjustments
    </button>
  );
}
