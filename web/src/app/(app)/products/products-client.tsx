"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import InlineCategoryCreate from "@/components/inline-category-create";
import InlineSupplierCreate from "@/components/inline-supplier-create";
import { saveProduct, deleteProduct } from "./actions";

export type Product = {
  id: number;
  barcode: string | null;
  name: string;
  category_id: number | null;
  supplier_id: number | null;
  product_type: "regular" | "bulk";
  product_source: "owned" | "consignment";
  consignment_supplier_id: number | null;
  consignment_cost: number;
  cost_price: number;
  sell_price: number;
  stock: number;
  low_stock_alert: number;
  unit: string | null;
  units_per_box: number;
  sell_price_box: number | null;
  track_expiry: boolean;
  categories: { name: string } | null;
  suppliers: { name: string } | null;
};

type Option = { id: number; name: string };

function generateBarcode(): string {
  // GS1 restricted-circulation prefix (20-29) reserved for in-store/internal use
  let data = "20";
  for (let i = 0; i < 10; i++) data += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(data[i]) * (i % 2 === 0 ? 1 : 3);
  const checkDigit = (10 - (sum % 10)) % 10;
  return data + checkDigit;
}

export default function ProductsClient({
  products,
  categories,
  suppliers,
}: {
  products: Product[];
  categories: Option[];
  suppliers: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [categoryList, setCategoryList] = useState(categories);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [productSource, setProductSource] = useState<"owned" | "consignment">("owned");
  const [unit, setUnit] = useState("pcs");
  const [costPrice, setCostPrice] = useState("0");
  const [sellPrice, setSellPrice] = useState("0");
  const [unitsPerBox, setUnitsPerBox] = useState("1");
  const [sellPriceBox, setSellPriceBox] = useState("");
  const [sellPriceBoxEdited, setSellPriceBoxEdited] = useState(false);
  const [barcode, setBarcode] = useState("");

  function applySuggestedSellPriceBox(sp: string, upb: string) {
    const suggested = (parseFloat(sp) || 0) * (parseFloat(upb) || 0);
    setSellPriceBox(suggested > 0 ? String(Math.round(suggested * 10000) / 10000) : "");
  }

  function openCreate() {
    setEditing(null);
    setProductSource("owned");
    setUnit("pcs");
    setCostPrice("0");
    setSellPrice("0");
    setUnitsPerBox("1");
    setSellPriceBox("");
    setSellPriceBoxEdited(false);
    setBarcode("");
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setProductSource(p.product_source);
    setUnit(p.unit ?? "pcs");
    setCostPrice(String(p.cost_price ?? 0));
    setSellPrice(String(p.sell_price ?? 0));
    setUnitsPerBox(String(p.units_per_box ?? 1));
    setSellPriceBox(p.sell_price_box != null ? String(p.sell_price_box) : "");
    setSellPriceBoxEdited(p.sell_price_box != null);
    setBarcode(p.barcode ?? "");
    setOpen(true);
  }

  const costPerBox = (parseFloat(costPrice) || 0) * (parseFloat(unitsPerBox) || 0);

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-6">
        <span className="text-sm text-zinc-500">
          {products.length} product{products.length === 1 ? "" : "s"}
        </span>
        <button onClick={openCreate} className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
          + Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500">
          No products yet. Add one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
          <table className="w-full text-sm bg-white dark:bg-zinc-900">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Barcode</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = Number(p.stock) <= Number(p.low_stock_alert);
                return (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{p.barcode ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {p.name}
                      {p.product_source === "consignment" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          Consignment
                        </span>
                      )}
                      {p.product_type === "bulk" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Bulk</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{p.categories?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{p.suppliers?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">${Number(p.cost_price).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">${Number(p.sell_price).toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right ${low ? "text-red-600 font-semibold" : ""}`}>
                      {Number(p.stock)} {p.unit ?? ""}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3">
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${p.name}"?`)) return;
                          try {
                            await deleteProduct(p.id);
                          } catch (e) {
                            alert(e instanceof Error ? e.message : "Failed to delete");
                          }
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Product" : "Add Product"} width="2xl">
        <form
          key={editing?.id ?? "new"}
          action={async (fd) => {
            try {
              await saveProduct(fd);
              setOpen(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save product");
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />

          <div>
            <label className="block text-sm font-medium mb-1">Product Name *</label>
            <input
              name="name"
              required
              autoFocus
              defaultValue={editing?.name ?? ""}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Barcode</label>
              <div className="relative">
                <input
                  name="barcode"
                  placeholder="Scan or leave blank"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm pr-20"
                />
                {!barcode && (
                  <button
                    type="button"
                    onClick={() => setBarcode(generateBarcode())}
                    title="Auto-generate an internal barcode"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md border border-blue-600 text-blue-600 bg-white dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    Generate
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select
                name="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
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
                <select
                  name="category_id"
                  defaultValue={editing?.category_id ?? ""}
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
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
              <label className="block text-sm font-medium mb-1">Product Type</label>
              <select
                name="product_type"
                defaultValue={editing?.product_type ?? "regular"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="regular">Regular (tracked stock)</option>
                <option value="bulk">Bulk (no batch tracking)</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="product_source"
                  value="owned"
                  checked={productSource === "owned"}
                  onChange={() => setProductSource("owned")}
                />
                Owned
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="product_source"
                  value="consignment"
                  checked={productSource === "consignment"}
                  onChange={() => setProductSource("consignment")}
                />
                Consignment
              </label>
            </div>

            {productSource === "owned" ? (
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <div className="flex gap-2">
                  <select
                    name="supplier_id"
                    defaultValue={editing?.supplier_id ?? ""}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  >
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
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Consignment Supplier *</label>
                  <div className="flex gap-2">
                    <select
                      name="consignment_supplier_id"
                      defaultValue={editing?.consignment_supplier_id ?? ""}
                      required={productSource === "consignment"}
                      className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    >
                      <option value="">— Select —</option>
                      {supplierList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <InlineSupplierCreate onCreated={(s) => setSupplierList((prev) => [...prev, s])} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Consignment Cost (owed to supplier per unit)</label>
                  <input
                    name="consignment_cost"
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue={editing?.consignment_cost ?? 0}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cost Price (per unit)</label>
              <input
                name="cost_price"
                type="number"
                min="0"
                step="0.0001"
                value={costPrice}
                onChange={(e) => {
                  setCostPrice(e.target.value);
                }}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sell Price (per unit)</label>
              <input
                name="sell_price"
                type="number"
                min="0"
                step="0.0001"
                value={sellPrice}
                onChange={(e) => {
                  setSellPrice(e.target.value);
                  if (!sellPriceBoxEdited) applySuggestedSellPriceBox(e.target.value, unitsPerBox);
                }}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {unit === "box" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Units per Box</label>
                <input
                  name="units_per_box"
                  type="number"
                  min="1"
                  step="1"
                  value={unitsPerBox}
                  onChange={(e) => {
                    setUnitsPerBox(e.target.value);
                    if (!sellPriceBoxEdited) applySuggestedSellPriceBox(sellPrice, e.target.value);
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
                {costPerBox > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">Cost per box: ${costPerBox.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sell Price / Box</label>
                <input
                  name="sell_price_box"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Optional"
                  value={sellPriceBox}
                  onChange={(e) => {
                    setSellPriceBox(e.target.value);
                    setSellPriceBoxEdited(true);
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Auto-filled as unit price × units per box —{" "}
                  <button
                    type="button"
                    onClick={() => {
                      applySuggestedSellPriceBox(sellPrice, unitsPerBox);
                      setSellPriceBoxEdited(false);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    reset to suggested
                  </button>
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Low Stock Alert</label>
            <input
              name="low_stock_alert"
              type="number"
              min="0"
              step="0.001"
              defaultValue={editing?.low_stock_alert ?? 5}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>

          {editing && (
            <p className="text-xs text-zinc-500">
              Current stock: <span className="font-medium">{Number(editing.stock)} {editing.unit}</span> — stock is only changed via Purchases,
              POS, Wastage, or Audits, not from this form.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <input type="checkbox" name="track_expiry" value="1" defaultChecked={editing?.track_expiry ?? false} />
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
            <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
              Save Product
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
