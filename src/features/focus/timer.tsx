"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
    [clockOffset, setClockOffset] = useState(0),
    [confirm, setConfirm] = useState(false),
    [mode, setMode] = useState<"countdown" | "stopwatch">("countdown"),
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
        setClockOffset(offset.current);
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
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      channel.current?.close();
    };
  }, [sync, userId]);
  const ticking = session?.timer_state === "running" || rest?.state === "running";
  const active =
    session?.timer_state === "running" || session?.timer_state === "paused";
  useEffect(() => {
    if (
      session?.timer_state === "running" &&
      session.planned_seconds !== null &&
      loaded &&
      !pending &&
      !error &&
      attempted.current !== session.id
    ) {
      const delay =
        remainingSeconds(
          session,
          Date.now() + offset.current,
        ) * 1000;

      const finish =
        setTimeout(() => {
          attempted.current =
            session.id;

          void sync("finish");
        }, delay);

      return () =>
        clearTimeout(finish);
    }
  }, [
    session,
    loaded,
    pending,
    error,
    sync,
  ]);
  const name = (id: string | null) =>
    subjectLabel(p2, subjects.find((s) => s.id === id)?.name ?? t.general);
  const reset = () => {
    current.current = null;
    setSession(null);
    setRest(null);
    startId.current = "";
    attempted.current = "";
  };
  function startBreak(kind: "short" | "long") {
    const anchor = Date.now() + offset.current;
    setNow(anchor);
    setRest({
      kind,
      state: "running",
      remaining:
        (kind === "short"
          ? settings.short_break_minutes
          : settings.long_break_minutes) * 60,
      anchor,
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
      <TimerClock initialNow={now} offset={clockOffset} ticking={ticking}>
        {(now) => {
          const elapsed =
            session
              ? elapsedSeconds(
                  session,
                  now,
                )
              : 0;

          const openSession =
            session?.planned_seconds ===
            null;

          const left = session
            ? openSession
              ? elapsed
              : remainingSeconds(
                  session,
                  now,
                )
            : mode === "stopwatch"
              ? 0
              : minutes * 60;
          const breakLeft = rest
            ? Math.max(
              0,
              rest.remaining -
              (rest.state === "running"
                ? Math.floor((now - rest.anchor) / 1000)
                : 0),
            )
            : 0;

          return (!loaded ? (
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
                    onClick={() => {
                      const anchor = Date.now() + clockOffset;
                      setNow(anchor);
                      setRest({
                        ...rest,
                        state: rest.state === "running" ? "paused" : "running",
                        remaining: breakLeft,
                        anchor,
                      });
                    }}
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
                {openSession
                  ? stopwatchDigits(left)
                  : timerDigits(left)}
              </div>
              <p className="text-xl font-semibold">{name(session.subject_id)}</p>
              {session.task_id && (
                <p className="muted mt-2">
                  {tasks.find((x) => x.id === session.task_id)?.title ?? ""}
                </p>
              )}
              {openSession ? (
                <p className="muted mt-7 text-sm">
                  {locale === "ar"
                    ? "الوقت بيزيد من الصفر، والجلسة هتفضل شغالة لحد ما تنهيها."
                    : "Time counts up from zero and keeps running until you end the session."}
                </p>
              ) : (
                <progress
                  className="focus-progress mt-7"
                  aria-label={t.focus}
                  max={
                    session.planned_seconds ??
                    1
                  }
                  value={elapsed}
                />
              )}
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
                  id:
                    startId.current,
                  minutes:
                    mode ===
                    "stopwatch"
                      ? "0"
                      : String(
                          minutes,
                        ),
                  subject,
                  task,
                });
              }}
            >
              <fieldset>
                <legend className="mb-3 font-semibold">
                  {locale === "ar"
                    ? "نوع الجلسة"
                    : "Session type"}
                </legend>

                <div className="duration-presets">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={
                      mode ===
                      "countdown"
                    }
                    onClick={() =>
                      setMode(
                        "countdown",
                      )
                    }
                  >
                    {locale === "ar"
                      ? "مؤقت محدد"
                      : "Countdown"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={
                      mode ===
                      "stopwatch"
                    }
                    onClick={() =>
                      setMode(
                        "stopwatch",
                      )
                    }
                  >
                    {locale === "ar"
                      ? "مذاكرة مفتوحة"
                      : "Open study"}
                  </Button>
                </div>
              </fieldset>

              {mode ===
              "countdown" ? (
                <fieldset>
                  <legend className="mb-3 font-semibold">
                    {t.duration}
                  </legend>

                  <div className="duration-presets">
                    {[
                      25,
                      45,
                      50,
                      60,
                    ].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="ghost"
                        aria-pressed={
                          minutes ===
                          n
                        }
                        onClick={() =>
                          setMinutes(
                            n,
                          )
                        }
                      >
                        {n}{" "}
                        {t.minutes}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Field
                      label={
                        t.custom
                      }
                      name="duration"
                      type="number"
                      min={5}
                      max={180}
                      step={1}
                      required
                      value={
                        minutes
                      }
                      onChange={(
                        e,
                      ) =>
                        setMinutes(
                          Number(
                            e.target
                              .value,
                          ),
                        )
                      }
                      hint={
                        t.minutes
                      }
                    />
                  </div>
                </fieldset>
              ) : (
                <div className="surface grid gap-3 p-5 text-center">
                  <p className="eyebrow">
                    {locale === "ar"
                      ? "مذاكرة مفتوحة"
                      : "Open study"}
                  </p>

                  <p
                    className="timer-digits"
                    dir="ltr"
                  >
                    00:00:00
                  </p>

                  <p className="muted text-sm">
                    {locale === "ar"
                      ? "ابدأ من الصفر وذاكر براحتك. الوقت هيتحفظ لما تنهي الجلسة."
                      : "Start from zero and study as long as you want. Your real time is saved when you end the session."}
                  </p>
                </div>
              )}
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
          ));
        }}
      </TimerClock>
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

function stopwatchDigits(
  seconds: number,
) {
  const n = Math.max(
    0,
    Math.floor(seconds),
  );

  const hours =
    Math.floor(n / 3600);

  const minutes =
    Math.floor(
      (n % 3600) / 60,
    );

  const secs =
    n % 60;

  return (
    String(hours).padStart(
      2,
      "0",
    ) +
    ":" +
    String(minutes).padStart(
      2,
      "0",
    ) +
    ":" +
    String(secs).padStart(
      2,
      "0",
    )
  );
}

// Only this subtree ticks. Navigation, header, dialogs and providers do not.
function TimerClock({ initialNow, offset, ticking, children }: {
  initialNow: number;
  offset: number;
  ticking: boolean;
  children: (now: number) => ReactNode;
}) {
  const [localNow, setLocalNow] = useState(0);
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return children(Math.max(initialNow, localNow ? localNow + offset : initialNow));
}
