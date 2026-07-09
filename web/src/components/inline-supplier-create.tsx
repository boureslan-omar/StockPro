"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { createSupplierQuick } from "@/lib/actions/quick-create";

type Supplier = { id: number; name: string };

export default function InlineSupplierCreate({ onCreated }: { onCreated: (s: Supplier) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="New supplier"
        className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        +
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Supplier">
        <form
          action={async (fd) => {
            try {
              const s = await createSupplierQuick(fd);
              onCreated(s);
              setOpen(false);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to create supplier");
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input name="name" required autoFocus className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input name="phone" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input name="email" type="email" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
