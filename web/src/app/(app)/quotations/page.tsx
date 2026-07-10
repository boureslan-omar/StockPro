import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import QuotationsClient from "./quotations-client";
import QuotationDetailActions from "./quotation-detail-actions";
import { deleteQuotation } from "./actions";
import type { EditingQuotation } from "./quotation-form";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  converted: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supabase = await createClient();
  const viewId = Number(view || 0);
  const settings = await getSettings(supabase);
  const storeName = settings.store_name || "StockPro";
  const storeAddress = settings.store_address || "";
  const storePhone = settings.store_phone || "";

  if (viewId) {
    const { data: quote } = await supabase.from("quotations").select("*").eq("id", viewId).single();
    const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", viewId);

    if (!quote) return <p className="text-zinc-500">Quotation not found.</p>;

    const rows = items ?? [];
    const total = rows.reduce((s, r) => s + Number(r.total), 0);

    return (
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/quotations" className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5">
              ← Back
            </Link>
            <h1 className="text-xl font-bold">Quotation {quote.quote_number}</h1>
            <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[quote.status] ?? STATUS_STYLE.draft}`}>{quote.status}</span>
          </div>
          <QuotationDetailActions quote={quote} items={rows} storeName={storeName} storeAddress={storeAddress} storePhone={storePhone} />
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <p className="text-zinc-500 text-xs">Customer</p>
              <p className="font-medium">{quote.customer_name || "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Valid Until</p>
              <p className="font-medium">{quote.valid_until || "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Created</p>
              <p className="font-medium">{new Date(quote.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium text-right">Qty</th>
                <th className="py-2 font-medium text-right">Unit Price</th>
                <th className="py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <td className="py-2">{r.product_name}</td>
                  <td className="py-2 text-right">
                    {Number(r.quantity)} {r.unit}
                  </td>
                  <td className="py-2 text-right">${Number(r.unit_price).toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">${Number(r.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-2" colSpan={3}>
                  TOTAL
                </td>
                <td className="py-2 text-right">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          {quote.note && <p className="text-sm text-zinc-500 mt-3">Note: {quote.note}</p>}
        </div>

        <div className="flex items-center gap-3">
          {quote.status !== "converted" && quote.status !== "rejected" && quote.status !== "expired" && (
            <Link href={`/pos?fromQuotation=${quote.id}`} className="rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2">
              Convert to Sale
            </Link>
          )}
          {quote.status === "converted" && quote.converted_sale_id && (
            <Link href="/reports" className="text-sm text-blue-600 hover:underline">
              View resulting sale in Reports
            </Link>
          )}
          {quote.status !== "converted" && (
            <ConfirmDeleteButton
              confirmText="Delete this quotation?"
              action={async () => {
                "use server";
                await deleteQuotation(quote.id);
              }}
            >
              Delete
            </ConfirmDeleteButton>
          )}
        </div>
      </div>
    );
  }

  const [{ data: quotations }, { data: customers }] = await Promise.all([
    supabase
      .from("quotations")
      .select("*, quotation_items(product_id, product_name, unit, quantity, unit_price, total)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").order("name"),
  ]);

  const rows = (quotations ?? []).map((q) => {
    const items = (q.quotation_items as unknown as { total: number }[]) ?? [];
    return {
      id: q.id,
      quote_number: q.quote_number,
      customer_name: q.customer_name,
      status: q.status,
      valid_until: q.valid_until,
      total: items.reduce((s, it) => s + Number(it.total), 0),
      item_count: items.length,
    };
  });

  const fullQuotations: Record<number, EditingQuotation> = {};
  for (const q of quotations ?? []) {
    fullQuotations[q.id] = {
      id: q.id,
      customer_id: q.customer_id,
      customer_name: q.customer_name,
      valid_until: q.valid_until,
      note: q.note,
      quotation_items: (q.quotation_items as unknown as EditingQuotation["quotation_items"]) ?? [],
    };
  }

  return <QuotationsClient rows={rows} customers={customers ?? []} fullQuotations={fullQuotations} />;
}
