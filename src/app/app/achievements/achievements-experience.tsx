"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useLocale } from "@/features/i18n/locale-provider";
import { achievementCopy } from "@/features/i18n/achievements";
import { NEW_ACHIEVEMENTS_KEY, recentAchievementKeys } from "@/features/progression/achievement-receipt";
import { almostThere, recentlyUnlocked, confirmedNewlyUnlockedKeys, type AchievementState, type AchievementView } from "@/features/progression/achievement-view";
import type { AchievementKey } from "@/features/progression/achievements";
import styles from "./achievements.module.css";

type Filter = "all" | AchievementState;
type Category = AchievementView["definition"]["category"];

function Badge({ category, state, newUnlock = false }: { category: Category; state: AchievementState; newUnlock?: boolean }) {
  return <span className={`${styles.badge} ${styles[category]} ${styles[state]} ${newUnlock ? styles.newBadge : ""}`} aria-hidden="true">
    <svg viewBox="0 0 72 72" fill="none">
      <path d="M36 4 58 13l9 23-9 23-22 9-22-9L5 36l9-23L36 4Z" className={styles.badgeOuter} />
      <circle cx="36" cy="36" r="22" className={styles.badgeInner} />
      {category === "focus" && <><circle cx="36" cy="36" r="11" /><circle cx="36" cy="36" r="3" /><path d="M36 17v8m0 22v8M17 36h8m22 0h8" /></>}
      {category === "tasks" && <><path d="M25 23h22v27H25zM30 31l3 3 5-6M30 42l3 3 5-6M40 32h4m-4 11h4" /></>}
      {category === "progression" && <><path d="M25 48V35l11-14 11 14v13H25Z" /><path d="M36 27v21M30 35h12" /></>}
      {category === "mastery" && <><path d="M36 48c-5-3-10-4-15-3V24c6-1 11 0 15 3 4-3 9-4 15-3v21c-5-1-10 0-15 3Zm0-21v21" /></>}
    </svg>
  </span>;
}

export function AchievementsExperience({ views }: { views: readonly AchievementView[] | null }) {
  const { locale } = useLocale();
  const t = achievementCopy[locale];
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedKey, setSelectedKey] = useState<AchievementKey | null>(null);
  const [newKeys, setNewKeys] = useState<AchievementKey[]>([]);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(NEW_ACHIEVEMENTS_KEY);
      window.sessionStorage.removeItem(NEW_ACHIEVEMENTS_KEY);
    } catch { /* Optional one-time visual hint. */ }
    const keys = confirmedNewlyUnlockedKeys(views ?? [], recentAchievementKeys(raw, Date.now()));
    if (!keys.length) return;
    const show = window.setTimeout(() => setNewKeys(keys), 0);
    const settle = window.setTimeout(() => setNewKeys([]), 6000);
    return () => { window.clearTimeout(show); window.clearTimeout(settle); };
  }, [views]);

  const unlockedCount = views?.filter((view) => view.unlockedAt).length ?? 0;
  const near = views ? almostThere(views) : [];
  const recent = views ? recentlyUnlocked(views) : [];
  const visible = useMemo(() => (views ?? []).filter((view) => filter === "all" || view.state === filter)
    .sort((a, b) => {
      const rank = (view: AchievementView) => newKeys.includes(view.definition.key) && view.unlockedAt ? 0
        : view.state === "in_progress" ? 1 : view.state === "locked" ? 2 : 3;
      return rank(a) - rank(b) || (rank(a) === 1 ? b.percent - a.percent : 0) ||
        a.definition.key.localeCompare(b.definition.key);
    }), [views, filter, newKeys]);
  const selected = views?.find((view) => view.definition.key === selectedKey);
  const displayProgress = (view: AchievementView) => `${number(Math.min(view.progress, view.target))} / ${number(view.target)} ${t.entries[view.definition.key].unit}`;
  const status = (view: AchievementView) => newKeys.includes(view.definition.key) && view.unlockedAt
    ? t.newlyUnlocked : t[view.state === "in_progress" ? "inProgress" : view.state];

  return <main id="main" className={`study-main ${styles.page}`} dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <p className="eyebrow">FOCUSLY ACHIEVEMENTS</p>
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
    </header>

    {!views ? <p role="status" className={styles.notice}>{t.unavailable}</p> : <>
      <section className={styles.summary} aria-label={t.progress}>
        <div><strong><bdi dir="ltr">{number(unlockedCount)} / {number(views.length)}</bdi></strong><span>{t.unlocked}</span></div>
        <div><strong><bdi dir="ltr">{number(Math.round(unlockedCount / views.length * 100))}%</bdi></strong><span>{t.completed}</span></div>
        <div className={styles.track} role="progressbar" aria-label={t.progress} aria-valuenow={unlockedCount} aria-valuemin={0} aria-valuemax={views.length}><i style={{ width: `${unlockedCount / views.length * 100}%` }} /></div>
      </section>
      {unlockedCount === 0 && <p className={styles.notice}>{t.starting}</p>}
      {unlockedCount === views.length && <p className={styles.notice}>{t.allDone}</p>}

      {near.length > 0 && <section className={styles.feature} aria-labelledby="achievements-almost-title">
        <h2 id="achievements-almost-title">{t.almost}</h2>
        <div className={styles.featureList}>{near.map((view) => <button key={view.definition.key} type="button" onClick={() => setSelectedKey(view.definition.key)}>
          <span>{t.entries[view.definition.key].name}</span><strong><bdi dir="ltr">{number(view.percent)}%</bdi></strong>
          <span className={styles.smallTrack}><i style={{ width: `${view.percent}%` }} /></span>
        </button>)}</div>
      </section>}

      {recent.length > 0 && <section className={styles.recent} aria-labelledby="achievements-recent-title">
        <h2 id="achievements-recent-title">{t.recent}</h2>
        <div>{recent.map((view) => <button key={view.definition.key} type="button" onClick={() => setSelectedKey(view.definition.key)}>
          <Badge category={view.definition.category} state="unlocked" newUnlock={newKeys.includes(view.definition.key)} />
          <span>{t.entries[view.definition.key].name}<small><time dateTime={view.unlockedAt!}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(view.unlockedAt!))}</time></small></span>
        </button>)}</div>
      </section>}

      <section aria-labelledby="achievements-collection-title">
        <div className={styles.collectionHeader}><h2 id="achievements-collection-title">{t.collection}</h2><p>{t.automatic}</p></div>
        <div className={styles.filters} role="group" aria-label={t.collection}>
          {(["all", "unlocked", "in_progress", "locked"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? t.all : item === "in_progress" ? t.inProgress : t[item]}</button>)}
        </div>
        <div className={styles.grid}>{visible.map((view) => {
          const entry = t.entries[view.definition.key];
          const isNew = newKeys.includes(view.definition.key) && !!view.unlockedAt;
          return <button key={view.definition.key} type="button" className={styles.card} data-state={isNew ? "new" : view.state}
            onClick={() => setSelectedKey(view.definition.key)} aria-label={`${entry.name}, ${status(view)}, ${displayProgress(view)}`}>
            <div className={styles.cardTop}><Badge category={view.definition.category} state={view.state} newUnlock={isNew} /><span className={styles.category}>{t.categories[view.definition.category]}</span></div>
            <span className={styles.cardName}>{entry.name}</span><span className={styles.description}>{entry.description}</span>
            <span className={styles.state}>{status(view)}</span>
            <span className={styles.progressLabel}>{t.progress}<bdi dir="ltr">{displayProgress(view)}</bdi></span>
            <span className={styles.track} role="progressbar" aria-label={`${entry.name} — ${t.progress}`} aria-valuenow={Math.min(view.progress, view.target)} aria-valuemin={0} aria-valuemax={view.target}><i style={{ width: `${view.percent}%` }} /></span>
            <span className={styles.reward}>+{number(view.definition.rewards.xp)} XP · +{number(view.definition.rewards.coins)} {t.coins}</span>
          </button>;
        })}</div>
      </section>
    </>}

    {selected && <Dialog title={t.details} closeLabel={t.close} onClose={() => setSelectedKey(null)}>
      <div className={styles.detail} dir={locale === "ar" ? "rtl" : "ltr"}>
        <Badge category={selected.definition.category} state={selected.state} newUnlock={newKeys.includes(selected.definition.key)} />
        <p className={styles.category}>{t.categories[selected.definition.category]}</p>
        <h3>{t.entries[selected.definition.key].name}</h3>
        <p>{t.entries[selected.definition.key].description}</p>
        <span className={styles.state}>{status(selected)}</span>
        <h4>{t.requirement}</h4><p>{t.entries[selected.definition.key].requirement}</p>
        <h4>{t.progress}</h4><p><bdi dir="ltr">{displayProgress(selected)}</bdi></p>
        <div className={styles.track} role="progressbar" aria-label={t.progress} aria-valuenow={Math.min(selected.progress, selected.target)} aria-valuemin={0} aria-valuemax={selected.target}><i style={{ width: `${selected.percent}%` }} /></div>
        {!selected.unlockedAt && selected.progress >= selected.target && <p>{t.reached}</p>}
        <h4>{t.reward}</h4><p>+{number(selected.definition.rewards.xp)} XP · +{number(selected.definition.rewards.coins)} {t.coins}</p>
        {selected.unlockedAt && <p>{t.earned} <time dateTime={selected.unlockedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(selected.unlockedAt))}</time></p>}
        <p className={styles.encouragement}>{t.entries[selected.definition.key].encouragement}</p>
      </div>
    </Dialog>}
  </main>;
}
