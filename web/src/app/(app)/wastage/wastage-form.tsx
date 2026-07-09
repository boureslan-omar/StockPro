"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import ProductPicker, { type PickedProduct } from "@/components/product-picker";
import { saveWastage } from "./actions";

const REASONS = [
  { key: "expired", label: "Expired" },
  { key: "damaged", label: "Damaged" },
  { key: "owner_use", label: "Owner Use" },
  { key: "sample", label: "Sample" },
  { key: "lost", label: "Lost" },
  { key: "other", label: "Other" },
];

export default function WastageForm() {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [reason, setReason] = useState("");

  function reset() {
    setProduct(null);
    setReason("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 transition"
      >
        + Record Wastage
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Wastage">
        <form
          action={async (fd) => {
            if (!reason) {
              alert("Please select a reason.");
              return;
            }
            try {
              await saveWastage(fd);
              setOpen(false);
              reset();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to save");
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <ProductPicker onPick={setProduct} />
            <input type="hidden" name="product_id" value={product?.id ?? ""} />
            {product && (
              <p className="text-xs text-green-600 mt-1">
                Stock: {Number(product.stock).toFixed(2)} {product.unit} · Cost: ${Number(product.cost_price).toFixed(4)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <input
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason *</label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <label
                  key={r.key}
                  className={`text-sm px-3 py-2 rounded-lg border cursor-pointer ${
                    reason === r.key
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.key}
                    checked={reason === r.key}
                    onChange={() => setReason(r.key)}
                    className="mr-2"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <input
              name="note"
              placeholder="e.g. Found expired during shelf check"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Wastage Date</label>
            <input
              name="wastage_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
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
            <button type="submit" className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2">
              Record Wastage
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
