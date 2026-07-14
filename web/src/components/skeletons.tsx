function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded bg-zinc-200 dark:bg-zinc-800 ${className}`} style={style} />;
}

function Card({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// Toolbar + table shape — matches the majority of module list pages
// (Products, Purchases, Purchase Orders, Quotations, Expenses, Audits, Wastage, Returns…).
export function ListSkeleton({
  columns = 6,
  rows = 7,
  showHeader = true,
}: {
  columns?: number;
  rows?: number;
  // False when a page streams its title in separately and only this
  // component's table/toolbar portion is behind the Suspense boundary.
  showHeader?: boolean;
}) {
  return (
    <div className="animate-pulse">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <Bar className="h-7 w-40" />
          <Bar className="h-9 w-28" />
        </div>
      )}
      <Bar className="h-9 w-64 mb-4" />
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex gap-6 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          {Array.from({ length: columns }).map((_, i) => (
            <Bar key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-6 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
            {Array.from({ length: columns }).map((_, c) => (
              <Bar key={c} className="h-3.5 flex-1" style={{ opacity: 1 - r * 0.06 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat-tile grid — Dashboard.
export function CardGridSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="animate-pulse">
      <Bar className="h-7 w-48 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <Card key={i} className="p-5">
            <Bar className="h-4 w-20 mb-3" />
            <Bar className="h-6 w-14" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// List + slide-out detail split — Customers, Suppliers.
export function ListWithDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <Bar className="h-7 w-40 mb-4" />
      <Bar className="h-9 w-64 mb-4" />
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
            <Bar className="h-3.5 w-1/4" />
            <Bar className="h-3.5 w-1/6" />
            <Bar className="h-3.5 w-1/6" />
            <Bar className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Three-column working surface — POS.
export function WorkspaceSkeleton() {
  return (
    <div className="animate-pulse grid lg:grid-cols-[1fr_360px_320px] gap-4">
      <div>
        <Bar className="h-9 w-full mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="h-24 p-3">
              <Bar className="h-16 w-full" />
            </Card>
          ))}
        </div>
      </div>
      <Card className="p-3">
        <Bar className="h-5 w-16 mb-3" />
        <Bar className="h-14 w-full mb-2" />
        <Bar className="h-14 w-full" />
      </Card>
      <Card className="p-3 space-y-3">
        <Bar className="h-5 w-20" />
        <Bar className="h-9 w-full" />
        <Bar className="h-9 w-full" />
        <Bar className="h-10 w-full" />
      </Card>
    </div>
  );
}

// Stacked content sections — Reports, Settings.
export function SectionsSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      <Bar className="h-7 w-40 mb-2" />
      {Array.from({ length: sections }).map((_, i) => (
        <Card key={i} className="p-5">
          <Bar className="h-4 w-32 mb-4" />
          <Bar className="h-24 w-full" />
        </Card>
      ))}
    </div>
  );
}
