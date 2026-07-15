"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { settleConsignment } from "./actions";

export default function SettleButton({
  supplierId,
  supplierName,
  unsettledDue,
}: {
  supplierId: number;
  supplierName: string;
  unsettledDue: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(unsettledDue.toFixed(2));
  const [method, setMethod] = useState("cash_register");
  const [note, setNote] = useState("");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5"
      >
        Settle
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Settle Consignment — ${supplierName}`}>
        <form
          action={async (fd) => {
            try {
              const result = await settleConsignment(fd);
              alert(result.message);
              setOpen(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to settle");
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="supplier_id" value={supplierId} />
          <p className="text-sm text-zinc-500">
            Unsettled due: <span className="font-semibold text-amber-600">${unsettledDue.toFixed(2)}</span>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Amount to Pay</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="cash_register">Cash Register (USD drawer)</option>
              <option value="cash_owner">Cash from owner</option>
              <option value="">Record only (no cash movement)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <input
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
              Settle
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
