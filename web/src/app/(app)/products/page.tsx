import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: number;
  barcode: string | null;
  name: string;
  product_type: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  low_stock_alert: number;
  unit: string | null;
  categories: { name: string } | null;
  suppliers: { name: string } | null;
};

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, barcode, name, product_type, cost_price, sell_price, stock, low_stock_alert, unit, categories(name), suppliers(name)"
    )
    .order("name");

  if (error) {
    return (
      <p className="text-red-600">Failed to load products: {error.message}</p>
    );
  }

  const rows = (products ?? []) as unknown as ProductRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <span className="text-sm text-zinc-500">
          {rows.length} product{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500">
          No products yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm bg-white dark:bg-zinc-900">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Barcode</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = Number(p.stock) <= Number(p.low_stock_alert);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                      {p.barcode ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">{p.categories?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{p.suppliers?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      ${Number(p.cost_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      ${Number(p.sell_price).toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right ${
                        low ? "text-red-600 font-semibold" : ""
                      }`}
                    >
                      {Number(p.stock)} {p.unit ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
