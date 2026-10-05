"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { companionBootstrap, companionContext, dueStudyReminders } from "./actions";
import { automaticGreeting, shouldAutoOpen } from "./greeting";
import { CompanionAvatar } from "./avatar";
import { companionCopy } from "./copy";
import type { CompanionPreference } from "./model";
import styles from "./companion.module.css";

const CompanionPanel = lazy(() => import("./panel"));
type Boot = { owner: string; preference: CompanionPreference | null };

export function CompanionHost() {
  const { locale } = useLocale();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ id: string; title: string; day: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onSelection = (event: Event) => {
      const row = (event as CustomEvent<unknown>).detail as Record<string, unknown> | null;
      if (row?.kind === "block" && typeof row.id === "string" && typeof row.title === "string" && typeof row.day === "string")
        setSelection({ id: row.id, title: row.title.slice(0, 200), day: row.day });
    };
    window.addEventListener("focusly-agent-selection", onSelection);
    return () => window.removeEventListener("focusly-agent-selection", onSelection);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await companionBootstrap();
      if (!active || !result.ok) return; // Migration may not yet be deployed; never break the app shell.
      const { owner, preference } = result.value;
      setBoot(result.value);
      let greeted = false;
      try { greeted = sessionStorage.getItem(`focusly-companion-greeted:${owner}`) === "1"; } catch { /* optional storage */ }
      if (!shouldAutoOpen(!!preference, preference?.enabled ?? true, preference?.auto_greeting_enabled ?? true, greeted)) return;
      if (!preference) { setOpen(true); return; }
      const context = await companionContext();
      if (!active || !context.ok) return;
      setGreeting(automaticGreeting(context.value, locale));
      setOpen(true);
      try { sessionStorage.setItem(`focusly-companion-greeted:${owner}`, "1"); } catch { /* optional storage */ }
    }
    void load();
    const reload = () => { void load(); };
    window.addEventListener("focusly-companion-settings", reload);
    return () => { active = false; window.removeEventListener("focusly-companion-settings", reload); };
  }, [locale]);

  useEffect(() => {
    if (!boot?.preference?.enabled) return;
    let active = true;
    const poll = async () => {
      const result = await dueStudyReminders();
      if (!active || !result.ok || !result.value.length) return;
      const messages = result.value.map(item => companionCopy[locale].reminderDue(item.title));
      setNotice(previous => [...previous, ...messages].slice(-10));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const body of messages) {
          try { new Notification("Focusly", { body }); } catch { /* In-app reminder remains available. */ }
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [boot?.owner, boot?.preference?.enabled, locale]);

  if (!boot || boot.preference?.enabled === false) return null;
  const name = boot.preference?.companion_name ?? null;
  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => trigger.current?.focus());
  };
  return <div className={styles.host}>
    {notice.length > 0 && <div role="status" className="mb-2 max-w-sm rounded-2xl border bg-[var(--surface)] p-3 text-sm shadow-lg">
      <ul className="grid gap-1">{notice.map((message, index) => <li key={index} dir="auto">{message}</li>)}</ul>
      <button type="button" className="mt-2 underline" onClick={() => setNotice([])} aria-label={locale === "ar" ? "إغلاق التذكيرات" : "Dismiss reminders"}>×</button>
    </div>}
    {open && <Suspense fallback={null}><CompanionPanel name={name} greeting={greeting} onClose={close} selection={selection}
      onNamed={next => {
        try { sessionStorage.setItem(`focusly-companion-greeted:${boot.owner}`, "1"); } catch { /* optional storage */ }
        setBoot({ ...boot, preference: { companion_name: next, enabled: true, auto_greeting_enabled: true } });
        setGreeting(null);
      }} /></Suspense>}
    {!open && <button ref={trigger} type="button" className={styles.bubble} aria-label={name ? `${companionCopy[locale].open}: ${name}` : companionCopy[locale].open}
      onClick={() => { setGreeting(null); setOpen(true); }}><CompanionAvatar mood={notice.length ? "reminder" : "neutral"} size={43} /></button>}
  </div>;
}
