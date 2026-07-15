import { Suspense } from "react";
import Link from "next/link";
import { ListWithDetailSkeleton } from "@/components/skeletons";
import CustomersData from "./customers-data";

// Title and search form need no data (they just reflect query params) —
// only the list/detail grid depends on Supabase, so that's what streams in
// behind the Suspense boundary.
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    credit_status?: string;
    debt_min?: string;
    last_tx_from?: string;
    last_tx_to?: string;
  }>;
}) {
  const { view, q, credit_status, debt_min, last_tx_from, last_tx_to } = await searchParams;
  const viewId = Number(view || 0);
  const search = (q || "").trim();
  const anyFilterActive = Boolean(search || credit_status || debt_min || last_tx_from || last_tx_to);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-zinc-500 mb-1">Search</label>
          <input
            name="q"
            defaultValue={search}
            placeholder="Name or phone…"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">Balance</label>
          <select name="credit_status" defaultValue={credit_status || ""} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="debt">Has Debt</option>
            <option value="credit">Has Credit</option>
            <option value="settled">Settled</option>
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-zinc-500 mb-1">Min Debt ($)</label>
          <input
            type="number"
            name="debt_min"
            min="0"
            step="1"
            defaultValue={debt_min}
            placeholder="e.g. 500"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-zinc-500 mb-1">Last Tx From</label>
          <input type="date" name="last_tx_from" defaultValue={last_tx_from} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-zinc-500 mb-1">Last Tx To</label>
          <input type="date" name="last_tx_to" defaultValue={last_tx_to} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <button className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
        {anyFilterActive && (
          <Link href="/customers" className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </Link>
        )}
      </form>

      <Suspense fallback={<ListWithDetailSkeleton showHeader={false} />}>
        <CustomersData
          viewId={viewId}
          search={search}
          creditStatus={credit_status || ""}
          debtMin={debt_min || ""}
          lastTxFrom={last_tx_from || ""}
          lastTxTo={last_tx_to || ""}
        />
      </Suspense>
    </div>
  );
}
