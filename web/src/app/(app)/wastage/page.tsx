import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import WastageData from "./wastage-data";

export default async function WastagePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; from?: string; to?: string; product?: string }>;
}) {
  const { reason, from: fromParam, to: toParam, product } = await searchParams;
  const now = new Date();
  const from = fromParam || `${now.toISOString().slice(0, 7)}-01`;
  const to = toParam || now.toISOString().slice(0, 10);
  const prodFilter = (product || "").trim();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Wastage</h1>
      <Suspense fallback={<ListSkeleton columns={8} showHeader={false} />}>
        <WastageData reason={reason} from={from} to={to} prodFilter={prodFilter} />
      </Suspense>
    </div>
  );
}
