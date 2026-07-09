"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import ProductPicker, { type PickedProduct } from "@/components/product-picker";
import { saveQuotation } from "./actions";

type Customer = { id: number; name: string };

type Row = {
  key: number;
  productId: number | null;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

let nextKey = 1;
function emptyRow(): Row {
  return { key: nextKey++, productId: null, productName: "", unit: "pcs", quantity: "1", unitPrice: "" };
}

export type EditingQuotation = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  valid_until: string | null;
  note: string | null;
  quotation_items: { product_id: number | null; product_name: string; unit: string | null; quantity: number; unit_price: number }[];
};

export default function QuotationForm({
  customers,
  editing,
  open,
  onClose,
}: {
  customers: Customer[];
  editing: EditingQuotation | null;
  open: boolean;
  onClose: () => void;
}) {
  const [customerId, setCustomerId] = useState(editing?.customer_id ? String(editing.customer_id) : "");
  const [customerName, setCustomerName] = useState(editing?.customer_name ?? "");
  const [rows, setRows] = useState<Row[]>(
    editing?.quotation_items.length
      ? editing.quotation_items.map((it) => ({
          key: nextKey++,
          productId: it.product_id,
          productName: it.product_name,
          unit: it.unit || "pcs",
          quantity: String(it.quantity),
          unitPrice: String(it.unit_price),
        }))
      : [emptyRow()]
  );

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function lineTotal(r: Row) {
    return (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
  }

  const total = rows.reduce((s, r) => s + lineTotal(r), 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.productId && (parseFloat(r.quantity) || 0) > 0)
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        unit: r.unit,
        quantity: parseFloat(r.quantity) || 0,
        unitPrice: parseFloat(r.unitPrice) || 0,
      }))
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit Quotation` : "New Quotation"} width="3xl">
      <form
        key={editing?.id ?? "new"}
        action={async (fd) => {
          try {
            await saveQuotation(fd);
            onClose();
          } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to save quotation");
          }
        }}
        className="space-y-4 max-h-[75vh] overflow-y-auto"
      >
        <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
        <input type="hidden" name="items_json" value={itemsJson} readOnly />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Customer</label>
            <select
              name="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="">— Not in system —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Or Customer Name</label>
            <input
              name="customer_name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={!!customerId}
              placeholder="Prospect not in system yet"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Valid Until</label>
            <input
              name="valid_until"
              type="date"
              defaultValue={editing?.valid_until ?? ""}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                <ProductPicker
                  onPick={(p: PickedProduct) =>
                    updateRow(r.key, { productId: p.id, productName: p.name, unit: p.unit || "pcs", unitPrice: String(p.sell_price || "") })
                  }
                />
                {r.productName && <p className="text-xs text-green-600 mt-1">{r.productName}</p>}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="Qty"
                  value={r.quantity}
                  onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Unit Price"
                  value={r.unitPrice}
                  onChange={(e) => updateRow(r.key, { unitPrice: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 text-sm pt-2 text-right">${lineTotal(r).toFixed(2)}</div>
              <div className="col-span-1 text-right pt-2">
                <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-600 text-xs">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="rounded-lg border border-blue-600 text-blue-600 text-sm px-3 py-1.5">
          + Add Item
        </button>

        <div>
          <label className="block text-xs font-medium mb-1">Note</label>
          <textarea
            name="note"
            rows={2}
            defaultValue={editing?.note ?? ""}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <p className="text-lg font-bold">Total: ${total.toFixed(2)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
              Save Quotation
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
