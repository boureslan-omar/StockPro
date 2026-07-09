"use client";

import { useState } from "react";
import { processCustomerReturn } from "./actions";

type Customer = { id: number; name: string; phone: string | null };
type Sale = { id: number; receipt_no: string; sale_date: string; total: number };
type SaleItem = {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  already_returned: number;
};

export default function CustomerReturnsPanel() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [items, setItems] = useState<SaleItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [returningItem, setReturningItem] = useState<SaleItem | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setCustomers(null);
    setSales(null);
    setItems(null);

    const receiptRes = await fetch(`/api/returns/sale-items?receipt=${encodeURIComponent(q)}`);
    const receiptItems = await receiptRes.json();
    if (Array.isArray(receiptItems) && receiptItems.length > 0) {
      setItems(receiptItems);
      setLabel(`Receipt ${q}`);
      setLoading(false);
      return;
    }

    const custRes = await fetch(`/api/returns/customers?q=${encodeURIComponent(q)}`);
    setCustomers(await custRes.json());
    setLoading(false);
  }

  async function pickCustomer(c: Customer) {
    setLoading(true);
    setCustomers(null);
    const res = await fetch(`/api/returns/sales?customerId=${c.id}`);
    setSales(await res.json());
    setLoading(false);
  }

  async function pickSale(s: Sale) {
    setLoading(true);
    setSales(null);
    const res = await fetch(`/api/returns/sale-items?saleId=${s.id}`);
    setItems(await res.json());
    setLabel(`Receipt ${s.receipt_no}`);
    setLoading(false);
  }

  function openReturn(it: SaleItem) {
    setReturningItem(it);
    setQty(String(Number(it.quantity) - Number(it.already_returned)));
    setNote("");
  }

  async function submitReturn() {
    if (!returningItem) return;
    const fd = new FormData();
    fd.append("sale_item_id", String(returningItem.id));
    fd.append("quantity", qty);
    fd.append("note", note);
    try {
      const result = await processCustomerReturn(fd);
      alert(`Return processed. Refund: $${result.refund.toFixed(2)}`);
      setReturningItem(null);
      if (items) {
        const maxRet = Number(returningItem.quantity) - Number(returningItem.already_returned);
        setItems(items.map((it) => (it.id === returningItem.id ? { ...it, already_returned: Number(it.already_returned) + Math.min(parseFloat(qty), maxRet) } : it)));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h3 className="font-semibold mb-3">Find Receipt</h3>
        <div className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Receipt number or customer name…"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          <button onClick={search} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2">
            Search
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}

        {customers && (
          <div className="space-y-1">
            {customers.length === 0 && <p className="text-sm text-zinc-500">No matches found.</p>}
            {customers.map((c) => (
              <button key={c.id} onClick={() => pickCustomer(c)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm">
                <strong>{c.name}</strong> {c.phone && <span className="text-zinc-500 ml-2">{c.phone}</span>}
              </button>
            ))}
          </div>
        )}

        {sales && (
          <div className="space-y-1">
            {sales.length === 0 && <p className="text-sm text-zinc-500">No sales found.</p>}
            {sales.map((s) => (
              <button key={s.id} onClick={() => pickSale(s)} className="w-full flex justify-between px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm">
                <span>
                  #{s.receipt_no} <span className="text-zinc-500">{s.sale_date?.slice(0, 10)}</span>
                </span>
                <span className="text-green-600">${Number(s.total).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {items && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm">{label}</h4>
              <button onClick={() => setItems(null)} className="text-xs text-zinc-500">
                ✕ Clear
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs">
                  <th className="py-1">Product</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Price</th>
                  <th className="py-1">Returned</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const maxRet = Number(it.quantity) - Number(it.already_returned);
                  return (
                    <tr key={it.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5">{it.product_name}</td>
                      <td className="py-1.5">{Number(it.quantity)}</td>
                      <td className="py-1.5">${Number(it.unit_price).toFixed(2)}</td>
                      <td className="py-1.5 text-xs">{Number(it.already_returned) > 0 ? it.already_returned : "—"}</td>
                      <td className="py-1.5">
                        {maxRet > 0 ? (
                          <button onClick={() => openReturn(it)} className="text-amber-600 text-xs hover:underline">
                            Return
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-500">Done</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {returningItem && (
        <div className="rounded-xl border border-amber-400 bg-white dark:bg-zinc-900 p-4 h-fit">
          <h3 className="font-semibold mb-3">Process Customer Return</h3>
          <p className="text-sm mb-2">
            Return <strong>{returningItem.product_name}</strong> (max {Number(returningItem.quantity) - Number(returningItem.already_returned)} units)
          </p>
          <label className="block text-xs font-medium mb-1">Quantity</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
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
          <p className="text-sm bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg px-3 py-2 mb-3">
            Refund: ${((parseFloat(qty) || 0) * Number(returningItem.unit_price)).toFixed(2)}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setReturningItem(null)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={submitReturn} className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2">
              Confirm Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
