"use client";

import { useState, useTransition } from "react";
import ProductPicker, { type PickedProduct } from "@/components/product-picker";
import { runAnalysis } from "./actions";

type Option = { id: number; name: string };
type Result = {
  units_sold: number;
  revenue: number;
  units_purchased: number;
  purchase_cost: number;
  top_products: { name: string; units: number; revenue: number }[];
};

export default function AnalysisWidget({
  from,
  to,
  categories,
  suppliers,
}: {
  from: string;
  to: string;
  categories: Option[];
  suppliers: Option[];
}) {
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function run(nextCategoryId = categoryId, nextSupplierId = supplierId, nextProductId = product?.id) {
    startTransition(async () => {
      const res = await runAnalysis({
        from,
        to,
        categoryId: nextCategoryId ? Number(nextCategoryId) : null,
        supplierId: nextSupplierId ? Number(nextSupplierId) : null,
        productId: nextProductId ?? null,
      });
      setResult(res);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="font-semibold mb-3">Sales &amp; Purchase Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              run(e.target.value, supplierId, product?.id);
            }}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              run(categoryId, e.target.value, product?.id);
            }}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Product</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <ProductPicker
                onPick={(p) => {
                  setProduct(p);
                  run(categoryId, supplierId, p.id);
                }}
              />
            </div>
            {product && (
              <button
                type="button"
                onClick={() => {
                  setProduct(null);
                  run(categoryId, supplierId, undefined);
                }}
                title="Clear product filter"
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {!result && !pending && <p className="text-sm text-zinc-500">Pick a category, supplier, or product above to see filtered stats.</p>}

      {result && (
        <div className={pending ? "opacity-50" : ""}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <p className="text-xs text-zinc-500">Units Sold</p>
              <p className="text-lg font-bold">{result.units_sold.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
              <p className="text-xs text-zinc-500">Sales Revenue</p>
              <p className="text-lg font-bold">${result.revenue.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
              <p className="text-xs text-zinc-500">Units Purchased</p>
              <p className="text-lg font-bold">{result.units_purchased.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
              <p className="text-xs text-zinc-500">Purchase Cost</p>
              <p className="text-lg font-bold">${result.purchase_cost.toFixed(2)}</p>
            </div>
          </div>

          {result.top_products.length > 1 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-500 mb-2">TOP PRODUCTS</h4>
              <table className="w-full text-sm">
                <thead className="text-zinc-500 text-left">
                  <tr>
                    <th className="font-medium py-1">Product</th>
                    <th className="font-medium py-1 text-right">Units</th>
                    <th className="font-medium py-1 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {result.top_products.map((p) => (
                    <tr key={p.name} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right">{p.units.toLocaleString()}</td>
                      <td className="py-1.5 text-right">${p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
