import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { saveSettings, getBackupInfo } from "./actions";
import BackupButton from "./backup-button";

export default async function SettingsData() {
  const supabase = await createClient();
  const [s, backup] = await Promise.all([getSettings(supabase), getBackupInfo()]);

  return (
    <div className="stream-in">
      <form action={saveSettings} className="space-y-6">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 mb-4">STORE INFORMATION</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Store Name</label>
              <input
                name="store_name"
                defaultValue={s.store_name || "StockPro"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address (printed on receipts)</label>
              <input
                name="store_address"
                defaultValue={s.store_address || ""}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone (printed on receipts)</label>
              <input
                name="store_phone"
                defaultValue={s.store_phone || ""}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 mb-4">CURRENCY</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Currency</label>
              <select
                name="base_currency"
                defaultValue={s.base_currency || "USD"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="USD">USD (US Dollar)</option>
                <option value="LBP">LBP (Lebanese Pound)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Exchange Rate — 1 USD = ? LBP</label>
              <input
                name="exchange_rate"
                type="number"
                min="1"
                step="1"
                defaultValue={s.exchange_rate || "89750"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Current rate: 1 USD = {Number(s.exchange_rate || 89750).toLocaleString()} LBP
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 mb-4">RECEIPTS</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="auto_print_receipt" value="1" defaultChecked={s.auto_print_receipt === "1"} className="mt-1" />
            <span>
              <span className="font-medium">Auto-print receipts</span>
              <p className="text-zinc-500 text-xs">When ON, the print dialog opens automatically after each sale.</p>
            </span>
          </label>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-zinc-500 mb-4">HARDWARE</h2>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="customer_display_enabled"
                value="1"
                defaultChecked={s.customer_display_enabled === "1"}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Customer Display</span>
                <p className="text-zinc-500 text-xs">Opens a full-screen display for the customer on checkout.</p>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="cash_drawer_enabled"
                value="1"
                defaultChecked={s.cash_drawer_enabled === "1"}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Cash Drawer</span>
                <p className="text-zinc-500 text-xs">Auto-opens cash drawer after each sale (requires drawer connected to thermal printer).</p>
              </span>
            </label>
          </div>
        </section>

        <button type="submit" className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2.5">
          Save Settings
        </button>
      </form>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5 mt-6">
        <h2 className="text-sm font-semibold text-zinc-500 mb-4">DATA BACKUP</h2>
        <p className="text-sm text-zinc-500 mb-3">
          A snapshot of your data (products, sales, purchases, customers, etc.) is backed up automatically every day, and the last 14 days are
          kept. You can also trigger one manually.
        </p>
        <div className="flex items-center gap-4">
          <BackupButton />
          {backup ? (
            <a href={backup.url ?? "#"} className="text-sm text-blue-600 hover:underline">
              Download latest backup ({backup.updatedAt ? new Date(backup.updatedAt).toLocaleString() : backup.name})
            </a>
          ) : (
            <span className="text-sm text-zinc-500">No backup yet.</span>
          )}
        </div>
      </section>
    </div>
  );
}
