"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LogoutButton } from "@/features/auth/logout-button";
import { mutate } from "@/features/planning/actions";
import { saveProfileSettings } from "@/features/focus/actions";
import { StudySettings } from "@/features/focus/settings";
import { formatDuration, type Progress } from "@/features/focus/logic";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { phase3 } from "@/features/i18n/phase3";
import { phase4 } from "@/features/i18n/phase4";
import { phase5 } from "@/features/i18n/phase5";
import {
  educationFrom,
  validEducation,
  suggestions,
  label,
} from "@/features/education/config";
import { EducationFields } from "@/features/education/fields";
import { useTheme } from "@/features/theme/theme-provider";
import { useInstallFocusly } from "@/features/pwa/install-provider";
import { CompanionSettings } from "@/features/study-companion/settings";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Settings = Database["public"]["Tables"]["user_settings"]["Row"];

function ProfileForm({
  profile,
  title,
  includeName = false,
}: {
  profile: Profile;
  title: string;
  includeName?: boolean;
}) {
  const { locale } = useLocale();
  const copy = useCopy();
  const t = phase5[locale];
  const router = useRouter();
  const [education, setEducation] = useState(() => educationFrom(profile));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<boolean | null>(null);
  return (
    <Card>
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          for (const [key, value] of Object.entries(education))
            form.set(key, value ?? "");
          start(async () => {
            const response = await saveProfileSettings(form);
            setResult(response.ok);
            if (response.ok) router.refresh();
          });
        }}
      >
        {includeName && (
          <Field
            label={copy.name}
            name="name"
            required
            maxLength={80}
            defaultValue={profile.display_name ?? ""}
          />
        )}
        {!includeName && (
          <input
            type="hidden"
            name="name"
            value={profile.display_name ?? "Student"}
          />
        )}
        {!validEducation(educationFrom(profile)) && (
          <p className="muted" role="status">
            {locale === "ar"
              ? "كمّل بيانات نظامك الدراسي لتحصل على اقتراحات أدق. موادك وبياناتك السابقة محفوظة."
              : "Complete your education details for accurate suggestions. Your existing subjects and history are preserved."}
          </p>
        )}
        <EducationFields value={education} onChange={setEducation} />
        {validEducation(education) && (
          <fieldset key={JSON.stringify(education)} className="grid gap-3">
            <legend className="mb-3 font-semibold">
              {locale === "ar"
                ? "المواد المقترحة لنظامك الدراسي"
                : "Suggested subjects for your education system"}
            </legend>
            <p className="muted text-sm">
              {locale === "ar"
                ? "اختَر المواد التي تريد إضافتها عند الحفظ. لن نحذف أو نغيّر أي مادة موجودة."
                : "Select subjects to add when saving. Existing subjects will not be removed or renamed."}
            </p>
            {suggestions(education).map((s) => (
              <label className="choice" key={s.id}>
                <input
                  type="checkbox"
                  name="suggested_subject"
                  value={label(s.id, "en")}
                />
                <span>{label(s.id, locale)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <Field
          label={t.dailyGoal}
          name="daily_goal_minutes"
          type="number"
          min={5}
          max={720}
          step={1}
          required
          defaultValue={profile.daily_goal_minutes ?? 120}
          hint={t.dailyGoalHint}
        />
        <Button type="submit" disabled={pending}>
          {pending ? copy.working : t.saveProfile}
        </Button>
        {result !== null && (
          <p className={result ? "muted" : "form-error"} role="status">
            {result ? t.profileSaved : t.profileError}
          </p>
        )}
      </form>
    </Card>
  );
}

function AppearanceSettings() {
  const { locale } = useLocale();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const t = phase5[locale],
    p3 = phase3[locale];
  const [pending, start] = useTransition();
  const [result, setResult] = useState<boolean | null>(null);
  const router = useRouter();
  function save(key: "theme" | "accent", value: string) {
    const previous = key === "theme" ? theme : accent;
    const preview = (next: string) =>
      key === "theme"
        ? setTheme(next as typeof theme)
        : setAccent(next as typeof accent);
    preview(value);
    setResult(null);
    const form = new FormData();
    form.set("entity", "settings");
    form.set("action", "save");
    form.set(key, value);
    start(async () => {
      try {
        const response = await mutate(form);
        if (response.error) {
          preview(previous);
          setResult(false);
          return;
        }
        setResult(true);
        router.refresh();
      } catch {
        preview(previous);
        setResult(false);
      }
    });
  }
  return (
    <Card>
      <h2 className="mb-5 text-lg font-semibold">{t.appearanceSection}</h2>
      <fieldset className="grid gap-5" disabled={pending} aria-busy={pending}>
        <label
          className="grid gap-2 text-sm font-semibold"
          htmlFor="settings-theme"
        >
          {p3.appearance}
          <span className="muted text-xs font-normal">{t.themeHint}</span>
          <select
            id="settings-theme"
            className="field"
            name="theme"
            value={theme}
            onChange={(e) => save("theme", e.target.value)}
          >
            {(["light", "dark", "system"] as const).map((value) => (
              <option key={value} value={value}>
                {p3[value]}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">{p3.accent}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["violet", "blue", "green", "orange"] as const).map((value) => (
              <label className="choice" key={value}>
                <input
                  type="radio"
                  name="accent"
                  value={value}
                  checked={accent === value}
                  onChange={() => save("accent", value)}
                />
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full"
                  style={{ background: "var(--accent-" + value + ")" }}
                />
                {p3[value]}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {(pending || result !== null) && (
        <p
          className={result === false ? "form-error mt-4" : "muted mt-4"}
          role="status"
        >
          {pending ? p3.saving : result ? t.saved : t.saveError}
        </p>
      )}
    </Card>
  );
}

function LanguageSettings({ settings }: { settings: Settings }) {
  const { locale, setLocale } = useLocale();
  const t = phase5[locale];
  const p3 = phase3[locale];
  const [pending, start] = useTransition();
  const [result, setResult] = useState<boolean | null>(null);
  const router = useRouter();
  return (
    <Card>
      <h2 className="mb-5 text-lg font-semibold">{t.languageSection}</h2>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          form.set("entity", "settings");
          form.set("action", "save");
          start(async () => {
            const response = await mutate(form);
            const ok = !response.error;
            setResult(ok);
            if (ok) {
              setLocale(String(form.get("locale")) as "en" | "ar");
              router.refresh();
            }
          });
        }}
      >
        <label
          className="grid gap-2 text-sm font-semibold"
          htmlFor="settings-locale"
        >
          {p3.language}
          <span className="muted text-xs font-normal">{t.languageHint}</span>
          <select
            id="settings-locale"
            className="field"
            name="locale"
            defaultValue={settings.locale}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? p3.saving : p3.save}
        </Button>
        {result !== null && (
          <p className={result ? "muted" : "form-error"} role="status">
            {result ? t.saved : t.saveError}
          </p>
        )}
      </form>
    </Card>
  );
}

function InstallSettings() {
  const { locale } = useLocale();
  const { canInstall, showIosInstructions, install } = useInstallFocusly();
  if (!canInstall && !showIosInstructions) return null;
  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold">
        {locale === "ar" ? "تثبيت التطبيق" : "Install the app"}
      </h2>
      {canInstall ? (
        <Button type="button" variant="secondary" onClick={() => void install()}>
          {locale === "ar" ? "تثبيت Focusly" : "Install Focusly"}
        </Button>
      ) : (
        <p className="muted text-sm">
          {locale === "ar"
            ? "في Safari، اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية."
            : "In Safari, tap Share, then Add to Home Screen."}
        </p>
      )}
    </Card>
  );
}

export function SettingsPanel({
  profile,
  settings,
  email,
}: {
  profile: Profile;
  settings: Settings;
  email: string;
}) {
  const { locale } = useLocale();
  const t = phase5[locale];
  return (
    <div className="settings-editorial">
      <header className="mb-2">
        <h1 className="mt-3 text-3xl font-semibold">{t.settingsTitle}</h1>
        <p className="muted mt-3">{t.settingsSubtitle}</p>
      </header>
      <Card>
        <h2 className="mb-5 text-lg font-semibold">{t.account}</h2>
        <p className="font-semibold">{profile.display_name}</p>
        <p className="muted mt-4 text-sm">{t.email}</p>
        <p className="mt-2 break-words">{email}</p>
        <p className="muted mt-2 text-xs">{t.emailReadOnly}</p>
      </Card>
      <ProfileForm profile={profile} title={t.educationSection} />
      <StudySettings settings={settings} />
      <AppearanceSettings />
      <LanguageSettings settings={settings} />
      <CompanionSettings />
      <InstallSettings />
      <Card>
        <h2 className="mb-2 text-lg font-semibold">{t.securitySection}</h2>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/forgot-password" variant="ghost">
            {locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password"}
          </ButtonLink>
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}

export function ProfileView({
  profile,
  email,
  subjectsCount,
  progress,
}: {
  profile: Profile;
  email: string;
  subjectsCount: number;
  progress: Progress;
}) {
  const { locale } = useLocale();
  const t = phase5[locale];
  const copy = useCopy();
  return (
    <main id="main" className="study-main">
      <header className="page-heading">
        <div>
          <h1 className="mt-3 text-3xl font-semibold">{t.profileTitle}</h1>
          <p className="mt-3 text-lg font-semibold">{profile.display_name}</p>
          <p className="muted mt-1 break-words">{email}</p>
        </div>
        <ButtonLink href="/app/settings" variant="ghost">
          {t.settingsTitle}
        </ButtonLink>
      </header>
      <div className="profile-content">
        <section className="profile-facts" aria-labelledby="profile-study-title">
          <h2 id="profile-study-title" className="text-lg font-semibold">
            {locale === "ar" ? "ملخص المذاكرة" : "Study at a glance"}
          </h2>
          <dl className="profile-facts-grid">
          {[
            [
              t.educationSection,
              profile.school_stage ? copy[profile.school_stage] : "—",
            ],
            [
              t.schoolYear,
              profile.school_year ? copy[profile.school_year] : "—",
            ],
            [
              t.dailyGoal,
              `${new Intl.NumberFormat(locale).format(profile.daily_goal_minutes ?? 0)} ${phase3[locale].minutes}`,
            ],
            [
              t.subjectCount,
              new Intl.NumberFormat(locale).format(subjectsCount),
            ],
            [
              t.completedFocus,
              progress.totalSeconds
                ? formatDuration(progress.totalSeconds, locale)
                : t.noStudyYet,
            ],
            [
              t.currentStreak,
              `${new Intl.NumberFormat(locale).format(progress.streak)} ${phase4[locale].days}`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="muted text-sm">{label}</dt>
              <dd className="mt-2 text-lg font-semibold">{value}</dd>
            </div>
          ))}
          </dl>
        </section>
        <details className="profile-editor" open={!validEducation(educationFrom(profile))}>
          <summary>{locale === "ar" ? "تعديل بياناتك" : "Edit your details"}</summary>
          <ProfileForm profile={profile} title={t.educationSection} includeName />
        </details>
      </div>
    </main>
  );
}
