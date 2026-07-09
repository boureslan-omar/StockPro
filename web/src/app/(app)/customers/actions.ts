"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";
import { getSettings } from "@/lib/settings";

export async function saveCustomer(formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const initialBalance = Number(formData.get("initial_balance") || 0);

  if (!name) throw new Error("Name is required.");

  if (id) {
    await supabase.from("customers").update({ name, phone, address, note }).eq("id", id);
  } else {
    const { data: created } = await supabase
      .from("customers")
      .insert({ name, phone, address, note, balance: initialBalance })
      .select("id")
      .single();
    if (initialBalance !== 0 && created) {
      const type = initialBalance > 0 ? "payment" : "sale";
      const bnote = initialBalance > 0 ? "Opening credit (pre-existing)" : "Opening debt (pre-existing)";
      await supabase
        .from("customer_ledger")
        .insert({ customer_id: created.id, type, amount: initialBalance, note: bnote });
    }
  }
  revalidatePath("/customers");
}

export async function deleteCustomer(id: number) {
  const supabase = await createClient();
  const { count } = await supabase.from("sales").select("id", { count: "exact", head: true }).eq("customer_id", id);
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete — this customer has sales history. Clear their balance to zero instead.");
  }
  await supabase.from("customers").delete().eq("id", id);
  revalidatePath("/customers");
  redirect("/customers");
}

export async function recordCustomerPayment(formData: FormData) {
  const supabase = await createClient();
  const customerId = Number(formData.get("customer_id"));
  const payMethod = String(formData.get("pay_method") || "cash_usd");
  const note = String(formData.get("note") || "").trim() || "Manual payment";

  let amount = Number(formData.get("amount") || 0);
  const amountLbp = Number(formData.get("amount_lbp") || 0);

  if (payMethod === "cash_lbp" && amountLbp > 0) {
    const settings = await getSettings(supabase);
    const rate = Number(settings.exchange_rate || 89750);
    amount = Math.round((amountLbp / rate) * 100) / 100;
  }

  if (amount <= 0) throw new Error("Enter an amount.");

  const { data: c } = await supabase.from("customers").select("balance").eq("id", customerId).single();
  await supabase.from("customers").update({ balance: Number(c?.balance ?? 0) + amount }).eq("id", customerId);
  await supabase.from("customer_ledger").insert({ customer_id: customerId, type: "payment", amount, note });

  if (payMethod === "cash_usd") {
    await logCashEntry(supabase, { type: "sale", amountUsd: amount, note: `Customer payment — ${note}` });
  } else if (payMethod === "cash_lbp") {
    await logCashEntry(supabase, { type: "sale", amountLbp, note: `Customer payment — ${note}`, currency: "LBP" });
  }

  revalidatePath("/customers");
}
