"use client";
import { useEffect, useRef } from "react";
import type { Database } from "@/types/database";
import { useCopy } from "@/features/i18n/use-copy";
import { useLocale } from "@/features/i18n/locale-provider";
import { subjectLabel } from "@/features/i18n/phase2";
import { useTheme } from "@/features/theme/theme-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { LogoutButton } from "@/features/auth/logout-button";
import { Card } from "@/components/ui/card";
type Tables = Database["public"]["Tables"];
export function StudentHome({
  profile,
  settings,
  subjects,
}: {
  profile: Tables["profiles"]["Row"];
  settings: Tables["user_settings"]["Row"];
  subjects: Tables["subjects"]["Row"][];
}) {
  const t = useCopy();
  const { locale, setLocale } = useLocale();
  const { setTheme, setAccent } = useTheme();
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    setLocale(settings.locale);
    setTheme(settings.theme);
    setAccent(settings.accent);
  }, [settings, setLocale, setTheme, setAccent]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-5xl px-5 pb-16 pt-8">
        <div className="mb-9 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow">Focusly</p>
            <h1 className="mt-4 break-words text-4xl font-semibold">
              {t.hello}, {profile.display_name}.
            </h1>
            <p className="muted mt-4 leading-7">{t.workspaceReady}</p>
          </div>
          <LogoutButton />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <h2 className="eyebrow">{t.education}</h2>
            <p className="mt-4 text-xl font-semibold">
              {profile.school_year ? t[profile.school_year] : "—"}
            </p>
            <p className="muted mt-2">
              {profile.school_stage ? t[profile.school_stage] : "—"}
            </p>
          </Card>
          <Card>
            <h2 className="eyebrow">{t.dailyGoal}</h2>
            <p className="mt-4 text-3xl font-semibold">
              {new Intl.NumberFormat(locale).format(
                profile.daily_goal_minutes ?? 0,
              )}{" "}
              <span className="text-base font-normal">{t.minutes}</span>
            </p>
          </Card>
          <Card>
            <h2 className="eyebrow">{t.subjects}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <li
                  className="rounded-xl border px-3 py-2 text-sm"
                  key={subject.id}
                >
                  {subjectLabel(t, subject.name)}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="eyebrow">{t.appearance}</h2>
            <p className="mt-4 text-xl">
              {t[settings.theme]} · {t[settings.accent]}
            </p>
          </Card>
        </div>
        <p className="muted mt-8 text-sm leading-7">{t.temporary}</p>
      </main>
    </>
  );
}
