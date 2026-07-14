import { createClient } from "@/lib/supabase/server";
import ProductsClient, { type Product } from "./products-client";

export default async function ProductsData() {
  const supabase = await createClient();

  const [{ data: products, error }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, barcode, name, category_id, supplier_id, product_type, product_source, consignment_supplier_id, consignment_cost, cost_price, sell_price, stock, low_stock_alert, unit, units_per_box, sell_price_box, track_expiry, categories(name), suppliers!products_supplier_id_fkey(name)"
      )
      .order("name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  if (error) {
    return <p className="text-red-600">Failed to load products: {error.message}</p>;
  }

  return (
    <ProductsClient
      products={(products ?? []) as unknown as Product[]}
      categories={categories ?? []}
      suppliers={suppliers ?? []}
    />
  );
}
