import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import SettleButton from "./settle-button";

type LedgerRow = {
  id: number;
  product_id: number;
  supplier_id: number;
  quantity: number;
  sell_price: number;
  consignment_cost: number;
  revenue: number;
  supplier_due: number;
  market_profit: number;
  settled: boolean;
  sale_date: string;
  products: { name: string } | null;
  suppliers: { name: string } | null;
};

export default async function ConsignmentsData({ supplierId, status }: { supplierId: string; status: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("consignment_ledger")
    .select("*, products(name), suppliers(name)")
    .order("sale_date", { ascending: false });
  if (supplierId) query = query.eq("supplier_id", Number(supplierId));
  if (status === "unsettled") query = query.eq("settled", false);
  if (status === "settled") query = query.eq("settled", true);

  const { data: rows } = await query.limit(300);
  const ledger = (rows ?? []) as unknown as LedgerRow[];

  // Per-supplier summary, aggregated client-side (no per-row FK to
  // settlements in the schema, so this is the source of truth for "who's
  // owed what" rather than a stored/denormalized total).
  const bySupplier = new Map<
    number,
    { name: string; unsettledDue: number; totalRevenue: number; totalProfit: number; lineCount: number; lastSale: string }
  >();
  for (const r of ledger) {
    const cur = bySupplier.get(r.supplier_id) ?? {
      name: r.suppliers?.name ?? "—",
      unsettledDue: 0,
      totalRevenue: 0,
      totalProfit: 0,
      lineCount: 0,
      lastSale: r.sale_date,
    };
    if (!r.settled) cur.unsettledDue += Number(r.supplier_due);
    cur.totalRevenue += Number(r.revenue);
    cur.totalProfit += Number(r.market_profit);
    cur.lineCount += 1;
    if (r.sale_date > cur.lastSale) cur.lastSale = r.sale_date;
    bySupplier.set(r.supplier_id, cur);
  }
  const summary = [...bySupplier.entries()]
    .map(([id, v]) => ({ supplierId: id, ...v }))
    .sort((a, b) => b.unsettledDue - a.unsettledDue);

  const totalUnsettled = summary.reduce((s, r) => s + r.unsettledDue, 0);
  const totalProfit = ledger.reduce((s, r) => s + Number(r.market_profit), 0);

  return (
    <div className="stream-in space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
          <p className="text-xs text-zinc-500">Unsettled Due</p>
          <p className="text-lg font-bold text-amber-600">{fmtUSD(totalUnsettled)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
          <p className="text-xs text-zinc-500">Store Profit (shown rows)</p>
          <p className="text-lg font-bold text-green-600">{fmtUSD(totalProfit)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
          <p className="text-xs text-zinc-500">Suppliers with Activity</p>
          <p className="text-lg font-bold">{summary.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
          <p className="text-xs text-zinc-500">Line Items (shown)</p>
          <p className="text-lg font-bold">{ledger.length}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-500 mb-2">BY SUPPLIER</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
          <table className="w-full text-sm bg-white dark:bg-zinc-900">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Unsettled Due</th>
                <th className="px-4 py-3 font-medium text-right">Store Profit</th>
                <th className="px-4 py-3 font-medium text-right">Lines</th>
                <th className="px-4 py-3 font-medium">Last Sale</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.supplierId} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${s.unsettledDue > 0 ? "text-amber-600" : "text-zinc-400"}`}>
                    {fmtUSD(s.unsettledDue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-600">{fmtUSD(s.totalProfit)}</td>
                  <td className="px-4 py-2.5 text-right">{s.lineCount}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{new Date(s.lastSale).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    {s.unsettledDue > 0.001 && <SettleButton supplierId={s.supplierId} supplierName={s.name} unsettledDue={s.unsettledDue} />}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No consignment activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-500 mb-2">LINE ITEMS</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
          <table className="w-full text-sm bg-white dark:bg-zinc-900">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Sell Price</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Supplier Due</th>
                <th className="px-4 py-3 font-medium text-right">Store Profit</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{new Date(r.sale_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">{r.products?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">{r.suppliers?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{Number(r.quantity)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtUSD(r.sell_price)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtUSD(r.revenue)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmtUSD(r.supplier_due)}</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{fmtUSD(r.market_profit)}</td>
                  <td className="px-4 py-2.5">
                    {r.settled ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Settled</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Unsettled</span>
                    )}
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    No consignment sales in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
