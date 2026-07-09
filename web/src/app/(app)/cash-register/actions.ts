"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logCashEntry, getCashBalance } from "@/lib/cash";
import { getShiftStats } from "@/lib/shift";
import { fmtUSD, fmtLBP } from "@/lib/format";

export async function recordMovement(formData: FormData) {
  const supabase = await createClient();
  const action = String(formData.get("action")); // withdrawal | deposit
  const currency = String(formData.get("currency") || "USD");
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim() || (action === "withdrawal" ? "Cash withdrawal" : "Cash deposit");

  if (amount <= 0) throw new Error("Enter an amount.");
  const sign = action === "withdrawal" ? -1 : 1;

  if (currency === "USD") {
    await logCashEntry(supabase, { type: action as "withdrawal" | "deposit", amountUsd: sign * amount, note, currency: "USD" });
  } else {
    await logCashEntry(supabase, { type: action as "withdrawal" | "deposit", amountLbp: sign * amount, note, currency: "LBP" });
  }

  revalidatePath("/cash-register");
}

export async function setOpeningBalance(formData: FormData) {
  const supabase = await createClient();
  const currency = String(formData.get("currency")); // USD | LBP
  const amount = Number(formData.get("amount") || 0);

  const { usd, lbp } = await getCashBalance(supabase);

  if (currency === "USD") {
    const diff = amount - usd;
    if (diff !== 0) {
      await logCashEntry(supabase, { type: "opening", amountUsd: diff, note: `Opening balance set to ${fmtUSD(amount)}`, currency: "USD" });
    }
  } else {
    const diff = amount - lbp;
    if (diff !== 0) {
      await logCashEntry(supabase, { type: "opening", amountLbp: diff, note: `Opening balance set to ${fmtLBP(amount)}`, currency: "LBP" });
    }
  }

  revalidatePath("/cash-register");
}

export async function endOfShift(formData: FormData) {
  const supabase = await createClient();
  const shiftNote = String(formData.get("shift_note") || "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { usd: snapUsd, lbp: snapLbp } = await getCashBalance(supabase);

  const { data: lastShift } = await supabase
    .from("cash_shifts")
    .select("closed_at")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastClose = lastShift?.closed_at ?? null;

  const stats = await getShiftStats(supabase, lastClose);

  await supabase.from("cash_shifts").insert({
    closed_by: user?.id ?? null,
    since_datetime: lastClose,
    balance_usd: snapUsd,
    balance_lbp: snapLbp,
    sales_count: stats.salesCount,
    sales_total_usd: stats.salesTotal,
    cash_in_usd: stats.inUsd,
    cash_in_lbp: stats.inLbp,
    cash_out_usd: stats.outUsd,
    cash_out_lbp: stats.outLbp,
    note: shiftNote,
  });

  revalidatePath("/cash-register");
}
