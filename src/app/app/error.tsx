"use client";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase3 } from "@/features/i18n/phase3";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = phase3[useLocale().locale];
  return (
    <main className="study-main" id="main">
      <div className="surface empty-state">
        <h1>{t.loadError}</h1>
        <Button onClick={reset}>{t.retry}</Button>
      </div>
    </main>
  );
}
