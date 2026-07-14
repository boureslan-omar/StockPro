import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { fmtUSD } from "@/lib/format";
import SuppliersClient from "./supplier-form";
import PaymentForm from "./payment-form";

export default async function SuppliersData({ viewId, search }: { viewId: number; search: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("suppliers")
    .select("*, products(count), purchases(count)")
    .order("name");
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const [{ data: rawSuppliers }, viewResult, ledgerResult, settings] = await Promise.all([
    query,
    viewId ? supabase.from("suppliers").select("*").eq("id", viewId).single() : Promise.resolve({ data: null }),
    viewId
      ? supabase.from("supplier_ledger").select("*").eq("supplier_id", viewId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: null }),
    getSettings(supabase),
  ]);

  const suppliers = (rawSuppliers ?? []).map((s) => ({
    ...s,
    product_count: (s.products as unknown as { count: number }[])?.[0]?.count ?? 0,
    purchase_count: (s.purchases as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  const totalOwed = suppliers.reduce((sum, s) => sum + Number(s.balance), 0);

  const viewSupplier = viewResult.data as { id: number; name: string; phone: string | null; email: string | null; balance: number } | null;
  const ledger = (viewSupplier ? ledgerResult.data : null) ?? [];

  const rate = Number(settings.exchange_rate || 89750);
  const bal = viewSupplier ? Number(viewSupplier.balance) : 0;

  return (
    <div className="stream-in">
      {totalOwed > 0 && (
        <p className="text-sm text-red-600 font-medium mb-2">Total owed to suppliers: {fmtUSD(totalOwed)}</p>
      )}
      {totalOwed < 0 && (
        <p className="text-sm text-green-600 font-medium mb-2">Net supplier credit: {fmtUSD(Math.abs(totalOwed))}</p>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {viewSupplier && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 order-1 lg:order-none">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{viewSupplier.name}</h3>
                <p className="text-xs text-zinc-500">
                  {viewSupplier.phone || ""}
                  {viewSupplier.email ? ` · ${viewSupplier.email}` : ""}
                </p>
              </div>
              <Link href="/suppliers" className="text-xs text-zinc-500 hover:underline">
                ✕ Close
              </Link>
            </div>

            <div
              className={`text-sm rounded-lg px-3 py-2 mb-3 ${
                bal > 0
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : bal < 0
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800"
              }`}
            >
              {bal > 0 ? `We owe them: ${fmtUSD(bal)}` : bal < 0 ? `They owe us: ${fmtUSD(Math.abs(bal))}` : "Account is settled"}
            </div>

            <PaymentForm
              supplierId={viewSupplier.id}
              balanceUsd={bal > 0 ? bal.toFixed(2) : ""}
              balanceLbp={bal > 0 ? String(Math.round(bal * rate)) : ""}
              defaultNote={`Payment to ${viewSupplier.name}`}
            />

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
                              : l.type === "purchase"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {l.type}
                        </span>
                      </td>
                      <td className={`py-1.5 font-medium ${Number(l.amount) > 0 ? "text-red-600" : "text-green-600"}`}>
                        {Number(l.amount) > 0 ? "+" : ""}
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

        <div className={viewSupplier ? "" : "lg:col-span-2"}>
          <SuppliersClient suppliers={suppliers} viewId={viewId} search={search} />
        </div>
      </div>
    </div>
  );
}
