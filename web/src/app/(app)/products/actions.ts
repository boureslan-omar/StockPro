"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveProduct(formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  const barcode = String(formData.get("barcode") || "").trim();
  const unit = String(formData.get("unit") || "pcs");
  const categoryId = formData.get("category_id") ? Number(formData.get("category_id")) : null;
  const productType = String(formData.get("product_type") || "regular") as "regular" | "bulk";
  const productSource = String(formData.get("product_source") || "owned") as "owned" | "consignment";
  const supplierId = formData.get("supplier_id") ? Number(formData.get("supplier_id")) : null;
  const consignmentSupplierId = formData.get("consignment_supplier_id") ? Number(formData.get("consignment_supplier_id")) : null;
  const consignmentCost = Number(formData.get("consignment_cost") || 0);
  const costPrice = Number(formData.get("cost_price") || 0);
  const sellPrice = Number(formData.get("sell_price") || 0);
  const unitsPerBox = Number(formData.get("units_per_box") || 1);
  const sellPriceBox = formData.get("sell_price_box") ? Number(formData.get("sell_price_box")) : null;
  const lowStockAlert = Number(formData.get("low_stock_alert") || 5);
  const trackExpiry = formData.get("track_expiry") === "1";

  if (!name) throw new Error("Product name is required.");
  if (productSource === "consignment" && !consignmentSupplierId) {
    throw new Error("Select a consignment supplier.");
  }

  const payload = {
    name,
    barcode: barcode || null,
    unit,
    category_id: categoryId,
    product_type: productType,
    product_source: productSource,
    supplier_id: productSource === "consignment" ? null : supplierId,
    consignment_supplier_id: productSource === "consignment" ? consignmentSupplierId : null,
    consignment_cost: productSource === "consignment" ? consignmentCost : 0,
    cost_price: costPrice,
    sell_price: sellPrice,
    units_per_box: unitsPerBox > 0 ? unitsPerBox : 1,
    sell_price_box: sellPriceBox,
    low_stock_alert: lowStockAlert,
    track_expiry: trackExpiry,
  };

  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("products").insert({ ...payload, stock: 0 });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/products");
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();

  const [batches, saleItems] = await Promise.all([
    supabase.from("batches").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);

  if ((batches.count ?? 0) > 0 || (saleItems.count ?? 0) > 0) {
    throw new Error("Cannot delete — this product has purchase or sale history. Consider editing it instead.");
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/products");
}
