import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, barcode, name, unit, stock, cost_price, sell_price, product_type")
    .or(`name.ilike.%${q}%,barcode.ilike.%${q}%`)
    .order("name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
