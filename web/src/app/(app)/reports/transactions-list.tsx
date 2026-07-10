"use client";

import { Fragment, useState } from "react";
import { fmtUSD } from "@/lib/format";
import { getReceiptData } from "../pos/actions";
import { printReceiptWindow } from "../pos/receipt";
import VoidButton from "./void-button";

type SaleItem = {
  id: number;
  product_name: string;
  product_type: "regular" | "bulk";
  is_consignment: boolean;
  quantity: number;
  unit_price: number;
  total: number;
};

type Sale = {
  id: number;
  receipt_no: string;
  sale_date: string;
  total: number;
  payment_method: string;
  is_void: boolean;
  discount: number;
  credit_used: number;
  note: string | null;
  customers: { name: string } | null;
  sale_items: SaleItem[];
};

const METHOD_STYLE: Record<string, string> = {
  cash: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  card: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  mobile: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  account: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

export default function TransactionsList({
  transactions,
  storeName,
  storeAddress,
  storePhone,
}: {
  transactions: Sale[];
  storeName: string;
  storeAddress: string;
  storePhone: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [printing, setPrinting] = useState<number | null>(null);

  async function handlePrint(saleId: number) {
    setPrinting(saleId);
    try {
      const { sale, items } = await getReceiptData(saleId);
      if (!sale) return;
      printReceiptWindow(sale as never, items as never, storeName, storeAddress, storePhone);
    } finally {
      setPrinting(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">All Transactions</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{transactions.length} sales</span>
      </div>
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-lg border border-zinc-100 dark:border-zinc-800 pr-3">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-white">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Date &amp; Time</th>
              <th className="px-3 py-2 font-medium">Receipt</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <Fragment key={tx.id}>
                <tr className={`border-b border-zinc-100 dark:border-zinc-800/60 ${tx.is_void ? "opacity-50 line-through" : ""}`}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(tx.sale_date).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {tx.receipt_no}
                    {tx.is_void && (
                      <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        VOID
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{tx.customers?.name ?? <span className="text-zinc-500">Cash</span>}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{tx.sale_items.length}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${METHOD_STYLE[tx.payment_method] ?? "bg-zinc-100 dark:bg-zinc-800"}`}>
                      {tx.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtUSD(tx.total)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    <button onClick={() => setExpanded(expanded === tx.id ? null : tx.id)} className="text-blue-600 hover:underline mr-2">
                      {expanded === tx.id ? "Hide" : "View"}
                    </button>
                    <button disabled={printing === tx.id} onClick={() => handlePrint(tx.id)} className="text-zinc-600 dark:text-zinc-300 hover:underline mr-2 disabled:opacity-50">
                      Print
                    </button>
                    {!tx.is_void && <VoidButton saleId={tx.id} receiptNo={tx.receipt_no} />}
                  </td>
                </tr>
                {expanded === tx.id && (
                  <tr className="bg-zinc-50 dark:bg-zinc-800/40">
                    <td colSpan={7} className="px-3 py-3">
                      <table className="w-full text-xs">
                        <thead className="text-zinc-500">
                          <tr>
                            <th className="text-left font-medium py-1">Product</th>
                            <th className="text-right font-medium py-1">Qty</th>
                            <th className="text-right font-medium py-1">Unit Price</th>
                            <th className="text-right font-medium py-1">Total</th>
                            <th className="text-left font-medium py-1 pl-3">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tx.sale_items.map((it) => (
                            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-700">
                              <td className="py-1">{it.product_name}</td>
                              <td className="py-1 text-right">{Number(it.quantity)}</td>
                              <td className="py-1 text-right">{fmtUSD(it.unit_price)}</td>
                              <td className="py-1 text-right font-medium">{fmtUSD(it.total)}</td>
                              <td className="py-1 pl-3">
                                {it.is_consignment ? (
                                  <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Consign</span>
                                ) : it.product_type === "bulk" ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Bulk</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">Owned</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(Number(tx.discount) > 0 || Number(tx.credit_used) > 0 || tx.note) && (
                        <p className="text-xs text-zinc-500 mt-2">
                          {Number(tx.discount) > 0 && <>Discount: -{fmtUSD(tx.discount)} · </>}
                          {Number(tx.credit_used) > 0 && <>Credit: -{fmtUSD(tx.credit_used)} · </>}
                          {tx.note && <>Note: {tx.note}</>}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  No transactions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
