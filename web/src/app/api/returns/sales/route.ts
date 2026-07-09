import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json([]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, receipt_no, sale_date, total")
    .eq("customer_id", Number(customerId))
    .eq("is_void", false)
    .order("sale_date", { ascending: false })
    .limit(50);
  return NextResponse.json(data ?? []);
}
