"use client";

import { useState } from "react";
import { recordCustomerPayment } from "./actions";

export default function CustomerPaymentForm({ customerId }: { customerId: number }) {
  const [method, setMethod] = useState<"cash_usd" | "cash_lbp" | "other">("cash_usd");

  return (
    <form
      action={async (fd) => {
        try {
          await recordCustomerPayment(fd);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed");
        }
      }}
      className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 mb-4 space-y-2"
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="pay_method" value={method} />
      <label className="block text-xs font-semibold text-zinc-500">Record Payment Received</label>
      <div className="flex gap-1 text-xs">
        {(["cash_usd", "cash_lbp", "other"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`px-2 py-1 rounded ${
              method === m ? "bg-green-600 text-white" : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {m === "cash_usd" ? "Cash USD" : m === "cash_lbp" ? "Cash LBP" : "Other"}
          </button>
        ))}
      </div>
      {method === "cash_lbp" ? (
        <input
          name="amount_lbp"
          type="number"
          step="1"
          min="1"
          placeholder="Amount (LBP)"
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
        />
      ) : (
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Amount (USD)"
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
        />
      )}
      <input
        name="note"
        placeholder="Note (optional)"
        className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
      />
      <button type="submit" className="rounded bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5">
        Record
      </button>
      <p className="text-xs text-zinc-500">Cash USD/LBP payments are added to the cash register. &quot;Other&quot; records only in the ledger.</p>
    </form>
  );
}
