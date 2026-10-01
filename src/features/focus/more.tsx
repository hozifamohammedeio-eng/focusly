"use client";

import { ButtonLink } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/logout-button";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase3 } from "@/features/i18n/phase3";
import { phase4 } from "@/features/i18n/phase4";
import { phase5 } from "@/features/i18n/phase5";

export function MoreNavigation() {
  const { locale } = useLocale();

  const t = {
    ...phase3[locale],
    ...phase4[locale],
    ...phase5[locale],
  };

  return (
    <main
      id="main"
      className="study-main"
    >
      <h1 className="mb-8 text-3xl font-semibold">
        {t.more}
      </h1>

      <nav className="grid max-w-xl gap-4">
        <ButtonLink
          href="/app/city"
          variant="ghost"
        >
          {locale === "ar"
            ? "المدينة"
            : "City"}
        </ButtonLink>

        <ButtonLink
          href="/app/challenges"
          variant="ghost"
        >
          {locale === "ar"
            ? "التحديات"
            : "Challenges"}
        </ButtonLink>

        <ButtonLink href="/app/achievements" variant="ghost">
          {t.achievements}
        </ButtonLink>

        {(
          [
            "calendar",
            "statistics",
            "subjects",
            "profile",
            "settings",
          ] as const
        ).map((key) => (
          <ButtonLink
            key={key}
            href={`/app/${key}`}
            variant="ghost"
          >
            {t[key]}
          </ButtonLink>
        ))}
      </nav>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}
