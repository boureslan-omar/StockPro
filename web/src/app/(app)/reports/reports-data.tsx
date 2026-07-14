import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import ReportsClient from "./reports-client";

type SaleItemRow = {
  id: number;
  product_id: number | null;
  product_name: string;
  product_type: "regular" | "bulk";
  is_consignment: boolean;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
};

type SaleRow = {
  id: number;
  receipt_no: string;
  customer_id: number | null;
  subtotal: number;
  discount: number;
  credit_used: number;
  total: number;
  paid_usd: number;
  paid_lbp: number;
  change_usd: number;
  change_lbp: number;
  exchange_rate_used: number;
  payment_method: string;
  note: string | null;
  is_void: boolean;
  sale_date: string;
  customers: { name: string } | null;
  sale_items: SaleItemRow[];
};

function periodKey(dateStr: string, groupBy: "day" | "week" | "month"): string {
  const d = new Date(dateStr);
  if (groupBy === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (groupBy === "week") {
    const monday = new Date(d);
    const dow = (monday.getDay() + 6) % 7; // 0 = Monday
    monday.setDate(monday.getDate() - dow);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export default async function ReportsData({
  from,
  to,
  groupBy,
}: {
  from: string;
  to: string;
  groupBy: "day" | "week" | "month";
}) {
  const supabase = await createClient();
  const fromTs = `${from}T00:00:00`;
  const toTs = `${to}T23:59:59.999`;

  const [{ data: sales }, { data: expenseRows }, { data: bulkPurchaseRows }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, customers(name), sale_items(id, product_id, product_name, product_type, is_consignment, quantity, unit_price, unit_cost, total)")
      .gte("sale_date", fromTs)
      .lte("sale_date", toTs)
      .order("sale_date", { ascending: false }),
    supabase.from("expenses").select("category, amount").gte("expense_date", from).lte("expense_date", to),
    supabase
      .from("purchase_items")
      .select("product_name, total, purchases!inner(purchase_date)")
      .eq("product_type", "bulk")
      .gte("purchases.purchase_date", from)
      .lte("purchases.purchase_date", to),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const rows = (sales ?? []) as unknown as SaleRow[];
  const nonVoid = rows.filter((s) => !s.is_void);

  const revenue = nonVoid.reduce((s, r) => s + Number(r.total), 0);
  const cogs = nonVoid.reduce(
    (s, r) => s + r.sale_items.filter((it) => !it.is_consignment).reduce((s2, it) => s2 + Number(it.quantity) * Number(it.unit_cost), 0),
    0
  );
  const expenses = (expenseRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const gross = revenue - cogs;
  const net = gross - expenses;
  const margin = revenue > 0 ? Math.round((gross / revenue) * 1000) / 10 : 0;
  const stats = { revenue, cogs, gross, net, expenses, margin, txCount: nonVoid.length };

  // Top products by profit
  const productAgg = new Map<
    number,
    { name: string; productType: "regular" | "bulk"; units: number; revenue: number; cogs: number }
  >();
  for (const sale of nonVoid) {
    for (const it of sale.sale_items) {
      if (it.product_id == null) continue;
      const cur = productAgg.get(it.product_id) ?? { name: it.product_name, productType: it.product_type, units: 0, revenue: 0, cogs: 0 };
      cur.units += Number(it.quantity);
      cur.revenue += Number(it.total);
      cur.cogs += Number(it.quantity) * Number(it.unit_cost);
      productAgg.set(it.product_id, cur);
    }
  }
  const topProducts = [...productAgg.values()]
    .map((p) => ({ ...p, profit: p.revenue - p.cogs }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20);

  // Bulk purchases reference
  const bulkAgg = new Map<string, number>();
  for (const r of bulkPurchaseRows ?? []) {
    bulkAgg.set(r.product_name, (bulkAgg.get(r.product_name) ?? 0) + Number(r.total));
  }
  const bulkPurchases = [...bulkAgg.entries()].map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost);

  // Payment methods
  const methodAgg = new Map<string, { count: number; total: number }>();
  for (const s of nonVoid) {
    const cur = methodAgg.get(s.payment_method) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(s.total);
    methodAgg.set(s.payment_method, cur);
  }
  const byMethod = [...methodAgg.entries()].map(([method, v]) => ({ method, ...v }));

  // Expenses by category
  const expCatAgg = new Map<string, number>();
  for (const r of expenseRows ?? []) {
    const cat = r.category || "General";
    expCatAgg.set(cat, (expCatAgg.get(cat) ?? 0) + Number(r.amount));
  }
  const expByCategory = [...expCatAgg.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

  // Timeline / period detail
  const periodAgg = new Map<string, { revenue: number; txns: number; cogs: number }>();
  for (const s of nonVoid) {
    const key = periodKey(s.sale_date, groupBy);
    const cur = periodAgg.get(key) ?? { revenue: 0, txns: 0, cogs: 0 };
    cur.revenue += Number(s.total);
    cur.txns += 1;
    cur.cogs += s.sale_items.filter((it) => !it.is_consignment).reduce((s2, it) => s2 + Number(it.quantity) * Number(it.unit_cost), 0);
    periodAgg.set(key, cur);
  }
  const timeline = [...periodAgg.entries()].map(([period, v]) => ({ period, ...v })).sort((a, b) => (a.period < b.period ? -1 : 1));

  const settings = await getSettings(supabase);

  return (
    <div className="stream-in">
      <ReportsClient
        from={from}
        to={to}
        groupBy={groupBy}
        stats={stats}
        topProducts={topProducts}
        bulkPurchases={bulkPurchases}
        byMethod={byMethod}
        expByCategory={expByCategory}
        timeline={timeline}
        transactions={rows}
        categories={categories ?? []}
        suppliers={suppliers ?? []}
        exchangeRate={Number(settings.exchange_rate || 89750)}
        storeName={settings.store_name || "StockPro"}
        storeAddress={settings.store_address || ""}
        storePhone={settings.store_phone || ""}
      />
    </div>
  );
}
