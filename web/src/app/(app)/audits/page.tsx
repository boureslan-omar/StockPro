import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AuditForm from "./audit-form";
import ApplyButton from "./apply-button";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import { deleteAudit } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  applied: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  in_progress: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

type SortKey = "date" | "discrepancy" | "shortages" | "surpluses";

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; from?: string; to?: string; sort?: string; dir?: string }>;
}) {
  const { view, status, from, to, sort, dir } = await searchParams;
  const supabase = await createClient();
  const viewId = Number(view || 0);

  if (viewId) {
    const { data: audit } = await supabase.from("audit_sessions").select("*").eq("id", viewId).single();
    const { data: items } = await supabase.from("audit_items").select("*").eq("audit_id", viewId).order("product_name");

    if (!audit) {
      return <p className="text-zinc-500">Audit not found.</p>;
    }

    const rows = items ?? [];
    const shortages = rows.filter((r) => Number(r.physical_qty) < Number(r.system_qty));
    const surpluses = rows.filter((r) => Number(r.physical_qty) > Number(r.system_qty));
    const exact = rows.filter((r) => Math.abs(Number(r.physical_qty) - Number(r.system_qty)) < 0.001);

    return (
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/audits" className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5">
              ← Back
            </Link>
            <h1 className="text-xl font-bold">Audit — {audit.audit_date}</h1>
            <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[audit.status] ?? STATUS_STYLE.in_progress}`}>{audit.status}</span>
          </div>
          {audit.status === "completed" && <ApplyButton auditId={audit.id} />}
        </div>

        {audit.note && <p className="text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2 mb-4">{audit.note}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
            <p className="text-xs text-zinc-500">Items Counted</p>
            <p className="text-lg font-bold">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
            <p className="text-xs text-zinc-500">Shortages</p>
            <p className="text-lg font-bold text-red-600">{shortages.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
            <p className="text-xs text-zinc-500">Surpluses</p>
            <p className="text-lg font-bold text-green-600">{surpluses.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 text-center">
            <p className="text-xs text-zinc-500">Exact Match</p>
            <p className="text-lg font-bold text-zinc-500">{exact.length}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
          <table className="w-full text-sm bg-white dark:bg-zinc-900">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium text-right">System Qty</th>
                <th className="px-4 py-3 font-medium text-right">Physical Qty</th>
                <th className="px-4 py-3 font-medium text-right">Discrepancy</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const disc = Number(r.physical_qty) - Number(r.system_qty);
                const match = Math.abs(disc) < 0.001;
                return (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.product_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(r.system_qty)} {r.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {Number(r.physical_qty)} {r.unit}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${match ? "text-zinc-500" : disc < 0 ? "text-red-600" : "text-green-600"}`}>
                      {disc > 0 ? "+" : ""}
                      {disc.toFixed(3)}
                    </td>
                    <td className="px-4 py-2.5">
                      {match ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">Match</span>
                      ) : disc < 0 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Shortage</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Surplus</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{r.note || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, stock, unit, category_id, categories(name)")
    .eq("product_type", "regular")
    .order("name");
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  let auditQuery = supabase.from("audit_sessions").select("*, audit_items(system_qty, physical_qty)").order("created_at", { ascending: false });
  if (status) auditQuery = auditQuery.eq("status", status);
  if (from) auditQuery = auditQuery.gte("audit_date", from);
  if (to) auditQuery = auditQuery.lte("audit_date", to);
  const { data: audits } = await auditQuery;

  let rows = (audits ?? []).map((a) => {
    const items = (a.audit_items as unknown as { system_qty: number; physical_qty: number }[]) ?? [];
    const totalDiscrepancy = items.reduce((s, i) => s + Math.abs(Number(i.physical_qty) - Number(i.system_qty)), 0);
    const shortageCount = items.filter((i) => Number(i.physical_qty) < Number(i.system_qty)).length;
    const surplusCount = items.filter((i) => Number(i.physical_qty) > Number(i.system_qty)).length;
    return { ...a, item_count: items.length, total_discrepancy: totalDiscrepancy, shortage_count: shortageCount, surplus_count: surplusCount };
  });

  const sortKey: SortKey = (["date", "discrepancy", "shortages", "surpluses"] as const).includes(sort as SortKey) ? (sort as SortKey) : "date";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";
  rows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = a.audit_date < b.audit_date ? -1 : a.audit_date > b.audit_date ? 1 : 0;
    else if (sortKey === "discrepancy") cmp = a.total_discrepancy - b.total_discrepancy;
    else if (sortKey === "shortages") cmp = a.shortage_count - b.shortage_count;
    else cmp = a.surplus_count - b.surplus_count;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sortHref(key: SortKey) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("sort", key);
    params.set("dir", sortKey === key && sortDir === "asc" ? "desc" : "asc");
    return `/audits?${params.toString()}`;
  }


  const productsForForm = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    unit: p.unit,
    category_id: p.category_id,
    cat_name: (p.categories as unknown as { name: string } | null)?.name ?? null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Stock Audits</h1>
        <AuditForm products={productsForForm} categories={categories ?? []} />
      </div>

      <form method="GET" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
        {sort && <input type="hidden" name="sort" value={sort} />}
        {dir && <input type="hidden" name="dir" value={dir} />}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">Status</label>
          <select name="status" defaultValue={status || ""} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="applied">Applied</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={from} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={to} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
        </div>
        <button className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
        {(status || from || to) && (
          <a href="/audits" className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
            Clear
          </a>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 pr-3">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">
                <Link href={sortHref("date")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
                  Date <span className="text-[10px]">{sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                </Link>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">
                <Link href={sortHref("shortages")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
                  Shortages <span className="text-[10px]">{sortKey === "shortages" ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                </Link>
              </th>
              <th className="px-4 py-3 font-medium">
                <Link href={sortHref("surpluses")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
                  Surpluses <span className="text-[10px]">{sortKey === "surpluses" ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                </Link>
              </th>
              <th className="px-4 py-3 font-medium">
                <Link href={sortHref("discrepancy")} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
                  Total Disc. <span className="text-[10px]">{sortKey === "discrepancy" ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                </Link>
              </th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5 font-medium">{a.audit_date}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[a.status] ?? STATUS_STYLE.in_progress}`}>{a.status}</span>
                </td>
                <td className="px-4 py-2.5">{a.item_count}</td>
                <td className="px-4 py-2.5 text-red-600 font-medium">{a.shortage_count}</td>
                <td className="px-4 py-2.5 text-green-600 font-medium">{a.surplus_count}</td>
                <td className="px-4 py-2.5">{a.total_discrepancy.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">{a.note || ""}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/audits?view=${a.id}`} className="text-blue-600 hover:underline text-xs mr-3">
                    View
                  </Link>
                  {a.status !== "applied" && (
                    <ConfirmDeleteButton
                      confirmText="Delete this audit?"
                      action={async () => {
                        "use server";
                        await deleteAudit(a.id);
                      }}
                    >
                      Delete
                    </ConfirmDeleteButton>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No audits yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
