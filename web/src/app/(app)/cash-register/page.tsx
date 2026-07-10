import { createClient } from "@/lib/supabase/server";
import { getCashBalance } from "@/lib/cash";
import { getShiftStats } from "@/lib/shift";
import { fmtUSD, fmtLBP } from "@/lib/format";
import { OpeningBalanceForms, MovementForm } from "./forms";
import EndOfShift from "./end-of-shift";

const TYPE_BADGE: Record<string, string> = {
  opening: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sale: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  withdrawal: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  deposit: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  void: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  expense: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  refund: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const from = fromParam || today;
  const to = toParam || today;

  const { usd: balanceUsd, lbp: balanceLbp } = await getCashBalance(supabase);

  const { data: lastShift } = await supabase
    .from("cash_shifts")
    .select("closed_at")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastClose = lastShift?.closed_at ?? null;

  const currentShift = await getShiftStats(supabase, lastClose);

  const { data: shiftHistory } = await supabase
    .from("cash_shifts")
    .select("*, profiles(full_name)")
    .order("closed_at", { ascending: false })
    .limit(20);

  const { data: log } = await supabase
    .from("cash_register_log")
    .select("*, sales(receipt_no)")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .order("created_at", { ascending: false });

  const rows = log ?? [];
  const periodInUsd = rows.reduce((s, r) => s + (Number(r.amount_usd) > 0 ? Number(r.amount_usd) : 0), 0);
  const periodOutUsd = rows.reduce((s, r) => s + (Number(r.amount_usd) < 0 ? Math.abs(Number(r.amount_usd)) : 0), 0);
  const periodInLbp = rows.reduce((s, r) => s + (Number(r.amount_lbp) > 0 ? Number(r.amount_lbp) : 0), 0);
  const periodOutLbp = rows.reduce((s, r) => s + (Number(r.amount_lbp) < 0 ? Math.abs(Number(r.amount_lbp)) : 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Cash Register</h1>
        <EndOfShift balanceUsd={balanceUsd} balanceLbp={balanceLbp} stats={currentShift} since={lastClose} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border-2 border-green-500 bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-xs text-zinc-500">USD Drawer</p>
          <p className="text-2xl font-bold text-green-600">{fmtUSD(balanceUsd)}</p>
        </div>
        <div className="rounded-xl border-2 border-amber-500 bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-xs text-zinc-500">LBP Drawer</p>
          <p className="text-2xl font-bold text-amber-600">{fmtLBP(balanceLbp)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 text-center">
          <p className="text-xs text-zinc-500">Period In</p>
          <p className="text-xl font-bold text-green-600">+{fmtUSD(periodInUsd)}</p>
          <p className="text-xs text-zinc-500">+{fmtLBP(periodInLbp)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 text-center">
          <p className="text-xs text-zinc-500">Period Out</p>
          <p className="text-xl font-bold text-red-600">-{fmtUSD(periodOutUsd)}</p>
          <p className="text-xs text-zinc-500">-{fmtLBP(periodOutLbp)}</p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Current Shift</h3>
          <span className="text-xs text-zinc-500">{lastClose ? `Since ${new Date(lastClose).toLocaleString()}` : "All time"}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-2">
            <p className="text-zinc-500">Cash Sales</p>
            <p className="font-bold text-blue-600">{currentShift.salesCount} txn</p>
            <p className="text-zinc-500">{fmtUSD(currentShift.salesTotal)}</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-2">
            <p className="text-zinc-500">Cash In USD</p>
            <p className="font-bold text-green-600">{fmtUSD(currentShift.inUsd)}</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-2">
            <p className="text-zinc-500">Cash In LBP</p>
            <p className="font-bold text-green-600">{fmtLBP(currentShift.inLbp)}</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-2">
            <p className="text-zinc-500">Cash Out USD</p>
            <p className="font-bold text-red-600">{fmtUSD(currentShift.outUsd)}</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-2">
            <p className="text-zinc-500">Cash Out LBP</p>
            <p className="font-bold text-red-600">{fmtLBP(currentShift.outLbp)}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <OpeningBalanceForms />
        <MovementForm action="withdrawal" label="Cash Out (Withdrawal)" color="red" />
        <MovementForm action="deposit" label="Cash In (Deposit)" color="green" />
      </div>

      <form method="GET" className="flex gap-3 items-end mb-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <button className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Date/Time</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">USD</th>
              <th className="px-3 py-2 font-medium">LBP</th>
              <th className="px-3 py-2 font-medium">Bal. USD</th>
              <th className="px-3 py-2 font-medium">Bal. LBP</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const usdAmt = Number(r.amount_usd);
              const lbpAmt = Number(r.amount_lbp ?? 0);
              const receiptNo = (r.sales as unknown as { receipt_no: string } | null)?.receipt_no;
              return (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_BADGE[r.type] ?? TYPE_BADGE.opening}`}>{r.type}</span>
                  </td>
                  <td className={`px-3 py-2 font-medium ${usdAmt >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {usdAmt !== 0 ? `${usdAmt > 0 ? "+" : ""}${fmtUSD(usdAmt)}` : "—"}
                  </td>
                  <td className={`px-3 py-2 ${lbpAmt >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {lbpAmt !== 0 ? `${lbpAmt > 0 ? "+" : ""}${fmtLBP(lbpAmt)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtUSD(r.balance_after_usd ?? 0)}</td>
                  <td className="px-3 py-2 text-xs">{fmtLBP(r.balance_after_lbp ?? 0)}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{r.note || "—"}</td>
                  <td className="px-3 py-2 text-xs">{receiptNo ? `#${receiptNo}` : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  No transactions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shiftHistory && shiftHistory.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">Shift History</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm bg-white dark:bg-zinc-900">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">Closed At</th>
                  <th className="px-3 py-2 font-medium">Closed By</th>
                  <th className="px-3 py-2 font-medium">Shift Start</th>
                  <th className="px-3 py-2 font-medium">USD Bal.</th>
                  <th className="px-3 py-2 font-medium">LBP Bal.</th>
                  <th className="px-3 py-2 font-medium">Sales</th>
                  <th className="px-3 py-2 font-medium">Cash In</th>
                  <th className="px-3 py-2 font-medium">Cash Out</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {shiftHistory.map((sh) => (
                  <tr key={sh.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 text-xs">
                    <td className="px-3 py-2 font-medium">{new Date(sh.closed_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{(sh.profiles as unknown as { full_name: string } | null)?.full_name || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{sh.since_datetime ? new Date(sh.since_datetime).toLocaleString() : "Beginning"}</td>
                    <td className="px-3 py-2 text-green-600 font-semibold">{fmtUSD(sh.balance_usd)}</td>
                    <td className="px-3 py-2 text-amber-600">{fmtLBP(sh.balance_lbp)}</td>
                    <td className="px-3 py-2">
                      {sh.sales_count} · {fmtUSD(sh.sales_total_usd)}
                    </td>
                    <td className="px-3 py-2 text-green-600">
                      {fmtUSD(sh.cash_in_usd)}
                      {Number(sh.cash_in_lbp) > 0 && <div className="text-zinc-500">{fmtLBP(sh.cash_in_lbp)}</div>}
                    </td>
                    <td className="px-3 py-2 text-red-600">
                      {fmtUSD(sh.cash_out_usd)}
                      {Number(sh.cash_out_lbp) > 0 && <div className="text-zinc-500">{fmtLBP(sh.cash_out_lbp)}</div>}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{sh.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
