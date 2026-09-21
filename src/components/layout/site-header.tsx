"use client";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
export function SiteHeader({ authLinks = false }: { authLinks?: boolean }) {
  const { locale, setLocale } = useLocale();
  const t = useCopy();
  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight"
          aria-label="Focusly"
          dir="ltr"
        >
          focusly<span className="text-[var(--accent)]">.</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            lang={locale === "en" ? "ar" : "en"}
          >
            {locale === "en" ? "العربية" : "English"}
          </Button>
          {authLinks && (
            <>
              <ButtonLink href="/login" variant="ghost">
                {t.login}
              </ButtonLink>
              <ButtonLink href="/signup">{t.getStarted}</ButtonLink>
            </>
          )}
        </nav>
      </header>
    </>
  );
}
