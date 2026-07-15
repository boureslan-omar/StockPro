import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import ExpensesData from "./expenses-data";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const from = fromParam || `${now.toISOString().slice(0, 7)}-01`;
  const to = toParam || now.toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Expenses</h1>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <button className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
      </form>

      <Suspense fallback={<ListSkeleton columns={6} showHeader={false} />}>
        <ExpensesData from={from} to={to} />
      </Suspense>
    </div>
  );
}
