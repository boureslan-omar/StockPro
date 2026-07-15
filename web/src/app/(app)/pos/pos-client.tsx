"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, ShoppingCart, Receipt } from "lucide-react";
import { processSale, getReceiptData, getCustomerPrices, type CartLine } from "./actions";
import { printReceiptWindow } from "./receipt";
import { linkQuotationToSale } from "../quotations/actions";

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

type Customer = { id: number; name: string; phone: string | null; balance: number };
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
  // "" = use catalog (or customer-memory) pricing; non-empty = a manual
  // override the operator typed, in whatever unit sellAs currently is
  // (per-box or per-unit). Saved back as this customer's new remembered
  // price on checkout, same as any other price actually charged.
  priceOverride: string;
};

let nextKey = 1;

export type InitialLine = {
  productId: number;
  name: string;
  unit: string;
  unitsPerBox: number;
  stock: number;
  type: "regular" | "bulk";
  costPrice: number;
  sellUnit: number;
  qty: number;
};

function buildLinesFromInitial(initialLines?: InitialLine[]): Line[] {
  if (!initialLines?.length) return [];
  return initialLines.map((it) => ({
    key: nextKey++,
    productId: it.productId,
    name: it.name,
    unit: it.unit,
    unitsPerBox: it.unitsPerBox,
    stock: it.stock,
    type: it.type,
    costPrice: it.costPrice,
    sellUnit: it.sellUnit,
    sellBox: null,
    sellAs: it.unit === "box" && it.unitsPerBox > 1 ? "box" : "unit",
    qty: String(it.qty),
    costMode: false,
    markupPercent: "",
    priceOverride: "",
  }));
}

// Fuzzy-filters the already-loaded customer list client-side by name or
// phone — fine even for thousands of rows since it's just a substring scan,
// no server round-trip needed.
function CustomerCombobox({
  customers,
  customerId,
  onSelect,
}: {
  customers: Customer[];
  customerId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => String(c.id) === customerId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 50)
    : customers.slice(0, 50);

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={open ? query : selected?.name ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        placeholder="Walk-in — search name or phone…"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setQuery("");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Walk-in (no customer)
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(String(c.id));
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span>
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="text-zinc-500 ml-2 text-xs">{c.phone}</span>}
              </span>
              {Number(c.balance) !== 0 && (
                <span className={`text-xs shrink-0 ${Number(c.balance) > 0 ? "text-green-600" : "text-red-600"}`}>
                  {Number(c.balance) > 0 ? "credit" : "debt"} ${Math.abs(Number(c.balance)).toFixed(2)}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">No matches.</p>}
        </div>
      )}
    </div>
  );
}

export default function PosClient({
  products,
  customers,
  categories,
  exchangeRate,
  storeName,
  storeAddress,
  storePhone,
  initialLines,
  quotationId,
}: {
  products: Product[];
  customers: Customer[];
  categories: Category[];
  exchangeRate: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  initialLines?: InitialLine[];
  quotationId?: number | null;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lines, setLines] = useState<Line[]>(() => buildLinesFromInitial(initialLines));
  const [customerId, setCustomerId] = useState("");
  const [customerPrices, setCustomerPrices] = useState<Record<number, number>>({});
  const [paymentTerms, setPaymentTerms] = useState<"cash" | "bank_transfer" | "account">("cash");
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

  // Customer-specific pricing memory: load this customer's last-paid prices
  // whenever they're selected, then apply them onto any cart line that
  // doesn't already have a manual override (added below and in addProduct).
  useEffect(() => {
    if (!customerId) {
      setCustomerPrices({});
      return;
    }
    let cancelled = false;
    getCustomerPrices(Number(customerId)).then((map) => {
      if (!cancelled) setCustomerPrices(map);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!Object.keys(customerPrices).length) return;
    setLines((prev) =>
      prev.map((l) => {
        if (l.priceOverride !== "" || l.costMode) return l;
        const remembered = customerPrices[l.productId];
        if (remembered == null) return l;
        const display = l.sellAs === "box" ? remembered * l.unitsPerBox : remembered;
        return { ...l, priceOverride: display.toFixed(4).replace(/\.?0+$/, "") };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPrices]);

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id && !l.costMode);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: String((parseFloat(l.qty) || 0) + 1) } : l));
      }
      const sellAs: "unit" | "box" = p.unit === "box" && (p.units_per_box || 1) > 1 ? "box" : "unit";
      const remembered = customerPrices[p.id];
      const priceOverride =
        remembered != null ? String(sellAs === "box" ? remembered * (p.units_per_box || 1) : remembered) : "";
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
          // Box-registered products are always transacted in whole boxes —
          // this isn't a per-sale choice, it's fixed by how the product is
          // registered (see products-client.tsx's own unit field).
          sellAs,
          qty: "1",
          costMode: false,
          markupPercent: "",
          priceOverride,
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
      const needsMarkup = l.sellUnit <= 0 && !l.markupPercent && l.priceOverride === "";
      const price =
        l.priceOverride !== ""
          ? parseFloat(l.priceOverride) || 0
          : l.sellUnit > 0
          ? l.sellUnit
          : l.costPrice * (1 + (parseFloat(l.markupPercent) || 0) / 100);
      return { unitPrice: price, baseQty: qtyEntered, needsMarkup };
    }

    // A manual price (typed directly, or auto-filled from this customer's
    // price memory) takes priority over catalog pricing entirely.
    if (l.priceOverride !== "") {
      const overrideVal = parseFloat(l.priceOverride) || 0;
      const unitPrice = l.sellAs === "box" ? overrideVal / l.unitsPerBox : overrideVal;
      return { unitPrice, baseQty, needsMarkup: false };
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
  const totalGiven = paymentTerms === "account" ? 0 : (parseFloat(paidUsd) || 0) + (parseFloat(paidLbp) || 0) / exchangeRate;
  const changeAmt = Math.max(0, totalGiven - total - (parseFloat(debtPayment) || 0));
  // Unpaid portion of THIS invoice — becomes debt on the customer's account.
  const remainingBalance = Math.max(0, total - totalGiven);

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
    if (paymentTerms === "account" && !customerId) {
      alert("Select a customer before selling on account.");
      return;
    }
    if (paymentTerms !== "account" && remainingBalance > 0.001 && !customerId) {
      alert("This sale isn't fully paid. Select a customer to record the remaining balance as debt, or collect full payment.");
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
    fd.append("paid_usd", paymentTerms === "account" ? "0" : paidUsd || "0");
    fd.append("paid_lbp", paymentTerms === "account" ? "0" : paidLbp || "0");
    fd.append("payment_method", paymentTerms);
    fd.append("note", note);
    if (customerId) fd.append("customer_id", customerId);
    fd.append("debt_payment", debtPayment || "0");
    fd.append("change_currency", changeCurrency);

    try {
      const result = await processSale(fd);
      if (quotationId) await linkQuotationToSale(quotationId, result.saleId);
      setLastSaleId(result.saleId);
      setLastReceipt(result.receipt);
      setLines([]);
      setCustomerId("");
      setPaymentTerms("cash");
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

  // Ctrl+Enter finalizes the sale without reaching for the mouse. (F12 was
  // requested, but Chrome/Edge reserve it for DevTools and won't let a page
  // override it — Ctrl+Enter is the reliable equivalent.)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter" && !submitting && lines.length > 0 && !anyNeedsMarkup) {
        e.preventDefault();
        checkout();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, lines, anyNeedsMarkup, paymentTerms, paidUsd, paidLbp, customerId]);

  async function print() {
    if (!lastSaleId) return;
    const { sale, items } = await getReceiptData(lastSaleId);
    if (!sale) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    printReceiptWindow(sale as any, items as any, storeName, storeAddress, storePhone);
  }

  if (lastSaleId) {
    return (
      <div className="max-w-md mx-auto rounded-xl border border-green-500 bg-white dark:bg-zinc-900 shadow-sm p-6 text-center">
        <h2 className="text-xl font-bold text-green-600 mb-2">Sale Complete</h2>
        <p className="text-sm text-zinc-500 mb-4">Receipt #{lastReceipt}</p>
        <div className="flex gap-2 justify-center mb-4">
          <button onClick={print} className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2">
            Print
          </button>
        </div>
        <button onClick={() => setLastSaleId(null)} className="text-sm text-blue-500 hover:underline">
          Start New Sale
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px_320px] gap-4">
      {/* Product grid */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Products
          </h3>
          <span className="text-xs text-zinc-500">{filtered.length} shown</span>
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto pr-1">
          {filtered.map((p) => {
            const low = Number(p.stock) <= 0 && p.product_type === "regular";
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={low}
                className={`text-left rounded-lg border p-3 text-sm shadow-sm transition ${
                  low
                    ? "border-zinc-200 dark:border-zinc-800 opacity-40 cursor-not-allowed"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-500 hover:shadow-md bg-white dark:bg-zinc-900"
                }`}
              >
                <div className="mb-2 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 h-16 w-full">
                  <Package className="h-6 w-6 text-zinc-400" />
                </div>
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-500" />
            Cart
          </h3>
          {lines.length > 0 && <span className="text-xs text-zinc-500">{lines.length} item{lines.length === 1 ? "" : "s"}</span>}
        </div>
        <div className="space-y-2 max-h-[62vh] overflow-y-auto">
          {lineTotals.map(({ l, unitPrice, baseQty, needsMarkup }) => {
            const remembered = customerPrices[l.productId];
            const rememberedDisplay = remembered != null ? (l.sellAs === "box" ? remembered * l.unitsPerBox : remembered) : null;
            return (
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
                    min={l.sellAs === "box" ? "1" : "0.001"}
                    step={l.sellAs === "box" ? "1" : "0.001"}
                    value={l.qty}
                    onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                    className="w-16 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs"
                  />
                  {l.sellAs === "box" ? (
                    <span className="rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-1 text-xs font-medium">
                      boxes ({l.unitsPerBox}/box)
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">{l.unit}</span>
                  )}
                  <label className="flex items-center gap-1 text-xs text-zinc-500 ml-auto">
                    <input type="checkbox" checked={l.costMode} onChange={(e) => updateLine(l.key, { costMode: e.target.checked })} />
                    Cost+markup
                  </label>
                </div>
                {!l.costMode && l.type !== "bulk" && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder={l.sellAs === "box" ? "Price/box" : "Price/unit"}
                      value={l.priceOverride}
                      onChange={(e) => updateLine(l.key, { priceOverride: e.target.value })}
                      className="w-28 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs"
                    />
                    {rememberedDisplay != null && (
                      <span className="text-xs text-amber-600 dark:text-amber-400" title="This customer's last price for this item">
                        last paid ${rememberedDisplay.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
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
            );
          })}
          {lines.length === 0 && <p className="text-center text-zinc-500 text-sm py-8">Cart is empty.</p>}
        </div>
      </div>

      {/* Checkout */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 space-y-3 h-fit">
        <h3 className="font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-500" />
          Checkout
        </h3>
        <div>
          <label className="block text-xs font-medium mb-1">Customer</label>
          <CustomerCombobox customers={customers} customerId={customerId} onSelect={setCustomerId} />
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

        {/* Warehouse settlement panel */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-3">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total Invoice</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>at {exchangeRate.toLocaleString()} LBP/$</span>
              <span>{Math.round(total * exchangeRate).toLocaleString()} LBP</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Terms of Payment</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as typeof paymentTerms)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="cash">Immediate Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="account">On Account (Debt)</option>
            </select>
          </div>

          {paymentTerms !== "account" && (
            <>
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
              {changeAmt > 0.001 && (
                <div>
                  <label className="block text-xs font-medium mb-1">Change in</label>
                  <select value={changeCurrency} onChange={(e) => setChangeCurrency(e.target.value as "USD" | "LBP")} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm">
                    <option value="LBP">LBP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}
            </>
          )}

          {paymentTerms === "account" ? (
            <p className="text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
              Full ${total.toFixed(2)} will be added to {selectedCustomer ? selectedCustomer.name + "'s" : "the customer's"} account as debt.
            </p>
          ) : remainingBalance > 0.001 ? (
            <p className="text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
              {selectedCustomer ? (
                <>
                  Remaining balance <strong>${remainingBalance.toFixed(2)}</strong> will be added to {selectedCustomer.name}&apos;s account as debt.
                </>
              ) : (
                <>
                  Remaining balance <strong>${remainingBalance.toFixed(2)}</strong> — select a customer to record this as debt, or collect full payment.
                </>
              )}
            </p>
          ) : changeAmt > 0.001 ? (
            <p className="text-sm bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg px-3 py-2">
              Change due: {changeCurrency === "USD" ? `$${changeAmt.toFixed(2)}` : `${Math.round(changeAmt * exchangeRate).toLocaleString()} LBP`}
            </p>
          ) : (
            <p className="text-sm bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 rounded-lg px-3 py-2">Fully settled.</p>
          )}
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm" />

        <button
          onClick={checkout}
          disabled={submitting || lines.length === 0 || anyNeedsMarkup}
          className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5"
        >
          {submitting ? "Processing…" : anyNeedsMarkup ? "Enter markup % to continue" : "Finalize Invoice"}
        </button>
        <p className="text-center text-[11px] text-zinc-400">Ctrl+Enter to finalize</p>
      </div>
    </div>
  );
}
