"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { phase4 } from "@/features/i18n/phase4";
import { phase3 } from "@/features/i18n/phase3";
import type { Database } from "@/types/database";
import type { Subject, Task } from "@/features/planning/logic";
import { focusAction } from "./actions";
import {
  elapsedSeconds,
  remainingSeconds,
  timerDigits,
  formatDuration,
  type FocusSession,
  type Progress,
} from "./logic";
import { GoalCard } from "./progress-ui";
type BreakState = {
  kind: "short" | "long";
  state: "running" | "paused";
  remaining: number;
  anchor: number;
};
export function FocusTimer({
  userId,
  settings,
  subjects,
  tasks,
  progress,
  goal,
}: {
  userId: string;
  settings: Database["public"]["Tables"]["user_settings"]["Row"];
  subjects: Subject[];
  tasks: Task[];
  progress: Progress;
  goal: number;
}) {
  const { locale } = useLocale(),
    t = phase4[locale],
    p2 = useCopy(),
    router = useRouter();
  const [session, setSession] = useState<FocusSession | null>(null),
    [loaded, setLoaded] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false),
    [now, setNow] = useState(0),
    [confirm, setConfirm] = useState(false),
    [minutes, setMinutes] = useState(settings.focus_minutes),
    [subject, setSubject] = useState(""),
    [task, setTask] = useState(""),
    [rest, setRest] = useState<BreakState | null>(null);
  const current = useRef<FocusSession | null>(null),
    busy = useRef(false),
    offset = useRef(0),
    attempted = useRef(""),
    startId = useRef(""),
    channel = useRef<BroadcastChannel | null>(null);
  const sync = useCallback(
    async (action: string, values: Record<string, string> = {}) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(false);
      const f = new FormData();
      f.set("action", action);
      if (current.current) {
        f.set("id", current.current.id);
        f.set("revision", current.current.updated_at);
      }
      Object.entries(values).forEach(([k, v]) => f.set(k, v));
      try {
        const result = await focusAction(f);
        if ("error" in result) {
          setError(true);
          return;
        }
        const newlyCompleted =
          result.session?.completed && !current.current?.completed;
        offset.current = Date.parse(result.serverNow) - Date.now();
        setNow(Date.now() + offset.current);
        current.current = result.session;
        setSession(result.session);
        setLoaded(true);
        if (action !== "recover") channel.current?.postMessage("changed");
        if (newlyCompleted) {
          channel.current?.postMessage("completed");
          router.refresh();
        }
      } catch {
        setError(true);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [router],
  );
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset.current);
    const id = setInterval(tick, 1000);
    const recover = () => {
      if (document.visibilityState === "visible") void sync("recover");
    };
    const initial = setTimeout(() => void sync("recover"), 0);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("focusly:timer:" + userId);
      channel.current.onmessage = () => {
        void sync("recover");
      };
    }
    return () => {
      clearTimeout(initial);
      clearInterval(id);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      channel.current?.close();
    };
  }, [sync, userId]);
  const active =
    session?.timer_state === "running" || session?.timer_state === "paused";
  const left = session ? remainingSeconds(session, now) : minutes * 60;
  useEffect(() => {
    if (
      session?.timer_state === "running" &&
      left === 0 &&
      loaded &&
      !pending &&
      !error &&
      attempted.current !== session.id
    ) {
      const finish = setTimeout(() => {attempted.current = session.id;void sync("finish");}, 0);
      return () => clearTimeout(finish);
    }
  }, [session, left, loaded, pending, error, sync]);
  const name = (id: string | null) =>
    subjectLabel(p2, subjects.find((s) => s.id === id)?.name ?? t.general);
  const breakLeft = rest
    ? Math.max(
        0,
        rest.remaining -
          (rest.state === "running"
            ? Math.floor((now - rest.anchor) / 1000)
            : 0),
      )
    : 0;
  const reset = () => {
    current.current = null;
    setSession(null);
    setRest(null);
    startId.current = "";
    attempted.current = "";
  };
  function startBreak(kind: "short" | "long") {
    setRest({
      kind,
      state: "running",
      remaining:
        (kind === "short"
          ? settings.short_break_minutes
          : settings.long_break_minutes) * 60,
      anchor: now,
    });
  }
  return (
    <main id="main" className="study-main focus-page">
      <header className="text-center">
        <p className="eyebrow">{t.focus}</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          {t.focusTitle}
        </h1>
        <p className="muted mt-3">{t.focusSubtitle}</p>
      </header>
      {error && (
        <div className="surface mt-6 p-5" role="alert">
          <p>{t.error}</p>
          <Button
            className="mt-3"
            onClick={() => {
              attempted.current = "";
              void sync("recover");
            }}
          >
            {t.retry}
          </Button>
        </div>
      )}
      {!loaded ? (
        <p className="muted py-16 text-center" role="status">
          {t.recovering}
        </p>
      ) : rest ? (
        <section className="timer-stage">
          <p className="eyebrow">{t[rest.kind]}</p>
          <div
            dir="ltr"
            className="timer-digits"
            role="timer"
            aria-label={t[rest.kind]}
          >
            {timerDigits(breakLeft)}
          </div>
          <p role="status">
            {breakLeft === 0
              ? t.breakDone
              : rest.state === "paused"
                ? t.paused
                : t.breakHint}
          </p>
          <div className="timer-controls">
            {breakLeft > 0 && (
              <Button
                onClick={() =>
                  setRest({
                    ...rest,
                    state: rest.state === "running" ? "paused" : "running",
                    remaining: breakLeft,
                    anchor: now,
                  })
                }
              >
                {rest.state === "running" ? t.pause : t.resume}
              </Button>
            )}
            <Button variant="ghost" onClick={reset}>
              {breakLeft > 0 ? t.skip : t.another}
            </Button>
          </div>
        </section>
      ) : active && session ? (
        <section className="timer-stage">
          <p className="eyebrow" role="status">
            {session.timer_state === "paused" ? t.paused : t.running}
          </p>
          <div
            dir="ltr"
            className="timer-digits"
            role="timer"
            aria-label={t.focus}
          >
            {timerDigits(left)}
          </div>
          <p className="text-xl font-semibold">{name(session.subject_id)}</p>
          {session.task_id && (
            <p className="muted mt-2">
              {tasks.find((x) => x.id === session.task_id)?.title ?? ""}
            </p>
          )}
          <progress
            className="focus-progress mt-7"
            aria-label={t.focus}
            max={session.planned_seconds ?? 1}
            value={elapsedSeconds(session, now)}
          />
          <div className="timer-controls">
            <Button
              disabled={pending}
              onClick={() =>
                void sync(session.timer_state === "paused" ? "resume" : "pause")
              }
            >
              {pending
                ? t.saving
                : session.timer_state === "paused"
                  ? t.resume
                  : t.pause}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirm(true)}
            >
              {t.end}
            </Button>
          </div>
          <p className="muted mt-8 text-sm">{t.noSound}</p>
        </section>
      ) : session ? (
        <section className={`focus-result mx-auto mt-12 grid max-w-xl gap-6 text-center ${session.completed ? "is-complete" : ""}`}>
          <h2 className="text-3xl font-semibold" role="status">
            {session.completed ? t.complete : t.discarded}
          </h2>
          <p className="text-2xl">
            {session.completed
              ? formatDuration(session.duration_seconds, locale)
              : t.discardHint}
          </p>
          <p className="muted">{name(session.subject_id)}</p>
          {session.completed && (
            <>
              <p>{t.synced}</p>
              <GoalCard progress={progress} goal={goal} />
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => startBreak("short")}>{t.break}</Button>
                <Button variant="ghost" onClick={() => startBreak("long")}>
                  {t.long}
                </Button>
              </div>
            </>
          )}
          <Button variant="ghost" onClick={reset}>
            {t.another}
          </Button>
          <ButtonLink href="/app" variant="ghost">
            {t.dashboard}
          </ButtonLink>
        </section>
      ) : (
        <form
          className="focus-setup mx-auto mt-10 grid max-w-xl gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!startId.current) startId.current = crypto.randomUUID();
            void sync("start", {
              id: startId.current,
              minutes: String(minutes),
              subject,
              task,
            });
          }}
        >
          <fieldset>
            <legend className="mb-3 font-semibold">{t.duration}</legend>
            <div className="duration-presets">
              {[25, 45, 50, 60].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="ghost"
                  aria-pressed={minutes === n}
                  onClick={() => setMinutes(n)}
                >
                  {n} {t.minutes}
                </Button>
              ))}
            </div>
            <div className="mt-4">
              <Field
                label={t.custom}
                name="duration"
                type="number"
                min={5}
                max={180}
                step={1}
                required
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                hint={t.minutes}
              />
            </div>
          </fieldset>
          <label className="grid gap-2 font-semibold">
            {t.subject}
            <select
              className="field"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTask("");
              }}
            >
              <option value="">{t.general}</option>
              {subjects
                .filter((s) => !s.archived_at)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {name(s.id)}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-2 font-semibold">
            {t.task}
            <select
              className="field"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            >
              <option value="">{t.noTask}</option>
              {tasks
                .filter(
                  (x) =>
                    x.status !== "completed" &&
                    (!subject || x.subject_id === subject),
                )
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : t.start}
          </Button>
          <p className="muted text-center text-sm">{t.ready}</p>
        </form>
      )}
      {confirm && (
        <Dialog
          title={t.endTitle}
          closeLabel={phase3[locale].close}
          busy={pending}
          onClose={() => setConfirm(false)}
        >
          <p className="muted my-6">{t.endHint}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t.cancel}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirm(false);
                void sync("finish");
              }}
            >
              {t.confirmEnd}
            </Button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
