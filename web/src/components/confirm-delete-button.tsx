"use client";

export default function ConfirmDeleteButton({
  action,
  confirmText,
  children,
  className,
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={async () => {
        if (confirm(confirmText)) await action();
      }}
      className={className ?? "text-red-600 hover:underline text-xs"}
    >
      {children}
    </button>
  );
}
