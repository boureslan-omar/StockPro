"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { saveExpense } from "./actions";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Supplies", "Maintenance", "Transport", "Marketing", "General"];

export default function ExpenseForm({ exchangeRate }: { exchangeRate: number }) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "LBP">("USD");
  const [amount, setAmount] = useState("");
  const [cashDeduct, setCashDeduct] = useState(true);

  const equiv = currency === "LBP" && amount ? (parseFloat(amount) / exchangeRate).toFixed(2) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 transition"
      >
        + Add Expense
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Expense">
        <form
          action={async (fd) => {
            try {
              await saveExpense(fd);
              setOpen(false);
              setAmount("");
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save");
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <input
              name="description"
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Amount ({currency}) *</label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              {equiv && <p className="text-xs text-zinc-500 mt-1">≈ ${equiv} USD</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                name="category"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              name="expense_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <textarea
              name="note"
              rows={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                name="cash_deduct"
                value="1"
                checked={cashDeduct}
                onChange={(e) => setCashDeduct(e.target.checked)}
              />
              Deduct from cash register
            </label>
            <div className="flex gap-4 text-sm ml-6">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="cash_currency"
                  value="USD"
                  checked={currency === "USD"}
                  onChange={() => setCurrency("USD")}
                />
                USD drawer
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="cash_currency"
                  value="LBP"
                  checked={currency === "LBP"}
                  onChange={() => setCurrency("LBP")}
                />
                LBP drawer
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
