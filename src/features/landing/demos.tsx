"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import styles from "./interactions.module.css";

export function demoTimerNext(remaining: number | null) {
  return remaining === null ? null : Math.max(0, remaining - 1);
}

export function demoCityVisibleBuildings(stage: number) {
  return [2, 3, 5, 6][stage] ?? 2;
}

export function TimerDemo({ ar }: { ar: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (remaining === null || remaining === 0) return;
    const timeout = setTimeout(() => setRemaining(demoTimerNext), 1000);
    return () => clearTimeout(timeout);
  }, [remaining]);
  return <div className={styles.timer}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" /><circle className={styles.ring} cx="50" cy="50" r="44" pathLength="1" strokeDasharray="1" strokeDashoffset={remaining === null ? 0 : 1 - remaining / 8} /></svg>
    <span className={styles.digits} dir="ltr">{remaining === null ? "25:00" : `00:0${remaining}`}</span>
    <Button disabled={remaining !== null && remaining > 0} onClick={() => setRemaining(8)}>{remaining === 0 ? (ar ? "جرّب تاني" : "Try again") : (ar ? "ابدأ جلسة تركيز" : "Start Focus Session")}</Button>
    <small>{ar ? "تجربة توضيحية لمدة ٨ ثوانٍ" : "An 8-second illustrative demo"}</small>
    <span role="status" className="sr-only">{remaining === 0 ? (ar ? "انتهت التجربة" : "Demo complete") : ""}</span>
  </div>;
}

export function TaskDemo({ ar }: { ar: boolean }) {
  const [done, setDone] = useState(false);
  return <div className={styles.task}>
    <label><input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)} /><span className={done ? styles.checked : undefined}>{ar ? "مراجعة الجبر" : "Review algebra"}</span></label>
    <span role="status">{done && <span className={styles.reward}><bdi dir="ltr">+10 XP</bdi> · {ar ? "توضيحي فقط" : "demo only"}</span>}</span>
  </div>;
}

export function CityDemo({ ar }: { ar: boolean }) {
  const [stage, setStage] = useState(0);
  const visibleBuildings = demoCityVisibleBuildings(stage);
  return <div className={styles.city}>
    <svg viewBox="0 0 360 170" role="img" aria-label={ar ? "مدينة توضيحية بتكبر مع المذاكرة" : "An illustrative city growing with study"}>
      <path d="M20 145 Q180 100 340 145 L340 160 L20 160Z" fill="var(--surface-subtle)" />
      {[0,1,2,3,4,5].map((building) => <g key={building} className={styles.building} opacity={building < visibleBuildings ? 1 : .15}>
        <rect x={36 + building * 49} y={115 - building % 3 * 22 - stage * 4} width="33" height={35 + building % 3 * 22 + stage * 4} rx="6" fill={building % 2 ? "var(--accent)" : "var(--foreground)"} />
        <path d={`M${46 + building * 49} 130h13`} stroke="var(--background)" strokeWidth="4" />
      </g>)}
      {[30,180,330].map(x => <g key={x}><path d={`M${x} 148v-15`} stroke="var(--muted)" strokeWidth="3" /><circle cx={x} cy="127" r={7 + stage * 2} fill="var(--accent)" /></g>)}
    </svg>
    <div className={styles.choices} role="group" aria-label={ar ? "مراحل المدينة التوضيحية" : "Illustrative city stages"}>{[1,5,10,20].map((hours,index) => <Button key={hours} variant={stage === index ? "primary" : "ghost"} aria-pressed={stage === index} onClick={() => setStage(index)}>{hours}{ar ? "س" : "h"}</Button>)}</div>
    <p>{ar ? "توضيح بصري فقط — الساعات دي مش معادلة التقدّم الحقيقية." : "Illustration only — these hours are not the real progression formula."}</p>
  </div>;
}

/** Content is visible in the server HTML; motion is an optional, one-time enhancement. */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.IntersectionObserver || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate([{ opacity: .65, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 400, easing: "ease-out" });
      observer.unobserve(entry.target);
    }), { threshold: .12 });
    root.querySelectorAll("section[id], article").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function CompanionDemo({ ar, children }: { ar: boolean; children: ReactNode }) {
  const [played, setPlayed] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!typing) return;
    const timeout = setTimeout(() => { setTyping(false); setPlayed(true); }, 1200);
    return () => clearTimeout(timeout);
  }, [typing]);
  return <div className={styles.companion} data-played={played}>
    {children}
    <span className={styles.typing} role="status" aria-live="polite">{typing ? (ar ? "الرفيق بيكتب…" : "Companion is typing…") : played ? (ar ? "تمام ✅ هدفك اليومي بقى ٩٠ دقيقة." : "Done ✅ Your daily goal is 90 minutes.") : (ar ? "اضغط عشان تشوف رد الرفيق" : "Press to see the Companion respond")}</span>
    <p className={styles.goal} role="status">{ar ? "الهدف اليومي: " : "Daily goal: "}{played ? (ar ? "٩٠ دقيقة" : "90 minutes") : (ar ? "٣ ساعات" : "3 hours")}</p>
    <Button variant="ghost" disabled={typing} onClick={() => { setPlayed(false); setTyping(true); }}>{ar ? "جرّب التغيير التوضيحي" : "Try the illustrative change"}</Button>
  </div>;
}
