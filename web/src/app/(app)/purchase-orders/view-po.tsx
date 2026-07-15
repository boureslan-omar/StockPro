"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { getPOItems } from "./actions";

type Item = {
  id: number;
  product_name: string;
  quantity: number;
  unit: string;
  units_per_box: number;
  estimated_price: number;
  note: string | null;
};

export default function ViewPO({ poId, label }: { poId: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  async function show() {
    setOpen(true);
    setLoading(true);
    const data = await getPOItems(poId);
    setItems(data as unknown as Item[]);
    setLoading(false);
  }

  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.estimated_price), 0);

  return (
    <>
      <button onClick={show} className="text-blue-600 hover:underline text-xs mr-3">
        Preview
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Purchase Order ${label}`}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 text-xs border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-1.5">Product</th>
                <th className="py-1.5">Qty</th>
                <th className="py-1.5">Unit</th>
                <th className="py-1.5 text-right">Est. Price</th>
                <th className="py-1.5 text-right">Line Total</th>
                <th className="py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="py-1.5">
                    {it.product_name}
                    {it.unit === "box" && it.units_per_box > 1 && (
                      <span className="text-xs text-zinc-500"> (box of {it.units_per_box})</span>
                    )}
                  </td>
                  <td className="py-1.5">{Number(it.quantity)}</td>
                  <td className="py-1.5">{it.unit}</td>
                  <td className="py-1.5 text-right">${Number(it.estimated_price).toFixed(2)}</td>
                  <td className="py-1.5 text-right font-medium">${(Number(it.quantity) * Number(it.estimated_price)).toFixed(2)}</td>
                  <td className="py-1.5 text-xs text-zinc-500">{it.note || ""}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-500">
                    No items.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-2" colSpan={4}>
                  TOTAL
                </td>
                <td className="py-2 text-right">${total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </Modal>
    </>
  );
}
