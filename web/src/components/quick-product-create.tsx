"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import InlineSupplierCreate from "@/components/inline-supplier-create";
import InlineCategoryCreate from "@/components/inline-category-create";
import { createProductQuick } from "@/lib/actions/quick-create";

export type QuickProduct = {
  id: number;
  name: string;
  barcode: string | null;
  unit: string | null;
  cost_price: number;
  sell_price: number;
  stock: number;
  track_expiry: boolean;
  product_type: string;
};

export default function QuickProductCreate({
  suppliers,
  categories,
  onCreated,
  initialName = "",
}: {
  suppliers: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  onCreated: (p: QuickProduct) => void;
  initialName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [categoryList, setCategoryList] = useState(categories);
  const [trackExpiry, setTrackExpiry] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Add new product"
        className="rounded-lg border border-green-600 text-green-600 px-2.5 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-950/30"
      >
        +
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add New Product">
        <form
          action={async (fd) => {
            try {
              const p = await createProductQuick(fd);
              onCreated(p);
              setOpen(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to create product");
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Product Name *</label>
            <input
              name="name"
              required
              defaultValue={initialName}
              autoFocus
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <input name="barcode" placeholder="Scan or leave blank" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select name="unit" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
                {["pcs", "box", "kg", "g", "L", "mL"].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <div className="flex gap-2">
                <select name="category_id" className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <InlineCategoryCreate onCreated={(c) => setCategoryList((prev) => [...prev, c])} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier</label>
              <div className="flex gap-2">
                <select name="supplier_id" className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {supplierList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <InlineSupplierCreate onCreated={(s) => setSupplierList((prev) => [...prev, s])} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cost Price</label>
              <input name="cost_price" type="number" min="0" step="0.0001" defaultValue="0" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sell Price</label>
              <input name="sell_price" type="number" min="0" step="0.0001" defaultValue="0" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Low Stock Alert</label>
            <input name="low_stock_alert" type="number" min="0" step="0.001" defaultValue="5" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          </div>

          <label className="flex items-center gap-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <input
              type="checkbox"
              name="track_expiry"
              value="1"
              checked={trackExpiry}
              onChange={(e) => setTrackExpiry(e.target.checked)}
            />
            <span>
              <span className="font-medium">Track Expiry</span>
              <p className="text-zinc-500 text-xs">
                Every batch of this product will require an expiry date. Expired stock is automatically flagged as wastage and blocked from sale.
              </p>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
              Create &amp; Add
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
