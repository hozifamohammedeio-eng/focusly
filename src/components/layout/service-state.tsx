"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { SiteHeader } from "./site-header";
import { useCopy } from "@/features/i18n/use-copy";
export function ServiceState() {
  const t = useCopy();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-lg px-5 py-14">
        <div className="surface p-8">
          <h1 className="text-3xl font-semibold">
            {t.unavailableTitle}
          </h1>
          <p className="muted mt-4 leading-7">
            {t.unavailableText}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()}>{t.retry}</Button>
            <ButtonLink href="/login" variant="ghost">
              {t.login}
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
