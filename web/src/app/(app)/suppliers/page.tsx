import { Suspense } from "react";
import Link from "next/link";
import { ListWithDetailSkeleton } from "@/components/skeletons";
import SuppliersData from "./suppliers-data";

export default async function SuppliersPage({
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
        <h1 className="text-2xl font-bold">Suppliers</h1>
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
          <Link href="/suppliers" className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </Link>
        )}
      </form>

      <Suspense fallback={<ListWithDetailSkeleton showHeader={false} />}>
        <SuppliersData viewId={viewId} search={search} />
      </Suspense>
    </div>
  );
}
