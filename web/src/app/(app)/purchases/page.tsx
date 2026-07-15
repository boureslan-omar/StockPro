import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeletons";
import PurchasesData from "./purchases-data";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier?: string }>;
}) {
  const { from, to, supplier } = await searchParams;
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").order("name");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchases</h1>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-zinc-500 mb-1">Supplier</label>
          <select name="supplier" defaultValue={supplier || ""} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
            <option value="">All Suppliers</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
        {(from || to || supplier) && (
          <a href="/purchases" className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </a>
        )}
      </form>

      <Suspense fallback={<ListSkeleton columns={7} showHeader={false} />}>
        <PurchasesData from={from} to={to} supplier={supplier} />
      </Suspense>
    </div>
  );
}
