"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { getPOItems, receivePO } from "./actions";

type POItem = {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  current_cost: number;
  sell_price: number;
  track_expiry: boolean;
  new_product_source: string;
};

type ReceiveRow = {
  productId: number | null;
  productName: string;
  unit: string;
  quantity: string;
  cost: string;
  sell: string;
  newProductSource: "regular" | "consignment";
  trackExpiry: boolean;
  expiryDate: string;
  existingTrackExpiry: boolean;
};

export default function ReceivePO({ poId, poNumber }: { poId: number; poNumber: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [note, setNote] = useState("");
  const [settlementMethod, setSettlementMethod] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");

  async function openModal() {
    setOpen(true);
    setLoading(true);
    const items = (await getPOItems(poId)) as POItem[];
    const newRows: ReceiveRow[] = items.map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      unit: it.unit,
      quantity: String(it.quantity),
      cost: String(it.estimated_price > 0 ? it.estimated_price : it.current_cost || 0),
      sell: it.sell_price ? String(it.sell_price) : "",
      newProductSource: (it.new_product_source as "regular" | "consignment") || "regular",
      trackExpiry: false,
      expiryDate: "",
      existingTrackExpiry: it.track_expiry,
    }));
    setRows(newRows);
    const grand = newRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.cost) || 0), 0);
    setSettlementAmount(grand.toFixed(2));
    setLoading(false);
  }

  function updateRow(i: number, patch: Partial<ReceiveRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const grandTotal = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.cost) || 0), 0);

  return (
    <>
      <button onClick={openModal} className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-2.5 py-1.5">
        Receive
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Receive PO — ${poNumber}`}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <form
            action={async (fd) => {
              try {
                const result = await receivePO(fd);
                alert(result.message);
                setOpen(false);
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to receive PO");
              }
            }}
            className="space-y-4 max-h-[75vh] overflow-y-auto"
          >
            <input type="hidden" name="po_id" value={poId} />
            <input
              type="hidden"
              name="items_json"
              readOnly
              value={JSON.stringify(
                rows.map((r) => ({
                  productId: r.productId,
                  productName: r.productName,
                  quantity: parseFloat(r.quantity) || 0,
                  unit: r.unit,
                  cost: parseFloat(r.cost) || 0,
                  sell: parseFloat(r.sell) || 0,
                  newProductSource: r.newProductSource,
                  trackExpiry: r.trackExpiry,
                  expiryDate: r.expiryDate || null,
                }))
              )}
            />

            <p className="text-xs text-zinc-500">Adjust quantities and costs to match what was actually delivered. Sell price is optional.</p>

            <div className="space-y-2">
              {rows.map((r, i) => {
                const needsExpiry = r.productId ? r.existingTrackExpiry : r.trackExpiry;
                return (
                  <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                      <p className="text-sm font-medium">{r.productName}</p>
                      <p className="text-xs text-zinc-500">{r.unit}</p>
                      {!r.productId && (
                        <label className="flex items-center gap-1.5 text-xs mt-1">
                          <input type="checkbox" checked={r.trackExpiry} onChange={(e) => updateRow(i, { trackExpiry: e.target.checked })} />
                          Track Expiry
                        </label>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-0.5">Qty received</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={r.quantity}
                        onChange={(e) => updateRow(i, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-0.5">Cost/unit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={r.cost}
                        onChange={(e) => updateRow(i, { cost: e.target.value })}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-0.5">Sell price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="unchanged"
                        value={r.sell}
                        onChange={(e) => updateRow(i, { sell: e.target.value })}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-semibold text-green-600 pt-5">
                      ${((parseFloat(r.quantity) || 0) * (parseFloat(r.cost) || 0)).toFixed(2)}
                    </div>
                    {needsExpiry && (
                      <div className="col-span-12">
                        <label className="block text-xs font-medium mb-1 text-red-600">Expiry Date *</label>
                        <input
                          type="date"
                          required
                          value={r.expiryDate}
                          onChange={(e) => updateRow(i, { expiryDate: e.target.value })}
                          className="rounded-lg border border-red-400 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-right font-bold">Grand Total: ${grandTotal.toFixed(2)}</p>

            <div>
              <label className="block text-xs font-medium mb-1">Delivery Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} name="note" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>

            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 space-y-2">
              <p className="text-sm font-semibold">Payment Settlement</p>
              <select
                name="settlement_method"
                value={settlementMethod}
                onChange={(e) => setSettlementMethod(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="">— Record receipt only (pay later) —</option>
                <option value="cash_register">Cash Register — USD drawer</option>
                <option value="cash_owner">Cash from owner</option>
              </select>
              {settlementMethod && (
                <input
                  name="settlement_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2">
                Commit Receipt &amp; Update Stock
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
