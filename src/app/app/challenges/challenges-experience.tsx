"use client";

import { useState } from "react";

import {
  challengeCatalog,
  type ChallengeKey,
} from "@/features/challenges/catalog";
import { useLocale } from "@/features/i18n/locale-provider";
import type { ChallengeProgress } from "@/features/challenges/data";

type ChallengeKind = "daily" | "weekly";

type ChallengeCopy = {
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  target: {
    ar: string;
    en: string;
  };
};

const challengeCopy: Record<ChallengeKey, ChallengeCopy> = {
  daily_focus_25: {
    title: {
      ar: "25 دقيقة تركيز",
      en: "Focused 25",
    },
    description: {
      ar: "أكمل 25 دقيقة من المذاكرة المركزة خلال اليوم.",
      en: "Complete 25 minutes of focused study during the day.",
    },
    target: {
      ar: "25 دقيقة تركيز",
      en: "25 Focus minutes",
    },
  },

  daily_tasks_2: {
    title: {
      ar: "أنجز مهامك",
      en: "Get Things Done",
    },
    description: {
      ar: "أكمل مهمتين حقيقيتين من مهامك خلال اليوم.",
      en: "Complete two real study tasks during the day.",
    },
    target: {
      ar: "مهمتان مكتملتان",
      en: "2 completed tasks",
    },
  },

  weekly_focus_180: {
    title: {
      ar: "أسبوع عميق",
      en: "Deep Week",
    },
    description: {
      ar: "اجمع 180 دقيقة من المذاكرة المركزة خلال الأسبوع.",
      en: "Build up 180 minutes of focused study during the week.",
    },
    target: {
      ar: "180 دقيقة تركيز",
      en: "180 Focus minutes",
    },
  },

  weekly_subjects_2: {
    title: {
      ar: "مذاكرة متوازنة",
      en: "Balanced Study",
    },
    description: {
      ar: "حقق تقدمًا حقيقيًا في مادتين مختلفتين خلال الأسبوع.",
      en: "Make real study progress in two different subjects this week.",
    },
    target: {
      ar: "مادتان مختلفتان",
      en: "2 different subjects",
    },
  },
};

const copy = {
  ar: {
    eyebrow: "FOCUSLY CHALLENGES",
    title: "تحدياتك",
    description:
      "ذاكر بشكل طبيعي. Focusly يتابع نشاطك الموثوق ويكافئك تلقائيًا عند إكمال التحديات.",

    daily: "اليومية",
    weekly: "الأسبوعية",

    dailyDescription: "تحديات قصيرة تتجدد كل يوم",
    weeklyDescription: "تحديات أعمق خلال أسبوع السبت–الجمعة",

    challengeCount: "تحديان",
    progress: "التقدم",
    completed: "مكتمل",
    pending: "تم بلوغ الهدف — في انتظار تسجيل الإكمال",
    unavailable: "تعذر تحميل تقدم التحديات الآن. حاول تحديث الصفحة لاحقًا.",
    inactive: "لا توجد فترة نشطة لهذا التحدي حاليًا.",
    target: "الهدف",
    reward: "المكافأة",

    tracking: "تتبع تلقائي",
    trackingDescription:
      "يتم احتساب التقدم من جلسات التركيز والمهام الحقيقية تلقائيًا.",

    automaticTitle: "مكافآت تلقائية",
    automaticDescription:
      "لا يوجد زر Claim. عند إكمال التحدي، تضاف XP والعملات تلقائيًا ويمكن أن تؤثر المكافأة في تقدم مدينتك.",

    dailyReward: "مكافأة التحدي اليومي",
    weeklyReward: "مكافأة التحدي الأسبوعي",

    coins: "عملات",
  },

  en: {
    eyebrow: "FOCUSLY CHALLENGES",
    title: "Your challenges",
    description:
      "Study normally. Focusly tracks trusted activity and rewards completed challenges automatically.",

    daily: "Daily",
    weekly: "Weekly",

    dailyDescription: "Short challenges that reset every day",
    weeklyDescription: "Deeper challenges across the Saturday–Friday week",

    challengeCount: "2 challenges",
    progress: "Progress",
    completed: "Completed",
    pending: "Target reached — completion pending",
    unavailable: "Challenge progress is unavailable right now. Try refreshing later.",
    inactive: "There is no active period for this challenge right now.",
    target: "Target",
    reward: "Reward",

    tracking: "Automatic tracking",
    trackingDescription:
      "Progress is derived automatically from real Focus sessions and completed tasks.",

    automaticTitle: "Automatic rewards",
    automaticDescription:
      "There is no Claim button. Completing a challenge automatically awards XP and Coins and may contribute to City growth.",

    dailyReward: "Daily challenge reward",
    weeklyReward: "Weekly challenge reward",

    coins: "Coins",
  },
} as const;

export function ChallengesExperience({ challenges }: { challenges: readonly ChallengeProgress[] | null }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const number = new Intl.NumberFormat(locale);

  const [kind, setKind] =
    useState<ChallengeKind>("daily");

  const visibleChallenges = challengeCatalog.filter(
    (challenge) => challenge.kind === kind,
  );

  const reward =
    kind === "daily"
      ? {
          xp: 50,
          coins: 10,
        }
      : {
          xp: 150,
          coins: 30,
        };

  return (
    <main
      id="main"
      className="study-main"
    >
      <section className="mb-9">
        <p className="eyebrow mb-3">
          {t.eyebrow}
        </p>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
              {t.title}
            </h1>

            <p className="muted mt-4 max-w-3xl text-base leading-8 sm:text-lg">
              {t.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <RewardChip
              value="+50 XP"
            />

            <RewardChip
              value={`+10 ${t.coins}`}
            />

            <span className="muted flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.025] px-4 text-xs font-semibold">
              {t.dailyReward}
            </span>
          </div>
        </div>
      </section>

      <section
        className="mb-8 grid max-w-lg grid-cols-2 rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-1"
        aria-label={t.title}
      >
        <TabButton
          active={kind === "daily"}
          onClick={() => setKind("daily")}
        >
          {t.daily}
        </TabButton>

        <TabButton
          active={kind === "weekly"}
          onClick={() => setKind("weekly")}
        >
          {t.weekly}
        </TabButton>
      </section>

      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">
              {kind === "daily"
                ? t.daily
                : t.weekly}
            </h2>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1 text-xs font-semibold">
              {t.challengeCount}
            </span>
          </div>

          <p className="muted mt-2 text-sm">
            {kind === "daily"
              ? t.dailyDescription
              : t.weeklyDescription}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-4 py-2">
          <span
            className="h-2 w-2 rounded-full bg-[var(--accent)]"
            aria-hidden="true"
          />

          <span className="text-xs font-semibold">
            {t.tracking}
          </span>
        </div>
      </section>

      {challenges === null && <p role="status" className="muted mb-4 text-sm">{t.unavailable}</p>}

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleChallenges.map((challenge) => {
          const content =
            challengeCopy[challenge.key];
          const current = challenges?.find(row => row.challenge_key === challenge.key);

          return (
            <article
              key={challenge.key}
              className="group rounded-[1.8rem] border border-white/10 bg-white/[0.035] p-5 shadow-lg backdrop-blur-xl transition hover:border-white/15 hover:bg-white/[0.045] sm:p-6"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <h3 className="text-xl font-bold">
                    {content.title[locale]}
                  </h3>

                  <p className="muted mt-2 max-w-xl leading-7">
                    {
                      content.description[
                        locale
                      ]
                    }
                  </p>
                </div>

                <span
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035]"
                  aria-hidden="true"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoBox
                  label={t.target}
                  value={
                    content.target[locale]
                  }
                />

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="muted text-xs font-semibold">
                    {t.reward}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <RewardChip
                      value={`+${reward.xp} XP`}
                    />

                    <RewardChip
                      value={`+${reward.coins} ${t.coins}`}
                    />
                  </div>
                </div>
              </div>

              {current ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{current.completed ? t.completed : t.progress}</span>
                    <bdi dir="ltr">{number.format(current.progress)} / {number.format(current.target)}</bdi>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${content.title[locale]} — ${t.progress}`}
                    aria-valuemin={0}
                    aria-valuemax={current.target}
                    aria-valuenow={current.progress}
                    aria-valuetext={current.completed ? t.completed : `${number.format(current.progress)} / ${number.format(current.target)}`}
                    className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
                  >
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${current.progress / current.target * 100}%` }} />
                  </div>
                  {!current.completed && current.progress >= current.target && <p className="muted mt-2 text-xs">{t.pending}</p>}
                </div>
              ) : challenges !== null ? <p className="muted mt-5 text-sm">{t.inactive}</p> : null}

              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                    aria-hidden="true"
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      {t.tracking}
                    </p>

                    <p className="muted mt-1 text-xs leading-5">
                      {
                        t.trackingDescription
                      }
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-7 rounded-[1.8rem] border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035]"
            aria-hidden="true"
          >
            <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
          </div>

          <div>
            <h2 className="font-bold">
              {t.automaticTitle}
            </h2>

            <p className="muted mt-2 max-w-4xl text-sm leading-6">
              {t.automaticDescription}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-11 rounded-[1.1rem] px-5 text-sm font-bold transition",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--foreground)] shadow-sm"
          : "muted hover:bg-white/[0.04]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="muted text-xs font-semibold">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold leading-6">
        {value}
      </p>
    </div>
  );
}

function RewardChip({
  value,
}: {
  value: string;
}) {
  return (
    <span
      dir="ltr"
      className="inline-flex min-h-8 items-center rounded-full border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 text-xs font-bold"
    >
      {value}
    </span>
  );
}
