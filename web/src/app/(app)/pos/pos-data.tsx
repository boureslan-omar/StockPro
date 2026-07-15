import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import PosClient, { type InitialLine } from "./pos-client";

export default async function PosData({ fromQuotation }: { fromQuotation?: string }) {
  const supabase = await createClient();

  const [{ data: products }, { data: customers }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, unit, stock, cost_price, sell_price, sell_price_box, units_per_box, product_type, product_source, category_id")
      .order("name"),
    supabase.from("customers").select("id, name, phone, balance").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const settings = await getSettings(supabase);
  const rate = Number(settings.exchange_rate || 89750);

  let initialLines: InitialLine[] | undefined;
  let quotationId: number | null = null;
  const quoteId = Number(fromQuotation || 0);
  if (quoteId) {
    const { data: quote } = await supabase.from("quotations").select("id, status").eq("id", quoteId).single();
    if (quote && quote.status !== "converted") {
      const { data: items } = await supabase
        .from("quotation_items")
        .select("product_id, product_name, unit, quantity, unit_price, products(unit, stock, cost_price, product_type, units_per_box)")
        .eq("quotation_id", quoteId);
      initialLines = (items ?? [])
        .filter((it) => it.product_id != null)
        .map((it) => {
          const p = it.products as unknown as { unit: string | null; stock: number; cost_price: number; product_type: "regular" | "bulk"; units_per_box: number } | null;
          return {
            productId: it.product_id as number,
            name: it.product_name,
            unit: p?.unit || it.unit || "pcs",
            unitsPerBox: p?.units_per_box || 1,
            stock: Number(p?.stock ?? 0),
            type: p?.product_type ?? "regular",
            costPrice: Number(p?.cost_price ?? 0),
            sellUnit: Number(it.unit_price),
            qty: Number(it.quantity),
          };
        });
      quotationId = quoteId;
    }
  }

  return (
    <div className="stream-in">
      <PosClient
        products={products ?? []}
        customers={customers ?? []}
        categories={categories ?? []}
        exchangeRate={rate}
        storeName={settings.store_name || "StockPro"}
        storeAddress={settings.store_address || ""}
        storePhone={settings.store_phone || ""}
        initialLines={initialLines}
        quotationId={quotationId}
      />
    </div>
  );
}
