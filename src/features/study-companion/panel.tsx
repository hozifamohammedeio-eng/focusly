"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { agentMessage, chooseAgentCandidate, confirmAgentCalls, type AgentOutcome } from "./agent-actions";
import { applyDayPlan, proposeDayPlan, saveCompanionName,
  suggestStudyNow, upcomingStudyReminders } from "./actions";
import { CompanionAvatar } from "./avatar";
import { companionCopy } from "./copy";
import { validCompanionName, type DayPlan, type Mood } from "./model";
import type { AgentRef } from "./tools/resolve";
import type { AgentCard, AgentChoice } from "./tools/execute";
import type { AgentCall } from "./tools/registry";
import type { AgentMemory, AgentPage } from "./tools/memory";
import { companionTone } from "./tone";
import styles from "./companion.module.css";

type Message = { role: "student" | "companion"; text: string; taskId?: string | null; card?: AgentCard };
const keep = (items: Message[]) => items.slice(-12);
const pageFromPath = (path: string): AgentPage => {
  const part = path.split("/")[2];
  return (["tasks", "subjects", "planner", "calendar", "schedule", "focus", "statistics", "settings", "profile",
    "challenges", "achievements", "city"] as string[]).includes(part ?? "") ? part as AgentPage : part ? "other" : "home";
};

export default function CompanionPanel({ name, greeting, onClose, onNamed, selection }: {
  name: string | null; greeting: string | null; onClose: () => void; onNamed: (name: string) => void;
  selection: { id: string; title: string; day: string } | null;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const page = pageFromPath(usePathname());
  const t = companionCopy[locale];
  const [displayName, setDisplayName] = useState(name);
  const [nameInput, setNameInput] = useState("");
  const [draft, setDraft] = useState("");
  const [available, setAvailable] = useState(90);
  const [planMode, setPlanMode] = useState(false);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [agentPending, setAgentPending] = useState<Extract<AgentOutcome, { ok: true }>["pending"]>();
  const [memory, setMemory] = useState<AgentRef | null>(null);
  const [sessionMemory, setSessionMemory] = useState<AgentMemory>({});
  const [agentChoice, setAgentChoice] = useState<{ call: AgentCall; requestId: string; options: AgentChoice[] }>();
  const [offerNotification, setOfferNotification] = useState(false);
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; remindAt: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => [{ role: "companion", text: name ? greeting ?? t.greetingEmpty : t.setup }]);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mood: Mood = pending ? "thinking" : agentPending ? "reminder" : plan ? "happy" : displayName ? "neutral" : "celebrating";

  useEffect(() => { (displayName ? inputRef.current : nameRef.current)?.focus(); }, [displayName]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
  useEffect(() => {
    if (!selection) return;
    const timer = window.setTimeout(() => {
      const ref: AgentRef = { kind: "block", id: selection.id, title: selection.title };
      setMemory(ref);
      setSessionMemory(previous => ({ ...previous, refs: { ...previous.refs, block: ref }, lastDay: selection.day }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selection]);
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

  const say = (text: string, taskId?: string | null, card?: AgentCard) =>
    setMessages(previous => keep([...previous, { role: "companion", text, ...(taskId ? { taskId } : {}), ...(card ? { card } : {}) }]));
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
    setPlan(null); setAgentPending(undefined); setPlanMode(false);
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
      setPlan(result.value.plan); setPlanMode(false); setAgentPending(undefined);
      say(result.value.message);
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending || inFlight.current) return;
    inFlight.current = true;
    const recent = messages.slice(-4).map(item => ({ role: item.role, text: item.text.slice(0, 500) }));
    setMessages(previous => keep([...previous, { role: "student", text }]));
    setDraft(""); setPlan(null); setAgentPending(undefined); setAgentChoice(undefined); setPlanMode(false);
    start(async () => {
      try { showAgentResult(await agentMessage(text, locale, recent, memory, crypto.randomUUID(), { page, memory: sessionMemory })); }
      catch { say(t.tryAgain); }
      finally { inFlight.current = false; }
    });
  }

  function showAgentResult(result: AgentOutcome) {
    say(result.text, null, result.ok ? result.card : undefined);
    if (result.memory) setSessionMemory(result.memory);
    if (!result.ok) return;
    if (result.ref) setMemory(result.ref);
    if (result.pending) setAgentPending(result.pending);
    if (result.choice) setAgentChoice(result.choice);
    if (result.companionSettingChanged) window.dispatchEvent(new Event("focusly-companion-settings"));
    if (result.companionName) { setDisplayName(result.companionName); onNamed(result.companionName); }
    if (result.reminderCreated && typeof Notification !== "undefined" && Notification.permission === "default") setOfferNotification(true);
    if (result.reminderCreated) void upcomingStudyReminders().then(next => { if (next.ok) setUpcoming(next.value); });
    if (result.changed) router.refresh();
  }

  function confirmAgent() {
    if (!agentPending || pending || inFlight.current) return;
    inFlight.current = true;
    const proposal = agentPending;
    setAgentPending(undefined);
    start(async () => {
      try { showAgentResult(await confirmAgentCalls(proposal.calls, locale, memory, proposal.requestId, { page, memory: sessionMemory })); }
      catch { setAgentPending(proposal); say(t.tryAgain); }
      finally { inFlight.current = false; }
    });
  }

  function chooseAgent(ref: AgentRef) {
    if (!agentChoice || pending || inFlight.current) return;
    inFlight.current = true;
    const choice = agentChoice;
    setAgentChoice(undefined);
    start(async () => {
      try { showAgentResult(await chooseAgentCandidate(choice.call, ref, locale, choice.requestId, { page, memory: sessionMemory })); }
      catch { setAgentChoice(choice); say(t.tryAgain); }
      finally { inFlight.current = false; }
    });
  }

  function quickMessage(text: string) {
    setDraft(text);
    inputRef.current?.focus();
  }

  function apply() {
    if (!plan || pending) return;
    start(async () => {
      const result = await applyDayPlan(plan);
      if (!result.ok) { say(result.error === "conflict" ? t.planConflict : t.tryAgain); return; }
      setPlan(null); say(t.planSaved); router.refresh();
    });
  }

  return <section className={styles.panel} role="region" aria-label={displayName ?? (locale === "ar" ? "رفيق المذاكرة" : "Study companion")}>
    <header className={styles.header}>
      <span className={styles.avatarWrap}><CompanionAvatar mood={mood} size={42} /></span>
      <div className={styles.headerText}><strong dir="auto">{displayName ?? (locale === "ar" ? "رفيق المذاكرة" : "Study companion")}</strong>
        <span>{pending ? companionTone.working(locale) : locale === "ar" ? "معاك في يومك الدراسي" : "Here for your study day"}</span></div>
      <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>×</button>
    </header>
    <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`${styles.message} ${message.role === "student" ? styles.student : ""} ${index === 0 && !displayName ? styles.speech : ""}`} dir="auto">
        {message.text}
        {message.card && <div className={styles.actionCard} aria-label={message.card.title}>
          <span aria-hidden="true">{message.card.kind === "task" ? "✅" : message.card.kind === "reminder" ? "🔔" : "📚"}</span>
          <span><strong dir="auto">{message.card.title}</strong><small dir="auto">{message.card.detail}</small></span>
        </div>}
        {message.taskId && <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4" href="/app/focus" onClick={onClose}>{t.startFocus}</Link>
          <Link className="underline underline-offset-4" href="/app/tasks" onClick={onClose}>{t.openTask}</Link>
        </div>}
      </div>)}
      {pending && <p className={styles.working} role="status"><span className={styles.workingDot} />{companionTone.working(locale)}</p>}
      <div ref={endRef} />
    </div>
    {!displayName ? <form className={styles.inputRow} onSubmit={event => void setName(event)}>
      <label className="sr-only" htmlFor="companion-name">{t.nameLabel}</label>
      <input ref={nameRef} id="companion-name" value={nameInput} onChange={event => setNameInput(event.target.value)}
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
      {agentPending && <div className={styles.choiceCard} role="group" aria-label={t.confirm}>
        <strong dir="auto">{agentPending.calls[0]?.args.title ?? agentPending.calls[0]?.args.query ??
          (locale === "ar" ? "مراجعة التغيير" : "Review this change")}</strong>
        <div><Button type="button" onClick={confirmAgent} disabled={pending}>{t.confirm}</Button>
          <Button type="button" variant="ghost" onClick={() => setAgentPending(undefined)}>{t.cancel}</Button></div>
      </div>}
      {agentChoice && <div className={styles.choiceCard} role="group" aria-label={companionTone.clarify(locale)}>
        <strong>{companionTone.clarify(locale)}</strong>
        <div>{agentChoice.options.map(option => <button key={option.ref.id} type="button" disabled={pending}
          onClick={() => chooseAgent(option.ref)} dir="auto">{option.label}</button>)}</div>
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
        <button type="button" onClick={() => { setPlanMode(true); setPlan(null); setAgentPending(undefined); }} disabled={pending}>{t.planDay}</button>
        <button type="button" onClick={() => quickMessage(page === "tasks" ? locale === "ar" ? "مهامي النهاردة" : "My tasks today"
          : locale === "ar" ? "إيه اللي عندي بكرة؟" : "What do I have tomorrow?")} disabled={pending}>
          {page === "tasks" ? locale === "ar" ? "مهام النهاردة" : "Today's tasks" : locale === "ar" ? "بكرة" : "Tomorrow"}</button>
        <button type="button" onClick={() => { say(t.reminderPrompt); inputRef.current?.focus(); }} disabled={pending}>{t.remind}</button>
      </div>
      <form className={styles.inputRow} onSubmit={send}>
        <label className="sr-only" htmlFor="companion-message">{t.placeholder}</label>
        <textarea ref={inputRef} id="companion-message" value={draft} onChange={event => {
          setDraft(event.target.value);
          event.target.style.height = "auto";
          event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
        }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.currentTarget.form?.requestSubmit();
        } }} placeholder={locale === "ar" ? "قولّي عايز تعمل إيه…" : "Ask me anything about your study day…"}
          maxLength={500} rows={1} disabled={pending} dir="auto" />
        <Button type="submit" disabled={pending || !draft.trim()} aria-label={t.send}>{t.send}</Button>
      </form>
    </>}
  </section>;
}
