"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { cityCopy } from "@/features/i18n/city";
import type { BuildingKey } from "@/features/city/domain";
import { buildingView, citySummary, nextCityMilestone, type CityBuilding, type CityOverview } from "@/features/city/overview";
import { CITY_GROWTH_STORAGE_KEY, confirmedRecentGrowth } from "@/features/city/receipt";
import { buildings } from "./city-buildings";
import styles from "./city.module.css";

function BuildingShape({ kind, level }: { kind: BuildingKey; level: number }) {
  const tower = kind === "focus_tower";
  const tall = kind === "knowledge_center" || tower;
  const top = tall ? 20 : 39;
  return <svg viewBox="0 0 140 132" aria-hidden="true" className={styles.buildingShape}>
    <ellipse cx="70" cy="114" rx="58" ry="11" className={styles.shadow} />
    <path d="M9 102 70 75l61 27-61 26Z" className={styles.plot} />
    <path d={`M24 103V${top + 19}L70 ${top}v85Z`} className={styles.front} />
    <path d={`M70 ${top} 116 ${top + 19}v84l-46-18Z`} className={styles.side} />
    <path d={`M24 ${top + 19} 70 ${top}l46 19-46 20Z`} className={styles.roof} />
    {kind === "knowledge_center" && <path d="M49 29V19a21 21 0 0 1 42 0v10L70 38Z" className={styles.accentShape} />}
    {tower && <><path d="M70 21V4" className={styles.line} /><circle cx="70" cy="4" r="4" className={styles.accentShape} /></>}
    {kind === "science_lab" && <path d="M85 43V20h12v30" className={styles.accentShape} />}
    {kind === "language_academy" && <path d="M69 38V16l25 9-25 10" className={styles.accentShape} />}
    {kind === "planner_hall" && <circle cx="70" cy="61" r="9" className={styles.accentShape} />}
    {kind === "library_district" && <path d="M43 101V62m12 34V57m12 33V53" className={styles.line} />}
    <path d="M36 67v8m15-14v8m-15 12v8m15-14v8m36-19v8m15-3v8m-15 1v8m15-3v8" className={styles.windows} />
    {level >= 2 && <><path d="M18 100V83l13-6m82 0 10 6v19" className={styles.wing} /><path d="M57 104V88l13-6 13 6v16" className={styles.accentShape} /><path d="M21 84h10m82-1h10" className={styles.line} /></>}
    {level >= 3 && <><path d="M36 48 70 32l34 16M70 32V22" className={styles.crown} /><circle cx="70" cy="20" r="4" className={styles.accentShape} /><path d="M42 105h56M50 112h40" className={styles.crown} /></>}
  </svg>;
}

function Status({ building, overview, locale }: { building: CityBuilding; overview: CityOverview; locale: "en" | "ar" }) {
  const t = cityCopy[locale];
  const view = buildingView(building, overview);
  const label = view.state === "max" ? t.max : t[view.state];
  return <span className={`${styles.status} ${styles[view.state]}`}>{label}</span>;
}

export function CityExperience({ overview }: { overview: CityOverview | null }) {
  const { locale } = useLocale();
  const t = cityCopy[locale];
  const ar = locale === "ar";
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [selectedKey, setSelectedKey] = useState<BuildingKey>("knowledge_center");
  const [growing, setGrowing] = useState<BuildingKey[]>([]);
  useEffect(() => {
    if (!overview) return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(CITY_GROWTH_STORAGE_KEY);
      window.sessionStorage.removeItem(CITY_GROWTH_STORAGE_KEY);
    } catch { /* Optional browser storage. */ }
    const confirmed = confirmedRecentGrowth(raw, overview.activity, Date.now());
    if (!confirmed.length) return;
    const show = window.setTimeout(() => setGrowing(confirmed), 0);
    const settle = window.setTimeout(() => setGrowing([]), 900);
    return () => { window.clearTimeout(show); window.clearTimeout(settle); };
  }, [overview]);
  if (!overview) return <main id="main" className={`study-main ${styles.city}`} dir={ar ? "rtl" : "ltr"}>
    <p className="eyebrow">{t.eyebrow}</p><h1 className={styles.title}>{t.title}</h1>
    <div className={styles.unavailable} role="status">{t.unavailable}</div>
  </main>;

  const summary = citySummary(overview);
  const selected = overview.buildings.find(building => building.key === selectedKey) ?? overview.buildings[0];
  const milestone = nextCityMilestone(overview);
  const next = selected ? buildingView(selected, overview) : null;
  const milestoneView = milestone ? buildingView(milestone, overview) : null;
  return <main id="main" className={`study-main ${styles.city}`} dir={ar ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <div><p className="eyebrow">{t.eyebrow}</p><h1 className={styles.title}>{t.title}</h1><p className={styles.intro}>{t.intro}</p></div>
      <span className={styles.autoBadge}>{t.automatic}</span>
    </header>

    <dl className={styles.resources}>
      <div><dt>{t.xp}</dt><dd>{number(overview.balances.totalXp)}</dd></div>
      <div><dt>{t.coins}</dt><dd>{number(overview.balances.coins)}</dd></div>
      <div><dt>{t.points}</dt><dd>{number(overview.balances.constructionPoints)}</dd></div>
    </dl>

    <div className={styles.topline}>
      <section className={styles.summary} aria-label={t.progress}>
        <div><p className={styles.kicker}>{t.progress}</p><strong><bdi dir="ltr">{number(summary.completedLevels)} <span>/ {number(summary.totalLevels)}</span></bdi></strong></div>
        <div><span><bdi dir="ltr">{number(summary.percent)}%</bdi></span><p><bdi dir="ltr">{number(summary.built)} / {number(summary.totalBuildings)}</bdi> {t.buildings}</p></div>
        <div className={styles.progressTrack} role="progressbar" aria-label={t.progress} aria-valuenow={summary.completedLevels} aria-valuemin={0} aria-valuemax={summary.totalLevels}><i style={{ width: `${summary.percent}%` }} /></div>
      </section>
      <section className={styles.milestone} aria-label={t.next}>
        <p className={styles.kicker}>{t.next}</p>
        {milestone && milestoneView ? <><strong>{t.names[milestone.key]} · {t.level} {number(milestone.level + 1)}</strong>
          <p>{milestoneView.requirement !== null && milestoneView.progress < milestoneView.requirement
            ? `${t.metrics[milestone.metric]}: ${number(milestoneView.requirement - milestoneView.progress)} ${t.remaining}`
            : milestoneView.cost && overview.balances.coins < milestoneView.cost.coins
              ? `${t.coins}: ${number(milestoneView.cost.coins - overview.balances.coins)} ${t.remaining}`
              : milestoneView.cost && overview.balances.constructionPoints < milestoneView.cost.constructionPoints
                ? `${t.points}: ${number(milestoneView.cost.constructionPoints - overview.balances.constructionPoints)} ${t.remaining}`
                : t.ready}</p></> : <p>{t.allComplete}</p>}
      </section>
    </div>

    <div className={styles.workspace}>
      <section className={styles.mapPanel} aria-labelledby="city-map-title">
        <div className={styles.mapHeader}><div><p className={styles.kicker}>{t.progress}</p><h2 id="city-map-title">{t.map}</h2></div><p>{t.mapHint}</p></div>
        <div className={styles.map}>
          <svg className={styles.roads} viewBox="0 0 600 580" preserveAspectRatio="none" aria-hidden="true">
            <ellipse cx="300" cy="285" rx="260" ry="252" className={styles.terrain} />
            <path d="M132 110Q300 15 468 110M132 110 300 270 468 110M300 270 120 415 300 515 480 415 300 270M120 415Q10 250 132 110M480 415Q590 250 468 110M300 270V515" className={styles.road} />
            <path d="M132 110 300 270 468 110M300 270 120 415 300 515 480 415 300 270" className={styles.roadLine} />
          </svg>
          {buildings.map(position => {
            const building = overview.buildings.find(item => item.key === position.key);
            if (!building) return null;
            const view = buildingView(building, overview);
            const active = selected?.key === building.key;
            return <button key={building.key} type="button" className={`${styles.building} ${styles[`level${building.level}`]} ${growing.includes(building.key) ? styles.justGrew : ""}`} data-state={view.state} dir={ar ? "rtl" : "ltr"}
              style={{ "--x": `${position.x}%`, "--y": `${position.y}%` } as CSSProperties}
              aria-pressed={active} aria-controls="city-building-details"
              aria-label={`${t.names[building.key]}, ${building.level ? `${t.level} ${number(building.level)}` : t.locked}, ${view.state === "max" ? t.max : t[view.state]}`}
              onClick={() => setSelectedKey(building.key)}>
              <BuildingShape kind={building.key} level={building.level} />
              <span className={styles.buildingName}>{t.names[building.key]}</span>
              <span className={styles.buildingLevel}>{building.level ? `${t.level} ${number(building.level)}` : view.state === "available" ? t.available : t.locked}</span>
            </button>;
          })}
        </div>
      </section>

      {selected && next && <aside id="city-building-details" className={styles.details} aria-label={t.details}>
        <div aria-live="polite" aria-atomic="true">
          <div className={`${styles.detailArt} ${styles[`level${selected.level}`]}`}><BuildingShape kind={selected.key} level={selected.level} /></div>
          <p className={styles.kicker}>{t.details}</p><h2>{t.names[selected.key]}</h2>
          <p className={styles.description}>{t.descriptions[selected.key]}</p>
          <div className={styles.detailStatus}><strong>{selected.level ? `${t.level} ${number(selected.level)} / ${number(selected.maxLevel)}` : `${t.level} 0 / ${number(selected.maxLevel)}`}</strong><Status building={selected} overview={overview} locale={locale} /></div>
          {next.nextLevel !== null && next.requirement !== null && next.cost && <>
            <h3>{t.requirements} · {t.level} {number(next.nextLevel)}</h3>
            <div className={styles.requirement}>
              <div><span>{t.metrics[selected.metric]}</span><strong><bdi dir="ltr">{number(Math.min(next.progress, next.requirement))} / {number(next.requirement)}</bdi></strong></div>
              <div className={styles.progressTrack} role="progressbar" aria-label={t.metrics[selected.metric]} aria-valuenow={Math.min(next.progress, next.requirement)} aria-valuemin={0} aria-valuemax={next.requirement}><i style={{ width: `${Math.min(100, next.progress / next.requirement * 100)}%` }} /></div>
              <small>{next.progress >= next.requirement ? t.met : `${number(next.requirement - next.progress)} ${t.remaining}`}</small>
            </div>
            <h3>{t.cost}</h3>
            <dl className={styles.costs}>
              <div><dt>{t.coins}</dt><dd><bdi dir="ltr">{number(next.cost.coins)} / {number(overview.balances.coins)}</bdi> <small>{t.balance}</small></dd></div>
              <div><dt>{t.points}</dt><dd><bdi dir="ltr">{number(next.cost.constructionPoints)} / {number(overview.balances.constructionPoints)}</bdi> <small>{t.balance}</small></dd></div>
            </dl>
            <p className={styles.eligibility}>{next.progress >= next.requirement && next.affordable ? t.ready : t.automatic}</p>
          </>}
          {next.state === "max" && <p className={styles.eligibility}>{t.allComplete}</p>}
        </div>
        <div className={styles.links}><Link href="/app/focus">{t.focus}</Link><Link href="/app/tasks">{t.tasks}</Link><Link href="/app/subjects">{t.subjects}</Link></div>
      </aside>}
    </div>

    <section className={styles.activity} aria-labelledby="city-activity-title"><h2 id="city-activity-title">{t.activity}</h2>
      {overview.activity.length ? <ol>{overview.activity.map((event, index) => <li key={`${event.key}-${event.level}-${event.at}-${index}`}><span className={styles.activityDot} aria-hidden="true" /><span>{t.names[event.key]} {t.reached} {number(event.level)}</span><time dateTime={event.at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(event.at))}</time></li>)}</ol>
        : <p>{t.noActivity}</p>}
    </section>
  </main>;
}
