"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { applyDayPlan, askCompanion, createStudyReminder, proposeDayPlan, saveCompanionName,
  suggestStudyNow, upcomingStudyReminders } from "./actions";
import { CompanionAvatar } from "./avatar";
import { companionCopy } from "./copy";
import { localReminderLabel, validCompanionName, type DayPlan, type Mood, type ReminderProposal } from "./model";
import styles from "./companion.module.css";

type Message = { role: "student" | "companion"; text: string; taskId?: string | null };
const keep = (items: Message[]) => items.slice(-12);

export default function CompanionPanel({ name, greeting, onClose, onNamed }: {
  name: string | null; greeting: string | null; onClose: () => void; onNamed: (name: string) => void;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const t = companionCopy[locale];
  const [displayName, setDisplayName] = useState(name);
  const [nameInput, setNameInput] = useState("");
  const [draft, setDraft] = useState("");
  const [available, setAvailable] = useState(90);
  const [planMode, setPlanMode] = useState(false);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [reminder, setReminder] = useState<ReminderProposal | null>(null);
  const [offerNotification, setOfferNotification] = useState(false);
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; remindAt: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => [{ role: "companion", text: name ? greeting ?? t.greetingEmpty : t.setup }]);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mood: Mood = pending ? "thinking" : reminder ? "reminder" : plan ? "happy" : displayName ? "neutral" : "celebrating";

  useEffect(() => { inputRef.current?.focus(); }, [displayName]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);
  useEffect(() => {
    let active = true;
    void upcomingStudyReminders().then(result => { if (active && result.ok) setUpcoming(result.value); });
    return () => { active = false; };
  }, []);

  const say = (text: string, taskId?: string | null) => setMessages(previous => keep([...previous, { role: "companion", text, ...(taskId ? { taskId } : {}) }]));
  const error = (code: string) => say(code === "busy" ? t.busy : t.tryAgain);

  async function setName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validCompanionName(nameInput)) { say(t.invalidName); return; }
    start(async () => {
      const result = await saveCompanionName(nameInput);
      if (!result.ok) { error(result.error); return; }
      setDisplayName(result.value.name);
      onNamed(result.value.name);
      say(t.named(result.value.name));
    });
  }

  function quickStudy() {
    if (pending) return;
    setPlan(null); setReminder(null); setPlanMode(false);
    start(async () => {
      const result = await suggestStudyNow(locale);
      if (!result.ok) { error(result.error); return; }
      say(result.value.message, result.value.taskId);
    });
  }

  function generateDayPlan() {
    if (pending) return;
    start(async () => {
      const result = await proposeDayPlan(locale, available);
      if (!result.ok) { error(result.error); return; }
      setPlan(result.value.plan); setPlanMode(false); setReminder(null);
      say(result.value.message);
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    const recent = messages.slice(-4).map(item => ({ role: item.role, text: item.text.slice(0, 500) }));
    setMessages(previous => keep([...previous, { role: "student", text }]));
    setDraft(""); setPlan(null); setReminder(null); setPlanMode(false);
    start(async () => {
      const result = await askCompanion(text, locale, recent);
      if (!result.ok) { error(result.error); return; }
      setReminder(result.value.proposal);
      if (result.value.proposal) {
        say(t.reminderConfirm(result.value.proposal.title, localReminderLabel(result.value.proposal, locale)));
      } else say(result.value.reply.message, result.value.reply.taskId);
    });
  }

  function apply() {
    if (!plan || pending) return;
    start(async () => {
      const result = await applyDayPlan(plan);
      if (!result.ok) { say(result.error === "conflict" ? t.planConflict : t.tryAgain); return; }
      setPlan(null); say(t.planSaved); router.refresh();
    });
  }

  function confirmReminder() {
    if (!reminder || pending) return;
    start(async () => {
      const result = await createStudyReminder(reminder);
      if (!result.ok) { error(result.error); return; }
      setUpcoming(previous => [...previous.filter(item => item.id !== result.value.id),
        { id: result.value.id, title: reminder.title, remindAt: reminder.remindAt }]
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt)).slice(0, 10));
      setReminder(null); say(t.reminderSaved);
      if (typeof Notification !== "undefined" && Notification.permission === "default") setOfferNotification(true);
    });
  }

  return <section className={styles.panel} role="region" aria-label={displayName ?? (locale === "ar" ? "رفيق المذاكرة" : "Study companion")}>
    <header className={styles.header}>
      <span className={displayName ? undefined : styles.welcome}><CompanionAvatar mood={mood} size={48} /></span>
      <strong className="min-w-0 truncate" dir="auto">{displayName ?? (locale === "ar" ? "رفيق المذاكرة" : "Study companion")}</strong>
      <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>×</button>
    </header>
    <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`${styles.message} ${message.role === "student" ? styles.student : ""} ${index === 0 && !displayName ? styles.speech : ""}`} dir="auto">
        {message.text}
        {message.taskId && <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4" href="/app/focus" onClick={onClose}>{t.startFocus}</Link>
          <Link className="underline underline-offset-4" href="/app/tasks" onClick={onClose}>{t.openTask}</Link>
        </div>}
      </div>)}
      {pending && <p className="muted text-sm" role="status">{t.loading}</p>}
      <div ref={endRef} />
    </div>
    {!displayName ? <form className={styles.inputRow} onSubmit={event => void setName(event)}>
      <label className="sr-only" htmlFor="companion-name">{t.nameLabel}</label>
      <input ref={inputRef} id="companion-name" value={nameInput} onChange={event => setNameInput(event.target.value)}
        placeholder={t.namePlaceholder} maxLength={40} disabled={pending} dir="auto" />
      <Button type="submit" disabled={pending || !validCompanionName(nameInput)}>{t.saveName}</Button>
    </form> : <>
      {planMode && <div className="flex flex-wrap items-end gap-2 px-4 py-2">
        <label className="text-sm">{t.available}<input type="number" min={25} max={240} step={5} value={available}
          onChange={event => setAvailable(Number(event.target.value))} className="field mt-1 w-28" /></label>
        <Button type="button" onClick={generateDayPlan} disabled={pending || available < 25 || available > 240}>{t.planDay}</Button>
      </div>}
      {plan && <div className="grid gap-2 border-t border-[var(--border)] px-4 py-3 text-sm">
        {plan.blocks.map(block => <p key={block.startsAt}>
          <time dateTime={block.startsAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: plan.zone }).format(new Date(block.startsAt))}</time>
          {" · "}<span dir="auto">{block.title}</span>
        </p>)}
        <div className="flex gap-2"><Button type="button" onClick={apply} disabled={pending}>{t.applyPlan}</Button>
          <Button type="button" variant="ghost" onClick={() => setPlan(null)}>{t.cancel}</Button></div>
      </div>}
      {reminder && <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
        <Button type="button" onClick={confirmReminder} disabled={pending}>{t.saveReminder}</Button>
        <Button type="button" variant="ghost" onClick={() => setReminder(null)}>{t.cancel}</Button>
      </div>}
      {offerNotification && <div className="border-t border-[var(--border)] px-4 py-3 text-sm">
        <p>{t.notificationsAsk}</p><div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" onClick={() => { setOfferNotification(false); void Notification.requestPermission(); }}>{t.notificationsEnable}</Button>
          <Button type="button" variant="ghost" onClick={() => setOfferNotification(false)}>{t.notificationsLater}</Button>
        </div>
      </div>}
      {upcoming.length > 0 && <details className="border-t border-[var(--border)] px-4 py-2 text-xs">
        <summary>{locale === "ar" ? "التذكيرات القادمة" : "Upcoming reminders"}</summary>
        <ul className="mt-2 grid gap-1">{upcoming.map(item => <li key={item.id} dir="auto">{item.title} · {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.remindAt))}</li>)}</ul>
      </details>}
      <div className={styles.quick}>
        <button type="button" onClick={quickStudy} disabled={pending}>{t.studyNow}</button>
        <button type="button" onClick={() => { setPlanMode(true); setPlan(null); setReminder(null); }} disabled={pending}>{t.planDay}</button>
        <button type="button" onClick={() => { say(t.reminderPrompt); inputRef.current?.focus(); }} disabled={pending}>{t.remind}</button>
      </div>
      <form className={styles.inputRow} onSubmit={send}>
        <label className="sr-only" htmlFor="companion-message">{t.placeholder}</label>
        <input ref={inputRef} id="companion-message" value={draft} onChange={event => setDraft(event.target.value)}
          placeholder={t.placeholder} maxLength={500} disabled={pending} dir="auto" />
        <Button type="submit" disabled={pending || !draft.trim()} aria-label={t.send}>{t.send}</Button>
      </form>
    </>}
  </section>;
}
