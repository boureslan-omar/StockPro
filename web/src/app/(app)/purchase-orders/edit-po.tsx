"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import InlineSupplierCreate from "@/components/inline-supplier-create";
import { getPOItems, updatePO } from "./actions";
import { type Row, emptyRow, ProductNameInput } from "./po-row";

type Supplier = { id: number; name: string };

export default function EditPO({
  poId,
  poNumber,
  suppliers,
  supplierId: initialSupplierId,
  deliveryDate: initialDeliveryDate,
  note: initialNote,
}: {
  poId: number;
  poNumber: string;
  suppliers: Supplier[];
  supplierId: number;
  deliveryDate: string | null;
  note: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [supplierId, setSupplierId] = useState(String(initialSupplierId));
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate || "");
  const [note, setNote] = useState(initialNote || "");
  const [rows, setRows] = useState<Row[]>([]);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    const items = await getPOItems(poId);
    setRows(
      items.length
        ? items.map((it) => ({
            key: it.id,
            productId: it.product_id,
            productName: it.product_name,
            unit: it.unit || "pcs",
            unitsPerBox: it.units_per_box || 1,
            quantity: String(it.quantity),
            estimatedPrice: String(it.estimated_price || ""),
            note: it.note || "",
            newProductSource: (it.new_product_source as "regular" | "consignment") || "regular",
          }))
        : [emptyRow()]
    );
    setLoading(false);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.productName.trim())
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        quantity: parseFloat(r.quantity) || 1,
        unit: r.unit,
        newProductUnitsPerBox: !r.productId && r.unit === "box" ? Math.max(1, Math.round(r.unitsPerBox || 1)) : 1,
        estimatedPrice: parseFloat(r.estimatedPrice) || 0,
        note: r.note,
        newProductSource: r.newProductSource,
      }))
  );

  return (
    <>
      <button onClick={openModal} className="text-blue-600 hover:underline text-xs mr-3">
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Edit Purchase Order — ${poNumber}`} width="3xl">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <form
            action={async (fd) => {
              try {
                const result = await updatePO(fd);
                alert(result.message);
                setOpen(false);
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to update PO");
              }
            }}
            className="space-y-4 max-h-[75vh] overflow-y-auto"
          >
            <input type="hidden" name="po_id" value={poId} />
            <input type="hidden" name="items_json" value={itemsJson} readOnly />

            <div className="grid grid-cols-3 gap-3">
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
                <label className="block text-xs font-medium mb-1">Expected Delivery</label>
                <input
                  name="delivery_date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Note</label>
                <input
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for supplier"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <ProductNameInput row={r} onChange={(patch) => updateRow(r.key, patch)} />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">Qty</label>
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
                    <label className="block text-[10px] text-zinc-500 mb-0.5">Unit</label>
                    <select
                      value={r.unit}
                      onChange={(e) => updateRow(r.key, { unit: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    >
                      {["pcs", "kg", "box", "crate", "doz", "L", "pack"].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-zinc-500 mb-0.5">Est. price/{r.unit === "box" ? "box" : "unit"}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder="Est. price"
                      value={r.estimatedPrice}
                      onChange={(e) => updateRow(r.key, { estimatedPrice: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      placeholder="Note"
                      value={r.note}
                      onChange={(e) => updateRow(r.key, { note: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-1 text-right pt-2">
                    <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-600 text-xs">
                      ✕
                    </button>
                  </div>
                  {!r.productId && r.unit === "box" && (
                    <div className="col-span-12">
                      <label className="block text-xs font-medium mb-1">Units per Box (new product)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={r.unitsPerBox}
                        onChange={(e) => updateRow(r.key, { unitsPerBox: Number(e.target.value) || 1 })}
                        className="w-32 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                  {!r.productId && (
                    <div className="col-span-12 flex gap-4 text-sm">
                      <span className="text-xs text-zinc-500 pt-1">New product type:</span>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="radio" checked={r.newProductSource === "regular"} onChange={() => updateRow(r.key, { newProductSource: "regular" })} />
                        Regular
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="radio"
                          checked={r.newProductSource === "consignment"}
                          onChange={() => updateRow(r.key, { newProductSource: "consignment" })}
                        />
                        Consignment
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="rounded-lg border border-blue-600 text-blue-600 text-sm px-3 py-1.5"
            >
              + Add Item
            </button>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
