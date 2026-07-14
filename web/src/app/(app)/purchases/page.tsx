import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import PurchasesData from "./purchases-data";

export default function PurchasesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchases</h1>
      <Suspense fallback={<ListSkeleton columns={7} showHeader={false} />}>
        <PurchasesData />
      </Suspense>
    </div>
  );
}
