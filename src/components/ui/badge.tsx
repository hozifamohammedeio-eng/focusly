import type { HTMLAttributes } from "react";

export function Badge({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-sm font-medium text-[var(--muted)] ${className}`}
      {...props}
    />
  );
}
