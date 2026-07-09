"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type AuditItemInput = {
  productId: number;
  productName: string;
  systemQty: number;
  physicalQty: number;
  unit: string;
  note: string;
};

export async function createAudit(formData: FormData) {
  const supabase = await createClient();
  const auditDate = String(formData.get("audit_date") || new Date().toISOString().slice(0, 10));
  const note = String(formData.get("note") || "").trim();
  const items: AuditItemInput[] = JSON.parse(String(formData.get("items_json") || "[]"));

  if (!items.length) throw new Error("No items submitted.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: audit, error } = await supabase
    .from("audit_sessions")
    .insert({ audit_date: auditDate, status: "completed", note, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  for (const item of items) {
    if (!item.productId) continue;
    await supabase.from("audit_items").insert({
      audit_id: audit.id,
      product_id: item.productId,
      product_name: item.productName,
      system_qty: item.systemQty,
      physical_qty: item.physicalQty,
      unit: item.unit,
      note: item.note,
    });
  }

  revalidatePath("/audits");
  return { message: `Audit #${audit.id} created successfully.` };
}

export async function applyAudit(auditId: number) {
  const supabase = await createClient();
  const { data: items } = await supabase.from("audit_items").select("*").eq("audit_id", auditId);

  for (const item of items ?? []) {
    const discrepancy = Number(item.physical_qty) - Number(item.system_qty);
    if (Math.abs(discrepancy) < 0.001) continue;

    await supabase.from("products").update({ stock: item.physical_qty }).eq("id", item.product_id);

    const { data: batch } = await supabase
      .from("batches")
      .select("id, quantity_remaining")
      .eq("product_id", item.product_id)
      .gt("quantity_remaining", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (batch) {
      const newQty = Math.max(0, Number(batch.quantity_remaining) + discrepancy);
      await supabase.from("batches").update({ quantity_remaining: newQty }).eq("id", batch.id);
    }
  }

  await supabase.from("audit_sessions").update({ status: "applied" }).eq("id", auditId);
  revalidatePath("/audits");
  revalidatePath("/products");
}

export async function deleteAudit(auditId: number) {
  const supabase = await createClient();
  await supabase.from("audit_sessions").delete().eq("id", auditId);
  revalidatePath("/audits");
}
