"use client";
import { lazy, Suspense, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { aiPlannerCopy } from "@/features/i18n/ai-planner";
import type { Subject } from "@/features/planning/logic";
import styles from "./planner.module.css";

const PlannerDialog = lazy(() => import("./planner-dialog"));
export function AiPlannerLauncher({ subjects, weekStart, zone }: { subjects: Subject[] | null; weekStart: string; zone: string }) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const copy = aiPlannerCopy[locale];
  return <>
    <button type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className={styles.sparkle} aria-hidden="true">✦</span>
      <span><strong>{copy.cta}</strong><small>{copy.ctaHint}</small></span>
      <span className={styles.arrow} aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
    </button>
    {open && <Suspense fallback={null}><PlannerDialog subjects={(subjects ?? []).filter(x => !x.archived_at)} weekStart={weekStart} zone={zone} onClose={() => setOpen(false)} /></Suspense>}
  </>;
}
