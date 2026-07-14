import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import ReportsData from "./reports-data";

// The title renders immediately. The date range, stats, and every table
// depend on the sales/expense queries in reports-data.tsx, so those stream
// in behind a Suspense boundary instead of blocking the whole page.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.from || today.slice(0, 8) + "01";
  const to = sp.to || today;
  const groupBy = (sp.group === "week" || sp.group === "month" ? sp.group : "day") as "day" | "week" | "month";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <Suspense fallback={<SectionsSkeleton sections={3} />}>
        <ReportsData from={from} to={to} groupBy={groupBy} />
      </Suspense>
    </div>
  );
}
