"use client";

import { useState } from "react";
import { recordSupplierPayment, adjustSupplierBalance } from "./actions";

export default function PaymentForm({
  supplierId,
  balanceUsd,
  balanceLbp,
  defaultNote,
}: {
  supplierId: number;
  balanceUsd: string;
  balanceLbp: string;
  defaultNote: string;
}) {
  const [method, setMethod] = useState<"cash_usd" | "cash_lbp" | "bank">("cash_usd");

  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 mb-4 space-y-3">
      <form
        action={async (fd) => {
          try {
            await recordSupplierPayment(fd);
          } catch (e) {
            alert(e instanceof Error ? e.message : "Failed");
          }
        }}
        className="space-y-2"
      >
        <input type="hidden" name="supplier_id" value={supplierId} />
        <input type="hidden" name="pay_method" value={method} />
        <label className="block text-xs font-semibold text-zinc-500">Record Payment to Supplier</label>
        <div className="flex gap-1 text-xs">
          {(["cash_usd", "cash_lbp", "bank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`px-2 py-1 rounded ${
                method === m ? "bg-blue-500 text-white" : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {m === "cash_usd" ? "Cash USD" : m === "cash_lbp" ? "Cash LBP" : "Bank / Other"}
            </button>
          ))}
        </div>
        {method === "cash_lbp" ? (
          <input
            name="amount_lbp"
            type="number"
            step="1"
            min="1"
            defaultValue={balanceLbp}
            placeholder="Amount (LBP)"
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
          />
        ) : (
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={balanceUsd}
            placeholder="Amount (USD)"
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
          />
        )}
        <input
          name="note"
          defaultValue={defaultNote}
          placeholder="Invoice #, cheque #, etc."
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5">
          Record Payment
        </button>
      </form>

      <details>
        <summary className="text-xs text-zinc-500 cursor-pointer">Manual adjustment</summary>
        <form
          action={async (fd) => {
            try {
              await adjustSupplierBalance(fd);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed");
            }
          }}
          className="flex gap-2 mt-1"
        >
          <input type="hidden" name="supplier_id" value={supplierId} />
          <input
            name="amount"
            type="number"
            step="0.01"
            placeholder="+ debt / − remove"
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
          />
          <input
            name="note"
            placeholder="Reason"
            required
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded bg-amber-500 hover:bg-amber-600 text-white text-sm px-3 py-1">
            Apply
          </button>
        </form>
      </details>
    </div>
  );
}
