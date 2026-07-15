"use client";

import Link from "next/link";
import { fmtUSD } from "@/lib/format";
import TransactionsList from "./transactions-list";
import AnalysisWidget from "./analysis-widget";

type Stats = { revenue: number; cogs: number; gross: number; net: number; expenses: number; margin: number; txCount: number };
type TopProduct = { name: string; productType: "regular" | "bulk"; units: number; revenue: number; cogs: number; profit: number };
type BulkPurchase = { name: string; cost: number };
type ByMethod = { method: string; count: number; total: number };
type ExpByCategory = { category: string; total: number };
type TimelineRow = { period: string; revenue: number; txns: number; cogs: number };
type Option = { id: number; name: string };

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function quickRanges() {
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  return [
    { label: "Today", from: ymd(today), to: ymd(today) },
    { label: "Yesterday", from: ymd(y), to: ymd(y) },
    { label: "This Week", from: ymd(monday), to: ymd(today) },
    { label: "This Month", from: ymd(monthStart), to: ymd(today) },
    { label: "Last Month", from: ymd(lastMonthStart), to: ymd(lastMonthEnd) },
    { label: "This Year", from: ymd(yearStart), to: ymd(today) },
  ];
}

export default function ReportsClient({
  from,
  to,
  groupBy,
  stats,
  topProducts,
  bulkPurchases,
  byMethod,
  expByCategory,
  timeline,
  transactions,
  categories,
  suppliers,
  exchangeRate,
  storeName,
  storeAddress,
  storePhone,
}: {
  from: string;
  to: string;
  groupBy: "day" | "week" | "month";
  stats: Stats;
  topProducts: TopProduct[];
  bulkPurchases: BulkPurchase[];
  byMethod: ByMethod[];
  expByCategory: ExpByCategory[];
  timeline: TimelineRow[];
  transactions: Parameters<typeof TransactionsList>[0]["transactions"];
  categories: Option[];
  suppliers: Option[];
  exchangeRate: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
}) {
  const ranges = quickRanges();
  const maxChartVal = Math.max(1, ...timeline.map((t) => Math.max(t.revenue, t.revenue - t.cogs)));
  const maxExpense = Math.max(1, ...expByCategory.map((e) => e.total));

  const totTxns = timeline.reduce((s, t) => s + t.txns, 0);
  const totRev = timeline.reduce((s, t) => s + t.revenue, 0);
  const totCogs = timeline.reduce((s, t) => s + t.cogs, 0);
  const totGP = totRev - totCogs;
  const totMargin = totRev > 0 ? Math.round((totGP / totRev) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => window.print()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm">
          Print
        </button>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Group by</label>
          <select name="group" defaultValue={groupBy} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2">
          Generate
        </button>
        <div className="w-full flex flex-wrap gap-1.5 pt-1">
          {ranges.map((r) => (
            <Link
              key={r.label}
              href={`/reports?from=${r.from}&to=${r.to}&group=${groupBy}`}
              className={`text-xs px-2.5 py-1 rounded-lg border ${
                from === r.from && to === r.to ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Revenue", val: fmtUSD(stats.revenue), sub: `${Math.round(stats.revenue * exchangeRate).toLocaleString()} LBP`, cls: "text-blue-600" },
          { label: "COGS", val: fmtUSD(stats.cogs), sub: "", cls: "text-zinc-500" },
          { label: "Gross Profit", val: fmtUSD(stats.gross), sub: "", cls: "text-green-600" },
          { label: "Gross Margin", val: `${stats.margin}%`, sub: "", cls: "text-cyan-600" },
          { label: "Expenses", val: fmtUSD(stats.expenses), sub: "", cls: "text-red-600" },
          { label: "Net Profit", val: fmtUSD(stats.net), sub: "", cls: "text-green-700 font-extrabold" },
          { label: "Transactions", val: String(stats.txCount), sub: "", cls: "text-zinc-900 dark:text-white" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className={`font-bold ${c.cls}`}>{c.val}</p>
            {c.sub && <p className="text-[10px] text-zinc-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
        <h3 className="font-semibold mb-3">Revenue vs Gross Profit</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-zinc-500">No data for this period.</p>
        ) : (
          <div className="flex items-end gap-2 h-48 overflow-x-auto pb-1">
            {timeline.map((t) => {
              const gp = t.revenue - t.cogs;
              return (
                <div key={t.period} className="flex flex-col items-center gap-1 min-w-[36px]" title={`${t.period}: revenue ${fmtUSD(t.revenue)}, GP ${fmtUSD(gp)}`}>
                  <div className="flex items-end gap-0.5 h-40">
                    <div className="w-3 bg-blue-500 rounded-t" style={{ height: `${Math.max(2, (t.revenue / maxChartVal) * 100)}%` }} />
                    <div className="w-3 bg-green-500 rounded-t" style={{ height: `${Math.max(2, (gp / maxChartVal) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 rotate-0 whitespace-nowrap">{t.period.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-4 text-xs mt-2 text-zinc-500">
          <span><span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-sm mr-1" />Revenue</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-sm mr-1" />Gross Profit</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
          <h3 className="font-semibold mb-3">Top Products by Profit</h3>
          <div className="overflow-x-auto pr-3">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="font-medium py-1">#</th>
                  <th className="font-medium py-1">Product</th>
                  <th className="font-medium py-1">Type</th>
                  <th className="font-medium py-1 text-right">Units</th>
                  <th className="font-medium py-1 text-right">Revenue</th>
                  <th className="font-medium py-1 text-right">COGS</th>
                  <th className="font-medium py-1 text-right">Profit</th>
                  <th className="font-medium py-1 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => {
                  const m = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 1000) / 10 : 0;
                  const isBulk = p.productType === "bulk";
                  return (
                    <tr key={p.name + i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 text-zinc-400">{i + 1}</td>
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isBulk ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"}`}>
                          {isBulk ? "Bulk" : "Regular"}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">{p.units}</td>
                      <td className="py-1.5 text-right">{fmtUSD(p.revenue)}</td>
                      <td className="py-1.5 text-right">{isBulk ? <span className="text-zinc-400 text-xs">see below</span> : fmtUSD(p.cogs)}</td>
                      <td className={`py-1.5 text-right font-semibold ${isBulk ? "text-zinc-400" : p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {isBulk ? "—" : fmtUSD(p.profit)}
                      </td>
                      <td className="py-1.5 text-right">
                        {isBulk ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Bulk</span>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${m > 20 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : m > 10 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"}`}>
                            {m}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-zinc-500 py-6">
                      No sales data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {bulkPurchases.length > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 p-4">
              <h3 className="font-semibold mb-2">Bulk/Produce Purchases (period)</h3>
              <table className="w-full text-sm">
                <thead className="text-zinc-500 text-left">
                  <tr>
                    <th className="font-medium py-1">Product</th>
                    <th className="font-medium py-1 text-right">Purchase Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPurchases.map((b) => (
                    <tr key={b.name} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5">{b.name}</td>
                      <td className="py-1.5 text-right font-semibold">{fmtUSD(b.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
            <h3 className="font-semibold mb-2">Expenses by Category</h3>
            {expByCategory.length === 0 ? (
              <p className="text-sm text-zinc-500">No expenses.</p>
            ) : (
              <div className="space-y-2">
                {expByCategory.map((e) => (
                  <div key={e.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{e.category}</span>
                      <span className="font-medium">{fmtUSD(e.total)}</span>
                    </div>
                    <div className="h-2 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${(e.total / maxExpense) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
            <h3 className="font-semibold mb-2">Payment Methods</h3>
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="font-medium py-1">Method</th>
                  <th className="font-medium py-1 text-right">Count</th>
                  <th className="font-medium py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map((m) => (
                  <tr key={m.method} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 capitalize">{m.method.replace("_", " ")}</td>
                    <td className="py-1.5 text-right">{m.count}</td>
                    <td className="py-1.5 text-right">{fmtUSD(m.total)}</td>
                  </tr>
                ))}
                {byMethod.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-zinc-500 py-4">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TransactionsList transactions={transactions} storeName={storeName} storeAddress={storeAddress} storePhone={storePhone} />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
        <h3 className="font-semibold mb-3">Period Detail</h3>
        <div className="overflow-x-auto pr-3">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-white text-left">
              <tr>
                <th className="px-2 py-2 font-medium">Period</th>
                <th className="px-2 py-2 font-medium text-right">Transactions</th>
                <th className="px-2 py-2 font-medium text-right">Revenue</th>
                <th className="px-2 py-2 font-medium text-right">Revenue (LBP)</th>
                <th className="px-2 py-2 font-medium text-right">COGS</th>
                <th className="px-2 py-2 font-medium text-right">Gross Profit</th>
                <th className="px-2 py-2 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row) => {
                const gp = row.revenue - row.cogs;
                const m = row.revenue > 0 ? Math.round((gp / row.revenue) * 1000) / 10 : 0;
                return (
                  <tr key={row.period} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-1.5">{row.period}</td>
                    <td className="px-2 py-1.5 text-right">{row.txns}</td>
                    <td className="px-2 py-1.5 text-right">{fmtUSD(row.revenue)}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-500 text-xs">{Math.round(row.revenue * exchangeRate).toLocaleString()} LBP</td>
                    <td className="px-2 py-1.5 text-right">{fmtUSD(row.cogs)}</td>
                    <td className="px-2 py-1.5 text-right text-green-600 font-semibold">{fmtUSD(gp)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${m > 20 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : m > 10 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"}`}>
                        {m}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {timeline.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-zinc-500 py-6">
                    No data for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {timeline.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700 font-bold bg-zinc-50 dark:bg-zinc-800/60">
                  <td className="px-2 py-2">TOTAL</td>
                  <td className="px-2 py-2 text-right">{totTxns}</td>
                  <td className="px-2 py-2 text-right">{fmtUSD(totRev)}</td>
                  <td className="px-2 py-2 text-right text-zinc-500 text-xs font-normal">{Math.round(totRev * exchangeRate).toLocaleString()} LBP</td>
                  <td className="px-2 py-2 text-right">{fmtUSD(totCogs)}</td>
                  <td className="px-2 py-2 text-right text-green-600">{fmtUSD(totGP)}</td>
                  <td className="px-2 py-2 text-right">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${totMargin > 20 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" : totMargin > 10 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"}`}>
                      {totMargin}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <AnalysisWidget from={from} to={to} categories={categories} suppliers={suppliers} />
    </div>
  );
}
