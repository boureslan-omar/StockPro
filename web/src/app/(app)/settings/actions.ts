"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveSetting } from "@/lib/settings";

const TEXT_FIELDS = ["store_name", "store_address", "store_phone", "exchange_rate", "base_currency"];

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();

  for (const f of TEXT_FIELDS) {
    const v = formData.get(f);
    if (v !== null) await saveSetting(supabase, f, String(v).trim());
  }
  await saveSetting(supabase, "auto_print_receipt", formData.get("auto_print_receipt") ? "1" : "0");
  await saveSetting(supabase, "customer_display_enabled", formData.get("customer_display_enabled") ? "1" : "0");
  await saveSetting(supabase, "cash_drawer_enabled", formData.get("cash_drawer_enabled") ? "1" : "0");

  revalidatePath("/settings");
}
