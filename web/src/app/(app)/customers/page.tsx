import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import CustomersClient from "./customer-form";
import CustomerPaymentForm from "./payment-form";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { view, q } = await searchParams;
  const supabase = await createClient();
  const viewId = Number(view || 0);
  const search = (q || "").trim();

  let query = supabase.from("customers").select("*").order("name");
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data: customers } = await query;

  let viewCustomer: { id: number; name: string; phone: string | null; balance: number } | null = null;
  let ledger: { id: number; type: string; amount: number; note: string | null; created_at: string }[] = [];

  if (viewId) {
    const { data: c } = await supabase.from("customers").select("*").eq("id", viewId).single();
    viewCustomer = c;
    if (c) {
      const { data: l } = await supabase
        .from("customer_ledger")
        .select("*")
        .eq("customer_id", viewId)
        .order("created_at", { ascending: false })
        .limit(100);
      ledger = l ?? [];
    }
  }

  const bal = viewCustomer ? Number(viewCustomer.balance) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <form method="GET" className="flex gap-2 mb-4 max-w-md">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name or phone…"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Search</button>
        {search && (
          <Link href="/customers" className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </Link>
        )}
      </form>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
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

            <div className="text-xs font-semibold text-zinc-500 mb-1">Ledger</div>
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
          <CustomersClient customers={customers ?? []} viewId={viewId} search={search} />
        </div>
      </div>
    </div>
  );
}
