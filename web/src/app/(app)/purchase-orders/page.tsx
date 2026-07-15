import { Suspense } from "react";
import Link from "next/link";
import { ListSkeleton } from "@/components/skeletons";
import PurchaseOrdersData from "./purchase-orders-data";

const TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const { status, from, to } = await searchParams;

  function tabHref(tabStatus: string) {
    const params = new URLSearchParams();
    if (tabStatus) params.set("status", tabStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `/purchase-orders?${qs}` : "/purchase-orders";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchase Orders</h1>

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              (status || "") === t.value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">Created From</label>
          <input type="date" name="from" defaultValue={from} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">Created To</label>
          <input type="date" name="to" defaultValue={to} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <button className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
        {(from || to) && (
          <a
            href={status ? `/purchase-orders?status=${status}` : "/purchase-orders"}
            className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm"
          >
            Clear dates
          </a>
        )}
      </form>

      <Suspense fallback={<ListSkeleton columns={7} showHeader={false} />}>
        <PurchaseOrdersData status={status || ""} from={from} to={to} />
      </Suspense>
    </div>
  );
}
