import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import PosClient from "./pos-client";

export default async function PosPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: customers }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, barcode, unit, stock, cost_price, sell_price, sell_price_box, units_per_box, product_type, product_source, category_id")
      .order("name"),
    supabase.from("customers").select("id, name, balance").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const settings = await getSettings(supabase);
  const rate = Number(settings.exchange_rate || 89750);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">POS</h1>
      <PosClient
        products={products ?? []}
        customers={customers ?? []}
        categories={categories ?? []}
        exchangeRate={rate}
        storeName={settings.store_name || "StockPro"}
        storeAddress={settings.store_address || ""}
        storePhone={settings.store_phone || ""}
      />
    </div>
  );
}
