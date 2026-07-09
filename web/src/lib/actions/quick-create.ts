"use server";

import { createClient } from "@/lib/supabase/server";

export async function createSupplierQuick(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!name) throw new Error("Supplier name is required.");

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name, phone, email, address })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCategoryQuick(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Category name is required.");

  const { data, error } = await supabase.from("categories").insert({ name }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProductQuick(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const barcode = String(formData.get("barcode") || "").trim();
  const unit = String(formData.get("unit") || "pcs");
  const categoryId = formData.get("category_id") ? Number(formData.get("category_id")) : null;
  const supplierId = formData.get("supplier_id") ? Number(formData.get("supplier_id")) : null;
  const costPrice = Number(formData.get("cost_price") || 0);
  const sellPrice = Number(formData.get("sell_price") || 0);
  const lowStockAlert = Number(formData.get("low_stock_alert") || 5);
  const trackExpiry = formData.get("track_expiry") === "1";

  if (!name) throw new Error("Product name is required.");

  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      barcode: barcode || null,
      unit,
      category_id: categoryId,
      supplier_id: supplierId,
      cost_price: costPrice,
      sell_price: sellPrice,
      low_stock_alert: lowStockAlert,
      track_expiry: trackExpiry,
      stock: 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
