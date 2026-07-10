import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { fmtUSD } from "@/lib/format";
import ExpenseForm from "./expense-form";
import { deleteExpense } from "./actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const from = fromParam || `${now.toISOString().slice(0, 7)}-01`;
  const to = toParam || now.toISOString().slice(0, 10);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = expenses ?? [];
  const totalExp = rows.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const e of rows) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  const categoryTotals = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const settings = await getSettings(supabase);
  const rate = Number(settings.exchange_rate || 89750);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <ExpenseForm exchangeRate={rate} />
      </div>

      <form method="GET" className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">Filter</button>
      </form>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 min-w-[140px]">
          <p className="text-xs text-zinc-500">Total Expenses</p>
          <p className="text-lg font-bold text-red-600">{fmtUSD(totalExp)}</p>
        </div>
        {categoryTotals.map(([cat, total]) => (
          <div key={cat} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3 min-w-[120px]">
            <p className="text-xs text-zinc-500">{cat}</p>
            <p className="font-semibold">{fmtUSD(total)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                <td className="px-4 py-2.5">{e.expense_date}</td>
                <td className="px-4 py-2.5">{e.description}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{e.category}</span>
                </td>
                <td className="px-4 py-2.5 font-medium text-red-600">{fmtUSD(e.amount)}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-500">{e.note || "—"}</td>
                <td className="px-4 py-2.5">
                  <form
                    action={async () => {
                      "use server";
                      await deleteExpense(e.id);
                    }}
                  >
                    <button type="submit" className="text-red-600 hover:underline text-xs">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No expenses in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
