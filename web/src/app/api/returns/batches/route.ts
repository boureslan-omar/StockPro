import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("batches")
    .select("id, cost_price, quantity_original, quantity_remaining, purchase_date, products(id, name, barcode), purchases(reference, suppliers(id, name))")
    .gt("quantity_remaining", 0)
    .order("created_at", { ascending: false })
    .limit(50);

  type Row = {
    id: number;
    cost_price: number;
    quantity_original: number;
    quantity_remaining: number;
    purchase_date: string;
    products: { id: number; name: string; barcode: string | null } | null;
    purchases: { reference: string | null; suppliers: { id: number; name: string } | null } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const lower = q.toLowerCase();
  const filtered = rows
    .filter(
      (b) =>
        b.products?.name.toLowerCase().includes(lower) ||
        b.products?.barcode === q ||
        b.purchases?.reference?.toLowerCase().includes(lower)
    )
    .slice(0, 20)
    .map((b) => ({
      id: b.id,
      cost_price: b.cost_price,
      quantity_original: b.quantity_original,
      quantity_remaining: b.quantity_remaining,
      purchase_date: b.purchase_date,
      product_id: b.products?.id ?? null,
      product_name: b.products?.name ?? "",
      supplier_id: b.purchases?.suppliers?.id ?? null,
      supplier_name: b.purchases?.suppliers?.name ?? null,
      reference: b.purchases?.reference ?? null,
    }));

  return NextResponse.json(filtered);
}
