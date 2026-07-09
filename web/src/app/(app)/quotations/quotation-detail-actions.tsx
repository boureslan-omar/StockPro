"use client";

import { useState } from "react";
import { updateQuotationStatus } from "./actions";
import { printQuotationWindow } from "./quotation-print";

const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];

type Item = { product_name: string; quantity: number; unit_price: number; total: number; unit: string | null };
type Quote = { id: number; quote_number: string; created_at: string; valid_until: string | null; customer_name: string | null; note: string | null; status: string };

export default function QuotationDetailActions({
  quote,
  items,
  storeName,
  storeAddress,
  storePhone,
}: {
  quote: Quote;
  items: Item[];
  storeName: string;
  storeAddress: string;
  storePhone: string;
}) {
  const [status, setStatus] = useState(quote.status);

  if (status === "converted") {
    return <span className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Converted</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={async (e) => {
          const next = e.target.value;
          setStatus(next);
          await updateQuotationStatus(quote.id, next);
        }}
        className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <button
        onClick={() => printQuotationWindow(quote, items, "thermal", storeName, storeAddress, storePhone)}
        className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5"
      >
        Print Thermal
      </button>
      <button
        onClick={() => printQuotationWindow(quote, items, "a4", storeName, storeAddress, storePhone)}
        className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5"
      >
        Print A4
      </button>
    </div>
  );
}
