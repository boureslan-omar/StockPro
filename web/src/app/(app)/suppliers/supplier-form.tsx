"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/modal";
import { saveSupplier, deleteSupplier } from "./actions";
import { fmtUSD } from "@/lib/format";

type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  product_count: number;
  purchase_count: number;
};

export default function SuppliersClient({
  suppliers,
  viewId,
  search,
}: {
  suppliers: Supplier[];
  viewId: number;
  search: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div />
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition"
        >
          + Add Supplier
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm bg-white dark:bg-zinc-900">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Products</th>
              <th className="px-4 py-3 font-medium">Purchases</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const bal = Number(s.balance);
              return (
                <tr
                  key={s.id}
                  className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 ${
                    viewId === s.id ? "bg-blue-50 dark:bg-blue-950/30" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5">{s.phone || "—"}</td>
                  <td className="px-4 py-2.5">
                    {bal > 0 ? (
                      <span className="text-red-600 font-medium">Owe {fmtUSD(bal)}</span>
                    ) : bal < 0 ? (
                      <span className="text-green-600 font-medium">Credit {fmtUSD(Math.abs(bal))}</span>
                    ) : (
                      <span className="text-zinc-500">Settled</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{s.product_count}</td>
                  <td className="px-4 py-2.5">{s.purchase_count}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/suppliers?view=${s.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete supplier?")) return;
                        try {
                          await deleteSupplier(s.id);
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
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Supplier" : "Add Supplier"}>
        <form
          key={editing?.id ?? "new"}
          action={async (fd) => {
            try {
              await saveSupplier(fd);
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
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={editing?.email ?? ""}
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
