"use client";

import { completionMessages } from "./completion";
import styles from "./completion.module.css";
import type { CityGrowth } from "@/features/city/receipt";
import { cityCopy } from "@/features/i18n/city";

export function CompletionMoment({ locale, message, xp, growth }: { locale: "ar" | "en"; message: number; xp: number | null; growth: CityGrowth | null }) {
  return <div className={styles.moment} role="status">
    <span className={styles.spark} aria-hidden="true">✦</span>
    <p>{completionMessages[locale][message % completionMessages[locale].length]}</p>
    {xp !== null && <p className={styles.xp}><bdi>+{xp} XP</bdi></p>}
    {growth && <div className={styles.city}>
      <span aria-hidden="true">🌱</span>
      <p>{locale === "ar" ? "مدينتك كبرت" : "Your city just grew"}</p>
      {growth.buildings.map(building => <p key={building.key}>{cityCopy[locale].names[building.key]} · {locale === "ar" ? "المستوى" : "Level"} {building.level}</p>)}
    </div>}
  </div>;
}
