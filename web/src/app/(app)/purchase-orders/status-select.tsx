"use client";

import { updatePOStatus } from "./actions";

const STATUSES = ["draft", "sent", "confirmed", "cancelled"];

export default function StatusSelect({ poId, status }: { poId: number; status: string }) {
  if (status === "received") {
    return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Received</span>;
  }

  return (
    <select
      defaultValue={status}
      onChange={(e) => updatePOStatus(poId, e.target.value)}
      className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s[0].toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
