import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import ProductsData from "./products-data";

// The title renders immediately — it needs no data. Everything that does
// (the count, the Add button, the table) streams in behind it once
// products-data.tsx's queries resolve, instead of the whole page waiting
// together.
export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      <Suspense fallback={<ListSkeleton columns={8} showHeader={false} />}>
        <ProductsData />
      </Suspense>
    </div>
  );
}
