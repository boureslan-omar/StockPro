"use client";

import { useState } from "react";
import Link from "next/link";
import QuotationForm, { type EditingQuotation } from "./quotation-form";

type Row = {
  id: number;
  quote_number: string;
  customer_name: string | null;
  status: string;
  valid_until: string | null;
  total: number;
  item_count: number;
};

type Customer = { id: number; name: string };

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  converted: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
};

export default function QuotationsClient({
  rows,
  customers,
  fullQuotations,
}: {
  rows: Row[];
  customers: Customer[];
  fullQuotations: Record<number, EditingQuotation>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditingQuotation | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2"
        >
          + New Quotation
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Quote #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Valid Until</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5 font-mono font-medium">{r.quote_number}</td>
                <td className="px-4 py-2.5">{r.customer_name || "—"}</td>
                <td className="px-4 py-2.5">{r.item_count}</td>
                <td className="px-4 py-2.5 text-right font-semibold">${r.total.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">{r.valid_until || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[r.status] ?? STATUS_STYLE.draft}`}>{r.status}</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/quotations?view=${r.id}`} className="text-blue-600 hover:underline mr-3">
                    View
                  </Link>
                  {r.status === "draft" && (
                    <button
                      onClick={() => {
                        setEditing(fullQuotations[r.id]);
                        setOpen(true);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No quotations yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <QuotationForm customers={customers} editing={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
