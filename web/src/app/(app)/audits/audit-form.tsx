"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { createAudit } from "./actions";

type Product = { id: number; name: string; stock: number; unit: string | null; category_id: number | null; cat_name: string | null };
type Category = { id: number; name: string };

export default function AuditForm({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  function resetForm() {
    setCounts({});
    setNotes({});
    setCatFilter("");
  }

  const visibleProducts = catFilter ? products.filter((p) => String(p.category_id) === catFilter) : products;

  const itemsJson = JSON.stringify(
    products
      .filter((p) => counts[p.id] !== undefined && counts[p.id] !== "")
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        systemQty: Number(p.stock),
        physicalQty: parseFloat(counts[p.id]),
        unit: p.unit || "pcs",
        note: notes[p.id] || "",
      }))
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
        + New Audit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New Stock Audit">
        <form
          action={async (fd) => {
            try {
              const result = await createAudit(fd);
              alert(result.message);
              setOpen(false);
              resetForm();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save audit");
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="items_json" value={itemsJson} readOnly />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Audit Date</label>
              <input name="audit_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Filter by Category</label>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Note (optional)</label>
              <input name="note" placeholder="e.g. Monthly audit" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-zinc-500">Enter the physical count for each product. Leave blank to skip.</p>
            <button
              type="button"
              onClick={() => {
                const all: Record<number, string> = {};
                visibleProducts.forEach((p) => (all[p.id] = String(p.stock)));
                setCounts((prev) => ({ ...prev, ...all }));
              }}
              className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5"
            >
              Reset All to System Qty
            </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                <tr className="text-left">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">System Qty</th>
                  <th className="px-3 py-2">Physical Count</th>
                  <th className="px-3 py-2 text-center">Variance</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p) => {
                  const countVal = counts[p.id];
                  const variance = countVal !== undefined && countVal !== "" ? parseFloat(countVal) - Number(p.stock) : null;
                  return (
                    <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-1.5">
                        {p.name}
                        {p.cat_name && <span className="text-xs text-zinc-500 ml-2">{p.cat_name}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-zinc-500">
                        {Number(p.stock)} {p.unit}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="Count…"
                          value={countVal ?? ""}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-24 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-center"
                        />
                      </td>
                      <td
                        className={`px-3 py-1.5 text-center font-semibold ${
                          variance === null ? "text-zinc-400" : Math.abs(variance) < 0.001 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-amber-600"
                        }`}
                      >
                        {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance.toFixed(3)}`}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={notes[p.id] || ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Optional"
                          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
              Save Audit
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
