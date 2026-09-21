"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCopy } from "@/features/i18n/use-copy";
import { useLocale } from "@/features/i18n/locale-provider";
import { subjectLabel } from "@/features/i18n/phase2";
import { useTheme } from "@/features/theme/theme-provider";
import { ACCENTS, THEMES } from "@/features/theme/theme-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { LogoutButton } from "@/features/auth/logout-button";
import { validName } from "@/features/auth/validation";
import type { ErrorCode } from "@/features/auth/state";
import type { Database } from "@/types/database";
import { saveStep } from "./actions";
import {
  educationFrom,
  changeEducation,
  suggestions,
  label,
  validEducation,
  type Stage,
} from "@/features/education/config";
import { EducationFields } from "@/features/education/fields";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export function OnboardingWizard({ profile }: { profile: Profile }) {
  const t = useCopy();
  const { locale } = useLocale();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(
    profile.onboarding_step > 3 && !validEducation(educationFrom(profile))
      ? 3
      : profile.onboarding_step,
  );
  const [name, setName] = useState(profile.display_name ?? "");
  const [education, setEducation] = useState(() => educationFrom(profile));
  const stage = education.school_stage;
  const [minutes, setMinutes] = useState(profile.daily_goal_minutes ?? 120);
  const [customGoal, setCustomGoal] = useState(
    ![60, 120, 180, 240].includes(profile.daily_goal_minutes ?? 120),
  );
  const [subjects, setSubjects] = useState(() =>
    profile.onboarding_subjects.length
      ? profile.onboarding_subjects
      : suggestions(educationFrom(profile)).map((s) => label(s.id, "en")),
  );
  const [suggestionsDirty, setSuggestionsDirty] = useState(false);
  const [custom, setCustom] = useState("");
  const [subjectError, setSubjectError] = useState(false);
  const [error, setError] = useState<ErrorCode | undefined>();
  const [complete, setComplete] = useState(false);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const choices = Array.from(
    new Set([
      ...suggestions(education).map((s) => label(s.id, "en")),
      ...subjects,
    ]),
  );
  const titles = [t.step1, t.step2, t.step3, t.step4, t.step5, t.step6];
  const intros = [t.intro1, t.intro2, t.intro3, t.intro4, t.intro5, t.intro6];
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  function updateEducation(next: typeof education) {
    const previous = new Set(
      suggestions(education).map((s) => label(s.id, "en")),
    );
    setSubjects((current) => current.filter((name) => !previous.has(name)));
    setEducation(next);
    setSuggestionsDirty(true);
  }
  function addSubject() {
    const value = custom.trim();
    if (
      !validName(value) ||
      subjects.length >= 20 ||
      subjects.some((item) => item.toLowerCase() === value.toLowerCase())
    ) {
      setSubjectError(true);
      return;
    }
    setSubjects([...subjects, value]);
    setCustom("");
    setSubjectError(false);
  }
  function changeStep(next: number) {
    setStep(next);
    setError(undefined);
    setSubjectError(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (step === 3)
      for (const [key, value] of Object.entries(education))
        form.set(key, value ?? "");
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await saveStep(form);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.complete) {
          setComplete(true);
          return;
        }
        if (result.step) {
          if (step === 3 && suggestionsDirty) {
            setSubjects((current) =>
              Array.from(
                new Set([
                  ...suggestions(education).map((s) => label(s.id, "en")),
                  ...current,
                ]),
              ),
            );
            setSuggestionsDirty(false);
          }
          changeStep(result.step);
        }
      } catch {
        setError("unavailable");
      }
    });
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="onboarding-page">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="muted text-sm">
            {t.step} {format(complete ? 6 : step)} {t.of} {format(6)}
          </p>
          <LogoutButton />
        </div>
        <div
          className="mb-7 h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-label={t.step}
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuenow={complete ? 6 : step - 1}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${((complete ? 6 : step - 1) / 6) * 100}%` }}
          />
        </div>
        <Card variant="paper" className="onboarding-question">
          {complete ? (
            <div className="py-8 text-center" role="status">
              <span aria-hidden="true" className="text-4xl">
                ✓
              </span>
              <h1 className="mt-4 text-3xl font-semibold">{t.ready}</h1>
              <p className="muted mt-4">{t.readyText}</p>
              <Button
                className="mt-8 !h-12"
                onClick={() => {
                  router.replace("/app");
                  router.refresh();
                }}
              >
                {t.home}
              </Button>
            </div>
          ) : (
            <>
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-3xl font-semibold tracking-tight"
              >
                {titles[step - 1]}
              </h1>
              <p className="muted mt-3 leading-7">{intros[step - 1]}</p>
              <form onSubmit={submit} className="mt-7" aria-busy={pending}>
                <fieldset disabled={pending} className="min-w-0">
                  <legend className="sr-only">{titles[step - 1]}</legend>
                  <input type="hidden" name="step" value={step} />
                  {step === 1 && (
                    <Field
                      label={t.name}
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  )}
                  {step === 2 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["preparatory", "secondary"] as const).map((value) => (
                        <label className="choice min-h-24" key={value}>
                          <input
                            type="radio"
                            name="stage"
                            value={value}
                            checked={stage === value}
                            onChange={() => {
                              if (stage !== value) {
                                updateEducation(
                                  changeEducation(
                                    education,
                                    "school_stage",
                                    value,
                                  ),
                                );
                              }
                              if (stage === value)
                                setEducation({
                                  ...education,
                                  school_stage: value as Stage,
                                });
                            }}
                            required
                          />
                          <span className="font-semibold">{t[value]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {step === 3 && (
                    <EducationFields
                      value={education}
                      onChange={updateEducation}
                      showStage={false}
                    />
                  )}
                  {step === 4 && (
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[60, 120, 180, 240].map((value) => (
                          <label className="choice" key={value}>
                            <input
                              type="radio"
                              name="goalChoice"
                              checked={!customGoal && minutes === value}
                              onChange={() => {
                                setMinutes(value);
                                setCustomGoal(false);
                              }}
                            />
                            <span>
                              {format(value / 60)}{" "}
                              {value === 60 ? t.hour : t.hours}
                            </span>
                          </label>
                        ))}
                        <label className="choice col-span-2">
                          <input
                            type="radio"
                            name="goalChoice"
                            checked={customGoal}
                            onChange={() => setCustomGoal(true)}
                          />
                          <span>{t.custom}</span>
                        </label>
                      </div>
                      {customGoal ? (
                        <Field
                          type="number"
                          label={t.minutes}
                          name="minutes"
                          min={5}
                          max={720}
                          step={1}
                          hint={t.goalHint}
                          value={minutes || ""}
                          onChange={(event) =>
                            setMinutes(Number(event.target.value))
                          }
                          required
                        />
                      ) : (
                        <input type="hidden" name="minutes" value={minutes} />
                      )}
                    </div>
                  )}
                  {step === 5 && (
                    <div className="grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {choices.map((value) => (
                          <label className="choice" key={value}>
                            <input
                              type="checkbox"
                              name="subject"
                              value={value}
                              checked={subjects.includes(value)}
                              onChange={(event) => {
                                if (
                                  event.target.checked &&
                                  subjects.length >= 20
                                ) {
                                  setSubjectError(true);
                                  return;
                                }
                                setSubjects(
                                  event.target.checked
                                    ? [...subjects, value]
                                    : subjects.filter((item) => item !== value),
                                );
                              }}
                            />
                            <span className="min-w-0 break-words">
                              {(() => {
                                const suggestion = suggestions(education).find(
                                  (s) => label(s.id, "en") === value,
                                );
                                return suggestion ? (
                                  <>
                                    {label(suggestion.id, locale)}
                                    <small className="muted block">
                                      {
                                        {
                                          total:
                                            locale === "ar"
                                              ? "مواد مضافة للمجموع"
                                              : "Counted toward total",
                                          supporting:
                                            locale === "ar"
                                              ? "غير مضافة للمجموع"
                                              : "Not counted toward total",
                                          specialization:
                                            locale === "ar"
                                              ? "مادة تخصصية"
                                              : "Specialization",
                                          advanced:
                                            locale === "ar"
                                              ? "مستوى متقدم"
                                              : "Advanced level",
                                        }[suggestion.group]
                                      }
                                    </small>
                                  </>
                                ) : (
                                  subjectLabel(t, value)
                                );
                              })()}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="muted text-xs leading-6">{t.subjectHint}</p>
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <Field
                            label={t.customSubject}
                            value={custom}
                            maxLength={80}
                            id="custom-subject"
                            onChange={(event) => setCustom(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addSubject();
                              }
                            }}
                          />
                        </div>
                        <Button className="!h-12" onClick={addSubject}>
                          {t.add}
                        </Button>
                      </div>
                      {subjectError && (
                        <p role="alert" className="form-error">
                          {t.subjectError}
                        </p>
                      )}
                    </div>
                  )}
                  {step === 6 && (
                    <div className="grid gap-6">
                      <input type="hidden" name="locale" value={locale} />
                      <fieldset>
                        <legend className="mb-3 text-sm font-semibold">
                          {t.themeLabel}
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {THEMES.map((value) => (
                            <label className="choice" key={value}>
                              <input
                                type="radio"
                                name="theme"
                                value={value}
                                checked={theme === value}
                                onChange={() => setTheme(value)}
                              />
                              <span>{t[value]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-3 text-sm font-semibold">
                          {t.accentLabel}
                        </legend>
                        <div className="grid grid-cols-2 gap-3">
                          {ACCENTS.map((value) => (
                            <label className="choice" key={value}>
                              <input
                                type="radio"
                                name="accent"
                                value={value}
                                checked={accent === value}
                                onChange={() => setAccent(value)}
                              />
                              <span
                                aria-hidden="true"
                                className="size-3 shrink-0 rounded-full"
                                style={{ background: `var(--accent-${value})` }}
                              />
                              <span>{t[value]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <section className="rounded-2xl border bg-[var(--surface-subtle)] p-5">
                        <p className="eyebrow">{t.previewTitle}</p>
                        <p className="mt-3 leading-7">{t.previewText}</p>
                      </section>
                    </div>
                  )}
                </fieldset>
                {error && (
                  <div className="mt-5" role="alert">
                    <p className="form-error">{t.errors[error]}</p>
                    {error === "expired" && (
                      <a className="mt-3 inline-block underline" href="/login">
                        {t.login}
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-8 flex justify-between gap-3">
                  <Button
                    variant="ghost"
                    disabled={pending || step === 1}
                    onClick={() => changeStep(step - 1)}
                  >
                    {t.back}
                  </Button>
                  <Button
                    type="submit"
                    className="!h-12 px-6"
                    disabled={pending || (step === 5 && subjects.length === 0)}
                  >
                    {pending ? t.working : step === 6 ? t.finish : t.continue}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
        <p className="muted mt-5 text-center text-xs leading-6">{t.saved}</p>
      </main>
    </>
  );
}
