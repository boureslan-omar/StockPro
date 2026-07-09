import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSettings(
  supabase: SupabaseClient
): Promise<Record<string, string>> {
  const { data } = await supabase.from("settings").select("key, value");
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.value ?? ""]));
}

export async function saveSetting(
  supabase: SupabaseClient,
  key: string,
  value: string
) {
  // settings is keyed per-organization; organization_id fills in via column default
  const { data: existing } = await supabase.from("settings").select("key").eq("key", key).maybeSingle();
  if (existing) {
    await supabase.from("settings").update({ value }).eq("key", key);
  } else {
    await supabase.from("settings").insert({ key, value });
  }
}
