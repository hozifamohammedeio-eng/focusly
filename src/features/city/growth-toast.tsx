"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { CITY_GROWTH_STORAGE_KEY, type CityGrowth } from "./receipt";

export function CityGrowthToast({ growth, onDismiss, suppressAnnouncement = false }: { growth: CityGrowth | null; onDismiss: () => void; suppressAnnouncement?: boolean }) {
  const { locale } = useLocale();
  useEffect(() => {
    if (!growth) return;
    try { window.sessionStorage.setItem(CITY_GROWTH_STORAGE_KEY, JSON.stringify({ at: Date.now(), growth })); } catch { /* Optional browser storage. */ }
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [growth, onDismiss]);
  if (!growth || growth.source === "challenge" || suppressAnnouncement) return null;
  const ar = locale === "ar";
  return <div className="study-toast mb-5 flex items-center justify-between gap-3" role="status" aria-live="polite">
    <div><p className="font-semibold">{ar ? "مدينتك كبرت بفضل مذاكرتك" : "Your study helped your city grow"}</p>
      <Link href="/app/city" className="mt-1 inline-block text-sm underline underline-offset-4">{ar ? "شاهد مدينتك" : "See your city"}</Link></div>
    <button type="button" className="min-h-11 shrink-0 px-2 font-semibold" onClick={onDismiss} aria-label={ar ? "إغلاق الإشعار" : "Dismiss notification"}>×</button>
  </div>;
}
