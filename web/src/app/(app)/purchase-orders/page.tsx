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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchase Orders</h1>

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/purchase-orders?status=${t.value}` : "/purchase-orders"}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              (status || "") === t.value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Suspense fallback={<ListSkeleton columns={7} showHeader={false} />}>
        <PurchaseOrdersData status={status || ""} />
      </Suspense>
    </div>
  );
}
