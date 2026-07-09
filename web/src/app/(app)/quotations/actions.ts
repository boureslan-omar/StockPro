"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Item = {
  productId: number | null;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

async function generateQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear();
  const { data } = await supabase.from("quotations").select("quote_number").ilike("quote_number", `QT-${year}-%`);
  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(String(row.quote_number).split("-").pop() || "0", 10);
    if (n > max) max = n;
  }
  return `QT-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function saveQuotation(formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id") || 0);
  const customerId = formData.get("customer_id") ? Number(formData.get("customer_id")) : null;
  const customerName = String(formData.get("customer_name") || "").trim();
  const validUntil = String(formData.get("valid_until") || "") || null;
  const note = String(formData.get("note") || "").trim();
  const items: Item[] = JSON.parse(String(formData.get("items_json") || "[]"));

  if (!customerId && !customerName) throw new Error("Select a customer or enter a name.");
  if (!items.length) throw new Error("Add at least one item.");

  if (id) {
    const { error } = await supabase
      .from("quotations")
      .update({ customer_id: customerId, customer_name: customerId ? null : customerName, valid_until: validUntil, note })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await supabase.from("quotation_items").delete().eq("quotation_id", id);
    await insertItems(supabase, id, items);
    revalidatePath("/quotations");
    return { id };
  }

  const quoteNumber = await generateQuoteNumber(supabase);
  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      quote_number: quoteNumber,
      customer_id: customerId,
      customer_name: customerId ? null : customerName,
      valid_until: validUntil,
      note,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await insertItems(supabase, quote.id, items);
  revalidatePath("/quotations");
  return { id: quote.id, quoteNumber };
}

async function insertItems(supabase: Awaited<ReturnType<typeof createClient>>, quotationId: number, items: Item[]) {
  const rows = items.map((it) => ({
    quotation_id: quotationId,
    product_id: it.productId,
    product_name: it.productName,
    unit: it.unit,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    total: Math.round(it.quantity * it.unitPrice * 100) / 100,
  }));
  const { error } = await supabase.from("quotation_items").insert(rows);
  if (error) throw new Error(error.message);
}

export async function updateQuotationStatus(id: number, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/quotations");
}

export async function deleteQuotation(id: number) {
  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotations").select("status").eq("id", id).single();
  if (quote?.status === "converted") throw new Error("Cannot delete — this quotation was already converted to a sale.");
  await supabase.from("quotations").delete().eq("id", id);
  revalidatePath("/quotations");
  redirect("/quotations");
}

export async function linkQuotationToSale(quotationId: number, saleId: number) {
  const supabase = await createClient();
  await supabase.from("quotations").update({ status: "converted", converted_sale_id: saleId }).eq("id", quotationId);
  revalidatePath("/quotations");
}
