"use client";

import { useMemo, useState } from "react";
import { processSale, getReceiptData, type CartLine } from "./actions";
import { printReceiptWindow } from "./receipt";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  unit: string | null;
  stock: number;
  cost_price: number;
  sell_price: number;
  sell_price_box: number | null;
  units_per_box: number;
  product_type: "regular" | "bulk";
  product_source: string;
  category_id: number | null;
};

type Customer = { id: number; name: string; balance: number };
type Category = { id: number; name: string };

type Line = {
  key: number;
  productId: number;
  name: string;
  unit: string;
  unitsPerBox: number;
  stock: number;
  type: "regular" | "bulk";
  costPrice: number;
  sellUnit: number;
  sellBox: number | null;
  sellAs: "unit" | "box";
  qty: string;
  costMode: boolean;
  markupPercent: string;
};

let nextKey = 1;

export default function PosClient({
  products,
  customers,
  categories,
  exchangeRate,
  storeName,
  storeAddress,
  storePhone,
}: {
  products: Product[];
  customers: Customer[];
  categories: Category[];
  exchangeRate: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [creditUse, setCreditUse] = useState("0");
  const [debtPayment, setDebtPayment] = useState("0");
  const [paidUsd, setPaidUsd] = useState("");
  const [paidLbp, setPaidLbp] = useState("");
  const [changeCurrency, setChangeCurrency] = useState<"USD" | "LBP">("LBP");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [lastReceipt, setLastReceipt] = useState("");

  const filtered = products.filter((p) => {
    if (categoryFilter && String(p.category_id) !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return p.name.toLowerCase().includes(q) || p.barcode === search.trim();
  });

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id && !l.costMode);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: String((parseFloat(l.qty) || 0) + 1) } : l));
      }
      return [
        ...prev,
        {
          key: nextKey++,
          productId: p.id,
          name: p.name,
          unit: p.unit || "pcs",
          unitsPerBox: p.units_per_box || 1,
          stock: Number(p.stock),
          type: p.product_type,
          costPrice: Number(p.cost_price),
          sellUnit: Number(p.sell_price),
          sellBox: p.sell_price_box ? Number(p.sell_price_box) : null,
          sellAs: "unit",
          qty: "1",
          costMode: false,
          markupPercent: "",
        },
      ];
    });
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // Effective per-base-unit price and total base-unit quantity for a line
  function lineEffective(l: Line): { unitPrice: number; baseQty: number; needsMarkup: boolean } {
    const qtyEntered = parseFloat(l.qty) || 0;
    const baseQty = l.type === "bulk" ? 0 : l.sellAs === "box" ? qtyEntered * l.unitsPerBox : qtyEntered;

    if (l.costMode) {
      const pct = parseFloat(l.markupPercent) || 0;
      return { unitPrice: l.costPrice * (1 + pct / 100), baseQty, needsMarkup: false };
    }

    if (l.type === "bulk") {
      // Bulk: qty field holds the flat charge, sellUnit doubles as a fixed amount
      const needsMarkup = l.sellUnit <= 0 && !l.markupPercent;
      const price = l.sellUnit > 0 ? l.sellUnit : l.costPrice * (1 + (parseFloat(l.markupPercent) || 0) / 100);
      return { unitPrice: price, baseQty: qtyEntered, needsMarkup };
    }

    if (l.sellAs === "box" && l.sellBox) {
      return { unitPrice: l.sellBox / l.unitsPerBox, baseQty, needsMarkup: false };
    }
    if (l.sellUnit > 0) {
      return { unitPrice: l.sellUnit, baseQty, needsMarkup: false };
    }
    // Zero-price item — requires a one-time markup over cost before checkout
    const pct = parseFloat(l.markupPercent);
    if (!isNaN(pct) && l.markupPercent !== "") {
      return { unitPrice: l.costPrice * (1 + pct / 100), baseQty, needsMarkup: false };
    }
    return { unitPrice: 0, baseQty, needsMarkup: true };
  }

  const lineTotals = useMemo(() => lines.map((l) => ({ l, ...lineEffective(l) })), [lines]);
  const subtotal = lineTotals.reduce((s, lt) => s + lt.unitPrice * lt.baseQty, 0);
  const anyNeedsMarkup = lineTotals.some((lt) => lt.needsMarkup);
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0) - (parseFloat(creditUse) || 0));
  const totalGiven = (parseFloat(paidUsd) || 0) + (parseFloat(paidLbp) || 0) / exchangeRate;
  const changeAmt = Math.max(0, totalGiven - total - (parseFloat(debtPayment) || 0));

  const selectedCustomer = customers.find((c) => String(c.id) === customerId);

  async function checkout() {
    if (!lines.length) {
      alert("Cart is empty.");
      return;
    }
    if (anyNeedsMarkup) {
      alert("Some items have no selling price. Enter a markup % for them before checkout.");
      return;
    }
    setSubmitting(true);
    const cart: CartLine[] = lineTotals.map((lt) => ({
      productId: lt.l.productId,
      name: lt.l.name,
      qty: lt.baseQty,
      price: lt.unitPrice,
      type: lt.l.type,
    }));

    const fd = new FormData();
    fd.append("cart_json", JSON.stringify(cart));
    fd.append("discount", discount || "0");
    fd.append("credit_use", creditUse || "0");
    fd.append("paid_usd", paidUsd || "0");
    fd.append("paid_lbp", paidLbp || "0");
    fd.append("payment_method", "cash");
    fd.append("note", note);
    if (customerId) fd.append("customer_id", customerId);
    fd.append("debt_payment", debtPayment || "0");
    fd.append("change_currency", changeCurrency);

    try {
      const result = await processSale(fd);
      setLastSaleId(result.saleId);
      setLastReceipt(result.receipt);
      setLines([]);
      setCustomerId("");
      setDiscount("0");
      setCreditUse("0");
      setDebtPayment("0");
      setPaidUsd("");
      setPaidLbp("");
      setNote("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function print(format: "thermal" | "a4") {
    if (!lastSaleId) return;
    const { sale, items } = await getReceiptData(lastSaleId);
    if (!sale) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    printReceiptWindow(sale as any, items as any, format, storeName, storeAddress, storePhone);
  }

  if (lastSaleId) {
    return (
      <div className="max-w-md mx-auto rounded-xl border border-green-500 bg-white dark:bg-zinc-900 p-6 text-center">
        <h2 className="text-xl font-bold text-green-600 mb-2">Sale Complete</h2>
        <p className="text-sm text-zinc-500 mb-4">Receipt #{lastReceipt}</p>
        <div className="flex gap-2 justify-center mb-4">
          <button onClick={() => print("thermal")} className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm px-4 py-2">
            Print Thermal
          </button>
          <button onClick={() => print("a4")} className="rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm px-4 py-2">
            Print A4
          </button>
        </div>
        <button onClick={() => setLastSaleId(null)} className="text-sm text-blue-600 hover:underline">
          Start New Sale
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px_320px] gap-4">
      {/* Product grid */}
      <div>
        <div className="flex gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or scan barcode…"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((p) => {
            const low = Number(p.stock) <= 0 && p.product_type === "regular";
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={low}
                className={`text-left rounded-lg border p-3 text-sm ${
                  low
                    ? "border-zinc-200 dark:border-zinc-800 opacity-40 cursor-not-allowed"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-500 bg-white dark:bg-zinc-900"
                }`}
              >
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-zinc-500">
                  {p.sell_price > 0 ? `$${Number(p.sell_price).toFixed(2)}` : "No price set"}
                </p>
                <p className="text-xs text-zinc-400">
                  {Number(p.stock)} {p.unit} in stock
                </p>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full text-center text-zinc-500 py-8">No products found.</p>}
        </div>
      </div>

      {/* Cart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <h3 className="font-semibold mb-2">Cart</h3>
        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          {lineTotals.map(({ l, unitPrice, baseQty, needsMarkup }) => (
            <div key={l.key} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium">{l.name}</span>
                <button onClick={() => removeLine(l.key)} className="text-red-600 text-xs">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={l.qty}
                  onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                  className="w-20 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs"
                />
                {l.unitsPerBox > 1 && l.type !== "bulk" && !l.costMode && (
                  <select
                    value={l.sellAs}
                    onChange={(e) => updateLine(l.key, { sellAs: e.target.value as "unit" | "box" })}
                    className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-1 text-xs"
                  >
                    <option value="unit">unit</option>
                    <option value="box">box ({l.unitsPerBox}/box)</option>
                  </select>
                )}
                <label className="flex items-center gap-1 text-xs text-zinc-500 ml-auto">
                  <input type="checkbox" checked={l.costMode} onChange={(e) => updateLine(l.key, { costMode: e.target.checked })} />
                  Cost+markup
                </label>
              </div>
              {(needsMarkup || l.costMode) && (
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Markup %"
                  value={l.markupPercent}
                  onChange={(e) => updateLine(l.key, { markupPercent: e.target.value })}
                  className={`w-full mt-1 rounded border px-2 py-1 text-xs ${needsMarkup ? "border-red-400" : "border-zinc-300 dark:border-zinc-700"}`}
                />
              )}
              <p className="text-right text-xs mt-1">
                {baseQty} {l.unit} × ${unitPrice.toFixed(4)} = <strong>${(baseQty * unitPrice).toFixed(2)}</strong>
              </p>
            </div>
          ))}
          {lines.length === 0 && <p className="text-center text-zinc-500 text-sm py-8">Cart is empty.</p>}
        </div>
      </div>

      {/* Checkout */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3 h-fit">
        <h3 className="font-semibold">Checkout</h3>
        <div>
          <label className="block text-xs font-medium mb-1">Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm">
            <option value="">Walk-in</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {Number(c.balance) !== 0 ? `(${Number(c.balance) > 0 ? "credit" : "debt"} $${Math.abs(Number(c.balance)).toFixed(2)})` : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedCustomer && Number(selectedCustomer.balance) < 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Settle debt now (optional)</label>
            <input type="number" min="0" step="0.01" value={debtPayment} onChange={(e) => setDebtPayment(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />
          </div>
        )}
        {selectedCustomer && Number(selectedCustomer.balance) > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Use store credit (max ${Number(selectedCustomer.balance).toFixed(2)})</label>
            <input type="number" min="0" step="0.01" max={selectedCustomer.balance} value={creditUse} onChange={(e) => setCreditUse(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1">Discount ($)</label>
          <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">Paid USD</label>
            <input type="number" min="0" step="0.01" value={paidUsd} onChange={(e) => setPaidUsd(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Paid LBP</label>
            <input type="number" min="0" step="1000" value={paidLbp} onChange={(e) => setPaidLbp(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Change in</label>
          <select value={changeCurrency} onChange={(e) => setChangeCurrency(e.target.value as "USD" | "LBP")} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm">
            <option value="LBP">LBP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        {changeAmt > 0 && (
          <p className="text-sm bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg px-3 py-2">
            Change due: {changeCurrency === "USD" ? `$${changeAmt.toFixed(2)}` : `${Math.round(changeAmt * exchangeRate).toLocaleString()} LBP`}
          </p>
        )}

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />

        <button
          onClick={checkout}
          disabled={submitting || lines.length === 0 || anyNeedsMarkup}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5"
        >
          {submitting ? "Processing…" : anyNeedsMarkup ? "Enter markup % to continue" : "Finalize Invoice"}
        </button>
      </div>
    </div>
  );
}
