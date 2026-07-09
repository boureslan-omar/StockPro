"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { voidSale } from "./actions";

export default function VoidButton({ saleId, receiptNo }: { saleId: number; receiptNo: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Voided by admin");
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Void this sale" className="text-red-600 hover:underline">
        Void
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Void Sale #${receiptNo}`}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            This restores stock (and, for regular products, the most recent batch), reverses any customer balance change, and reverses the cash
            register effect of this sale.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const res = await voidSale(saleId, reason);
                  alert(res.message);
                  setOpen(false);
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to void sale");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
            >
              {submitting ? "Voiding…" : "Void Sale"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
