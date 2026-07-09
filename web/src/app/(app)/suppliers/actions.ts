"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";
import { getSettings } from "@/lib/settings";
import { fmtUSD } from "@/lib/format";

export async function saveSupplier(formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!name) throw new Error("Name is required.");

  if (id) {
    await supabase
      .from("suppliers")
      .update({ name, phone, email, address })
      .eq("id", id);
  } else {
    await supabase.from("suppliers").insert({ name, phone, email, address });
  }
  revalidatePath("/suppliers");
}

export async function deleteSupplier(id: number) {
  const supabase = await createClient();

  const [purchases, ledger] = await Promise.all([
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("supplier_id", id),
    supabase.from("supplier_ledger").select("id", { count: "exact", head: true }).eq("supplier_id", id),
  ]);

  if ((purchases.count ?? 0) > 0 || (ledger.count ?? 0) > 0) {
    throw new Error("Cannot delete — this supplier has purchase or payment history.");
  }

  await supabase.from("suppliers").delete().eq("id", id);
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function recordSupplierPayment(formData: FormData) {
  const supabase = await createClient();
  const supplierId = Number(formData.get("supplier_id"));
  const method = String(formData.get("pay_method") || "bank");
  const note = String(formData.get("note") || "").trim();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("name")
    .eq("id", supplierId)
    .single();
  const payNote = note || `Payment to ${supplier?.name ?? ""}`;

  if (method === "cash_usd") {
    const amount = Number(formData.get("amount") || 0);
    if (amount <= 0) throw new Error("Enter an amount.");
    await logCashEntry(supabase, { type: "withdrawal", amountUsd: -amount, note: payNote });
    const { data: s } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
    await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) - amount }).eq("id", supplierId);
    await supabase.from("supplier_ledger").insert({ supplier_id: supplierId, type: "payment", amount: -amount, note: payNote });
  } else if (method === "cash_lbp") {
    const amountLbp = Number(formData.get("amount_lbp") || 0);
    if (amountLbp <= 0) throw new Error("Enter an amount.");
    const settings = await getSettings(supabase);
    const rate = Number(settings.exchange_rate || 89750);
    const amountUsdEquiv = Math.round((amountLbp / rate) * 100) / 100;
    await logCashEntry(supabase, { type: "withdrawal", amountLbp: -amountLbp, note: payNote, currency: "LBP" });
    const { data: s } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
    await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) - amountUsdEquiv }).eq("id", supplierId);
    await supabase.from("supplier_ledger").insert({
      supplier_id: supplierId,
      type: "payment",
      amount: -amountUsdEquiv,
      note: `${payNote} (LL ${amountLbp.toLocaleString()} = ${fmtUSD(amountUsdEquiv)})`,
    });
  } else {
    const amount = Number(formData.get("amount") || 0);
    if (amount <= 0) throw new Error("Enter an amount.");
    const { data: s } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
    await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) - amount }).eq("id", supplierId);
    await supabase.from("supplier_ledger").insert({ supplier_id: supplierId, type: "payment", amount: -amount, note: payNote });
  }

  revalidatePath("/suppliers");
}

export async function adjustSupplierBalance(formData: FormData) {
  const supabase = await createClient();
  const supplierId = Number(formData.get("supplier_id"));
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "—").trim();

  const { data: s } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
  await supabase.from("suppliers").update({ balance: Number(s?.balance ?? 0) + amount }).eq("id", supplierId);
  await supabase.from("supplier_ledger").insert({ supplier_id: supplierId, type: "adjustment", amount, note });

  revalidatePath("/suppliers");
}
