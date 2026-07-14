export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5"
          >
            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
            <div className="h-6 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
