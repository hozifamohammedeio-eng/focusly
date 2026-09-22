"use client";

import { useLocale } from "@/features/i18n/locale-provider";
import { phase3 } from "@/features/i18n/phase3";
import styles from "./transition.module.css";

export default function Loading() {
  const t = phase3[useLocale().locale];

  return (
    <div className={`study-main ${styles.loading}`} role="status">
      <span className="sr-only">{t.loading}</span>

      <div aria-hidden="true">
        <div className="skeleton mb-8 h-12 w-2/3" />

        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div className="surface grid gap-5 p-6" key={i}>
              <div className="skeleton h-6 w-1/2" />
              <div className="skeleton h-14" />
              <div className="skeleton h-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}