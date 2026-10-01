"use client";

import Link from "next/link";
import { dashboardChallengePeriod, dashboardFocusWeek, dashboardTodayTasks } from "./overview";
import { formatDuration, goalProgress } from "@/features/focus/logic";
import { formatDay, formatTime } from "@/features/planning/logic";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { dashboardCopy } from "@/features/i18n/dashboard";
import { challengesCopy } from "@/features/i18n/challenges";
import { achievementCopy } from "@/features/i18n/achievements";
import type { DashboardData } from "./data";
import styles from "./dashboard.module.css";

function SectionHead({ id, title, href, label }: { id: string; title: string; href: string; label: string }) {
  return <div className={styles.sectionHead}><h2 id={id}>{title}</h2><Link href={href}>{label}<span aria-hidden="true"> ↗</span></Link></div>;
}

function Track({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className={styles.track} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
    <span style={{ width: `${Math.min(100, Math.max(0, value / max * 100))}%` }} />
  </div>;
}

export function DashboardExperience({ data }: { data: DashboardData }) {
  const { locale } = useLocale();
  const t = dashboardCopy[locale];
  const challengeText = challengesCopy[locale];
  const achievementText = achievementCopy[locale];
  const subjectText = useCopy();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const duration = (seconds: number) => seconds === 0 ? `${number(0)} ${t.minutes}` : formatDuration(seconds, locale);
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: data.zone }).format(new Date(data.now)));
  const greeting = hour < 12 ? t.morning : hour < 18 ? t.afternoon : t.evening;
  const todayTasks = data.tasks ? dashboardTodayTasks(data.tasks, data.today, data.zone) : null;
  const completedTasks = todayTasks?.filter(task => task.status === "completed").length ?? 0;
  const focus = data.progress ? dashboardFocusWeek(data.progress) : null;
  const goal = focus ? goalProgress(focus.todaySeconds, data.goal) : null;
  const daily = dashboardChallengePeriod(data.challenges, "daily");
  const weekly = dashboardChallengePeriod(data.challenges, "weekly");

  return <main id="main" className={`study-main ${styles.page}`} dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <div><p className="eyebrow">FOCUSLY · {formatDay(data.today, locale, { dateStyle: "full" })}</p>
        <h1>{greeting}{data.name ? `${locale === "ar" ? "،" : ","} ${data.name}` : ""}</h1><p>{t.intro}</p></div>
    </header>

    <div className={styles.topGrid}>
      <section className={`${styles.card} ${styles.today}`} aria-labelledby="dashboard-today">
        <div><p className={styles.kicker}>{t.today}</p><h2 id="dashboard-today">{t.todayHint}</h2></div>
        <div className={styles.metrics}>
          <div><span>{t.tasksDone}</span><strong>{todayTasks ? <bdi dir="ltr">{number(completedTasks)} / {number(todayTasks.length)}</bdi> : "—"}</strong></div>
          <div><span>{t.focusToday}</span><strong>{focus ? duration(focus.todaySeconds) : "—"}</strong></div>
          <div><span>{t.dailyChallenges}</span><strong>{daily?.available ? <bdi dir="ltr">{number(daily.completed)} / {number(daily.total)}</bdi> : "—"}</strong></div>
        </div>
        <p className={styles.softNote}>{goal ? goal.remaining === 0 ? t.goalReached
          : `${formatDuration(goal.remaining, locale)} ${t.remaining}` : t.noData}</p>
      </section>

      <section className={`${styles.card} ${styles.focus}`} aria-labelledby="dashboard-focus">
        <p className={styles.kicker}>{t.focus}</p><h2 id="dashboard-focus">{focus ? duration(focus.todaySeconds) : "—"}
          {focus && <small> / {formatDuration(data.goal * 60, locale)}</small>}</h2>
        <p>{focus ? t.focusHint : t.noData}</p>
        {focus && <><div className={styles.progressLabel}><span>{t.dailyGoal}</span><bdi dir="ltr">{number(Math.min(100, Math.round((goal?.ratio ?? 0) * 100)))}%</bdi></div>
          <Track value={focus.todaySeconds} max={data.goal * 60} label={t.dailyGoal} /></>}
        <Link className={styles.primaryAction} href="/app/focus">{data.activeFocus === "unavailable" ? t.openFocus
          : data.activeFocus === "running" || data.activeFocus === "paused" ? t.returnFocus : t.startFocus}<span aria-hidden="true">↗</span></Link>
        {focus && focus.todaySeconds === 0 && <p className={styles.supporting}>{t.focusEmpty}</p>}
      </section>
    </div>

    <div className={styles.middleGrid}>
      <section className={styles.card} aria-labelledby="dashboard-tasks">
        <SectionHead id="dashboard-tasks" title={t.tasks} href="/app/tasks" label={t.viewAll} />
        {!todayTasks ? <p role="status" className={styles.empty}>{t.tasksUnavailable}</p>
          : todayTasks.length === 0 ? <div className={styles.empty}><p>{t.tasksEmpty}</p><Link href="/app/tasks">{t.openTasks} ↗</Link></div>
          : <><ul className={styles.taskList}>{todayTasks.slice(0, 4).map(task => {
            const subject = data.subjects?.find(row => row.id === task.subject_id);
            return <li key={task.id}>
              <span className={task.status === "completed" ? styles.taskComplete : styles.taskMark} aria-hidden="true">{task.status === "completed" ? "✓" : ""}</span>
              <div><strong className={task.status === "completed" ? styles.done : undefined}>{task.title}</strong>
                <small>{subject ? subjectLabel(subjectText, subject.name) : null}
                  {task.due_at && <> · {t.due} {formatTime(task.due_at, locale, data.zone)}</>}</small></div>
              {task.status === "completed" && <span className="sr-only">{t.complete}</span>}
            </li>;
          })}</ul>{todayTasks.length > 4 && <p className={styles.more}>{number(todayTasks.length - 4)} {t.tasksMore}</p>}</>}
      </section>

      <section className={styles.card} aria-labelledby="dashboard-challenges">
        <SectionHead id="dashboard-challenges" title={t.challenges} href="/app/challenges" label={t.openChallenges} />
        <p className={styles.sectionIntro}>{t.challengesHint}</p>
        {!daily || !weekly ? <p role="status" className={styles.empty}>{t.challengesUnavailable}</p>
          : <><div className={styles.challengeRows}>{([daily, weekly] as const).map((period, index) => <div key={index}>
            <div className={styles.progressLabel}><span>{index === 0 ? t.daily : t.weekly}</span>
              <strong>{period.available ? <bdi dir="ltr">{number(period.completed)} / {number(period.total)}</bdi> : "—"}</strong></div>
            {period.percent !== null && <Track value={period.percent} max={100} label={index === 0 ? t.dailyChallenges : t.weekly} />}
            {period.next?.current && <p>{challengeText.entries[period.next.key].name} · <bdi dir="ltr">{number(period.next.current.progress)} / {number(period.next.current.target)}</bdi></p>}
          </div>)}</div>
          {daily.available && daily.completed === daily.total && <p className={styles.softNote}>{t.challengesDone}</p>}
          {!daily.available && !weekly.available && <p className={styles.softNote}>{t.challengesEmpty}</p>}</>}
      </section>
    </div>

    <div className={styles.bottomGrid}>
      <section className={styles.card} aria-labelledby="dashboard-week">
        <SectionHead id="dashboard-week" title={t.week} href="/app/statistics" label={t.openStatistics} />
        <p className={styles.sectionIntro}>{t.weekHint}</p>
        {!focus ? <p role="status" className={styles.empty}>{t.noData}</p> : <>
          <div className={styles.weekTotals}><strong>{duration(focus.weekSeconds)}</strong><span>{t.studyDays}: {number(focus.studyDays)} · {t.streak}: {number(focus.streak)} {t.days}</span></div>
          <div className={styles.weekBars} role="list" aria-label={t.week}>{focus.days.map(day => <div key={day.day} role="listitem" aria-label={`${formatDay(day.day, locale, { weekday: "long" })}: ${day.seconds ? formatDuration(day.seconds, locale) : `0 ${t.minutes}`}`}>
            <span aria-hidden="true" style={{ height: `${Math.max(day.seconds > 0 ? 8 : 3, Math.min(100, day.seconds / Math.max(3600, ...focus.days.map(item => item.seconds)) * 100))}%` }} />
            <small>{formatDay(day.day, locale, { weekday: "short" })}</small>
          </div>)}</div>
          {focus.weekSeconds === 0 && <p className={styles.softNote}>{t.weekEmpty}</p>}
        </>}
      </section>

      <section className={styles.card} aria-labelledby="dashboard-achievements">
        <SectionHead id="dashboard-achievements" title={t.achievements} href="/app/achievements" label={t.openAchievements} />
        {!data.achievements ? <p role="status" className={styles.empty}>{t.achievementsUnavailable}</p>
          : <><p className={styles.compactCount}><bdi dir="ltr">{number(data.achievements.unlocked)} / {number(data.achievements.total)}</bdi> {t.unlocked}</p>
            {data.achievements.next ? <div className={styles.milestone}><span>{t.achievementClose}</span>
              <strong>{achievementText.entries[data.achievements.next.definition.key].name}</strong>
              <div className={styles.progressLabel}><span>{achievementText.progress}</span><bdi dir="ltr">{number(data.achievements.next.progress)} / {number(data.achievements.next.target)}</bdi></div>
              <Track value={data.achievements.next.progress} max={data.achievements.next.target} label={t.achievementClose} /></div>
              : <p className={styles.empty}>{data.achievements.unlocked === data.achievements.total ? t.achievementsDone : t.achievementsEmpty}</p>}</>}
      </section>

      <section className={styles.card} aria-labelledby="dashboard-city">
        <SectionHead id="dashboard-city" title={t.city} href="/app/city" label={t.openCity} />
        <p className={styles.sectionIntro}>{t.cityHint}</p>
        {!data.city ? <p role="status" className={styles.empty}>{t.cityUnavailable}</p> : <>
          <p className={styles.cityLevel}><bdi dir="ltr">{number(data.city.completedLevels)} / {number(data.city.totalLevels)}</bdi> <span>{t.levels}</span></p>
          <Track value={data.city.completedLevels} max={data.city.totalLevels} label={t.city} />
          <p className={styles.softNote}>{data.city.completedLevels === data.city.totalLevels ? t.cityDone
            : data.city.built === 0 ? t.cityEmpty : `${number(data.city.built)} / ${number(data.city.totalBuildings)} ${t.buildings}`}</p>
        </>}
      </section>
    </div>
  </main>;
}
