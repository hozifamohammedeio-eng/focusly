"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationProgress } from "@/components/layout/navigation-progress";
import { LogoutButton } from "@/features/auth/logout-button";
import { TimeZoneSetup } from "@/features/focus/settings";
import { useLocale } from "@/features/i18n/locale-provider";
import { AuthLocaleToggle } from "@/features/i18n/auth-locale-toggle";
import { QuickThemeSwitcher } from "@/features/theme/quick-theme-switcher";
import { phase3 } from "@/features/i18n/phase3";
import { phase4 } from "@/features/i18n/phase4";
import { phase5 } from "@/features/i18n/phase5";
import { useTheme } from "@/features/theme/theme-provider";
import type { Database } from "@/types/database";

import styles from "./liquid-navigation.module.css";

type NavigationKey =
  | "home"
  | "tasks"
  | "focus"
  | "schedule"
  | "planner"
  | "calendar"
  | "city"
  | "statistics"
  | "subjects"
  | "profile"
  | "settings"
  | "more";

const navigation = [
  {
    key: "home",
    url: "/app",
  },
  { key: "city", url: "/app/city" },
  {
    key: "tasks",
    url: "/app/tasks",
  },
  {
    key: "focus",
    url: "/app/focus",
  },
  {
    key: "schedule",
    url: "/app/schedule",
  },
  {
    key: "planner",
    url: "/app/planner",
  },
  {
    key: "calendar",
    url: "/app/calendar",
  },
  {
    key: "statistics",
    url: "/app/statistics",
  },
  {
    key: "subjects",
    url: "/app/subjects",
  },
  {
    key: "profile",
    url: "/app/profile",
  },
  {
    key: "settings",
    url: "/app/settings",
  },
] as const;

const mobileNavigation = [
  {
    key: "home",
    url: "/app",
  },
  {
    key: "tasks",
    url: "/app/tasks",
  },
  {
    key: "focus",
    url: "/app/focus",
  },
  {
    key: "schedule",
    url: "/app/schedule",
  },
  {
    key: "more",
    url: "/app/more",
  },
] as const;

function NavigationIcon({
  name,
}: {
  name: NavigationKey;
}) {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M3.5 10.5 12 3l8.5 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );

    case "tasks":
      return (
        <svg {...commonProps}>
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="m8 9 1.5 1.5L12 8" />
          <path d="M14 9h3" />
          <path d="m8 15 1.5 1.5L12 14" />
          <path d="M14 15h3" />
        </svg>
      );

    case "focus":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
        </svg>
      );

    case "schedule":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
          <path d="M8 14h2" />
          <path d="M14 14h2" />
          <path d="M8 18h2" />
        </svg>
      );

    case "planner":
      return (
        <svg {...commonProps}>
          <path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M7 11h10" />
          <path d="M7 15h7" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M7 3v4" />
          <path d="M17 3v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );

    case "statistics":
      return (
        <svg {...commonProps}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );

    case "city":
      return <svg {...commonProps}><path d="M3 21V10h5V4h8v9h5v8H3ZM11 8h2m-2 4h2m-2 4h2M6 14v3m12 0v2" /></svg>;
    case "subjects":
      return (
        <svg {...commonProps}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z" />
        </svg>
      );

    case "profile":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      );

    case "settings":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.5a1.7 1.7 0 0 0 1.7-1.6 1.7 1.7 0 0 0-.34-1.88L3.8 6.06 6.66 3.2l.06.06A1.7 1.7 0 0 0 8.6 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.5a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 20 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.3v4h-.5a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-1 1.2Z" />
        </svg>
      );

    case "more":
      return (
        <svg {...commonProps}>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function GlassLayers() {
  return (
    <>
      <span className={styles.glassEffect} />
      <span className={styles.glassTint} />
      <span className={styles.glassShine} />
    </>
  );
}

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

  function navigationLabel(key: NavigationKey) {
    if (key === "city") return locale === "ar" ? "المدينة" : "City";
    if (key === "schedule") {
      return locale === "ar" ? "جدول الدروس" : "Schedule";
    }

    if (key === "more") {
      return locale === "ar" ? "المزيد" : "More";
    }

    return t[key];
  }

  function isActive(url: string) {
    if (url === "/app") {
      return path === "/app";
    }

    return path === url || path.startsWith(`${url}/`);
  }


  const activeDesktopIndex = navigation.findIndex(
    ({ url }) => isActive(url),
  );

  const desktopSliderStyle = {
    "--active-index": String(
      Math.max(activeDesktopIndex, 0),
    ),
  } as CSSProperties;

  return (
    <div className="study-shell">
      <NavigationProgress />

      <a className="skip-link" href="#main">
        {t.skip}
      </a>

      <aside className={`study-sidebar ${styles.desktopSidebar}`}>
        <div className={styles.glassPanel}>
          <GlassLayers />

          <div className={styles.sidebarContent}>
            <Link
              className={styles.logo}
              href="/app"
              dir="ltr"
              aria-label="Focusly"
            >
              focusly
              <span>.</span>
            </Link>

            <nav
              aria-label={t.nav}
              className={styles.desktopNavigation}
            >
              <span
                className={styles.navSlider}
                style={desktopSliderStyle}
                data-visible={
                  activeDesktopIndex >= 0
                    ? "true"
                    : "false"
                }
                aria-hidden="true"
              />

              {navigation.map(({ key, url }) => {
                const active = isActive(url);

                return (
                  <Link
                    key={key}
                    href={url}
                    aria-current={active ? "page" : undefined}
                    className={`${styles.navLink} ${
                      active ? styles.navLinkActive : ""
                    }`}
                  >
                    <span className={styles.navIcon}>
                      <NavigationIcon name={key} />
                    </span>

                    <span className={styles.navLabel}>
                      {navigationLabel(key)}
                    </span>

                    <span
                      className={styles.activeIndicator}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </nav>

            <div className={styles.sidebarFooter}>
              <p className={styles.encouragement}>
                {t.encouragement}
              </p>

              <LogoutButton />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className={`study-topbar ${styles.topbar}`}>
          <Link
            href="/app"
            dir="ltr"
            className={styles.mobileLogo}
          >
            focusly
            <span>.</span>
          </Link>

          <span className="muted hidden text-sm lg:block">
            {t.nav}
          </span>

          <div className={styles.topbarActions}>
            <QuickThemeSwitcher />
            <AuthLocaleToggle />

            <Link
              className={styles.profileButton}
              href="/app/profile"
              aria-label={t.profile}
            >
              <NavigationIcon name="profile" />
            </Link>
          </div>
        </header>

        <TimeZoneSetup settings={settings} />

        {children}
      </div>

      <nav
        className={`study-mobile-nav ${styles.mobileDock}`}
        aria-label={t.nav}
      >
        <GlassLayers />

        <div className={styles.mobileDockContent}>
          {mobileNavigation.map(({ key, url }) => {
            const active = isActive(url);

            return (
              <Link
                key={key}
                href={url}
                aria-current={active ? "page" : undefined}
                className={`${styles.mobileNavLink} ${
                  active ? styles.mobileNavLinkActive : ""
                }`}
              >
                <span className={styles.mobileIcon}>
                  <NavigationIcon name={key} />
                </span>

                <span className={styles.mobileLabel}>
                  {navigationLabel(key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}