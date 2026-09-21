"use client";
import { useCopy } from "@/features/i18n/use-copy";
export default function Loading() {
  const t = useCopy();
  return (
    <div role="status" className="mx-auto max-w-xl px-5 py-28">
      <span className="sr-only">{t.working}</span>
      <div aria-hidden="true" className="surface grid gap-5 p-8">
        <div className="h-7 w-2/3 rounded-lg bg-[var(--surface-subtle)]" />
        <div className="h-12 rounded-xl bg-[var(--surface-subtle)]" />
        <div className="h-12 rounded-xl bg-[var(--surface-subtle)]" />
      </div>
    </div>
  );
}
