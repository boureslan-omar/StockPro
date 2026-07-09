import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import POForm from "./po-form";
import ReceivePO from "./receive-po";
import StatusSelect from "./status-select";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import { deletePO } from "./actions";

const TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");

  let query = supabase
    .from("purchase_orders")
    .select("*, suppliers(name, phone), purchase_order_items(count)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data: orders } = await query;

  const rows = orders ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <POForm suppliers={suppliers ?? []} />
      </div>

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/purchase-orders?status=${t.value}` : "/purchase-orders"}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              (status || "") === t.value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">PO #</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((po) => {
              const supplier = po.suppliers as unknown as { name: string; phone: string | null } | null;
              const itemCount = (po.purchase_order_items as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={po.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="px-4 py-2.5 font-mono font-medium">{po.po_number}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{supplier?.name}</div>
                    {supplier?.phone && <div className="text-xs text-zinc-500">{supplier.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5">{itemCount} item(s)</td>
                  <td className="px-4 py-2.5">{po.delivery_date || "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusSelect poId={po.id} status={po.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{new Date(po.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {po.status !== "received" && po.status !== "cancelled" && <ReceivePO poId={po.id} poNumber={po.po_number} />}
                    {po.status === "received" && po.received_purchase_id && (
                      <Link href="/purchases" className="text-green-600 hover:underline text-xs mr-2">
                        View purchase
                      </Link>
                    )}
                    <ConfirmDeleteButton
                      confirmText="Delete this PO?"
                      className="text-red-600 hover:underline text-xs ml-2"
                      action={async () => {
                        "use server";
                        await deletePO(po.id);
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
                  No purchase orders yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
