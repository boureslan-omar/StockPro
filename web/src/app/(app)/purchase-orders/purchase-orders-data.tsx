import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import POForm from "./po-form";
import ReceivePO from "./receive-po";
import ViewPO from "./view-po";
import EditPO from "./edit-po";
import StatusSelect from "./status-select";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import { deletePO } from "./actions";

export default async function PurchaseOrdersData({ status, from, to }: { status: string; from?: string; to?: string }) {
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");

  let query = supabase
    .from("purchase_orders")
    .select("*, suppliers(name, phone), purchase_order_items(count)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);
  const { data: orders } = await query;

  const rows = orders ?? [];

  return (
    <div className="stream-in">
      <div className="flex items-center justify-end mb-4">
        <POForm suppliers={suppliers ?? []} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
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
                    <ViewPO poId={po.id} label={po.po_number} />
                    {po.status !== "received" && po.status !== "cancelled" && (
                      <EditPO
                        poId={po.id}
                        poNumber={po.po_number}
                        suppliers={suppliers ?? []}
                        supplierId={po.supplier_id}
                        deliveryDate={po.delivery_date}
                        note={po.note}
                      />
                    )}
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
