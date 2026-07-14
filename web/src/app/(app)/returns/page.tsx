import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import ReturnsData from "./returns-data";

export default function ReturnsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Returns</h1>
      <Suspense fallback={<ListSkeleton columns={7} showHeader={false} />}>
        <ReturnsData />
      </Suspense>
    </div>
  );
}
