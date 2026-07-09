"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/modal";
import { saveCustomer, deleteCustomer } from "./actions";
import { fmtUSD } from "@/lib/format";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  balance: number;
};

export default function CustomersClient({
  customers,
  viewId,
  search,
}: {
  customers: Customer[];
  viewId: number;
  search: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [balanceType, setBalanceType] = useState<"none" | "debt" | "credit">("none");

  function openAdd() {
    setEditing(null);
    setBalanceType("none");
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div />
        <button
          onClick={openAdd}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition"
        >
          + Add Customer
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const bal = Number(c.balance);
              return (
                <tr
                  key={c.id}
                  className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 ${
                    viewId === c.id ? "bg-blue-50 dark:bg-blue-950/30" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5">{c.phone || "—"}</td>
                  <td className="px-4 py-2.5">
                    {bal > 0 ? (
                      <span className="text-green-600 font-medium">Credit {fmtUSD(bal)}</span>
                    ) : bal < 0 ? (
                      <span className="text-red-600 font-medium">Debt {fmtUSD(Math.abs(bal))}</span>
                    ) : (
                      <span className="text-zinc-500">Settled</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{c.note || "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/customers?view=${c.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => {
                        setEditing(c);
                        setOpen(true);
                      }}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete customer?")) return;
                        try {
                          await deleteCustomer(c.id);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : "Failed to delete");
                        }
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Customer" : "Add Customer"}>
        <form
          key={editing?.id ?? "new"}
          action={async (fd) => {
            try {
              await saveCustomer(fd);
              setOpen(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save");
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                name="phone"
                defaultValue={editing?.phone ?? ""}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Note</label>
              <input
                name="note"
                defaultValue={editing?.note ?? ""}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              name="address"
              rows={2}
              defaultValue={editing?.address ?? ""}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>

          {!editing && (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <label className="block text-sm font-semibold mb-2">
                Opening Balance <span className="text-zinc-500 font-normal">(new customers only)</span>
              </label>
              <div className="flex gap-4 text-sm mb-2">
                {(["none", "debt", "credit"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={balanceType === t}
                      onChange={() => setBalanceType(t)}
                    />
                    {t === "none" ? "None" : t === "debt" ? "Existing debt" : "Existing credit"}
                  </label>
                ))}
              </div>
              {balanceType !== "none" && (
                <input
                  name="initial_balance_raw"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount (USD)"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const hidden = e.currentTarget.form?.elements.namedItem("initial_balance") as HTMLInputElement;
                    if (hidden) hidden.value = String(balanceType === "debt" ? -val : val);
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              )}
              <input type="hidden" name="initial_balance" defaultValue="0" />
            </div>
          )}

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
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
