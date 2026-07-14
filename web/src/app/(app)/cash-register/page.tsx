import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import CashRegisterData from "./cash-register-data";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = fromParam || today;
  const to = toParam || today;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Cash Register</h1>
      <Suspense fallback={<SectionsSkeleton sections={2} />}>
        <CashRegisterData from={from} to={to} />
      </Suspense>
    </div>
  );
}
