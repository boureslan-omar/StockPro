"use client";

import { useState } from "react";
import { processSupplierReturn } from "./actions";

type Batch = {
  id: number;
  cost_price: number;
  quantity_remaining: number;
  purchase_date: string;
  product_id: number;
  product_name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  reference: string | null;
};

export default function SupplierReturnsPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Batch[] | null>(null);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState<"credit" | "cash">("credit");
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/returns/batches?q=${encodeURIComponent(query.trim())}`);
    setResults(await res.json());
    setLoading(false);
  }

  function select(b: Batch) {
    setSelected(b);
    setQty("");
    setNote("");
    setRefundMethod("credit");
  }

  async function submit() {
    if (!selected) return;
    const fd = new FormData();
    fd.append("batch_id", String(selected.id));
    fd.append("supplier_id", String(selected.supplier_id ?? ""));
    fd.append("quantity", qty);
    fd.append("note", note);
    fd.append("refund_method", refundMethod);
    try {
      const result = await processSupplierReturn(fd);
      const label = result.refundMethod === "cash" ? "Cash deposited to register" : "Credit applied to supplier balance";
      alert(`Supplier return processed.\n${label}: $${result.credit.toFixed(2)}`);
      setSelected(null);
      setResults(null);
      setQuery("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  const qtyNum = parseFloat(qty) || 0;
  const previewCredit = selected ? qtyNum * Number(selected.cost_price) : 0;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
        <h3 className="font-semibold mb-3">Find Batch to Return</h3>
        <div className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Product name, barcode or purchase reference…"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          <button onClick={search} className="rounded-lg bg-blue-500 hover:bg-blue-500 text-white text-sm px-4 py-2">
            Search
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">Searching…</p>}

        {results && (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {results.length === 0 && <p className="text-sm text-zinc-500">No active batches found.</p>}
            {results.map((b) => (
              <button key={b.id} onClick={() => select(b)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm">
                <div className="flex justify-between">
                  <strong>{b.product_name}</strong>
                  <span className="text-green-600">${Number(b.cost_price).toFixed(4)}/unit</span>
                </div>
                <div className="text-xs text-zinc-500">
                  Batch #{b.id} · {b.purchase_date?.slice(0, 10)} · {b.supplier_name || "—"} · Remaining: <strong>{Number(b.quantity_remaining)}</strong>
                  {b.reference && ` · Ref: ${b.reference}`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-xl border border-amber-400 bg-white dark:bg-zinc-900 p-4 h-fit">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">
              Batch #{selected.id} — {selected.product_name}
            </h3>
            <button onClick={() => setSelected(null)} className="text-xs text-zinc-500">
              ✕ Clear
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Supplier: <strong>{selected.supplier_name || "—"}</strong> · Cost: <strong>${Number(selected.cost_price).toFixed(4)}/unit</strong> · Remaining: <strong>{Number(selected.quantity_remaining)}</strong>
          </p>

          <label className="block text-xs font-medium mb-1">Quantity to Return</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            max={selected.quantity_remaining}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm mb-2"
          />
          <label className="block text-xs font-medium mb-1">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm mb-3"
          />

          <label className="block text-xs font-medium mb-1">Refund Method</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setRefundMethod("credit")}
              className={`flex-1 text-sm px-3 py-1.5 rounded-lg border ${refundMethod === "credit" ? "bg-green-600 text-white border-green-600" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              Credit to Balance
            </button>
            <button
              onClick={() => setRefundMethod("cash")}
              className={`flex-1 text-sm px-3 py-1.5 rounded-lg border ${refundMethod === "cash" ? "bg-blue-500 text-white border-blue-500" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              Cash Refund
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">Credit reduces what you owe the supplier. Cash: supplier gives cash, deposited to register.</p>

          {qtyNum > 0 && (
            <p className="text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2 mb-3">
              {refundMethod === "cash" ? "Cash deposit to register" : "Credit to supplier balance"}: ${previewCredit.toFixed(2)}
            </p>
          )}

          <button onClick={submit} className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2">
            Process Supplier Return
          </button>
        </div>
      )}
    </div>
  );
}
