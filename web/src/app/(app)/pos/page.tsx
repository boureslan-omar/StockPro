import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/skeletons";
import PosData from "./pos-data";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuotation?: string }>;
}) {
  const { fromQuotation } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">POS</h1>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <PosData fromQuotation={fromQuotation} />
      </Suspense>
    </div>
  );
}
