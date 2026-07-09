import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("id, name, phone").or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(10);
  return NextResponse.json(data ?? []);
}
