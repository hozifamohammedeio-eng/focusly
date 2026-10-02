"use client";
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/logout-button";
import {StudySettings} from '@/features/focus/settings';
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { phase3 } from "@/features/i18n/phase3";
import type { PlanningData } from "./data";
import { mutate } from "./actions";
import { ChallengeRewardToast } from "@/features/challenges/reward-toast";
import { CityGrowthToast } from "@/features/city/growth-toast";
import type { CityGrowth } from "@/features/city/receipt";
import type { ChallengeAward } from "@/features/challenges/receipt";
import { AchievementRewardToast } from "@/features/progression/achievement-toast";
import type { AchievementAward } from "@/features/progression/achievement-receipt";
import type { EditorState } from "./editor";
const Editor = dynamic(() => import("./editor").then((module) => module.Editor));
const DeleteDialog = dynamic(() => import("./editor").then((module) => module.DeleteDialog));
import {
  dateAdd,
  dayInZone,
  filterTasks,
  formatDay,
  formatRange,
  formatTime,
  monthMove,
  monthStart,
  occurrences,
  taskDay,
  weekStart,
  type Task,
  type View,
  type Occurrence,
} from "./logic";

const FOCUSLY_DAILY_MOTIVATION = {
  ar: [
    "ابدأ بالقليل، والاستمرار سيصنع الفرق.",
    "ساعة مركزة اليوم أفضل من خطة مثالية لم تبدأ.",
    "كل جلسة مذاكرة تقرّبك خطوة من هدفك.",
    "ركز على المهمة التي أمامك الآن، والباقي يأتي بعد ذلك.",
    "التقدم الهادئ ما زال تقدمًا.",
    "لا تحتاج إلى إنجاز كل شيء اليوم، فقط ابدأ بالأهم.",
    "اجعل هدف اليوم واضحًا، ثم ابدأ.",
    "الاستمرارية أقوى من الحماس المؤقت.",
    "مجهود صغير ومتكرر يصنع نتيجة كبيرة.",
    "ابدأ حتى لو لم تشعر أنك مستعد تمامًا.",
    "كل خطوة صغيرة اليوم تسهّل عليك الغد.",
    "مهمتك ليست أن تكون مثاليًا، بل أن تتقدم.",
  ],

  en: [
    "Start small. Consistency will do the heavy lifting.",
    "One focused hour beats a perfect plan you never start.",
    "Every study session moves you closer to your goal.",
    "Focus on the task in front of you; the rest can wait.",
    "Quiet progress is still progress.",
    "You do not need to finish everything today, just start with what matters most.",
    "Make today's goal clear, then begin.",
    "Consistency beats temporary motivation.",
    "Small repeated effort becomes a big result.",
    "Start even if you do not feel completely ready.",
    "Every small step today makes tomorrow easier.",
    "Your job is not to be perfect; it is to make progress.",
  ],
} as const;


function dailyMotivation(
  day: string,
  locale: "ar" | "en",
) {

  const list =
    FOCUSLY_DAILY_MOTIVATION[
      locale
    ];


  const key =
    Number(
      day.replaceAll(
        "-",
        "",
      ),
    );


  return list[
    key %
    list.length
  ];
}
export function Workspace({ data, view }: { data: PlanningData; view: View }) {
  const { locale } = useLocale(),
    t = phase3[locale],
    p2 = useCopy(),
    router = useRouter();
  const [clock, setClock] = useState(data.now);
  useEffect(() => {
    const update = () => {
      const instant = new Date().toISOString();
      setClock(instant);
      if (dayInZone(instant, data.zone) !== dayInZone(data.now, data.zone))
        router.refresh();
    };
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [data.now, data.zone, router]);
  const now = clock > data.now ? clock : data.now;
  const zone = data.zone,
    today = dayInZone(now, zone);
  const [editor, setEditor] = useState<EditorState | null>(null),
    [deleting, setDeleting] = useState<{
      entity: EditorState["entity"];
      id: string;
      weekly: boolean;
    } | null>(null);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const [challengeAwards, setChallengeAwards] = useState<ChallengeAward[]>([]);
  const [achievementAwards, setAchievementAwards] = useState<AchievementAward[]>([]);
  const [cityGrowth, setCityGrowth] = useState<CityGrowth | null>(null);
  const dismissChallengeAwards = useCallback(() => setChallengeAwards([]), []);
  const dismissAchievementAwards = useCallback(() => setAchievementAwards([]), []);
  const dismissCityGrowth = useCallback(() => setCityGrowth(null), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  const [subjectFilter, setSubjectFilter] = useState(""),
    [priority, setPriority] = useState(""),
    [archived, setArchived] = useState(false);
  const [selected, setSelectedState] = useState({ base: data.selectedDay, day: data.selectedDay });
  const setSelected = (chosen: string) => setSelectedState({ base: data.selectedDay, day: chosen });
  const currentWeek = weekStart(data.selectedDay),
    currentMonth = monthStart(data.selectedDay),
    day = selected.base === data.selectedDay ? selected.day : data.selectedDay;
  const active = data.subjects
    .filter((s) => !s.archived_at)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, locale),
    );
  const subjectName = (id: string | null) =>
    subjectLabel(
      p2,
      data.subjects.find((s) => s.id === id)?.name || t.noSubject,
    );
  const subjectColor = (id: string | null) =>
    data.subjects.find((s) => s.id === id)?.color || "var(--muted)";
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  function success(text: string) {
    setMessage(text);
    setError("");
    router.refresh();
  }
  function run(form: FormData) {
    start(async () => {
      try {
        const r = await mutate(form);
        if (r.error) {
          setError(t[r.error]);
          return;
        }
        success(t.saved);
      } catch {
        setError(t.saveError);
      }
    });
  }
  function complete(task: Task) {
    const f = new FormData();
    f.set("entity", "tasks");
    f.set("action", "complete");
    f.set("id", task.id);
    f.set("completed", String(task.status !== "completed"));
    start(async () => {
      try {
        const r = await mutate(f);
        if (r.error) setError(t[r.error]);
        else {
          if (r.challengeAwards?.length) setChallengeAwards(r.challengeAwards);
          if (r.achievementAwards?.length) setAchievementAwards(r.achievementAwards);
          if (r.cityGrowth) setCityGrowth(r.cityGrowth);
          setError("");
          router.refresh();
        }
      } catch {
        setError(t.saveError);
      }
    });
  }
  const taskRows = (tasks: Task[]) => (
    <ul className="task-list">
      {tasks.map((task) => (
        <li
          className={`task-row ${task.status === "completed" ? "task-completed" : ""}`}
          key={task.id}
        >
          <label className="completion-target">
            <input
              type="checkbox"
              className="completion-check"
              checked={task.status === "completed"}
              disabled={pending}
              onChange={() => complete(task)}
              aria-label={`${task.status === "completed" ? t.markIncomplete : t.markComplete}: ${task.title}`}
            />
          </label>
          <div className="min-w-0 flex-1">
            <button
              className="task-title text-start font-semibold"
              onClick={() => setEditor({ entity: "tasks", row: task })}
            >
              {task.title}
            </button>
            <div className="muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <i
                  className="subject-dot"
                  style={{ background: subjectColor(task.subject_id) }}
                />
                {subjectName(task.subject_id)}
              </span>
              <span>
                {taskDay(task, zone)
                  ? formatDay(taskDay(task, zone)!, locale)
                  : t.undated}
                {task.due_at
                  ? ` · ${formatTime(task.due_at, locale, zone)}`
                  : ""}
              </span>
              <span className="priority-badge">{t[task.priority]}</span>
            </div>
          </div>
          <div className="row-actions">
            <Button
              variant="ghost"
              onClick={() => setEditor({ entity: "tasks", row: task })}
              aria-label={`${t.edit}: ${task.title}`}
            >
              {t.edit}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setDeleting({ entity: "tasks", id: task.id, weekly: false })
              }
              aria-label={`${t.remove}: ${task.title}`}
            >
              {t.remove}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
  const plannerTaskRows = (tasks: Task[]) =>
    tasks.length ? (
      <ul className="grid gap-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`flex items-start gap-3 rounded-2xl border px-3 py-3 ${
              task.status === "completed"
                ? "opacity-60"
                : ""
            }`}
          >
            <label className="completion-target mt-0.5">
              <input
                type="checkbox"
                className="completion-check"
                checked={task.status === "completed"}
                disabled={pending}
                onChange={() => complete(task)}
                aria-label={`${
                  task.status === "completed"
                    ? t.markIncomplete
                    : t.markComplete
                }: ${task.title}`}
              />
            </label>

            <button
              type="button"
              className="min-w-0 flex-1 break-words text-start text-sm font-semibold"
              onClick={() =>
                setEditor({
                  entity: "tasks",
                  row: task,
                })
              }
            >
              {task.title}
            </button>

            <span className="priority-badge shrink-0">
              {t[task.priority]}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="empty-small">
        {locale === "ar"
          ? "لا توجد مهام في هذا اليوم"
          : "No tasks for this day"}
      </p>
    );

  const sessionCard = (occ: Occurrence) => (
    <button
      key={occ.block.id + occ.starts}
      className="session-card"
      onClick={() => setEditor({ entity: "study_blocks", row: occ.block })}
      style={{ borderInlineStartColor: subjectColor(occ.block.subject_id) }}
    >
      <span className="block break-words font-semibold">
        {subjectName(occ.block.subject_id)}
      </span>
      <span className="muted mt-2 block text-sm">
        {formatTime(occ.starts, locale, zone)} ·{" "}
        {number((Date.parse(occ.ends) - Date.parse(occ.starts)) / 60000)}{" "}
        {t.minutes}
      </span>
      {occ.block.repeat_weekly && (
        <span className="muted mt-2 block text-xs">↻ {t.weekly}</span>
      )}
    </button>
  );
  const sessionList = (list: Occurrence[]) =>
    list.length ? (
      <div className="grid gap-3">
        {list.map((o) => (
          <div key={o.block.id + o.starts} className="session-detail">
            {sessionCard(o)}
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                onClick={() =>
                  setEditor({ entity: "study_blocks", row: o.block })
                }
              >
                {t.edit}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setDeleting({
                    entity: "study_blocks",
                    id: o.block.id,
                    weekly: o.block.repeat_weekly,
                  })
                }
              >
                {t.remove}
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="empty-small">{t.emptyDay}</p>
    );
  const plan = (selectedDay = today) => {
    if (!active.length) {
      setError(t.subjectNeeded);
      return;
    }
    setEditor({ entity: "study_blocks", day: selectedDay });
  };
  const title =
    view === "home"
      ? `${t.greeting}, ${data.profile.display_name || ""}.`
      : view === "planner"
        ? t.plannerTitle
        : t[view];
  const subtitle =
    view === "home"
      ? t.encouragement
      : view === "tasks"
        ? t.taskSubtitle
        : view === "subjects"
          ? t.subjectSubtitle
          : view === "planner"
            ? t.plannerSubtitle
            : view === "calendar"
              ? t.calendarSubtitle
              : t.appearance;
  const todayTasks = filterTasks(
    data.tasks,
    "today",
    "",
    "",
    today,
    zone,
  ).slice(0, 5);
  const next = view === "home" ? occurrences(data.blocks, today, dateAdd(today, 28), zone).find(
    (o) => Date.parse(o.starts) >= Date.parse(now),
  ) : undefined;
  const filtered = filterTasks(
    data.tasks,
    "all",
    subjectFilter,
    priority,
    today,
    zone,
  ).filter((task) => taskDay(task, zone) === day);
  const weekly = view === "planner" ? occurrences(
    data.blocks,
    currentWeek,
    dateAdd(currentWeek, 6),
    zone,
  ) : [];
  const calendarStart = weekStart(currentMonth),
    calendarEnd = dateAdd(calendarStart, 41),
    calendarBlocks = view === "calendar" ? occurrences(data.blocks, calendarStart, calendarEnd, zone) : [];
  const selectedTasks = filterTasks(
    data.tasks,
    "all",
    "",
    "",
    today,
    zone,
  ).filter((task) => taskDay(task, zone) === day);
  const selectedBlocks = view === "planner" || view === "calendar" ? occurrences(data.blocks, day, day, zone) : [];
  return (
    <main id="main" className="study-main">
      <div className="page-heading">
        <div>
          {view === "home" && <p className="eyebrow mb-3">
            {formatDay(today, locale, { weekday: "long", month: "long", day: "numeric" })}
          </p>}
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="muted mt-3 leading-7">{subtitle}</p>
        </div>
        {view === "tasks" ? (
          <Button onClick={() => setEditor({ entity: "tasks", day })}>
            + {t.newTask}
          </Button>
        ) : view === "subjects" ? (
          <Button onClick={() => setEditor({ entity: "subjects" })}>
            + {t.addSubject}
          </Button>
        ) : view === "planner" ? (
          <Button onClick={() => plan()}>+ {t.newSession}</Button>
        ) : null}
      </div>
      <ChallengeRewardToast awards={challengeAwards} onDismiss={dismissChallengeAwards} />
      <AchievementRewardToast awards={achievementAwards} onDismiss={dismissAchievementAwards} />
      <CityGrowthToast growth={cityGrowth} onDismiss={dismissCityGrowth} />
      {message && (
        <div className="study-toast" role="status">
          <span>{message}</span>
          <Button
            variant="ghost"
            aria-label={t.dismiss}
            onClick={() => setMessage("")}
          >
            ×
          </Button>
        </div>
      )}
      {error && (
        <div className="form-error mb-5" role="alert">
          {error}
          <Button variant="ghost" onClick={() => setError("")}>
            {t.dismiss}
          </Button>
        </div>
      )}
      {view === "home" && (
        <>
          <Card className="mb-5">
            <p className="eyebrow mb-2">
              {locale === "ar"
                ? "رسالة اليوم"
                : "Today's note"}
            </p>

            <p className="text-lg font-semibold leading-8">
              {dailyMotivation(today, locale)}
            </p>
          </Card>

          <div className="mb-8 flex flex-wrap gap-2" aria-label={t.quick}>
            <Button onClick={() => setEditor({ entity: "tasks" })}>
              + {t.addTask}
            </Button>
            <Button variant="ghost" onClick={() => plan()}>
              {t.newSession}
            </Button>
            <ButtonLink variant="ghost" href="/app/subjects">
              {t.manageSubjects}
            </ButtonLink>
            <ButtonLink
              variant="ghost"
              href="/app/schedule"
            >
              {locale === "ar"
                ? "مواعيد الدروس"
                : "Lessons schedule"}
            </ButtonLink>
          </div>
          <div className="home-grid">
            <Card className="home-tasks">
              <div className="section-heading">
                <h2>{t.todayTasks}</h2>
                <ButtonLink href="/app/tasks" variant="ghost">
                  {t.viewAll}
                </ButtonLink>
              </div>
              {todayTasks.length ? (
                taskRows(todayTasks)
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true" className="empty-symbol">
                    ✓
                  </span>
                  <p>{t.clearToday}</p>
                </div>
              )}
            </Card>
            <Card>
              <h2 className="mb-5 text-lg font-semibold">{t.nextSession}</h2>
              {next ? (
                <>
                  <p className="muted mb-3 text-sm">
                    {formatDay(dayInZone(next.starts, zone), locale)}
                  </p>
                  {sessionCard(next)}
                </>
              ) : (
                <p className="muted py-6">{t.nothingPlanned}</p>
              )}
              <Button className="mt-5" variant="ghost" onClick={() => plan()}>
                {t.plan} →
              </Button>
            </Card>
            <Card className="home-subjects">
              <div className="section-heading">
                <h2>{t.subjects}</h2>
                <ButtonLink href="/app/subjects" variant="ghost">
                  {t.viewAll}
                </ButtonLink>
              </div>
              <div className="flex flex-wrap gap-3 pt-3">
                {active.slice(0, 6).map((s) => (
                  <span key={s.id} className="subject-chip">
                    <i
                      className="subject-dot"
                      style={{ background: s.color }}
                    />
                    {subjectLabel(p2, s.name)}
                  </span>
                ))}
                {!active.length && <p className="muted">{t.noSubjects}</p>}
              </div>
            </Card>
          </div>
        </>
      )}
      {view === "subjects" && (
        <>
          <div className="mb-6 flex gap-2">
            {[false, true].map((value) => (
              <Button
                key={String(value)}
                variant="ghost"
                className="filter-button"
                aria-pressed={archived === value}
                onClick={() => setArchived(value)}
              >
                {value ? t.archived : t.active}
              </Button>
            ))}
          </div>
          <div className="subject-list">
            {data.subjects
              .filter((s) => Boolean(s.archived_at) === archived)
              .map((s) => (
                <div className="subject-row" key={s.id}>
                  <div className="flex items-center gap-3">
                    <span
                      className="subject-swatch"
                      style={{ background: s.color }}
                    />
                    <h2 className="min-w-0 break-words text-xl font-semibold">
                      {subjectLabel(p2, s.name)}
                    </h2>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {archived ? (
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          const f = new FormData();
                          f.set("entity", "subjects");
                          f.set("action", "restore");
                          f.set("id", s.id);
                          run(f);
                        }}
                      >
                        {t.restore}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setEditor({ entity: "subjects", row: s })
                          }
                          aria-label={`${t.edit}: ${s.name}`}
                        >
                          {t.edit}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setDeleting({
                              entity: "subjects",
                              id: s.id,
                              weekly: false,
                            })
                          }
                          aria-label={`${t.remove}: ${s.name}`}
                        >
                          {t.remove}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
          {!data.subjects.some((s) => Boolean(s.archived_at) === archived) && (
            <div className="surface empty-state">
              <p>{archived ? t.noArchived : t.noSubjects}</p>
            </div>
          )}
        </>
      )}
      {view === "tasks" && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {day === today ? t.todayTasks : formatDay(day, locale, { dateStyle: "full" })}
              </h2>
              {day === today && <p className="muted mt-2 text-sm">
                {formatDay(day, locale, { weekday: "long", month: "long", day: "numeric" })}
              </p>}
              {day !== today && <ButtonLink href="/app/tasks" variant="ghost">
                {t.backToday}
              </ButtonLink>}
            </div>

            <span className="muted text-sm">
              {number(filtered.length)} {t.tasks}
            </span>
          </div>

          <div className="task-toolbar">
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="sr-only"
                htmlFor="subject-filter"
              >
                {t.subject}
              </label>

              <select
                id="subject-filter"
                className="field"
                value={subjectFilter}
                onChange={(e) =>
                  setSubjectFilter(
                    e.target.value,
                  )
                }
              >
                <option value="">
                  {t.allSubjects}
                </option>

                {data.subjects.map((s) => (
                  <option
                    value={s.id}
                    key={s.id}
                  >
                    {subjectLabel(p2, s.name)}

                    {s.archived_at
                      ? ` (${t.archived})`
                      : ""}
                  </option>
                ))}
              </select>

              <label
                className="sr-only"
                htmlFor="priority-filter"
              >
                {t.priority}
              </label>

              <select
                id="priority-filter"
                className="field"
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value,
                  )
                }
              >
                <option value="">
                  {t.allPriorities}
                </option>

                {(
                  [
                    "low",
                    "medium",
                    "high",
                  ] as const
                ).map((p) => (
                  <option
                    value={p}
                    key={p}
                  >
                    {t[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="surface overflow-hidden">
            {filtered.length ? (
              taskRows(filtered)
            ) : (
              <div className="empty-state">
                <h2>
                  {subjectFilter || priority
                    ? locale === "ar" ? "لا توجد مهام تطابق هذه التصفية" : "No tasks match these filters"
                    : day === today ? t.noToday : t.noDay}
                </h2>

                <p className="muted">
                  {subjectFilter || priority
                    ? locale === "ar" ? "جرّب مادة أو أولوية أخرى." : "Try another subject or priority."
                    : t.addDayHint}
                </p>

                {(subjectFilter || priority) ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPriority("");
                      setSubjectFilter("");
                    }}
                  >
                    {t.resetFilters}
                  </Button>
                ) : (
                  <Button onClick={() => setEditor({ entity: "tasks", day })}>
                    + {t.newTask}
                  </Button>
                )}
              </div>
            )}
          </div>

        </>
      )}

      {view === "planner" && (
        <>
          <div className="date-toolbar">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  router.push(`/app/planner?date=${dateAdd(currentWeek, -7)}`);
                }}
                aria-label={t.previous}
              >
                ‹
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.push(`/app/planner?date=${dateAdd(currentWeek, 7)}`);
                }}
                aria-label={t.next}
              >
                ›
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.push("/app/planner");
                  setSelected(today);
                }}
              >
                {t.thisWeek}
              </Button>
            </div>
            <h2 className="font-semibold">
              {formatRange(currentWeek, dateAdd(currentWeek, 6), locale)}
            </h2>
          </div>
          <div className="planner-day-tabs" aria-label={t.selectDay}>
            {Array.from({ length: 7 }, (_, i) => dateAdd(currentWeek, i)).map(
              (d) => (
                <button
                  key={d}
                  className="filter-button"
                  aria-pressed={day === d}
                  onClick={() => setSelected(d)}
                >
                  {formatDay(d, locale, { weekday: "short", day: "numeric" })}
                </button>
              ),
            )}
          </div>
          <div className="week-grid">
            {Array.from({ length: 7 }, (_, i) => dateAdd(currentWeek, i)).map(
              (d) => (
                <section
                  className={`week-day ${day === d || ((day < currentWeek || day > dateAdd(currentWeek, 6)) && d === currentWeek) ? "is-selected" : ""}`}
                  key={d}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2>
                      <button type="button" onClick={() => setSelected(d)}
                        aria-pressed={day === d} aria-label={formatDay(d, locale, { dateStyle: "full" })}>
                      <span className="muted block text-xs">
                        {formatDay(d, locale, { weekday: "long" })}
                      </span>
                      <span
                        className={`mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold ${d === today ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : ""}`}
                      >
                        {number(Number(d.slice(-2)))}
                      </span>
                      </button>
                    </h2>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setEditor({
                            entity: "tasks",
                            day: d,
                          })
                        }
                        aria-label={`${t.newTask}: ${formatDay(
                          d,
                          locale,
                        )}`}
                      >
                        + {t.tasks}
                      </Button>
                      <ButtonLink href={`/app/tasks?date=${d}`} variant="ghost">
                        {t.viewDay}
                      </ButtonLink>

                      <Button
                        variant="ghost"
                        onClick={() =>
                          plan(d)
                        }
                        aria-label={`${t.plan}: ${formatDay(
                          d,
                          locale,
                        )}`}
                      >
                        + {t.planned}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-5">
                    <div>
                      <p className="muted mb-3 text-xs font-semibold">
                        {t.tasks}
                      </p>

                      {plannerTaskRows(
                        data.tasks.filter(
                          (task) =>
                            taskDay(
                              task,
                              zone,
                            ) === d,
                        ),
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <p className="muted mb-3 text-xs font-semibold">
                        {t.planned}
                      </p>

                      {sessionList(
                        weekly.filter(
                          (o) =>
                            dayInZone(
                              o.starts,
                              zone,
                            ) === d,
                        ),
                      )}
                    </div>
                  </div>
                </section>
              ),
            )}
          </div>
          <p className="muted mt-5 text-xs leading-6">
            {t.timeZoneHelp} ({zone})
          </p>
        </>
      )}
      {view === "calendar" && (
        <>
          <div className="date-toolbar">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                aria-label={t.previous}
                onClick={() => {
                  const m = monthMove(currentMonth, -1);
                  router.push(`/app/calendar?date=${m}`);
                }}
              >
                ‹
              </Button>
              <Button
                variant="ghost"
                aria-label={t.next}
                onClick={() => {
                  const m = monthMove(currentMonth, 1);
                  router.push(`/app/calendar?date=${m}`);
                }}
              >
                ›
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.push("/app/calendar");
                  setSelected(today);
                }}
              >
                {t.thisMonth}
              </Button>
            </div>
            <h2 className="text-xl font-semibold">
              {formatDay(currentMonth, locale, {
                year: "numeric",
                month: "long",
              })}
            </h2>
          </div>
          <div className="calendar-layout">
            <div className="surface p-3 sm:p-5">
              <div className="month-grid mb-2">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="muted py-2 text-center text-xs">
                    {formatDay(dateAdd(calendarStart, i), locale, {
                      weekday: "short",
                    })}
                  </span>
                ))}
              </div>
              <div className="month-grid">
                {Array.from({ length: 42 }, (_, i) =>
                  dateAdd(calendarStart, i),
                ).map((d) => {
                  const tasks = data.tasks.filter(
                      (x) => taskDay(x, zone) === d,
                    ).length,
                    blocks = calendarBlocks.filter(
                      (x) => dayInZone(x.starts, zone) === d,
                    ).length;
                  return (
                    <button
                      key={d}
                      className={`month-cell ${d.slice(0, 7) !== currentMonth.slice(0, 7) ? "outside-month" : ""}`}
                      aria-pressed={day === d}
                      aria-current={d === today ? "date" : undefined}
                      aria-label={`${formatDay(d, locale, { dateStyle: "full" })}: ${number(tasks)} ${t.tasks}, ${number(blocks)} ${t.planned}`}
                      onClick={() => setSelected(d)}
                    >
                      <span>{number(Number(d.slice(-2)))}</span>
                      <span
                        className="flex min-h-3 justify-center gap-1"
                        aria-hidden="true"
                      >
                        {tasks > 0 && <i className="calendar-dot task-dot" />}
                        {blocks > 0 && <i className="calendar-dot block-dot" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="muted mt-5 flex flex-wrap gap-5 text-xs">
                <span className="inline-flex items-center gap-2">
                  <i className="calendar-dot task-dot" />
                  {t.calendarTasks}
                </span>
                <span className="inline-flex items-center gap-2">
                  <i className="calendar-dot block-dot" />
                  {t.calendarBlocks}
                </span>
              </div>
            </div>
            <Card>
              <h2 className="mb-6 text-lg font-semibold">
                {formatDay(day, locale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <h3 className="mb-3 font-semibold">{t.tasksDue}</h3>
              {selectedTasks.length ? (
                taskRows(selectedTasks)
              ) : (
                <p className="muted mb-7 text-sm">{t.noMatches}</p>
              )}
              <h3 className="mb-3 mt-7 font-semibold">{t.planned}</h3>
              {sessionList(selectedBlocks)}
              <Button
                variant="ghost"
                className="mt-5"
                onClick={() => plan(day)}
              >
                + {t.plan}
              </Button>
            </Card>
          </div>
        </>
      )}
      {view === "settings" && (
        <div className="grid max-w-3xl gap-5">
          <StudySettings settings={data.settings}/>
          <Card>
            <h2 className="mb-5 text-lg font-semibold">{t.profile}</h2>
            <form
              className="grid gap-5"
              key={data.settings.updated_at + data.profile.updated_at}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                f.set("entity", "settings");
                f.set("action", "save");
                run(f);
              }}
            >
              <Field
                label={t.name}
                name="name"
                required
                maxLength={80}
                defaultValue={data.profile.display_name || ""}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="muted text-sm">{t.education}</p>
                  <p className="mt-2">
                    {data.profile.school_year
                      ? p2[data.profile.school_year]
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="muted text-sm">{t.goal}</p>
                  <p className="mt-2">
                    {number(data.profile.daily_goal_minutes || 0)} {t.minutes}
                  </p>
                </div>
              </div>
              <h3 className="border-t pt-5 font-semibold">{t.appearance}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  {t.language}
                  <select
                    className="field"
                    name="locale"
                    defaultValue={data.settings.locale}
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  {t.appearance}
                  <select
                    className="field"
                    name="theme"
                    defaultValue={data.settings.theme}
                  >
                    {(["light", "dark", "system"] as const).map((k) => (
                      <option key={k} value={k}>
                        {t[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                {t.accent}
                <select
                  className="field"
                  name="accent"
                  defaultValue={data.settings.accent}
                >
                  {(["violet", "blue", "green", "orange"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t[k]}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={pending}>
                {pending ? t.saving : t.save}
              </Button>
            </form>
          </Card>
          <div>
            <LogoutButton />
          </div>
        </div>
      )}
      {editor && (
        <Editor
          key={editor.entity + (editor.row?.id || "new")}
          editor={editor}
          subjects={data.subjects}
          t={t}
          zone={zone}
          today={today}
          onClose={() => setEditor(null)}
          onSaved={success}
          onDelete={() => {
            if (editor.row) {
              setDeleting({
                entity: editor.entity,
                id: editor.row.id,
                weekly:
                  editor.entity === "study_blocks" && editor.row.repeat_weekly,
              });
              setEditor(null);
            }
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          {...deleting}
          t={t}
          onClose={() => setDeleting(null)}
          onSaved={success}
        />
      )}
    </main>
  );
}
