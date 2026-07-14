import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import Tabs from "@/components/tabs";
import CustomerReturnsPanel from "./customer-returns-panel";
import SupplierReturnsPanel from "./supplier-returns-panel";

export default async function ReturnsData() {
  const supabase = await createClient();

  const [{ data: custReturns }, { data: suppReturns }] = await Promise.all([
    supabase
      .from("customer_returns")
      .select("*, sales(receipt_no, customer_id, customers(name))")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("supplier_returns")
      .select("*, suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="stream-in">
      <Tabs
        tabs={[
          {
            label: "Customer Returns",
            content: (
              <div className="space-y-6">
                <CustomerReturnsPanel />
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
                  <table className="w-full text-sm bg-white dark:bg-zinc-900">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Receipt</th>
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">Qty</th>
                        <th className="px-4 py-3 font-medium">Refund</th>
                        <th className="px-4 py-3 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(custReturns ?? []).map((r) => {
                        const sale = r.sales as unknown as { receipt_no: string; customers: { name: string } | null } | null;
                        return (
                          <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                            <td className="px-4 py-2.5 text-xs">{r.return_date}</td>
                            <td className="px-4 py-2.5 text-xs">{sale?.customers?.name || "—"}</td>
                            <td className="px-4 py-2.5 text-xs">{sale?.receipt_no || "—"}</td>
                            <td className="px-4 py-2.5">{r.product_name}</td>
                            <td className="px-4 py-2.5">{Number(r.quantity)}</td>
                            <td className="px-4 py-2.5 font-medium text-green-600">{fmtUSD(r.refund_amount)}</td>
                            <td className="px-4 py-2.5 text-xs text-zinc-500">{r.note || "—"}</td>
                          </tr>
                        );
                      })}
                      {(custReturns ?? []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                            No customer returns yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            label: "Supplier Returns",
            content: (
              <div className="space-y-6">
                <SupplierReturnsPanel />
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
                  <table className="w-full text-sm bg-white dark:bg-zinc-900">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Supplier</th>
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">Qty</th>
                        <th className="px-4 py-3 font-medium">Credit</th>
                        <th className="px-4 py-3 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(suppReturns ?? []).map((r) => {
                        const supplier = r.suppliers as unknown as { name: string } | null;
                        return (
                          <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                            <td className="px-4 py-2.5 text-xs">{r.return_date}</td>
                            <td className="px-4 py-2.5 text-xs">{supplier?.name || "—"}</td>
                            <td className="px-4 py-2.5">{r.product_name}</td>
                            <td className="px-4 py-2.5">{Number(r.quantity)}</td>
                            <td className="px-4 py-2.5 font-medium text-green-600">{fmtUSD(r.credit_amount)}</td>
                            <td className="px-4 py-2.5 text-xs text-zinc-500">{r.note || "—"}</td>
                          </tr>
                        );
                      })}
                      {(suppReturns ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                            No supplier returns yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
