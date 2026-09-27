"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { buildings } from "./city-buildings";
import styles from "./city.module.css";

function BuildingShape({ kind }: { kind: (typeof buildings)[number]["id"] }) {
  const tower = kind === "focus";
  return (
    <svg viewBox="0 0 120 112" aria-hidden="true" className={styles.buildingShape}>
      <ellipse cx="60" cy="99" rx="49" ry="10" fill="currentColor" opacity=".08" />
      <path d="M12 85 60 64l48 21-48 22Z" fill="var(--surface-subtle)" stroke="currentColor" strokeOpacity=".25" />
      <path d={tower ? "M39 31 64 21v66L39 98Z" : "M25 54 61 39v48L25 101Z"} fill="var(--surface)" stroke="currentColor" strokeOpacity=".4" />
      <path d={tower ? "M64 21 86 31v67L64 87Z" : "M61 39 96 54v47L61 87Z"} fill="currentColor" opacity=".17" />
      <path d={tower ? "M39 31 64 20l22 11-22 11Z" : "M25 54 61 38l35 16-35 16Z"} fill="var(--surface-subtle)" stroke="currentColor" strokeOpacity=".5" />
      {kind === "knowledge" && <path d="M43 42V30a18 18 0 0 1 36 0v12l-18 8Z" fill="var(--surface)" stroke="currentColor" />}
      {tower && <><path d="M64 21V8" stroke="currentColor" strokeWidth="2" /><circle cx="64" cy="8" r="3" fill="currentColor" /></>}
      {kind === "science" && <path d="M68 34V18h10v21" fill="var(--surface)" stroke="currentColor" strokeWidth="3" />}
      {kind === "language" && <path d="M59 38V17l20 8-20 8" fill="currentColor" fillOpacity=".2" stroke="currentColor" />}
      {kind === "planner" && <circle cx="61" cy="51" r="7" fill="var(--surface)" stroke="currentColor" />}
      <path d={tower ? "M45 48l10-4m-10 16 10-4m-10 16 10-4m-10 16 10-4" : "M33 70l9-4m-9 17 9-4m7-17 7-3m-7 17 7-3"} stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      {kind === "library" && <path d="M73 68v19m9-15v19m8-15v19" stroke="currentColor" strokeWidth="3" opacity=".4" />}
    </svg>
  );
}

export function CityExperience() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [selected, setSelected] = useState<(typeof buildings)[number]>(buildings[0]);
  const name = ar ? selected.ar : selected.en;
  return (
    <main id="main" className={`study-main ${styles.city}`} dir={ar ? "rtl" : "ltr"}>
      <header className={styles.header}>
        <div><p className="eyebrow">{ar ? "مدينة Focusly" : "Focusly City"}</p>
          <h1>{ar ? "معرفتك تبني مدينتك." : "Your knowledge builds your city."}</h1>
          <p className="muted">{ar ? "استكشف معالم مدينتك المستقبلية. اختر مبنى لتتعرف على دوره." : "Explore your future city. Select a building to discover its role."}</p>
        </div>
        <span className={styles.badge}>{ar ? "مرحلة التأسيس" : "Foundation phase"}</span>
      </header>

      <dl className={styles.metrics}>
        {(ar ? ["المستوى", "XP", "العملات", "نقاط البناء"] : ["Level", "XP", "Coins", "Construction Points"]).map(label => (
          <div key={label}><dt><bdi>{label}</bdi></dt><dd>—<span>{ar ? "غير متصل بعد" : "Not connected yet"}</span></dd></div>
        ))}
      </dl>

      <div className={styles.workspace}>
        <section className={styles.mapPanel} aria-labelledby="city-map-title">
          <div className={styles.mapHeader}><h2 id="city-map-title">{ar ? "خريطة المدينة" : "City map"}</h2><span>{ar ? "تصوّر أولي" : "Concept map"}</span></div>
          <p className={styles.hint}>{ar ? "كل معلم يبدأ بخطوة في رحلتك التعليمية." : "Every landmark begins with a step in your learning journey."}</p>
          <div className={styles.map}>
            <svg className={styles.roads} viewBox="0 0 600 580" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="300" cy="285" rx="255" ry="250" className={styles.terrain} />
              <path d="M150 110Q300 15 450 110M150 110 300 270 450 110M300 270 120 400 300 500 480 400 300 270M120 400Q10 250 150 110M480 400Q590 250 450 110M300 270V500" className={styles.road} />
              <path d="M150 110 300 270 450 110M300 270 120 400 300 500 480 400 300 270" className={styles.roadLine} />
              {[ [90,240], [505,240], [225,370], [385,380], [340,90], [235,485] ].map(([x,y], i) => <g key={i}><ellipse cx={x} cy={y} rx="13" ry="7" fill="var(--accent)" opacity=".09" /><circle cx={x} cy={(y ?? 0)-8} r="8" fill="var(--accent)" opacity=".15" /></g>)}
            </svg>
            {buildings.map(building => {
              const active = selected.id === building.id;
              return <button key={building.id} type="button" className={styles.building} dir={ar ? "rtl" : "ltr"}
                style={{ "--x": `${building.x}%`, "--y": `${building.y}%` } as CSSProperties}
                aria-pressed={active} aria-controls="city-building-details"
                onClick={() => setSelected(building)}>
                <BuildingShape kind={building.id} />
                <span className={styles.buildingName}>{ar ? building.ar : building.en}</span>
                <span className={styles.selection}>{active ? (ar ? "✓ تم الاختيار" : "✓ Selected") : (ar ? "استكشف" : "Explore")}</span>
              </button>;
            })}
          </div>
          <p className={styles.mapFoot}>{ar ? "المباني المعروضة تصوّر للمستقبل، ولم تُبنَ بعد." : "These buildings represent the future city. None are built yet."}</p>
        </section>

        <aside id="city-building-details" className={styles.details} aria-label={ar ? "تفاصيل المبنى" : "Building details"}>
          <div aria-live="polite" aria-atomic="true">
            <div className={styles.detailArt}><BuildingShape kind={selected.id} /></div>
            <p className="eyebrow">{ar ? "المعلم المختار" : "Selected landmark"}</p>
            <h2>{name}</h2>
            <p className="muted">{ar ? selected.roleAr : selected.roleEn}</p>
            <span className={styles.status}>{ar ? "لم يُبنَ بعد · مرحلة التأسيس" : "Not built yet · Foundation phase"}</span>
            <div className={styles.growth}><h3>{ar ? "كيف سينمو؟" : "What will help it grow?"}</h3>
              <p>{ar ? selected.growthAr : selected.growthEn}</p></div>
            <p className={styles.note}>{ar ? "يمكنك استكشاف المخطط الآن. البناء والترقيات وحفظ المدينة غير متاحة بعد." : "You can explore the layout now. Building, upgrades, and saved city progress are not available yet."}</p>
          </div>
          <Link href="/app/focus" className={styles.action}>{ar ? "ابدأ جلسة تركيز" : "Start a Focus session"} <span aria-hidden="true">{ar ? "←" : "→"}</span></Link>
          <Link href="/app/subjects" className={styles.secondary}>{ar ? "عرض المواد" : "View subjects"}</Link>
        </aside>
      </div>
    </main>
  );
}
