import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const saleIdParam = req.nextUrl.searchParams.get("saleId");
  const receiptNo = req.nextUrl.searchParams.get("receipt");
  const supabase = await createClient();

  let saleId = saleIdParam ? Number(saleIdParam) : null;
  if (!saleId && receiptNo) {
    const { data: sale } = await supabase.from("sales").select("id").eq("receipt_no", receiptNo).maybeSingle();
    saleId = sale?.id ?? null;
  }
  if (!saleId) return NextResponse.json([]);

  const { data: items } = await supabase
    .from("sale_items")
    .select("id, product_id, product_name, quantity, unit_price, total")
    .eq("sale_id", saleId);

  const { data: returns } = await supabase.from("customer_returns").select("sale_item_id, quantity").eq("sale_id", saleId);
  const returnedMap = new Map<number, number>();
  for (const r of returns ?? []) {
    returnedMap.set(r.sale_item_id, (returnedMap.get(r.sale_item_id) ?? 0) + Number(r.quantity));
  }

  const result = (items ?? []).map((it) => ({ ...it, already_returned: returnedMap.get(it.id) ?? 0 }));
  return NextResponse.json(result);
}
