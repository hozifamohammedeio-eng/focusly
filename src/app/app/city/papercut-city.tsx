"use client";

import { useEffect, useState } from "react";
import { cityCopy } from "@/features/i18n/city";
import type { papercutState } from "@/features/city/papercut";
import styles from "./papercut-city.module.css";

type Scene = NonNullable<ReturnType<typeof papercutState>>;

const stageText = {
  en: ["Foundation", "Walls", "Roof", "Completed"],
  ar: ["الأساس", "الجدران", "السقف", "مكتمل"],
} as const;

export function PapercutCity({ scene, locale, fromLevel, onSelect }: {
  scene: Scene;
  locale: "en" | "ar";
  fromLevel: number | null;
  onSelect: () => void;
}) {
  const [visibleLevel, setVisibleLevel] = useState(fromLevel ?? scene.level);
  useEffect(() => {
    if (fromLevel === null) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;
    const timer = window.setTimeout(() => setVisibleLevel(scene.level), delay);
    return () => window.clearTimeout(timer);
  }, [fromLevel, scene.level]);

  const ar = locale === "ar";
  const stage = stageText[locale][visibleLevel];
  return <section className={styles.scene} data-ambient={scene.ambient} data-revealed={fromLevel !== null && visibleLevel === scene.level} aria-labelledby="papercut-title">
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>{ar ? "النور هو التقدّم" : "LIGHT IS PROGRESS"}</p><h2 id="papercut-title">{ar ? "ذاكر، وابنِ، ونوّر مدينتك" : "Study, build, light up your city"}</h2></div>
      <p>{ar ? "برج التركيز بيتبني بمكافآت مذاكرتك المؤكدة." : "Your Focus Tower grows from confirmed study rewards."}</p>
    </div>
    <svg className={styles.art} viewBox="0 0 640 310" role="img" aria-label={`${cityCopy[locale].names.focus_tower}: ${stageText[locale][scene.level]}, ${ar ? "المستوى" : "level"} ${scene.level}`}>
      <path className={styles.sky} d="M0 0h640v310H0Z" />
      <circle className={styles.sun} cx="512" cy="68" r="37" />
      <path className={styles.hillBack} d="M0 202Q146 110 296 196T640 188v122H0Z" />
      <path className={styles.hillFront} d="M0 251Q170 204 321 254T640 232v78H0Z" />
      <path className={styles.path} d="M267 310q-12-48 54-65t71 65Z" />
      <ellipse className={styles.plaza} cx="320" cy="252" rx="128" ry="36" />
      {[84, 145, 474, 551].map((x, index) => <g key={x} className={styles.tree}><path d={`M${x} 258v-38`} /><circle cx={x} cy={216} r={index % 2 ? 14 : 18} /></g>)}
      <g className={styles.tower}>
        <path className={styles.paperShadow} d="M253 250l25-116h96l24 116Z" />
        <path className={styles.foundation} d="M250 241h140v16H250Z" />
        {visibleLevel === 0 && <g className={styles.scaffold}><path d="M270 238V143h100v95M270 162h100M270 194h100M285 143l72 95M355 143l-70 95" /></g>}
        {visibleLevel >= 1 && <>
          <path className={styles.wallSide} d="M357 238V114l26 17v107Z" />
          <path className={styles.wall} d="M276 238V126l81-12v124Z" />
          <path className={styles.arch} d="M307 238v-29a13 13 0 0 1 26 0v29" />
          {[0,1,2,3].map((index) => <path key={index} className={index < scene.litWindows ? styles.windowLit : styles.window} d={`M${287 + index % 2 * 45} ${145 + Math.floor(index / 2) * 33}v-10a7 7 0 0 1 14 0v10Z`} />)}
        </>}
        {visibleLevel >= 2 && <path className={styles.roof} d="M267 128l53-37 62 37-14 5-48-28-42 28Z" />}
        {visibleLevel >= 3 && <><path className={styles.spire} d="M320 91V65m-9 8h18" /><circle className={styles.spireDot} cx="320" cy="63" r="5" /></>}
      </g>
    </svg>
    <div className={styles.info}>
      <div><p className={styles.eyebrow}>{cityCopy[locale].names.focus_tower}</p><strong>{stage}</strong><span>{cityCopy[locale].level} <bdi dir="ltr">{scene.level} / 3</bdi></span></div>
      <div><p className={styles.eyebrow}>{ar ? "مذاكرة النهارده" : "TODAY'S FOCUS"}</p><strong><bdi dir="ltr">{scene.todayMinutes} / {scene.goalMinutes}</bdi> {ar ? "دقيقة" : "min"}</strong><span>{ar ? "من هدفك اليومي" : "of your daily goal"}</span></div>
      <div><p className={styles.eyebrow}>{ar ? "الاستمرارية" : "CONSISTENCY"}</p><strong>{scene.streak} {ar ? "يوم" : scene.streak === 1 ? "day" : "days"}</strong><span>{ar ? "نوافذ منورة من تقدمك" : "Your progress lights the windows"}</span></div>
      <button type="button" onClick={onSelect} aria-controls="city-building-details">{ar ? "تفاصيل برج التركيز" : "Focus Tower details"}</button>
    </div>
  </section>;
}
