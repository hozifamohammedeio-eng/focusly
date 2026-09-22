"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { LogoutButton } from "@/features/auth/logout-button";
import { TimeZoneSetup } from "@/features/focus/settings";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase3 } from "@/features/i18n/phase3";
import { phase4 } from "@/features/i18n/phase4";
import { phase5 } from "@/features/i18n/phase5";
import { useTheme } from "@/features/theme/theme-provider";
import type { Database } from "@/types/database";

const navigation = [
  ["home", "/app", "⌂"],
  ["tasks", "/app/tasks", "✓"],
  ["focus", "/app/focus", "◷"],
  ["planner", "/app/planner", "▤"],
  ["calendar", "/app/calendar", "▦"],
  ["statistics", "/app/statistics", "▥"],
  ["subjects", "/app/subjects", "◇"],
  ["profile", "/app/profile", "◎"],
  ["settings", "/app/settings", "⚙"],
] as const;

export function PlanningShell({
  settings,
  children,
}: {
  settings: Database["public"]["Tables"]["user_settings"]["Row"];
  children: ReactNode;
}) {
  const { locale, setLocale } = useLocale();
  const { setTheme, setAccent } = useTheme();
  const path = usePathname();

  const t = {
    ...phase3[locale],
    ...phase4[locale],
    ...phase5[locale],
  };

  const synced = useRef("");

  useEffect(() => {
    const key = JSON.stringify(settings);

    if (synced.current === key) {
      return;
    }

    synced.current = key;

    setLocale(settings.locale);
    setTheme(settings.theme);
    setAccent(settings.accent);
  }, [settings, setLocale, setTheme, setAccent]);

  return (
    <div className="study-shell">
      <NavigationProgress />

      <a className="skip-link" href="#main">
        {t.skip}
      </a>

      <aside className="study-sidebar">
        <Link
          className="text-3xl font-bold tracking-tight"
          href="/app"
          dir="ltr"
        >
          focusly<span className="text-[var(--accent)]">.</span>
        </Link>

        <nav aria-label={t.nav} className="mt-12 grid gap-2">
          {navigation.map(([key, url, icon]) => (
            <Link
              key={key}
              href={url}
              aria-current={path === url ? "page" : undefined}
              className="study-nav-link"
            >
              <span aria-hidden="true" className="nav-icon">
                {icon}
              </span>

              {t[key]}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-10">
          <p className="muted mb-3 text-xs">
            {t.encouragement}
          </p>

          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="study-topbar">
          <Link
            href="/app"
            dir="ltr"
            className="text-xl font-bold lg:hidden"
          >
            focusly.
          </Link>

          <span className="muted hidden text-sm lg:block">
            {t.nav}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              lang={locale === "en" ? "ar" : "en"}
              onClick={() =>
                setLocale(locale === "en" ? "ar" : "en")
              }
            >
              {locale === "en" ? "العربية" : "English"}
            </Button>

            <Link
              className="profile-link"
              href="/app/profile"
              aria-label={t.profile}
            >
              ◎
            </Link>
          </div>
        </header>

        <TimeZoneSetup settings={settings} />

        {children}
      </div>

      <nav
        className="study-mobile-nav"
        aria-label={t.nav}
      >
        {[
          ...navigation.slice(0, 4),
          ["more", "/app/more", "☰"] as const,
        ].map(([key, url, icon]) => (
          <Link
            key={key}
            href={url}
            aria-current={path === url ? "page" : undefined}
          >
            <span
              aria-hidden="true"
              className="text-xl"
            >
              {icon}
            </span>

            <span>{t[key]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}