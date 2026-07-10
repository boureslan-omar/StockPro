"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { getPurchaseItems } from "./actions";
import { fmtUSD } from "@/lib/format";

type Item = {
  id: number;
  product_name: string;
  product_type: string;
  quantity: number;
  unit_cost: number;
  total: number;
  batch_action: string | null;
};

export default function ViewPurchase({ purchaseId, label }: { purchaseId: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  async function show() {
    setOpen(true);
    setLoading(true);
    const data = await getPurchaseItems(purchaseId);
    setItems(data as Item[]);
    setLoading(false);
  }

  return (
    <>
      <button onClick={show} className="text-blue-600 hover:underline text-xs mr-3">
        View
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Purchase ${label}`}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto pr-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-1.5">Product</th>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5">Qty</th>
                  <th className="py-1.5">Cost</th>
                  <th className="py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                    <td className="py-1.5">{it.product_name}</td>
                    <td className="py-1.5 text-xs">{it.product_type}</td>
                    <td className="py-1.5">{Number(it.quantity)}</td>
                    <td className="py-1.5">{fmtUSD(it.unit_cost)}</td>
                    <td className="py-1.5 font-medium">{fmtUSD(it.total)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500">
                      No items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
