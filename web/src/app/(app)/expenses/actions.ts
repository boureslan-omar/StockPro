"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry } from "@/lib/cash";
import { getSettings } from "@/lib/settings";

export async function saveExpense(formData: FormData) {
  const supabase = await createClient();
  const description = String(formData.get("description") || "").trim();
  let amount = Number(formData.get("amount") || 0);
  const category = String(formData.get("category") || "General").trim();
  const expenseDate = String(formData.get("expense_date") || new Date().toISOString().slice(0, 10));
  let note = String(formData.get("note") || "").trim();
  const cashDeduct = formData.get("cash_deduct") === "1";
  const cashCurrency = String(formData.get("cash_currency") || "USD");

  let amountLbp = 0;
  if (cashCurrency === "LBP") {
    const settings = await getSettings(supabase);
    const rate = Number(settings.exchange_rate || 89750);
    amountLbp = amount;
    amount = Math.round((amountLbp / rate) * 10000) / 10000;
    const lbpLabel = `${Math.round(amountLbp).toLocaleString()} LBP`;
    note = note ? `${lbpLabel} — ${note}` : lbpLabel;
  }

  if (!description || amount <= 0) {
    throw new Error("Description and a positive amount are required.");
  }

  await supabase.from("expenses").insert({ description, amount, category, expense_date: expenseDate, note });

  if (cashDeduct) {
    const cashNote = `Expense: ${description}${note ? ` — ${note}` : ""}`;
    if (cashCurrency === "LBP") {
      await logCashEntry(supabase, { type: "expense", amountLbp: -amountLbp, note: cashNote, currency: "LBP" });
    } else {
      await logCashEntry(supabase, { type: "expense", amountUsd: -amount, note: cashNote });
    }
  }

  revalidatePath("/expenses");
}

export async function deleteExpense(id: number) {
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/expenses");
}
