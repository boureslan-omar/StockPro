"use client";

import { useState, useRef, useEffect } from "react";
import Modal from "@/components/modal";
import InlineSupplierCreate from "@/components/inline-supplier-create";
import { createPO } from "./actions";

type Supplier = { id: number; name: string };
type Match = { id: number; name: string; unit: string | null; cost_price: number };

type Row = {
  key: number;
  productId: number | null;
  productName: string;
  unit: string;
  estimatedPrice: string;
  note: string;
  newProductSource: "regular" | "consignment";
};

let nextKey = 1;
function emptyRow(): Row {
  return { key: nextKey++, productId: null, productName: "", unit: "pcs", estimatedPrice: "", note: "", newProductSource: "regular" };
}

function ProductNameInput({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (row.productName.trim().length < 2 || row.productId) {
      setMatches([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(row.productName.trim())}`);
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
      setOpen(true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.productName]);

  return (
    <div className="relative">
      <input
        value={row.productName}
        onChange={(e) => onChange({ productName: e.target.value, productId: null })}
        placeholder="Product name or search existing…"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange({ productId: m.id, productName: m.name, unit: m.unit || "pcs", estimatedPrice: String(m.cost_price || "") });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {m.name} <span className="text-zinc-500 text-xs">{m.unit}</span>
            </button>
          ))}
        </div>
      )}
      {row.productId && <p className="text-xs text-green-600 mt-1">Existing product selected</p>}
    </div>
  );
}

export default function POForm({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [supplierId, setSupplierId] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.productName.trim())
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        quantity: 1,
        unit: r.unit,
        estimatedPrice: parseFloat(r.estimatedPrice) || 0,
        note: r.note,
        newProductSource: r.newProductSource,
      }))
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2">
        + New Purchase Order
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Order">
        <form
          action={async (fd) => {
            try {
              const result = await createPO(fd);
              alert(result.message);
              setOpen(false);
              setSupplierId("");
              setRows([emptyRow()]);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to create PO");
            }
          }}
          className="space-y-4 max-h-[75vh] overflow-y-auto"
        >
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
              <input name="delivery_date" type="date" min={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Note</label>
              <input name="note" placeholder="Optional note for supplier" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <ProductNameInput row={r} onChange={(patch) => updateRow(r.key, patch)} />
                </div>
                <div className="col-span-2">
                  <select value={r.unit} onChange={(e) => updateRow(r.key, { unit: e.target.value })} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm">
                    {["pcs", "kg", "box", "crate", "doz", "L", "pack"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
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
                {!r.productId && (
                  <div className="col-span-12 flex gap-4 text-sm">
                    <span className="text-xs text-zinc-500 pt-1">New product type:</span>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="radio" checked={r.newProductSource === "regular"} onChange={() => updateRow(r.key, { newProductSource: "regular" })} />
                      Regular
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="radio" checked={r.newProductSource === "consignment"} onChange={() => updateRow(r.key, { newProductSource: "consignment" })} />
                      Consignment
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="rounded-lg border border-blue-600 text-blue-600 text-sm px-3 py-1.5">
            + Add Item
          </button>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2">
              Create Purchase Order
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
