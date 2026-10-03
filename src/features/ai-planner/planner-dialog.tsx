"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { generateAiPlan, saveAiPlan } from "./actions";
import { hasWorkload, type FixedEvent, type GeneratedPlan, type PlannerInput } from "./model";
import { aiPlannerCopy } from "@/features/i18n/ai-planner";
import { useLocale } from "@/features/i18n/locale-provider";
import { subjectLabel } from "@/features/i18n/phase2";
import { useCopy } from "@/features/i18n/use-copy";
import { dateAdd, formatDay, toInstant, type Subject } from "@/features/planning/logic";
import styles from "./planner.module.css";

const keys = ["subjects", "fixed", "backlog", "time", "priorities", "review"] as const;
const prefs = ["morning", "afternoon", "evening", "flexible"] as const;
const stylesList = ["balanced", "light", "productive", "catchup"] as const;
type ErrorKey = "required" | "invalid" | "conflict" | "provider" | "expired" | "unavailable";

export default function PlannerDialog({ subjects, weekStart, zone, onClose }: {
  subjects: Subject[]; weekStart: string; zone: string; onClose: () => void;
}) {
  const { locale } = useLocale();
  const t = aiPlannerCopy[locale];
  const subjectCopy = useCopy();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<PlannerInput>({ weekStart, zone, locale, workload: {}, backlog: "", exams: "",
    fixed: [], dailyMinutes: 120, preferred: "flexible", sessionMinutes: 45, daysOff: [], busyDays: [], prioritySubjects: [], style: "balanced" });
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [selectedDay, setSelectedDay] = useState(weekStart);
  const [adjustment, setAdjustment] = useState("");
  const [saved, setSaved] = useState(false);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => dateAdd(weekStart, i)), [weekStart]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  const patch = (change: Partial<PlannerInput>) => { setInput(previous => ({ ...previous, ...change })); setError(null); };
  const toggle = (field: "daysOff" | "busyDays" | "prioritySubjects", value: string) =>
    patch({ [field]: input[field].includes(value) ? input[field].filter(x => x !== value) : [...input[field], value] });
  const field = (label: string | undefined, name: string, value: string, onChange: (value: string) => void, placeholder: string | undefined = "", rows = 3) =>
    <label className={styles.field}><span>{label}</span><textarea className="field" name={name} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} maxLength={2000} /></label>;
  function next() {
    if (!form.current?.reportValidity()) return;
    if (step === 1 && input.fixed.some(f => !f.title.trim() || !f.subjectId || !f.date || !f.start || !f.end ||
      !toInstant(f.date, f.start, zone) || !toInstant(f.date, f.end, zone) || f.end <= f.start)) {
      setError("invalid"); return;
    }
    setError(null); setStep(value => Math.min(5, value + 1));
  }
  async function generate(current?: GeneratedPlan, instruction?: string) {
    if (!hasWorkload(input)) { setError("required"); return; }
    if (busy) return;
    setBusy("generate"); setError(null);
    try {
      const result = await generateAiPlan({ ...input, locale }, current, instruction);
      if (result.ok) { setPlan(result.plan); requestId.current = crypto.randomUUID(); setSelectedDay(result.plan.sessions[0]?.date ?? weekStart); setAdjustment(""); }
      else setError(result.error === "invalid" ? "invalid" : result.error);
    } catch { setError("unavailable"); }
    finally { setBusy(null); }
  }
  async function save() {
    if (!plan || busy) return;
    setBusy("save"); setError(null);
    try {
      const result = await saveAiPlan({ ...input, locale }, plan, requestId.current);
      if (result.ok) setSaved(true);
      else setError(result.error);
    } catch { setError("unavailable"); }
    finally { setBusy(null); }
  }
  const updateFixed = (id: string, change: Partial<FixedEvent>) => patch({ fixed: input.fixed.map(f => f.id === id ? { ...f, ...change } : f) });
  const dayEntries = plan ? [
    ...input.fixed.filter(x => x.date === selectedDay).map(x => ({ id: x.id, subjectId: x.subjectId, title: x.title, start: x.start, end: x.end, fixed: true, backlog: false })),
    ...plan.sessions.filter(x => x.date === selectedDay).map(x => ({ id: x.id, subjectId: x.subjectId, title: x.title, start: x.start, end: x.end, fixed: false,
      backlog: plan.items.find(item => item.id === x.workItemId)?.isBacklog ?? false })),
  ].sort((a, b) => a.start.localeCompare(b.start)) : [];
  return <dialog ref={dialog} className={styles.dialog} dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby="ai-planner-heading"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.header}><div><p className={styles.eyebrow}>FOCUSLY · {t.cta}</p><h2 id="ai-planner-heading">{saved ? t.saved : plan ? t.ready : t.title}</h2></div>
      <button type="button" className={styles.close} onClick={onClose} disabled={!!busy} aria-label={t.close}>×</button></div>
    {!plan && !saved && <div className={styles.progress}><span>{t.step} {step + 1} {t.of} {keys.length} · {t[keys[step] ?? "review"]}</span>
      <progress value={step + 1} max={keys.length} aria-label={`${t.step} ${step + 1} ${t.of} ${keys.length}`} /></div>}
    {saved ? <div className={styles.saved}><p>{t.saved}</p><Link className={styles.primary} href="/app/planner" onClick={onClose}>{t.viewPlanner}</Link>
      <button className={styles.secondary} type="button" onClick={onClose}>{t.close}</button></div> :
    <form ref={form} onSubmit={e => e.preventDefault()} className={styles.content}>
      {!plan && step === 0 && <section className={styles.stack} aria-label={t.subjects}>
        {subjects.length === 0 ? <p>{t.noSubjects}</p> : subjects.map(subject => <div className={styles.subject} key={subject.id}>
          <strong>{subjectLabel(subjectCopy, subject.name)}</strong>
          {field(t.subjectPrompt, `subject-${subject.id}`, input.workload[subject.id] ?? "", value => patch({ workload: { ...input.workload, [subject.id]: value } }), t.subjectPlaceholder)}
        </div>)}
      </section>}
      {!plan && step === 1 && <section className={styles.stack} aria-label={t.fixed}><p>{t.fixedPrompt}</p><p className={styles.hint}>{t.fixedHelp}</p>
        {input.fixed.map(f => <div className={styles.fixedCard} key={f.id}>
          <div className={styles.two}><label className={styles.field}><span>{t.subject}</span><select className="field" value={f.subjectId} required onChange={e => updateFixed(f.id, { subjectId: e.target.value })}>
            <option value="">—</option>{subjects.map(s => <option key={s.id} value={s.id}>{subjectLabel(subjectCopy, s.name)}</option>)}</select></label>
            <label className={styles.field}><span>{t.eventTitle}</span><input className="field" value={f.title} required maxLength={200} onChange={e => updateFixed(f.id, { title: e.target.value })} /></label></div>
          <div className={styles.three}><label className={styles.field}><span>{t.date}</span><select className="field" value={f.date} onChange={e => updateFixed(f.id, { date: e.target.value })}>
            {week.map(day => <option key={day} value={day}>{formatDay(day, locale, { weekday: "short", month: "short", day: "numeric" })}</option>)}</select></label>
            <label className={styles.field}><span>{t.start}</span><input className="field" type="time" required value={f.start} onChange={e => updateFixed(f.id, { start: e.target.value })} /></label>
            <label className={styles.field}><span>{t.end}</span><input className="field" type="time" required value={f.end} onChange={e => updateFixed(f.id, { end: e.target.value })} /></label></div>
          <label className={styles.field}><span>{t.notes}</span><input className="field" value={f.notes} maxLength={1000} onChange={e => updateFixed(f.id, { notes: e.target.value })} /></label>
          <button type="button" className={styles.textButton} onClick={() => patch({ fixed: input.fixed.filter(x => x.id !== f.id) })}>{t.remove}</button>
        </div>)}
        <button type="button" className={styles.secondary} onClick={() => patch({ fixed: [...input.fixed, { id: crypto.randomUUID(), subjectId: subjects[0]?.id ?? "", title: "", date: weekStart, start: "16:00", end: "17:00", notes: "" }] })} disabled={!subjects.length || input.fixed.length >= 20}>+ {t.addFixed}</button>
      </section>}
      {!plan && step === 2 && <section className={styles.stack} aria-label={t.backlog}>{field(t.backlogPrompt, "backlog", input.backlog, value => patch({ backlog: value }), t.backlogPlaceholder, 6)}</section>}
      {!plan && step === 3 && <section className={styles.stack} aria-label={t.time}>
        <fieldset><legend>{t.capacity}</legend><div className={styles.chips}>{[60, 120, 180, 240].map(n => <button className={styles.chip} type="button" aria-pressed={input.dailyMinutes === n} key={n} onClick={() => patch({ dailyMinutes: n })}>{n / 60} {t.hours}</button>)}</div>
          <label className={styles.inlineField}><span>{t.minutes}</span><input type="number" className="field" min="30" max="480" value={input.dailyMinutes} onChange={e => patch({ dailyMinutes: Number(e.target.value) })} required /></label></fieldset>
        <fieldset><legend>{t.preferred}</legend><div className={styles.chips}>{prefs.map(p => <button className={styles.chip} type="button" aria-pressed={input.preferred === p} key={p} onClick={() => patch({ preferred: p })}>{t[p]}</button>)}</div></fieldset>
        <fieldset><legend>{t.sessionLength}</legend><div className={styles.chips}>{([25, 45, 60, 90] as const).map(n => <button className={styles.chip} type="button" aria-pressed={input.sessionMinutes === n} key={n} onClick={() => patch({ sessionMinutes: n })}>{n} {t.minutes}</button>)}</div></fieldset>
        {(["daysOff", "busyDays"] as const).map(key => <fieldset key={key}><legend>{t[key]}</legend><div className={styles.chips}>{week.map(day => <button className={styles.chip} type="button" aria-pressed={input[key].includes(day)} key={day} onClick={() => toggle(key, day)}>{formatDay(day, locale, { weekday: "short" })}</button>)}</div></fieldset>)}
      </section>}
      {!plan && step === 4 && <section className={styles.stack} aria-label={t.priorities}>
        <fieldset><legend>{t.priorityPrompt}</legend><div className={styles.chips}>{subjects.map(s => <button className={styles.chip} type="button" aria-pressed={input.prioritySubjects.includes(s.id)} key={s.id} onClick={() => toggle("prioritySubjects", s.id)}>{subjectLabel(subjectCopy, s.name)}</button>)}</div></fieldset>
        {field(t.examPrompt, "exams", input.exams, value => patch({ exams: value }), t.examPlaceholder)}
        <fieldset><legend>{t.style}</legend><div className={styles.chips}>{stylesList.map(s => <button className={styles.chip} type="button" aria-pressed={input.style === s} key={s} onClick={() => patch({ style: s })}>{t[s]}</button>)}</div></fieldset>
      </section>}
      {!plan && step === 5 && <section className={styles.stack} aria-label={t.review}><h3>{t.summary}</h3>
        <div className={styles.reviewGrid}><span>{Object.values(input.workload).filter(Boolean).length} {t.subjectsCount}</span><span>{input.fixed.length} {t.fixedCount}</span>
          <span>{input.daysOff.length} {t.dayOffCount}</span><span>{input.dailyMinutes} {t.minutes} {t.perDay}</span>
          {input.backlog.trim() && <span>{t.backlogStatus}</span>}</div>
        {keys.slice(0, 5).map((key, i) => <button type="button" className={styles.reviewRow} key={key} onClick={() => setStep(i)}><span>{t[key]}</span><span>{t.edit} {locale === "ar" ? "←" : "→"}</span></button>)}
      </section>}
      {plan && <section className={styles.preview} aria-label={t.ready}>
        <p className={styles.hint}>{plan.summary}</p><p className={styles.hint}>{plan.sessions.length} {locale === "ar" ? "جلسات مذاكرة" : "study sessions"}</p>
        <div className={styles.days} role="group" aria-label={t.date}>{week.map(day => <button type="button" className={styles.chip} key={day} aria-pressed={selectedDay === day} onClick={() => setSelectedDay(day)}>{formatDay(day, locale, { weekday: "short", day: "numeric" })}</button>)}</div>
        <div className={styles.timeline}>{dayEntries.length === 0 ? <p className={styles.hint}>{t.emptyDay}</p> : dayEntries.map(entry => <article className={styles.timelineRow} key={entry.id}>
          <bdi dir="ltr" className={styles.timelineTime}>{entry.start}–{entry.end}</bdi><div><strong>{subjectLabel(subjectCopy, subjects.find(s => s.id === entry.subjectId)?.name ?? "")}</strong><p>{entry.title}</p>
            {(entry.fixed || entry.backlog) && <small>{entry.fixed ? t.fixedLabel : t.backlogLabel}</small>}</div></article>)}</div>
        <details className={styles.why}><summary>{t.why}</summary><ul>{plan.reasoning.map((reason, i) => <li key={i}>{reason}</li>)}</ul></details>
        {field(t.adjustPrompt, "adjustment", adjustment, setAdjustment, t.adjustPlaceholder, 2)}
        <div className={styles.previewActions}><button className={styles.secondary} type="button" disabled={!!busy || !adjustment.trim()} onClick={() => generate(plan, adjustment)}>{t.adjust}</button>
          <button className={styles.secondary} type="button" disabled={!!busy} onClick={() => generate()}>{t.regenerate}</button></div>
      </section>}
      {busy === "generate" && <p role="status" className={styles.loading}>{t.generating}</p>}
      {error && <p role="alert" className="form-error">{t[error]}</p>}
      <div className={styles.footer}>{!plan && <><button className={styles.secondary} type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || !!busy}>{t.back}</button>
        {step < 5 ? <button className={styles.primary} type="button" onClick={next} disabled={!!busy}>{t.next}</button> : <button className={styles.primary} type="button" onClick={() => generate()} disabled={!!busy || !subjects.length}>{t.generate}</button>}</>}
        {plan && <><button className={styles.secondary} type="button" disabled={!!busy} onClick={() => { setPlan(null); setStep(5); }}>{t.edit}</button>
          <button className={styles.primary} type="button" disabled={!!busy} onClick={save}>{busy === "save" ? t.saving : t.save}</button></>}</div>
    </form>}
  </dialog>;
}
