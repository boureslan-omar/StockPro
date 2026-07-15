"use client";

import { useEffect, useRef, useState } from "react";

export type PickedProduct = {
  id: number;
  barcode: string | null;
  name: string;
  unit: string | null;
  stock: number;
  cost_price: number;
  sell_price: number;
  units_per_box: number;
  product_type: string;
  product_source: string;
  track_expiry: boolean;
};

export default function ProductPicker({
  onPick,
  placeholder = "Type product name or barcode…",
}: {
  onPick: (p: PickedProduct) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p);
                setQuery(p.name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex justify-between"
            >
              <span>
                <span className="font-medium">{p.name}</span>
                <span className="text-zinc-500 ml-2">{p.unit || ""}</span>
              </span>
              <span className="text-green-600">{Number(p.stock).toFixed(2)} in stock</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
