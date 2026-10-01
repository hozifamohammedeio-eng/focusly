"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Dialog } from "@/components/ui/dialog";
import { challengeCatalog, challengeRewards, type ChallengeKey } from "@/features/challenges/catalog";
import type { ChallengeProgress } from "@/features/challenges/data";
import { challengeViews, nextChallenge, type ChallengeView } from "@/features/challenges/overview";
import { challengesCopy } from "@/features/i18n/challenges";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./challenges.module.css";

type ChallengeKind = "daily" | "weekly";

const destination: Record<ChallengeKey, string> = {
  daily_focus_25: "/app/focus",
  daily_tasks_2: "/app/tasks",
  weekly_focus_180: "/app/focus",
  weekly_subjects_2: "/app/subjects",
};

function ChallengeIcon({ keyName }: { keyName: ChallengeKey }) {
  return <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="26" className={styles.iconRing} />
    {(keyName === "daily_focus_25" || keyName === "weekly_focus_180")
      ? <><circle cx="32" cy="32" r="13" /><circle cx="32" cy="32" r="4" /><path d="M32 12v7m0 26v7M12 32h7m26 0h7" /></>
      : keyName === "daily_tasks_2"
        ? <><path d="M21 18h23v29H21zM26 27l3 3 5-6m-8 15 3 3 5-6M38 27h3m-3 12h3" /></>
        : <><path d="M32 47c-6-4-12-5-18-3V21c7-2 13-1 18 3 5-4 11-5 18-3v23c-6-2-12-1-18 3Zm0-23v23" /><path d="M21 30h5m-5 6h5m12-6h5m-5 6h5" /></>}
  </svg></span>;
}

export function ChallengesExperience({ challenges, timeZone = "UTC" }: { challenges: readonly ChallengeProgress[] | null; timeZone?: string }) {
  const { locale } = useLocale();
  const t = challengesCopy[locale];
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
  const [kind, setKind] = useState<ChallengeKind>("daily");
  const [selectedKey, setSelectedKey] = useState<ChallengeKey | null>(null);
  const views = challengeViews(challenges);
  const visible = views.filter((view) => challengeCatalog.find((entry) => entry.key === view.key)?.kind === kind);
  const active = visible.filter((view) => view.current !== null);
  const completed = active.filter((view) => view.state === "completed").length;
  const periodPercent = active.length === visible.length ? Math.round(active.reduce((sum, view) => sum + (view.percent ?? 0), 0) / visible.length) : null;
  const next = nextChallenge(views, kind);
  const selected = views.find((view) => view.key === selectedKey) ?? null;
  const reward = challengeRewards(kind);

  const progressText = (view: ChallengeView) => view.current
    ? `${number(view.current.progress)} / ${number(view.current.target)} ${t.entries[view.key].unit}` : null;
  const stateText = (view: ChallengeView) => view.state === "completed" ? t.completed
    : view.state === "pending" ? t.pending : view.state === "in_progress" ? t.inProgress
      : view.state === "unavailable" ? t.unavailable : t.inactive;

  return <main id="main" className={`study-main ${styles.page}`} dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.intro}</p></div>
      <span className={styles.autoMark}>{t.automatic}</span>
    </header>

    <section className={styles.hero} aria-label={t.periodProgress}>
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>{t.periodProgress}</p>
        <h2>{kind === "daily" ? t.dailyDescription : t.weeklyDescription}</h2>
        <p>{challenges === null ? t.unavailable : periodPercent === null ? t.inactive
          : completed === visible.length ? t.allDone : completed === 0 && periodPercent === 0 ? t.start : t.nextDescription}</p>
        {periodPercent !== null && <div className={styles.heroTrack} role="progressbar" aria-label={t.periodProgress}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={periodPercent}>
          <i style={{ width: `${periodPercent}%` }} />
        </div>}
      </div>
      <div className={styles.heroFigure} aria-hidden="true">
        <span className={styles.heroOrb} style={{ "--period-progress": `${periodPercent ?? 0}%` } as CSSProperties}>
          <strong>{periodPercent === null ? "—" : `${number(periodPercent)}%`}</strong>
          <small>{periodPercent === null ? t.unavailable : `${number(completed)} / ${number(visible.length)} ${t.completed}`}</small>
        </span>
      </div>
    </section>

    <div className={styles.tabs} role="group" aria-label={t.activeWindow}>
      {(["daily", "weekly"] as const).map((item) => <button key={item} type="button" aria-pressed={kind === item}
        onClick={() => { setKind(item); setSelectedKey(null); }}>
        <span>{item === "daily" ? t.daily : t.weekly}</span>
        <small>{item === "daily" ? t.dailyDescription : t.saturdayFriday}</small>
      </button>)}
    </div>

    {challenges === null && <p role="status" className={styles.notice}>{t.unavailable}</p>}

    <section className={styles.feature} aria-labelledby="challenge-next-title">
      <div><p className={styles.kicker}>{t.next}</p><h2 id="challenge-next-title">{next ? t.entries[next.key].name : completed === visible.length && active.length === visible.length ? t.allDone : t.noNext}</h2>
        {next && <p>{t.nextDescription} <bdi dir="ltr">{number(next.remaining ?? 0)}</bdi> {t.entries[next.key].unit}.</p>}
      </div>
      {next && <Link href={destination[next.key]} className={styles.action}>{t.goTo} {t.entries[next.key].action}<span aria-hidden="true">↗</span></Link>}
    </section>

    <section aria-labelledby="challenge-list-title">
      <div className={styles.sectionHead}>
        <div><p className={styles.kicker}>{t.activeWindow}</p><h2 id="challenge-list-title">{kind === "daily" ? t.daily : t.weekly}</h2></div>
        <span className={styles.periodNote}>{kind === "daily" ? t.dailyDescription : t.saturdayFriday}</span>
      </div>
      <div className={styles.grid}>{visible.map((view) => {
        const entry = t.entries[view.key];
        const definition = challengeCatalog.find((item) => item.key === view.key)!;
        const ownReward = challengeRewards(definition.kind);
        return <article key={view.key} className={styles.card} data-state={view.state}>
          <div className={styles.cardTop}><ChallengeIcon keyName={view.key} /><span className={styles.state}>{stateText(view)}</span></div>
          <h3>{entry.name}</h3><p className={styles.description}>{entry.description}</p>
          {view.current ? <div className={styles.progressBlock}>
            <div className={styles.progressLabel}><span>{t.progress}</span><bdi dir="ltr">{number(view.current.progress)} / {number(view.current.target)}</bdi></div>
            <div className={styles.track} role="progressbar" aria-label={`${entry.name} — ${t.progress}`}
              aria-valuemin={0} aria-valuemax={view.current.target} aria-valuenow={Math.min(view.current.progress, view.current.target)}
              aria-valuetext={view.state === "completed" ? t.completed : progressText(view) ?? undefined}>
              <i style={{ width: `${view.percent}%` }} />
            </div>
            {view.state === "pending" && <p className={styles.pending}>{t.pending}</p>}
          </div> : <p className={styles.missing}>{stateText(view)}</p>}
          <div className={styles.cardFooter}>
            <span className={styles.reward}><bdi dir="ltr">+{number(ownReward.xp)} XP · +{number(ownReward.coins)}</bdi> {t.coins}</span>
            <button type="button" onClick={() => setSelectedKey(view.key)} aria-label={`${t.open}: ${entry.name}`}>{t.open}<span aria-hidden="true">↗</span></button>
          </div>
          {view.current && <p className={styles.deadline}>{t.ends}: <time dateTime={view.current.ends_at}>{date(view.current.ends_at)}</time> <bdi dir="ltr">({timeZone})</bdi></p>}
        </article>;
      })}</div>
    </section>

    <aside className={styles.explainer}><span className={styles.explainerIcon} aria-hidden="true">✦</span><div>
      <h2>{t.automatic}</h2><p>{t.automaticDetail}</p>
      <span><bdi dir="ltr">+{number(reward.xp)} XP · +{number(reward.coins)}</bdi> {t.coins} · {kind === "daily" ? t.daily : t.weekly}</span>
    </div></aside>

    {selected && <Dialog title={t.details} closeLabel={t.close} onClose={() => setSelectedKey(null)}>
      <div className={styles.detail} dir={locale === "ar" ? "rtl" : "ltr"}>
        <ChallengeIcon keyName={selected.key} />
        <h3>{t.entries[selected.key].name}</h3><p>{t.entries[selected.key].description}</p>
        <span className={styles.state} data-state={selected.state}>{stateText(selected)}</span>
        <h4>{t.requirement}</h4><p>{t.entries[selected.key].requirement}</p>
        {selected.current && <><h4>{t.progress}</h4>
          <p><bdi dir="ltr">{progressText(selected)}</bdi></p>
          <div className={styles.track} role="progressbar" aria-label={`${t.entries[selected.key].name} — ${t.progress}`}
            aria-valuemin={0} aria-valuemax={selected.current.target} aria-valuenow={Math.min(selected.current.progress, selected.current.target)}>
            <i style={{ width: `${selected.percent}%` }} /></div>
          <h4>{t.activeWindow}</h4>
          <p>{t.starts}: <time dateTime={selected.current.starts_at}>{date(selected.current.starts_at)}</time><br />
            {t.ends}: <time dateTime={selected.current.ends_at}>{date(selected.current.ends_at)}</time> <bdi dir="ltr">({timeZone})</bdi></p>
        </>}
        {!selected.current && <p>{stateText(selected)}</p>}
        <h4>{t.reward}</h4><p><bdi dir="ltr">+{number(challengeRewards(challengeCatalog.find((item) => item.key === selected.key)!.kind).xp)} XP · +{number(challengeRewards(challengeCatalog.find((item) => item.key === selected.key)!.kind).coins)}</bdi> {t.coins}</p>
        {selected.state === "in_progress" && <Link href={destination[selected.key]} className={styles.detailAction}>{t.goTo} {t.entries[selected.key].action}<span aria-hidden="true">↗</span></Link>}
      </div>
    </Dialog>}
  </main>;
}
