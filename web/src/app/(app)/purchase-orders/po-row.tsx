"use client";

import { useState, useRef, useEffect } from "react";

export type Match = { id: number; name: string; unit: string | null; cost_price: number; units_per_box: number };

export type Row = {
  key: number;
  productId: number | null;
  productName: string;
  unit: string;
  unitsPerBox: number;
  quantity: string;
  estimatedPrice: string;
  note: string;
  newProductSource: "regular" | "consignment";
};

let nextKey = 1;
export function emptyRow(): Row {
  return {
    key: nextKey++,
    productId: null,
    productName: "",
    unit: "pcs",
    unitsPerBox: 1,
    quantity: "1",
    estimatedPrice: "",
    note: "",
    newProductSource: "regular",
  };
}

export function ProductNameInput({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (row.productName.trim().length < 2 || row.productId) {
      setMatches([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(row.productName.trim())}`);
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
      setOpen(true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.productName]);

  return (
    <div className="relative">
      <input
        value={row.productName}
        onChange={(e) => onChange({ productName: e.target.value, productId: null })}
        placeholder="Product name or search existing…"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange({
                  productId: m.id,
                  productName: m.name,
                  unit: m.unit || "pcs",
                  unitsPerBox: m.units_per_box || 1,
                  estimatedPrice: String(m.cost_price || ""),
                });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {m.name} <span className="text-zinc-500 text-xs">{m.unit}</span>
            </button>
          ))}
        </div>
      )}
      {row.productId && <p className="text-xs text-green-600 mt-1">Existing product selected</p>}
    </div>
  );
}
