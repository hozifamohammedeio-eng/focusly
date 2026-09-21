"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { phase4 } from "@/features/i18n/phase4";
import { saveStudySettings } from "./actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Database } from "@/types/database";
type Settings = Database["public"]["Tables"]["user_settings"]["Row"];
export function TimeZoneSetup({ settings }: { settings: Settings }) {
  const router = useRouter(),
    tried = useRef(false),
    [failed, setFailed] = useState(false),
    { locale } = useLocale();
  useEffect(() => {
    if (settings.time_zone || tried.current) return;
    tried.current = true;
    const f = new FormData();
    f.set("initialize", "true");
    f.set("time_zone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    void saveStudySettings(f).then((r) => {
      if (r.ok) router.refresh();
      else setFailed(true);
    });
  }, [settings.time_zone, router]);
  return failed ? (
    <p className="form-error px-6" role="status">
      {phase4[locale].zonePending}
    </p>
  ) : null;
}
export function StudySettings({ settings }: { settings: Settings }) {
  const { locale } = useLocale(),
    t = phase4[locale],
    router = useRouter(),
    [pending, start] = useTransition(),
    [result, setResult] = useState<boolean | null>(null);
  return (
    <Card>
      <h2 className="mb-5 text-lg font-semibold">{t.studySettings}</h2>
      <form
        key={settings.updated_at}
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await saveStudySettings(f);
            setResult(r.ok);
            if (r.ok) router.refresh();
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              "focus_minutes",
              "short_break_minutes",
              "long_break_minutes",
            ] as const
          ).map((k, i) => (
            <Field
              key={k}
              name={k}
              type="number"
              required
              min={i === 0 ? 5 : 1}
              max={i === 0 ? 180 : 60}
              step={1}
              label={[t.focusDefault, t.shortDefault, t.longDefault][i]!}
              hint={t.minutes}
              defaultValue={settings[k]}
            />
          ))}
        </div>
        <Field
          name="time_zone"
          required
          maxLength={100}
          label={t.zone}
          hint={t.zoneHint}
          defaultValue={settings.time_zone ?? "UTC"}
          list="study-zones"
        />
        <datalist id="study-zones">
          {[
            "Africa/Cairo",
            "Asia/Riyadh",
            "Asia/Dubai",
            "Europe/London",
            "America/New_York",
            "UTC",
          ].map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
        {result !== null && (
          <p role="status" className={result ? "muted" : "form-error"}>
            {result ? t.saved : t.settingsError}
          </p>
        )}
      </form>
    </Card>
  );
}
