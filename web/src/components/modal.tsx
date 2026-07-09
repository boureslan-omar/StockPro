"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WIDTH: Record<string, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: keyof typeof WIDTH;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Native listeners via ref instead of JSX onClose/onCancel: React 19's synthetic
  // handling of these non-bubbling <dialog> events cross-fired between sibling
  // portaled dialogs (closing a nested modal also closed its parent modal).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleClose);
    };
  }, []);

  if (!mounted) return null;

  // Portalled to <body> so a form inside this dialog never nests inside an
  // ancestor <form> in the DOM tree (invalid HTML, breaks submission/hydration)
  // when this Modal is used from within another form-based component.
  return createPortal(
    <dialog
      ref={ref}
      className={`m-auto max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 w-full ${WIDTH[width]} backdrop:bg-black/50`}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-3">
        <h3 className="font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>,
    document.body
  );
}
