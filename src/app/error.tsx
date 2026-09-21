"use client";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/features/i18n/use-copy";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useCopy();
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="surface w-full max-w-md p-8 text-center">
        <p className="eyebrow">Focusly</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t.unavailableTitle}
        </h1>
        <p className="muted mt-3">{t.unavailableText}</p>
        <Button className="mt-6" onClick={reset}>
          {t.retry}
        </Button>
      </div>
    </main>
  );
}
