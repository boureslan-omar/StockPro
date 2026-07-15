import Link from "next/link";
import { Package, AlertTriangle, ShoppingCart, DollarSign, Users, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import RevenueTrendChart from "./dashboard-chart";

const TREND_DAYS = 14;

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));
  trendStart.setHours(0, 0, 0, 0);

  const [products, customers, todaySales, settings, trendSales, recentSales] = await Promise.all([
    supabase.from("products").select("id, name, stock, low_stock_alert, unit"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("sales")
      .select("total")
      .eq("is_void", false)
      .gte("sale_date", todayStart.toISOString()),
    supabase.from("settings").select("key, value"),
    supabase
      .from("sales")
      .select("sale_date, total")
      .eq("is_void", false)
      .gte("sale_date", trendStart.toISOString()),
    supabase
      .from("sales")
      .select("id, receipt_no, total, sale_date, customers(name)")
      .eq("is_void", false)
      .order("sale_date", { ascending: false })
      .limit(8),
  ]);

  const settingsMap = Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.value]));
  const allProducts = products.data ?? [];
  const lowStockProducts = allProducts
    .filter((p) => Number(p.stock) <= Number(p.low_stock_alert))
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 6);
  const salesTotal = (todaySales.data ?? []).reduce((sum, s) => sum + Number(s.total), 0);

  const byDay = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of trendSales.data ?? []) {
    const key = String(s.sale_date).slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(s.total));
  }
  const trend = [...byDay.entries()].map(([date, total]) => ({ date, total }));
  const trendTotal = trend.reduce((s, t) => s + t.total, 0);

  const recent = recentSales.data ?? [];

  const stats = [
    { label: "Products", value: String(allProducts.length), icon: Package, tone: "text-blue-500" },
    { label: "Low stock", value: String(lowStockProducts.length), icon: AlertTriangle, tone: lowStockProducts.length > 0 ? "text-red-500" : "text-zinc-400" },
    { label: "Sales today", value: String(todaySales.data?.length ?? 0), icon: ShoppingCart, tone: "text-green-500" },
    { label: "Revenue today", value: fmtUSD(salesTotal), icon: DollarSign, tone: "text-green-500" },
    { label: "Customers", value: String(customers.count ?? 0), icon: Users, tone: "text-violet-500" },
    { label: "Exchange rate", value: `${Number(settingsMap.exchange_rate ?? 0).toLocaleString()} LBP`, icon: Coins, tone: "text-amber-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{settingsMap.store_name ?? "StockPro"} — Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800 ${s.tone}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-zinc-500 mb-0.5">{s.label}</p>
            <p className="text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">Revenue — Last {TREND_DAYS} Days</h2>
            <span className="text-sm text-zinc-500">{fmtUSD(trendTotal)} total</span>
          </div>
          <RevenueTrendChart data={trend} />
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="font-semibold mb-3">Recent Activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">No sales yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((s) => {
                const customerName = (s.customers as unknown as { name: string } | null)?.name;
                return (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{customerName ?? "Walk-in"}</p>
                      <p className="text-xs text-zinc-500">
                        #{s.receipt_no} · {new Date(s.sale_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="font-semibold shrink-0 ml-3">{fmtUSD(s.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/reports" className="block mt-3 text-xs text-blue-600 hover:underline text-center">
            View all in Reports →
          </Link>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 shadow-sm p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Low Stock
            </h2>
            <Link href="/products" className="text-xs text-blue-600 hover:underline">
              Manage products →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="text-red-600 font-semibold shrink-0 ml-2">
                  {Number(p.stock)} {p.unit ?? ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
