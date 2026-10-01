"use client";

import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { statisticsCopy } from "@/features/i18n/statistics";
import { formatDuration, type Progress } from "@/features/focus/logic";
import { statisticsWeek, subjectShare } from "@/features/focus/statistics-view";
import { dateAdd, formatDay, formatRange, type Subject } from "@/features/planning/logic";
import styles from "./statistics.module.css";

export function StatisticsExperience({ progress, subjects }: { progress: Progress; subjects: Subject[] }) {
  const { locale } = useLocale();
  const t = statisticsCopy[locale];
  const p2 = useCopy();
  const week = statisticsWeek(progress);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const duration = (seconds: number) => seconds === 0 ? `${number(0)} ${t.minutes}` : formatDuration(seconds, locale);
  const subjectName = (id: string | null) => {
    if (id === null) return t.unassigned;
    const subject = subjects.find(item => item.id === id);
    return subject ? subjectLabel(p2, subject.name) : t.missingSubject;
  };
  const empty = progress.totalSessions === 0;
  const maxDay = Math.max(3600, ...week.days.map(day => day.seconds));

  return <div className={styles.page} dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
    </header>

    {empty ? <section className={styles.empty} aria-labelledby="statistics-empty">
      <span aria-hidden="true" className={styles.emptyMark}>↗</span>
      <h2 id="statistics-empty">{t.emptyTitle}</h2>
      <p>{t.emptyHint}</p>
      <Link className={styles.primaryLink} href="/app/focus">{t.startFocus}</Link>
    </section> : <>
      <section className={styles.summary} aria-label={t.week}>
        <div><span>{t.focusTime}</span><strong>{duration(week.seconds)}</strong></div>
        <div><span>{t.sessions}</span><strong>{number(week.sessions)}</strong></div>
        <div><span>{t.activeDays}</span><strong>{number(week.activeDays)} <small>/ {number(7)}</small></strong></div>
      </section>

      <section className={styles.weekCard} aria-labelledby="statistics-week">
        <div className={styles.sectionHead}><div><p className={styles.kicker}>{formatRange(progress.weekStart, dateAdd(progress.weekStart, 6), locale)}</p><h2 id="statistics-week">{t.week}</h2><p>{t.weekHint}</p></div>
          <div className={styles.streak}><span>{t.streak}</span><strong>{number(week.streak)} {t.days}</strong><small>{t.streakHint}</small></div></div>
        <div className={styles.chart} role="list" aria-label={t.week}>
          {week.days.map(day => <div key={day.day} className={`${styles.day} ${day.day === progress.today ? styles.currentDay : ""}`} role="listitem"
            aria-label={`${formatDay(day.day, locale, { weekday: "long" })}: ${duration(day.seconds)}${day.day === progress.today ? `, ${t.today}` : ""}`}>
            <div className={styles.barArea}><span aria-hidden="true" style={{ height: `${day.seconds ? Math.max(7, day.seconds / maxDay * 100) : 3}%` }} /></div>
            <span>{formatDay(day.day, locale, { weekday: "short" })}</span><strong>{duration(day.seconds)}</strong>
            {day.day === progress.today && <small>{t.today}</small>}
          </div>)}
        </div>
        {week.seconds === 0 && <p className={styles.weekEmpty}>{t.noWeek}</p>}
      </section>

      <div className={styles.detailsGrid}>
        <section className={styles.card} aria-labelledby="statistics-subjects"><p className={styles.kicker}>{t.allTime}</p><h2 id="statistics-subjects">{t.subjectTitle}</h2><p className={styles.sectionHint}>{t.subjectHint}</p>
          {progress.subjects.length ? <ul className={styles.subjectList}>{progress.subjects.map(row => <li key={row.subject_id ?? "unassigned"}>
            <div><strong>{subjectName(row.subject_id)}</strong><span>{duration(row.seconds)} · {number(subjectShare(row.seconds, progress.totalSeconds))}%</span></div>
            <div className={styles.track} role="progressbar" aria-label={`${subjectName(row.subject_id)} ${t.share}`} aria-valuenow={subjectShare(row.seconds, progress.totalSeconds)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${subjectShare(row.seconds, progress.totalSeconds)}%` }} /></div>
          </li>)}</ul> : <p className={styles.sectionHint}>{t.noSubjects}</p>}
        </section>

        <section className={styles.card} aria-labelledby="statistics-recent"><p className={styles.kicker}>{t.allTime}</p><h2 id="statistics-recent">{t.recent}</h2>
          <div className={styles.lifetime}><div><span>{t.allTime}</span><strong>{duration(progress.totalSeconds)}</strong></div><div><span>{t.totalSessions}</span><strong>{number(progress.totalSessions)}</strong></div></div>
          {progress.recent.length ? <ol className={styles.recentList}>{progress.recent.map(session => <li key={session.id}><div><strong>{subjectName(session.subject_id)}</strong><small>{session.ended_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: progress.zone }).format(new Date(session.ended_at)) : ""}</small></div><span>{duration(session.duration_seconds)}</span></li>)}</ol> : <p className={styles.sectionHint}>{t.noRecent}</p>}
        </section>
      </div>
    </>}

    <section className={styles.progression} aria-labelledby="statistics-progression"><p className={styles.kicker}>FOCUSLY</p><h2 id="statistics-progression">{t.progression}</h2><p>{t.progressionHint}</p>
      <dl><div><dt>{t.xp}</dt><dd>{t.xpHint}</dd></div><div><dt>{t.coins}</dt><dd>{t.coinsHint}</dd></div><div><dt>{t.points}</dt><dd>{t.pointsHint}</dd></div></dl>
      <div className={styles.links}><Link href="/app/achievements">{t.achievements} ↗</Link><Link href="/app/city">{t.city} ↗</Link></div>
    </section>
  </div>;
}
