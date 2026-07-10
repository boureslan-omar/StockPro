"use client";

import { useState } from "react";
import { recordMovement, setOpeningBalance } from "./actions";

function submitWithAlert(fn: (fd: FormData) => Promise<void>, onDone?: () => void) {
  return async (fd: FormData) => {
    try {
      await fn(fd);
      onDone?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  };
}

export function OpeningBalanceForms() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <h3 className="font-semibold mb-3">Set Opening Balance</h3>
      <div className="grid grid-cols-2 gap-3">
        <form action={submitWithAlert(setOpeningBalance)} className="space-y-2">
          <input type="hidden" name="currency" value="USD" />
          <label className="block text-xs font-semibold text-green-600">USD Drawer</label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="w-full rounded-lg border border-green-600 text-green-600 text-sm py-1.5">
            Set USD
          </button>
        </form>
        <form action={submitWithAlert(setOpeningBalance)} className="space-y-2">
          <input type="hidden" name="currency" value="LBP" />
          <label className="block text-xs font-semibold text-amber-600">LBP Drawer</label>
          <input
            name="amount"
            type="number"
            min="0"
            step="1000"
            required
            placeholder="0"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="w-full rounded-lg border border-amber-600 text-amber-600 text-sm py-1.5">
            Set LBP
          </button>
        </form>
      </div>
    </div>
  );
}

export function MovementForm({ action, label, color }: { action: "withdrawal" | "deposit"; label: string; color: "red" | "green" }) {
  const [currency, setCurrency] = useState<"USD" | "LBP">("USD");
  const borderCls = color === "red" ? "border-red-500" : "border-green-500";
  const btnCls = color === "red" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700";
  const textCls = color === "red" ? "text-red-600" : "text-green-600";

  return (
    <div className={`rounded-xl border ${borderCls} bg-white dark:bg-zinc-900 p-4`}>
      <h3 className={`font-semibold mb-3 ${textCls}`}>{label}</h3>
      <form action={submitWithAlert(recordMovement)} className="space-y-2">
        <input type="hidden" name="action" value={action} />
        <div className="flex gap-2">
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="Amount"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "LBP")}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
          >
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </div>
        <input
          name="note"
          placeholder={action === "withdrawal" ? "Reason (e.g. rent, supplies)" : "Note"}
          required={action === "withdrawal"}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          onClick={(e) => {
            if (action === "withdrawal" && !confirm("Confirm withdrawal?")) e.preventDefault();
          }}
          className={`w-full rounded-lg ${btnCls} text-white text-sm py-2`}
        >
          {action === "withdrawal" ? "Withdraw" : "Deposit"}
        </button>
      </form>
    </div>
  );
}
