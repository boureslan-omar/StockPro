import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import PurchaseForm from "./purchase-form";
import ViewPurchase from "./view-purchase";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import { deletePurchase } from "./actions";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("*, suppliers(name), purchase_items(count)")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(150);

  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  const rows = purchases ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Purchases</h1>
        <PurchaseForm suppliers={suppliers ?? []} categories={categories ?? []} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const supplierName = (p.suppliers as unknown as { name: string } | null)?.name;
              const itemCount = (p.purchase_items as unknown as { count: number }[])?.[0]?.count ?? 0;
              const label = p.reference || `#${p.id}`;
              return (
                <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="px-4 py-2.5">{p.purchase_date}</td>
                  <td className="px-4 py-2.5">{p.reference || "—"}</td>
                  <td className="px-4 py-2.5">{supplierName || "—"}</td>
                  <td className="px-4 py-2.5">{itemCount}</td>
                  <td className="px-4 py-2.5 font-medium">{fmtUSD(p.total_amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{p.note || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <ViewPurchase purchaseId={p.id} label={label} />
                    <ConfirmDeleteButton
                      confirmText="Delete? Stock will be reversed."
                      action={async () => {
                        "use server";
                        await deletePurchase(p.id);
                      }}
                    >
                      Delete
                    </ConfirmDeleteButton>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No purchases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
