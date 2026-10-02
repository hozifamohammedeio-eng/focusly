"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationProgress } from "@/components/layout/navigation-progress";
import { LogoutButton } from "@/features/auth/logout-button";
import { TimeZoneSetup } from "@/features/focus/settings";
import { AuthLocaleToggle } from "@/features/i18n/auth-locale-toggle";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase3 } from "@/features/i18n/phase3";
import { phase4 } from "@/features/i18n/phase4";
import { phase5 } from "@/features/i18n/phase5";
import { QuickThemeSwitcher } from "@/features/theme/quick-theme-switcher";
import { useTheme } from "@/features/theme/theme-provider";
import type { Database } from "@/types/database";
import { groupForRoute, navigationGroups, routeIsActive, type GroupKey, type PageKey } from "./navigation-model";

import styles from "./liquid-navigation.module.css";

function Icon({ name }: { name: PageKey | GroupKey | "menu" | "close" }) {
  const paths: Record<PageKey | GroupKey | "menu" | "close", ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-6h6v6" /></>,
    study: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15" /></>,
    focus: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    progress: <><path d="M4 20V12m6 8V7m6 13v-5m4 5H2" /></>,
    subjects: <><path d="M4 4h16v16H4zM8 8h8M8 12h8" /></>,
    tasks: <><path d="M5 4h14v16H5zM8 9l2 2 4-4M8 16h8" /></>,
    planner: <><path d="M4 5h16v16H4zM8 3v4m8-4v4M4 10h16M8 14h8" /></>,
    calendar: <><path d="M4 5h16v16H4zM8 3v4m8-4v4M4 10h16M8 14h.01M12 14h.01M16 14h.01" /></>,
    schedule: <><path d="M4 5h16v16H4zM8 3v4m8-4v4M4 10h16M8 14h3m3 0h2M8 18h8" /></>,
    statistics: <><path d="M4 20V12m6 8V5m6 15v-8m4 8H2" /></>,
    challenges: <><path d="M12 3 9 10l-6 2 6 2 3 7 3-7 6-2-6-2-3-7Z" /></>,
    achievements: <><circle cx="12" cy="9" r="6" /><path d="m8 14-2 8 6-3 6 3-2-8" /></>,
    city: <><path d="M3 21V9h5V4h8v9h5v8H3ZM11 8h2m-2 4h2m-2 4h2" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    settings: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PlanningShell({ settings, children }: {
  settings: Database["public"]["Tables"]["user_settings"]["Row"];
  children: ReactNode;
}) {
  const { locale, setLocale } = useLocale();
  const { setTheme, setAccent } = useTheme();
  const path = usePathname();
  const [selection, setSelection] = useState<{ path: string; group: GroupKey | null } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const synced = useRef("");
  const t = { ...phase3[locale], ...phase4[locale], ...phase5[locale] };
  const openGroup = selection?.path === path ? selection.group : groupForRoute(path);

  useEffect(() => {
    const key = JSON.stringify(settings);
    if (synced.current === key) return;
    synced.current = key;
    setLocale(settings.locale);
    setTheme(settings.theme);
    setAccent(settings.accent);
  }, [settings, setLocale, setTheme, setAccent]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (drawerOpen && !drawer.open) drawer.showModal();
    if (!drawerOpen && drawer.open) drawer.close();
  }, [drawerOpen]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  function label(key: PageKey | GroupKey) {
    if (key === "study") return locale === "ar" ? "المذاكرة" : "Study";
    if (key === "progress") return locale === "ar" ? "التقدم" : "Progress";
    if (key === "schedule") return locale === "ar" ? "جدول الدروس" : "Schedule";
    if (key === "city") return locale === "ar" ? "المدينة" : "City";
    if (key === "challenges") return locale === "ar" ? "التحديات" : "Challenges";
    if (key === "settings") return phase5[locale].settings;
    if (key === "home") return locale === "ar" ? "الرئيسية" : "Home";
    return t[key];
  }

  function navigation(mobile: boolean) {
    return <nav aria-label={t.nav} className={styles.navigation}>
      <Link href="/app" aria-current={routeIsActive(path, "/app") ? "page" : undefined}
        className={`${styles.groupLink} ${routeIsActive(path, "/app") ? styles.active : ""}`}
        onClick={() => mobile && setDrawerOpen(false)}>
        <Icon name="home" /><span>{label("home")}</span>
      </Link>
      {navigationGroups.map((group) => {
        const expanded = openGroup === group.key;
        const containsActive = group.pages.some((page) => routeIsActive(path, page.url));
        const panelId = `${mobile ? "mobile" : "desktop"}-${group.key}-links`;
        return <div className={styles.group} key={group.key}>
          <button type="button" className={`${styles.groupButton} ${containsActive ? styles.groupCurrent : ""}`}
            aria-expanded={expanded} aria-controls={panelId}
            onClick={() => setSelection({ path, group: expanded ? null : group.key })}>
            <Icon name={group.key} /><span>{label(group.key)}</span><span className={styles.chevron} aria-hidden="true" />
          </button>
          <div id={panelId} className={styles.submenu} data-open={expanded} inert={!expanded}>
            <div className={styles.submenuInner}>
              {group.pages.map((page) => {
                const active = routeIsActive(path, page.url);
                return <Link key={page.key} href={page.url} aria-current={active ? "page" : undefined}
                  className={`${styles.subLink} ${active ? styles.active : ""}`}
                  onClick={() => mobile && setDrawerOpen(false)}>
                  <Icon name={page.key} /><span>{label(page.key)}</span>
                </Link>;
              })}
            </div>
          </div>
        </div>;
      })}
    </nav>;
  }

  function account(mobile: boolean) {
    return <div className={styles.account}>
      <p className={styles.accountLabel}>{t.account}</p>
      <Link href="/app/profile" aria-current={routeIsActive(path, "/app/profile") ? "page" : undefined}
        className={`${styles.accountLink} ${routeIsActive(path, "/app/profile") ? styles.active : ""}`}
        onClick={() => mobile && setDrawerOpen(false)}><Icon name="profile" />{label("profile")}</Link>
      <Link href="/app/settings" aria-current={routeIsActive(path, "/app/settings") ? "page" : undefined}
        className={`${styles.accountLink} ${routeIsActive(path, "/app/settings") ? styles.active : ""}`}
        onClick={() => mobile && setDrawerOpen(false)}><Icon name="settings" />{label("settings")}</Link>
      <LogoutButton />
    </div>;
  }

  return <div className="study-shell">
    <NavigationProgress />
    <a className="skip-link" href="#main">{t.skip}</a>
    <aside className={`study-sidebar ${styles.desktopSidebar}`}>
      <Link className={styles.logo} href="/app" dir="ltr" aria-label="Focusly">focusly<span>.</span></Link>
      {navigation(false)}
      {account(false)}
    </aside>
    <div className={styles.content}>
      <header className={`study-topbar ${styles.topbar}`}>
        <button type="button" className={styles.menuButton} aria-label={locale === "ar" ? "افتح القائمة" : "Open menu"}
          aria-haspopup="dialog" onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
        <Link href="/app" dir="ltr" className={styles.mobileLogo}>focusly<span>.</span></Link>
        <div className={styles.topbarActions}><QuickThemeSwitcher /><AuthLocaleToggle /></div>
      </header>
      <TimeZoneSetup settings={settings} />
      {children}
    </div>
    <dialog ref={drawerRef} className={styles.drawer} aria-label={t.nav} onClose={() => setDrawerOpen(false)}>
      <div className={styles.drawerHeader}>
        <Link href="/app" dir="ltr" className={styles.logo} onClick={() => setDrawerOpen(false)}>focusly<span>.</span></Link>
        <button type="button" className={styles.closeButton} aria-label={locale === "ar" ? "أغلق القائمة" : "Close menu"}
          onClick={() => setDrawerOpen(false)}><Icon name="close" /></button>
      </div>
      {navigation(true)}
      {account(true)}
    </dialog>
  </div>;
}
