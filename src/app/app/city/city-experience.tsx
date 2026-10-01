"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { cityCopy } from "@/features/i18n/city";
import type { BuildingKey } from "@/features/city/domain";
import { buildingView, citySummary, nextCityMilestone, type CityBuilding, type CityOverview } from "@/features/city/overview";
import { CITY_GROWTH_STORAGE_KEY, confirmedRecentGrowth } from "@/features/city/receipt";
import { buildings } from "./city-buildings";
import { CityBuildingArt } from "./city-building-art";
import styles from "./city.module.css";

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
          <svg className={styles.roads} viewBox="0 0 900 660" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.districtShadow} d="M25 231 433 43l439 190v310L450 641 25 542Z" />
            <path className={styles.districtSide} d="M25 520 450 622l422-102v23L450 645 25 543Z" />
            <path className={styles.districtGround} d="M25 215 433 44l439 189v287L450 622 25 520Z" />
            <path className={styles.districtRoad} d="M25 355h847M25 435h847M294 80v520M352 80v520M583 92v500M641 92v500" />
            <path className={styles.districtLane} d="M25 395h847M323 75v540M612 90v505" />
            <path className={styles.districtGarden} d="M52 236 251 147v154L52 339ZM668 127l180 92v117l-180-72ZM57 466l191 50v62L57 527ZM668 467l174-42v83l-174 41Z" />
            <g className={styles.districtTrees}><circle cx="72" cy="276" r="11" /><circle cx="223" cy="196" r="10" /><circle cx="714" cy="189" r="10" /><circle cx="825" cy="272" r="11" /><circle cx="85" cy="493" r="10" /><circle cx="825" cy="483" r="10" /></g>
          </svg>
          {buildings.map(position => {
            const building = overview.buildings.find(item => item.key === position.key);
            if (!building) return null;
            const view = buildingView(building, overview);
            const active = selected?.key === building.key;
            return <button key={building.key} type="button" className={`${styles.building} ${styles[`level${building.level}`]} ${growing.includes(building.key) ? styles.justGrew : ""}`} data-state={view.state} data-building={building.key} dir={ar ? "rtl" : "ltr"}
              style={{ "--x": `${position.x}%`, "--y": `${position.y}%` } as CSSProperties}
              aria-pressed={active} aria-controls="city-building-details"
              aria-label={`${t.names[building.key]}, ${t.level} ${number(building.level)}, ${view.state === "max" ? t.max : t[view.state]}`}
              onClick={() => setSelectedKey(building.key)}>
              <span className={styles.buildingArt}><CityBuildingArt kind={building.key} level={building.level} /></span>
              <span className={styles.buildingName}>{t.names[building.key]}</span>
              <span className={styles.buildingLevel}>{building.level ? `${t.level} ${number(building.level)}` : view.state === "available" ? t.available : t.locked}</span>
            </button>;
          })}
        </div>
      </section>

      {selected && next && <aside id="city-building-details" className={styles.details} aria-label={t.details}>
        <div aria-live="polite" aria-atomic="true">
          <div className={`${styles.detailArt} ${styles[`level${selected.level}`]}`}><CityBuildingArt kind={selected.key} level={selected.level} /></div>
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
