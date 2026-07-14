import { Suspense } from "react";
import Link from "next/link";
import { ListWithDetailSkeleton } from "@/components/skeletons";
import CustomersData from "./customers-data";

// Title and search form need no data (the search box just reflects the
// current query param) — only the list/detail grid depends on Supabase,
// so that's what streams in behind the Suspense boundary.
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { view, q } = await searchParams;
  const viewId = Number(view || 0);
  const search = (q || "").trim();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <form method="GET" className="flex gap-2 mb-4 max-w-md">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name or phone…"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Search</button>
        {search && (
          <Link href="/customers" className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </Link>
        )}
      </form>

      <Suspense fallback={<ListWithDetailSkeleton showHeader={false} />}>
        <CustomersData viewId={viewId} search={search} />
      </Suspense>
    </div>
  );
}
