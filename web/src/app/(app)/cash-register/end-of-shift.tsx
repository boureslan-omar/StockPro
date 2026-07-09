"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { fmtUSD, fmtLBP } from "@/lib/format";
import { endOfShift } from "./actions";
import type { ShiftStats } from "@/lib/shift";

export default function EndOfShift({
  balanceUsd,
  balanceLbp,
  stats,
  since,
}: {
  balanceUsd: number;
  balanceLbp: number;
  stats: ShiftStats;
  since: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2">
        End of Shift
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="End of Shift — Snapshot">
        <div className="space-y-4">
          <p className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2">
            Shift period: {since ? `From ${new Date(since).toLocaleString()} to now` : "All time — no previous shift logged"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-500 text-center p-3">
              <p className="text-xs text-zinc-500">USD Drawer (current)</p>
              <p className="text-2xl font-bold text-green-600">{fmtUSD(balanceUsd)}</p>
            </div>
            <div className="rounded-lg border border-amber-500 text-center p-3">
              <p className="text-xs text-zinc-500">LBP Drawer (current)</p>
              <p className="text-2xl font-bold text-amber-600">{fmtLBP(balanceLbp)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-blue-500 p-2">
              <p className="text-zinc-500">Cash Sales</p>
              <p className="font-bold text-blue-600">{stats.salesCount} txn</p>
              <p className="text-zinc-500">{fmtUSD(stats.salesTotal)}</p>
            </div>
            <div className="rounded-lg border border-green-500 p-2">
              <p className="text-zinc-500">Cash In USD</p>
              <p className="font-bold text-green-600">{fmtUSD(stats.inUsd)}</p>
            </div>
            <div className="rounded-lg border border-green-500 p-2">
              <p className="text-zinc-500">Cash In LBP</p>
              <p className="font-bold text-green-600">{fmtLBP(stats.inLbp)}</p>
            </div>
            <div className="rounded-lg border border-red-500 p-2">
              <p className="text-zinc-500">Cash Out USD</p>
              <p className="font-bold text-red-600">{fmtUSD(stats.outUsd)}</p>
            </div>
            <div className="rounded-lg border border-red-500 p-2">
              <p className="text-zinc-500">Cash Out LBP</p>
              <p className="font-bold text-red-600">{fmtLBP(stats.outLbp)}</p>
            </div>
          </div>

          <form
            action={async (fd) => {
              await endOfShift(fd);
              setOpen(false);
            }}
            className="space-y-2"
          >
            <label className="block text-sm font-medium">Note (optional)</label>
            <input
              name="shift_note"
              placeholder="e.g. Counted till, no discrepancy"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">Balance is not reset — this is a read-only snapshot for your records.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2">
                Confirm &amp; Log Shift
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
