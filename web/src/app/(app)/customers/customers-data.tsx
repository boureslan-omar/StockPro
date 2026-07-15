import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import CustomersClient from "./customer-form";
import CustomerPaymentForm from "./payment-form";
import ExportStatementButton from "./export-statement-button";

export default async function CustomersData({
  viewId,
  search,
  creditStatus,
  debtMin,
  lastTxFrom,
  lastTxTo,
}: {
  viewId: number;
  search: string;
  creditStatus: string;
  debtMin: string;
  lastTxFrom: string;
  lastTxTo: string;
}) {
  const supabase = await createClient();

  let query = supabase.from("customers").select("*").order("name");
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const needsLastTx = Boolean(lastTxFrom || lastTxTo);

  const [{ data: customers }, viewResult, ledgerResult, lastTxResult] = await Promise.all([
    query,
    viewId ? supabase.from("customers").select("*").eq("id", viewId).single() : Promise.resolve({ data: null }),
    viewId
      ? supabase.from("customer_ledger").select("*").eq("customer_id", viewId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: null }),
    // Only needed when filtering by last-transaction date — otherwise skip
    // pulling the whole ledger table just to compute a date we won't use.
    needsLastTx
      ? supabase.from("customer_ledger").select("customer_id, created_at").order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const viewCustomer = viewResult.data as { id: number; name: string; phone: string | null; balance: number } | null;
  const ledger = (viewCustomer ? ledgerResult.data : null) ?? [];

  const bal = viewCustomer ? Number(viewCustomer.balance) : 0;

  let filteredCustomers = customers ?? [];
  if (creditStatus === "debt") filteredCustomers = filteredCustomers.filter((c) => Number(c.balance) < -0.001);
  else if (creditStatus === "credit") filteredCustomers = filteredCustomers.filter((c) => Number(c.balance) > 0.001);
  else if (creditStatus === "settled") filteredCustomers = filteredCustomers.filter((c) => Math.abs(Number(c.balance)) <= 0.001);

  const minDebt = parseFloat(debtMin);
  if (!isNaN(minDebt) && minDebt > 0) {
    filteredCustomers = filteredCustomers.filter((c) => -Number(c.balance) >= minDebt);
  }

  if (needsLastTx) {
    const lastTxByCustomer = new Map<number, string>();
    for (const row of lastTxResult.data ?? []) {
      if (!lastTxByCustomer.has(row.customer_id)) lastTxByCustomer.set(row.customer_id, row.created_at);
    }
    filteredCustomers = filteredCustomers.filter((c) => {
      const last = lastTxByCustomer.get(c.id);
      if (!last) return false;
      const lastDate = last.slice(0, 10);
      if (lastTxFrom && lastDate < lastTxFrom) return false;
      if (lastTxTo && lastDate > lastTxTo) return false;
      return true;
    });
  }

  return (
    <div className="stream-in grid lg:grid-cols-[380px_1fr] gap-4">
      {viewCustomer && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 order-1 lg:order-none">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold">{viewCustomer.name}</h3>
              <p className="text-xs text-zinc-500">{viewCustomer.phone || "No phone"}</p>
            </div>
            <Link href="/customers" className="text-xs text-zinc-500 hover:underline">
              ✕ Close
            </Link>
          </div>

          <div
            className={`text-sm rounded-lg px-3 py-2 mb-3 ${
              bal >= 0
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {bal > 0
              ? `Credit: ${fmtUSD(bal)} (we owe them)`
              : bal < 0
              ? `Debt: ${fmtUSD(Math.abs(bal))} (they owe us)`
              : "Balance is settled"}
          </div>

          <CustomerPaymentForm customerId={viewCustomer.id} />

          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-zinc-500">Ledger</div>
            <ExportStatementButton customerId={viewCustomer.id} />
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs">
                  <th className="py-1">Date</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Amount</th>
                  <th className="py-1">Note</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="py-1.5">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          l.type === "payment"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            : l.type === "sale"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className={`py-1.5 font-medium ${Number(l.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {Number(l.amount) >= 0 ? "+" : ""}
                      {fmtUSD(l.amount)}
                    </td>
                    <td className="py-1.5 text-xs text-zinc-500">{l.note || "—"}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-500 text-xs">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={viewCustomer ? "" : "lg:col-span-2"}>
        <CustomersClient customers={filteredCustomers} viewId={viewId} search={search} />
      </div>
    </div>
  );
}
