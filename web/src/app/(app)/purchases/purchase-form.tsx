"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import ProductPicker, { type PickedProduct } from "@/components/product-picker";
import InlineSupplierCreate from "@/components/inline-supplier-create";
import QuickProductCreate, { type QuickProduct } from "@/components/quick-product-create";
import { savePurchase } from "./actions";

type Supplier = { id: number; name: string };
type Category = { id: number; name: string };

type Row = {
  key: number;
  product: PickedProduct | QuickProduct | null;
  itemType: "regular" | "consignment";
  quantity: string;
  unitCost: string;
  newSellPrice: string;
  expiryDate: string;
};

let nextKey = 1;
function emptyRow(): Row {
  return { key: nextKey++, product: null, itemType: "regular", quantity: "1", unitCost: "", newSellPrice: "", expiryDate: "" };
}

export default function PurchaseForm({ suppliers, categories }: { suppliers: Supplier[]; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_register");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function lineTotal(r: Row) {
    return (parseFloat(r.quantity) || 0) * (parseFloat(r.unitCost) || 0);
  }

  const totalDue = rows.filter((r) => r.itemType === "regular").reduce((s, r) => s + lineTotal(r), 0);
  const totalConsignment = rows.filter((r) => r.itemType === "consignment").reduce((s, r) => s + lineTotal(r), 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.product && (parseFloat(r.unitCost) || 0) > 0)
      .map((r) => ({
        productId: r.product!.id,
        itemType: r.itemType,
        quantity: parseFloat(r.quantity) || 0,
        unitCost: parseFloat(r.unitCost) || 0,
        newSellPrice: parseFloat(r.newSellPrice) || 0,
        expiryDate: r.expiryDate || null,
      }))
  );

  function resetForm() {
    setSupplierId("");
    setPaymentMethod("cash_register");
    setRows([emptyRow()]);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
        + New Purchase
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase" width="3xl">
        <form
          action={async (fd) => {
            try {
              const result = await savePurchase(fd);
              alert(result.message);
              setOpen(false);
              resetForm();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save purchase");
            }
          }}
          className="space-y-4 max-h-[75vh] overflow-y-auto"
        >
          <input type="hidden" name="items_json" value={itemsJson} readOnly />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Supplier *</label>
              <div className="flex gap-2">
                <select
                  name="supplier_id"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {supplierList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <InlineSupplierCreate
                  onCreated={(s) => {
                    setSupplierList((prev) => [...prev, s]);
                    setSupplierId(String(s.id));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reference</label>
              <input name="reference" placeholder="Invoice #" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input name="purchase_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Note</label>
              <input name="note" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r) => {
              const needsExpiry = r.product?.track_expiry;
              return (
                <div key={r.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <ProductPicker onPick={(p) => updateRow(r.key, { product: p, unitCost: String(p.cost_price || ""), newSellPrice: "" })} />
                      </div>
                      <QuickProductCreate
                        suppliers={supplierList}
                        categories={categories}
                        onCreated={(p) => updateRow(r.key, { product: p, unitCost: String(p.cost_price || "") })}
                      />
                    </div>
                    {r.product && <p className="text-xs text-green-600 mt-1">{r.product.name}</p>}
                  </div>
                  <div className="col-span-2">
                    <select
                      value={r.itemType}
                      onChange={(e) => updateRow(r.key, { itemType: e.target.value as "regular" | "consignment" })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    >
                      <option value="regular">Regular</option>
                      <option value="consignment">Consignment</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
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
                      placeholder="Cost"
                      value={r.unitCost}
                      onChange={(e) => updateRow(r.key, { unitCost: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder="New sell (opt.)"
                      value={r.newSellPrice}
                      onChange={(e) => updateRow(r.key, { newSellPrice: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-1 text-right pt-2">
                    <button type="button" onClick={() => removeRow(r.key)} className="text-red-600 text-xs">
                      Remove
                    </button>
                  </div>
                  {needsExpiry && (
                    <div className="col-span-12">
                      <label className="block text-xs font-medium mb-1 text-amber-600">Expiry Date * (this product tracks expiry)</label>
                      <input
                        type="date"
                        required
                        value={r.expiryDate}
                        onChange={(e) => updateRow(r.key, { expiryDate: e.target.value })}
                        className="rounded-lg border border-amber-400 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                  <div className="col-span-12 text-right text-xs text-zinc-500">Line total: ${lineTotal(r).toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="rounded-lg border border-blue-600 text-blue-600 text-sm px-3 py-1.5">
            + Add Item
          </button>

          <div className="text-right space-y-1">
            {totalConsignment > 0 && (
              <p className="text-sm text-amber-600">Consignment (due on sale): ${totalConsignment.toFixed(2)}</p>
            )}
            <p className="text-lg font-bold">
              Due now: ${totalDue.toFixed(2)} <span className="text-sm text-zinc-500">| Received total: ${(totalDue + totalConsignment).toFixed(2)}</span>
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <div>
              <label className="block text-xs font-medium mb-1">Payment Method</label>
              <select
                name="payment_method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm min-w-[260px]"
              >
                <option value="cash_register">Deduct from cash register (USD)</option>
                <option value="cash_owner">Cash from owner — deposit to register</option>
                <option value="pay_later">Pay later — show in supplier balance</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
                Save Purchase
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
