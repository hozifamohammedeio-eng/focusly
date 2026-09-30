"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import {
  Button,
  ButtonLink,
} from "@/components/ui/button";

import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";

import {
  useLocale,
} from "@/features/i18n/locale-provider";

import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { phase4 } from "@/features/i18n/phase4";
import { phase3 } from "@/features/i18n/phase3";

import type { Database } from "@/types/database";

import type {
  Subject,
  Task,
} from "@/features/planning/logic";

import { focusAction } from "./actions";
import { ChallengeRewardToast } from "@/features/challenges/reward-toast";
import type { ChallengeAward } from "@/features/challenges/receipt";

import {
  elapsedSeconds,
  remainingSeconds,
  timerDigits,
  formatDuration,
  type FocusSession,
  type Progress,
} from "./logic";

import { GoalCard } from "./progress-ui";

import styles from "./timer.module.css";

type BreakState = {
  kind: "short" | "long";
  state: "running" | "paused";
  remaining: number;
  total: number;
  anchor: number;
};

type SessionMode =
  | "countdown"
  | "stopwatch";

export function FocusTimer({
  userId,
  settings,
  subjects,
  tasks,
  progress,
  goal,
}: {
  userId: string;
  settings:
    Database["public"]["Tables"]["user_settings"]["Row"];
  subjects: Subject[];
  tasks: Task[];
  progress: Progress;
  goal: number;
}) {
  const { locale } =
    useLocale();

  const t =
    phase4[locale];

  const p2 =
    useCopy();

  const router =
    useRouter();
  const [challengeAwards, setChallengeAwards] = useState<ChallengeAward[]>([]);
  const dismissChallengeAwards = useCallback(() => setChallengeAwards([]), []);

  const [
    session,
    setSession,
  ] =
    useState<FocusSession | null>(
      null,
    );

  const [
    loaded,
    setLoaded,
  ] = useState(false);

  const [
    pending,
    setPending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(false);

  const [
    now,
    setNow,
  ] = useState(0);

  const [
    clockOffset,
    setClockOffset,
  ] = useState(0);

  const [
    confirm,
    setConfirm,
  ] = useState(false);

  const [
    mode,
    setMode,
  ] =
    useState<SessionMode>(
      "countdown",
    );

  const [
    minutes,
    setMinutes,
  ] = useState(
    settings.focus_minutes,
  );

  const [
    subject,
    setSubject,
  ] = useState("");

  const [
    task,
    setTask,
  ] = useState("");

  const [
    rest,
    setRest,
  ] =
    useState<BreakState | null>(
      null,
    );

  const current =
    useRef<FocusSession | null>(
      null,
    );

  const busy =
    useRef(false);

  const offset =
    useRef(0);

  const attempted =
    useRef("");

  const startId =
    useRef("");

  const channel =
    useRef<BroadcastChannel | null>(
      null,
    );

  const sync =
    useCallback(
      async (
        action: string,
        values:
          Record<string, string> = {},
      ) => {
        if (busy.current) {
          return;
        }

        busy.current = true;

        setPending(true);
        setError(false);

        const f =
          new FormData();

        f.set(
          "action",
          action,
        );

        if (current.current) {
          f.set(
            "id",
            current.current.id,
          );

          f.set(
            "revision",
            current.current.updated_at,
          );
        }

        Object.entries(
          values,
        ).forEach(
          ([key, value]) => {
            f.set(
              key,
              value,
            );
          },
        );

        try {
          const result =
            await focusAction(f);

          if (
            "error" in result
          ) {
            setError(true);
            return;
          }

          const newlyCompleted =
            result.session
              ?.completed &&
            !current.current
              ?.completed;
          if (result.challengeAwards?.length) setChallengeAwards(result.challengeAwards);

          offset.current =
            Date.parse(
              result.serverNow,
            ) -
            Date.now();

          setClockOffset(
            offset.current,
          );

          setNow(
            Date.now() +
              offset.current,
          );

          current.current =
            result.session;

          setSession(
            result.session,
          );

          setLoaded(true);

          if (
            action !==
            "recover"
          ) {
            channel.current
              ?.postMessage(
                "changed",
              );
          }

          if (
            newlyCompleted
          ) {
            channel.current
              ?.postMessage(
                "completed",
              );

            router.refresh();
          }
        } catch {
          setError(true);
        } finally {
          busy.current =
            false;

          setPending(false);
        }
      },
      [router],
    );

  useEffect(() => {
    const recover = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void sync(
          "recover",
        );
      }
    };

    const initial =
      setTimeout(
        () => {
          void sync(
            "recover",
          );
        },
        0,
      );

    window.addEventListener(
      "focus",
      recover,
    );

    document.addEventListener(
      "visibilitychange",
      recover,
    );

    if (
      "BroadcastChannel" in
      window
    ) {
      channel.current =
        new BroadcastChannel(
          "focusly:timer:" +
            userId,
        );

      channel.current.onmessage =
        () => {
          void sync(
            "recover",
          );
        };
    }

    return () => {
      clearTimeout(
        initial,
      );

      window.removeEventListener(
        "focus",
        recover,
      );

      document.removeEventListener(
        "visibilitychange",
        recover,
      );

      channel.current
        ?.close();
    };
  }, [
    sync,
    userId,
  ]);

  const ticking =
    session?.timer_state ===
      "running" ||
    rest?.state ===
      "running";

  const active =
    session?.timer_state ===
      "running" ||
    session?.timer_state ===
      "paused";

  useEffect(() => {
    if (
      session?.timer_state ===
        "running" &&
      session.planned_seconds !==
        null &&
      loaded &&
      !pending &&
      !error &&
      attempted.current !==
        session.id
    ) {
      const delay =
        remainingSeconds(
          session,
          Date.now() +
            offset.current,
        ) * 1000;

      const finish =
        setTimeout(
          () => {
            attempted.current =
              session.id;

            void sync(
              "finish",
            );
          },
          delay,
        );

      return () => {
        clearTimeout(
          finish,
        );
      };
    }
  }, [
    session,
    loaded,
    pending,
    error,
    sync,
  ]);

  const name = (
    id: string | null,
  ) =>
    subjectLabel(
      p2,
      subjects.find(
        (item) =>
          item.id === id,
      )?.name ??
        t.general,
    );

  const reset = () => {
    current.current =
      null;

    setSession(null);
    setRest(null);

    startId.current = "";
    attempted.current =
      "";
  };

  function startBreak(
    kind:
      | "short"
      | "long",
  ) {
    const anchor =
      Date.now() +
      offset.current;

    const total =
      (kind === "short"
        ? settings.short_break_minutes
        : settings.long_break_minutes) *
      60;

    setNow(anchor);

    setRest({
      kind,
      state: "running",
      remaining: total,
      total,
      anchor,
    });
  }

  const todayTasks =
    tasks.filter(
      (item) =>
        item.status !==
          "completed" &&
        item.due_on ===
          progress.today,
    );

  const immersive =
    active ||
    Boolean(rest);

  return (
    <main
      id="main"
      className={[
        "study-main",
        "focus-page",
        styles.page,
        immersive
          ? styles.immersive
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ChallengeRewardToast awards={challengeAwards} onDismiss={dismissChallengeAwards} />
      <header
        className={
          styles.header
        }
      >
        <p className="eyebrow">
          {t.focus}
        </p>

        <h1
          className={
            styles.title
          }
        >
          {t.focusTitle}
        </h1>

        <p
          className={[
            "muted",
            styles.subtitle,
          ].join(" ")}
        >
          {t.focusSubtitle}
        </p>
      </header>

      {error ? (
        <div
          className={
            styles.errorCard
          }
          role="alert"
        >
          <p>
            {t.error}
          </p>

          <Button
            className={
              styles.retryButton
            }
            onClick={() => {
              attempted.current =
                "";

              void sync(
                "recover",
              );
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : null}

      <TimerClock
        initialNow={now}
        offset={clockOffset}
        ticking={ticking}
      >
        {(serverNow) => {
          const elapsed =
            session
              ? elapsedSeconds(
                  session,
                  serverNow,
                )
              : 0;

          const openSession =
            session
              ?.planned_seconds ===
            null;

          const left =
            session
              ? openSession
                ? elapsed
                : remainingSeconds(
                    session,
                    serverNow,
                  )
              : mode ===
                  "stopwatch"
                ? 0
                : minutes *
                  60;

          const breakLeft =
            rest
              ? Math.max(
                  0,
                  rest.remaining -
                    (rest.state ===
                    "running"
                      ? Math.floor(
                          (serverNow -
                            rest.anchor) /
                            1000,
                        )
                      : 0),
                )
              : 0;

          if (!loaded) {
            return (
              <div
                className={
                  styles.loading
                }
                role="status"
              >
                <div
                  className={
                    styles.loadingOrb
                  }
                />

                <p className="muted">
                  {t.recovering}
                </p>
              </div>
            );
          }

          if (rest) {
            const breakProgress =
              rest.total > 0
                ? breakLeft /
                  rest.total
                : 0;

            return (
              <section
                className={
                  styles.stage
                }
              >
                <ModePill
                  label={
                    rest.kind ===
                    "short"
                      ? locale ===
                        "ar"
                        ? "استراحة قصيرة"
                        : "Short break"
                      : locale ===
                          "ar"
                        ? "استراحة طويلة"
                        : "Long break"
                  }
                />

                <FocusDial
                  value={
                    timerDigits(
                      breakLeft,
                    )
                  }
                  progress={
                    breakProgress
                  }
                  status={
                    breakLeft ===
                    0
                      ? t.breakDone
                      : rest.state ===
                          "paused"
                        ? t.paused
                        : t.breakHint
                  }
                  ariaLabel={
                    t[
                      rest.kind
                    ]
                  }
                />

                <div
                  className={
                    styles.controls
                  }
                >
                  {breakLeft >
                  0 ? (
                    <Button
                      className={
                        styles.primaryControl
                      }
                      onClick={() => {
                        const anchor =
                          Date.now() +
                          clockOffset;

                        setNow(
                          anchor,
                        );

                        setRest({
                          ...rest,
                          state:
                            rest.state ===
                            "running"
                              ? "paused"
                              : "running",
                          remaining:
                            breakLeft,
                          anchor,
                        });
                      }}
                    >
                      {rest.state ===
                      "running"
                        ? t.pause
                        : t.resume}
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    className={
                      styles.secondaryControl
                    }
                    onClick={reset}
                  >
                    {breakLeft >
                    0
                      ? t.skip
                      : t.another}
                  </Button>
                </div>
              </section>
            );
          }

          if (
            active &&
            session
          ) {
            const taskLabel =
              session.task_id
                ? tasks.find(
                    (item) =>
                      item.id ===
                      session.task_id,
                  )?.title ??
                  ""
                : "";

            const progressValue =
              openSession ||
              !session.planned_seconds
                ? null
                : left /
                  session.planned_seconds;

            return (
              <section
                className={
                  styles.stage
                }
              >
                <ModePill
                  label={
                    openSession
                      ? locale ===
                        "ar"
                        ? "مذاكرة مفتوحة"
                        : "Open study"
                      : locale ===
                          "ar"
                        ? "جلسة تركيز"
                        : "Focus session"
                  }
                  active
                />

                <FocusDial
                  value={
                    openSession
                      ? stopwatchDigits(
                          left,
                        )
                      : timerDigits(
                          left,
                        )
                  }
                  progress={
                    progressValue
                  }
                  subject={
                    name(
                      session.subject_id,
                    )
                  }
                  task={
                    taskLabel
                  }
                  status={
                    session.timer_state ===
                    "paused"
                      ? t.paused
                      : t.running
                  }
                  ariaLabel={
                    t.focus
                  }
                />

                {openSession ? (
                  <p
                    className={
                      styles.helper
                    }
                  >
                    {locale ===
                    "ar"
                      ? "الوقت يزيد من الصفر، والجلسة تستمر حتى تنهيها."
                      : "Time counts up from zero and keeps running until you end the session."}
                  </p>
                ) : null}

                <div
                  className={
                    styles.controls
                  }
                >
                  <Button
                    disabled={
                      pending
                    }
                    className={
                      styles.primaryControl
                    }
                    onClick={() =>
                      void sync(
                        session.timer_state ===
                          "paused"
                          ? "resume"
                          : "pause",
                      )
                    }
                  >
                    {pending
                      ? t.saving
                      : session.timer_state ===
                          "paused"
                        ? t.resume
                        : t.pause}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={
                      pending
                    }
                    className={
                      styles.secondaryControl
                    }
                    onClick={() =>
                      setConfirm(
                        true,
                      )
                    }
                  >
                    {t.end}
                  </Button>
                </div>

                <p
                  className={
                    styles.soundNote
                  }
                >
                  {t.noSound}
                </p>
              </section>
            );
          }

          if (session) {
            return (
              <section
                className={[
                  styles.result,
                  session.completed
                    ? styles.resultComplete
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={
                    styles.resultIcon
                  }
                  aria-hidden="true"
                >
                  {session.completed
                    ? "✓"
                    : "—"}
                </div>

                <h2
                  className={
                    styles.resultTitle
                  }
                  role="status"
                >
                  {session.completed
                    ? t.complete
                    : t.discarded}
                </h2>

                <p
                  className={
                    styles.resultTime
                  }
                >
                  {session.completed
                    ? formatDuration(
                        session.duration_seconds,
                        locale,
                      )
                    : t.discardHint}
                </p>

                <p className="muted">
                  {name(
                    session.subject_id,
                  )}
                </p>

                {session.completed ? (
                  <>
                    <p
                      className={
                        styles.synced
                      }
                    >
                      {t.synced}
                    </p>

                    <GoalCard
                      progress={
                        progress
                      }
                      goal={
                        goal
                      }
                    />

                    <div
                      className={
                        styles.resultActions
                      }
                    >
                      <Button
                        onClick={() =>
                          startBreak(
                            "short",
                          )
                        }
                      >
                        {t.break}
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() =>
                          startBreak(
                            "long",
                          )
                        }
                      >
                        {t.long}
                      </Button>
                    </div>
                  </>
                ) : null}

                <div
                  className={
                    styles.resultActions
                  }
                >
                  <Button
                    variant="ghost"
                    onClick={
                      reset
                    }
                  >
                    {t.another}
                  </Button>

                  <ButtonLink
                    href="/app"
                    variant="ghost"
                  >
                    {t.dashboard}
                  </ButtonLink>
                </div>
              </section>
            );
          }

          const previewValue =
            mode ===
            "stopwatch"
              ? "00:00:00"
              : timerDigits(
                  minutes *
                    60,
                );

          return (
            <section
              className={
                styles.setupLayout
              }
            >
              <div
                className={
                  styles.previewColumn
                }
              >
                <div
                  className={
                    styles.modeTabs
                  }
                  role="group"
                  aria-label={
                    locale ===
                    "ar"
                      ? "نوع الجلسة"
                      : "Session type"
                  }
                >
                  <button
                    type="button"
                    className={[
                      styles.modeTab,
                      mode ===
                      "countdown"
                        ? styles.modeTabActive
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      setMode(
                        "countdown",
                      )
                    }
                  >
                    {locale ===
                    "ar"
                      ? "بومودورو"
                      : "Pomodoro"}
                  </button>

                  <button
                    type="button"
                    className={[
                      styles.modeTab,
                      mode ===
                      "stopwatch"
                        ? styles.modeTabActive
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      setMode(
                        "stopwatch",
                      )
                    }
                  >
                    {locale ===
                    "ar"
                      ? "مذاكرة مفتوحة"
                      : "Open study"}
                  </button>
                </div>

                <FocusDial
                  value={
                    previewValue
                  }
                  progress={
                    mode ===
                    "countdown"
                      ? 1
                      : null
                  }
                  subject={
                    subject
                      ? name(
                          subject,
                        )
                      : locale ===
                          "ar"
                        ? "اختر المادة"
                        : "Choose subject"
                  }
                  task={
                    task
                      ? todayTasks.find(
                          (item) =>
                            item.id ===
                            task,
                        )
                          ?.title ??
                        ""
                      : ""
                  }
                  status={
                    locale ===
                    "ar"
                      ? "جاهز للتركيز"
                      : "Ready to focus"
                  }
                  ariaLabel={
                    t.focus
                  }
                />
              </div>

              <form
                className={
                  styles.setupCard
                }
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();

                  if (
                    !startId.current
                  ) {
                    startId.current =
                      crypto.randomUUID();
                  }

                  void sync(
                    "start",
                    {
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
                    },
                  );
                }}
              >
                {mode ===
                "countdown" ? (
                  <fieldset
                    className={
                      styles.fieldset
                    }
                  >
                    <legend
                      className={
                        styles.legend
                      }
                    >
                      {locale ===
                      "ar"
                        ? "مدة الجلسة"
                        : "Session duration"}
                    </legend>

                    <div
                      className={
                        styles.presets
                      }
                    >
                      {[
                        25,
                        45,
                        50,
                        60,
                      ].map(
                        (
                          value,
                        ) => (
                          <button
                            key={
                              value
                            }
                            type="button"
                            className={[
                              styles.preset,
                              minutes ===
                              value
                                ? styles.presetActive
                                : "",
                            ]
                              .filter(
                                Boolean,
                              )
                              .join(
                                " ",
                              )}
                            onClick={() =>
                              setMinutes(
                                value,
                              )
                            }
                          >
                            {value}
                            <span>
                              {locale ===
                              "ar"
                                ? "د"
                                : "min"}
                            </span>
                          </button>
                        ),
                      )}
                    </div>

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
                        event,
                      ) =>
                        setMinutes(
                          Number(
                            event
                              .target
                              .value,
                          ),
                        )
                      }
                      hint={
                        t.minutes
                      }
                    />
                  </fieldset>
                ) : (
                  <div
                    className={
                      styles.openStudyInfo
                    }
                  >
                    <strong>
                      {locale ===
                      "ar"
                        ? "مذاكرة بدون وقت محدد"
                        : "Study without a time limit"}
                    </strong>

                    <p className="muted">
                      {locale ===
                      "ar"
                        ? "ابدأ من الصفر، وسيُحفظ وقت المذاكرة الفعلي عند إنهاء الجلسة."
                        : "Start from zero. Your actual study time is saved when you finish."}
                    </p>
                  </div>
                )}

                <label
                  className={
                    styles.selectLabel
                  }
                >
                  <span>
                    {t.subject}
                  </span>

                  <select
                    className="field"
                    value={
                      subject
                    }
                    onChange={(
                      event,
                    ) => {
                      setSubject(
                        event
                          .target
                          .value,
                      );

                      setTask(
                        "",
                      );
                    }}
                  >
                    <option value="">
                      {t.general}
                    </option>

                    {subjects
                      .filter(
                        (item) =>
                          !item.archived_at,
                      )
                      .map(
                        (
                          item,
                        ) => (
                          <option
                            value={
                              item.id
                            }
                            key={
                              item.id
                            }
                          >
                            {name(
                              item.id,
                            )}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label
                  className={
                    styles.selectLabel
                  }
                >
                  <span>
                    {locale ===
                    "ar"
                      ? "مهمة اليوم"
                      : "Today's task"}
                  </span>

                  <select
                    className="field"
                    value={
                      task
                    }
                    onChange={(
                      event,
                    ) =>
                      setTask(
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      {t.noTask}
                    </option>

                    {todayTasks
                      .filter(
                        (
                          item,
                        ) =>
                          !subject ||
                          item.subject_id ===
                            subject,
                      )
                      .map(
                        (
                          item,
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {
                              item.title
                            }
                          </option>
                        ),
                      )}
                  </select>

                  <small
                    className={
                      styles.fieldHint
                    }
                  >
                    {locale ===
                    "ar"
                      ? "يظهر هنا فقط المهام غير المكتملة المحددة لليوم."
                      : "Only unfinished tasks scheduled for today appear here."}
                  </small>
                </label>

                <Button
                  type="submit"
                  disabled={
                    pending
                  }
                  className={
                    styles.startButton
                  }
                >
                  {pending
                    ? t.saving
                    : locale ===
                        "ar"
                      ? "ابدأ التركيز"
                      : "Start focus"}
                </Button>

                <p
                  className={
                    styles.ready
                  }
                >
                  {t.ready}
                </p>
              </form>
            </section>
          );
        }}
      </TimerClock>

      {confirm ? (
        <Dialog
          title={
            t.endTitle
          }
          closeLabel={
            phase3[locale]
              .close
          }
          busy={
            pending
          }
          onClose={() =>
            setConfirm(
              false,
            )
          }
        >
          <p className="muted my-6">
            {t.endHint}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() =>
                setConfirm(
                  false,
                )
              }
            >
              {t.cancel}
            </Button>

            <Button
              disabled={
                pending
              }
              onClick={() => {
                setConfirm(
                  false,
                );

                void sync(
                  "finish",
                );
              }}
            >
              {t.confirmEnd}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </main>
  );
}

function ModePill({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={[
        styles.sessionPill,
        active
          ? styles.sessionPillActive
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={
          styles.pillDot
        }
      />

      {label}
    </div>
  );
}

function FocusDial({
  value,
  progress,
  subject,
  task,
  status,
  ariaLabel,
}: {
  value: string;
  progress:
    | number
    | null;
  subject?: string;
  task?: string;
  status: string;
  ariaLabel: string;
}) {
  const radius = 162;

  const circumference =
    2 *
    Math.PI *
    radius;

  const safeProgress =
    progress === null
      ? null
      : Math.min(
          1,
          Math.max(
            0,
            progress,
          ),
        );

  const dashOffset =
    safeProgress === null
      ? circumference *
        0.72
      : circumference *
        (1 -
          safeProgress);

  return (
    <div
      className={
        styles.dial
      }
      role="timer"
      aria-label={
        ariaLabel
      }
    >
      <svg
        className={
          styles.ring
        }
        viewBox="0 0 360 360"
        aria-hidden="true"
      >
        <circle
          className={
            styles.ringTrack
          }
          cx="180"
          cy="180"
          r={
            radius
          }
        />

        <circle
          className={[
            styles.ringProgress,
            safeProgress ===
            null
              ? styles.ringIdle
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          cx="180"
          cy="180"
          r={
            radius
          }
          strokeDasharray={
            circumference
          }
          strokeDashoffset={
            dashOffset
          }
        />
      </svg>

      <div
        className={
          styles.glassCore
        }
      >
        <div
          className={
            styles.glassShine
          }
        />

        <p
          dir="ltr"
          className={
            styles.time
          }
        >
          {value}
        </p>

        {subject ? (
          <p
            className={
              styles.subject
            }
          >
            {subject}
          </p>
        ) : null}

        {task ? (
          <p
            className={
              styles.task
            }
          >
            {task}
          </p>
        ) : null}

        <p
          className={
            styles.status
          }
        >
          {status}
        </p>
      </div>
    </div>
  );
}

function stopwatchDigits(
  seconds: number,
) {
  const n =
    Math.max(
      0,
      Math.floor(
        seconds,
      ),
    );

  const hours =
    Math.floor(
      n / 3600,
    );

  const minutes =
    Math.floor(
      (n % 3600) /
        60,
    );

  const secs =
    n % 60;

  return (
    String(
      hours,
    ).padStart(
      2,
      "0",
    ) +
    ":" +
    String(
      minutes,
    ).padStart(
      2,
      "0",
    ) +
    ":" +
    String(
      secs,
    ).padStart(
      2,
      "0",
    )
  );
}

/*
 * Keep ticking isolated to this subtree.
 * This prevents the app shell/navigation
 * from rerendering every second.
 */
function TimerClock({
  initialNow,
  offset,
  ticking,
  children,
}: {
  initialNow: number;
  offset: number;
  ticking: boolean;
  children:
    (
      now: number,
    ) => ReactNode;
}) {
  const [
    localNow,
    setLocalNow,
  ] = useState(0);

  useEffect(() => {
    if (!ticking) {
      return;
    }

    const timer =
      setInterval(
        () =>
          setLocalNow(
            Date.now(),
          ),
        1000,
      );

    return () => {
      clearInterval(
        timer,
      );
    };
  }, [
    ticking,
  ]);

  return children(
    Math.max(
      initialNow,
      localNow
        ? localNow +
          offset
        : initialNow,
    ),
  );
}
