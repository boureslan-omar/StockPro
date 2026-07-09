import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [products, customers, todaySales, settings] = await Promise.all([
    supabase.from("products").select("id, stock, low_stock_alert"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("sales")
      .select("total")
      .eq("is_void", false)
      .gte("sale_date", todayStart.toISOString()),
    supabase.from("settings").select("key, value"),
  ]);

  const settingsMap = Object.fromEntries(
    (settings.data ?? []).map((s) => [s.key, s.value])
  );
  const lowStock = (products.data ?? []).filter(
    (p) => Number(p.stock) <= Number(p.low_stock_alert)
  ).length;
  const salesTotal = (todaySales.data ?? []).reduce(
    (sum, s) => sum + Number(s.total),
    0
  );

  const stats = [
    { label: "Products", value: String(products.data?.length ?? 0) },
    { label: "Low stock", value: String(lowStock) },
    { label: "Sales today", value: String(todaySales.data?.length ?? 0) },
    { label: "Revenue today (USD)", value: `$${salesTotal.toFixed(2)}` },
    { label: "Customers", value: String(customers.count ?? 0) },
    {
      label: "Exchange rate",
      value: `${Number(settingsMap.exchange_rate ?? 0).toLocaleString()} LBP`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {settingsMap.store_name ?? "StockPro"} — Dashboard
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
          >
            <p className="text-sm text-zinc-500 mb-1">{s.label}</p>
            <p className="text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
