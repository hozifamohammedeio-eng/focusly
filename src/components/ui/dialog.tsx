"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
  title,
  closeLabel,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    label = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="focusly-dialog"
      aria-labelledby={label}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <h2 id={label} className="text-xl font-semibold">
          {title}
        </h2>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onClose}
          aria-label={closeLabel}
        >
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
