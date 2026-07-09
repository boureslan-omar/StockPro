import { createClient } from "@/lib/supabase/server";
import { fmtUSD } from "@/lib/format";
import WastageForm from "./wastage-form";
import { deleteWastage } from "./actions";

const REASON_STYLE: Record<string, string> = {
  expired: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  damaged: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  owner_use: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  sample: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  lost: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function WastagePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; from?: string; to?: string; product?: string }>;
}) {
  const { reason, from: fromParam, to: toParam, product } = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const from = fromParam || `${now.toISOString().slice(0, 7)}-01`;
  const to = toParam || now.toISOString().slice(0, 10);
  const prodFilter = (product || "").trim();

  let query = supabase.from("wastage").select("*").gte("wastage_date", from).lte("wastage_date", to);
  if (reason && reason !== "all") query = query.eq("reason", reason);
  if (prodFilter) query = query.ilike("product_name", `%${prodFilter}%`);
  const { data: records } = await query.order("wastage_date", { ascending: false }).order("id", { ascending: false });

  const rows = records ?? [];
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0);

  const { data: mtdRows } = await supabase
    .from("wastage")
    .select("quantity, unit_cost")
    .gte("wastage_date", `${now.toISOString().slice(0, 7)}-01`)
    .lte("wastage_date", now.toISOString().slice(0, 10));
  const mtdCost = (mtdRows ?? []).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Wastage</h1>
        <WastageForm />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xs text-zinc-500">This Month Loss</p>
          <p className="text-lg font-bold text-red-600">{fmtUSD(mtdCost)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xs text-zinc-500">Filtered Records</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xs text-zinc-500">Filtered Loss Value</p>
          <p className="text-lg font-bold text-red-600">{fmtUSD(totalCost)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xs text-zinc-500">Filtered Qty</p>
          <p className="text-lg font-bold">{totalQty.toFixed(2)}</p>
        </div>
      </div>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Reason</label>
          <select name="reason" defaultValue={reason || "all"} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
            <option value="all">All Reasons</option>
            {Object.keys(REASON_STYLE).map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Product</label>
          <input name="product" defaultValue={prodFilter} placeholder="Search by name…" className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <button className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium text-right">Unit Cost</th>
              <th className="px-4 py-3 font-medium text-right">Total Loss</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5 text-xs">{r.wastage_date}</td>
                <td className="px-4 py-2.5 font-medium">{r.product_name}</td>
                <td className="px-4 py-2.5">
                  {Number(r.quantity)} {r.unit}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${REASON_STYLE[r.reason] ?? REASON_STYLE.other}`}>
                    {r.reason.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">{r.reason_note || ""}</td>
                <td className="px-4 py-2.5 text-right text-xs">{fmtUSD(r.unit_cost)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-red-600">{fmtUSD(Number(r.quantity) * Number(r.unit_cost))}</td>
                <td className="px-4 py-2.5">
                  <form
                    action={async () => {
                      "use server";
                      await deleteWastage(r.id);
                    }}
                  >
                    <button type="submit" className="text-red-600 hover:underline text-xs">
                      Delete &amp; restore
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No wastage records in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
