"use client";

import { useState } from "react";

type Point = { date: string; total: number };

const WIDTH = 600;
const HEIGHT = 180;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export default function RevenueTrendChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const n = data.length;
  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = PAD_X + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const y = PAD_TOP + plotH - (d.total / max) * plotH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${PAD_TOP + plotH} L ${points[0].x.toFixed(2)} ${PAD_TOP + plotH} Z`;

  const active = hover != null ? points[hover] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        closest = i;
      }
    });
    setHover(closest);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-44"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive baseline */}
        <line x1={PAD_X} y1={PAD_TOP + plotH} x2={WIDTH - PAD_X} y2={PAD_TOP + plotH} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />

        <path d={areaPath} fill="url(#revenue-fill)" />
        <path d={linePath} stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* endpoint marker */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3.5" fill="#3b82f6" />

        {active && (
          <>
            <line x1={active.x} y1={PAD_TOP} x2={active.x} y2={PAD_TOP + plotH} stroke="#3b82f6" strokeOpacity="0.35" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
          </>
        )}

        {/* x-axis labels: first, middle, last */}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text
            key={i}
            x={points[i].x}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-zinc-400 dark:fill-zinc-500"
            fontSize="10"
          >
            {new Date(data[i].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ))}
      </svg>

      {active && (
        <div
          className="absolute top-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-md px-2.5 py-1.5 text-xs pointer-events-none"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            transform: `translateX(${active.x > WIDTH * 0.75 ? "-100%" : active.x < WIDTH * 0.25 ? "0%" : "-50%"})`,
          }}
        >
          <p className="text-zinc-500">{new Date(active.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="font-semibold">${active.total.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
