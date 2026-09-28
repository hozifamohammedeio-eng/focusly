import test from "node:test";
import assert from "node:assert/strict";
import { challengeCatalog, challengeRewards, challengeProgress } from "../src/features/challenges/catalog";
import { calculateChallengeRewards } from "../src/features/progression/rewards";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { ChallengesExperience } from "../src/app/app/challenges/challenges-experience";
import type { ChallengeProgress } from "../src/features/challenges/data";
import { DailyChallengesWidget, consumeChallengeCompletions } from "../src/features/challenges/summary";

test("dashboard shows daily server progress and links to Challenges in both languages", () => {
  for (const locale of ["en", "ar"] as const) {
    const html = renderToStaticMarkup(<LocaleProvider initial={locale}><DailyChallengesWidget snapshot={{ userId: "owner", challenges: [progressRow, { ...progressRow, challenge_key: "weekly_focus_180", progress: 90, target: 180 }] }} /></LocaleProvider>);
    assert.match(html, /href="\/app\/challenges"/);
    assert.match(html, /aria-valuenow="12"/);
    assert.doesNotMatch(html, /aria-valuenow="90"/);
    const unavailable = renderToStaticMarkup(<LocaleProvider initial={locale}><DailyChallengesWidget snapshot={null} /></LocaleProvider>);
    assert.doesNotMatch(unavailable, /role="progressbar"/);
    assert.ok(unavailable.includes(locale === "ar" ? "غير متاح" : "unavailable"));
  }
});

test("completion feedback suppresses repeated receipts across mounts and isolates users and periods", () => {
  const saved = new Map<string,string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key,value); } };
  const completed = { ...progressRow, progress: 25, completed: true };
  assert.equal(consumeChallengeCompletions("a",[progressRow],storage,new Set()),0);
  assert.equal(consumeChallengeCompletions("a",[completed,completed],storage,new Set()),1);
  assert.equal(consumeChallengeCompletions("a",[completed],storage,new Set()),0);
  assert.equal(consumeChallengeCompletions("b",[completed],storage,new Set()),1);
  assert.equal(consumeChallengeCompletions("a",[{ ...completed, starts_at: "2026-09-29T00:00:00Z" }],storage,new Set()),1);
});

test("completion feedback remains usable without browser storage", () => {
  const blocked = { getItem: (): string | null => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const seen = new Set<string>();
  const completed = { ...progressRow, completed: true };
  assert.equal(consumeChallengeCompletions("a",[completed],blocked,seen),1);
  assert.equal(consumeChallengeCompletions("a",[completed],blocked,seen),0);
});

function renderChallenges(locale: "ar" | "en", challenges: ChallengeProgress[] | null) {
  return renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <ChallengesExperience challenges={challenges} />
    </LocaleProvider>,
  );
}
const progressRow: ChallengeProgress = {
  challenge_key: "daily_focus_25", progress: 12, target: 25, completed: false,
  starts_at: "2026-09-28T00:00:00Z", ends_at: "2026-09-29T00:00:00Z",
};

test("challenge cards render server progress accessibly in both languages", () => {
  for (const locale of ["en", "ar"] as const) {
    const html = renderChallenges(locale, [progressRow]);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-valuenow="12"/);
    assert.match(html, /aria-valuemax="25"/);
    assert.match(html, /width:48%/);
    const number = new Intl.NumberFormat(locale);
    assert.ok(html.includes(`<bdi dir="ltr">${number.format(12)} / ${number.format(25)}</bdi>`));
    assert.ok(html.includes(locale === "ar" ? "التقدم" : "Progress"));
  }
});

test("challenge cards distinguish awarded completion from pending full progress", () => {
  for (const locale of ["en", "ar"] as const) {
    const pending = renderChallenges(locale, [{ ...progressRow, progress: 25 }]);
    assert.ok(pending.includes(locale === "ar" ? "في انتظار تسجيل الإكمال" : "completion pending"));
    const completed = renderChallenges(locale, [{ ...progressRow, progress: 25, completed: true }]);
    assert.ok(completed.includes(locale === "ar" ? "مكتمل" : "Completed"));
    assert.ok(!completed.includes(locale === "ar" ? "في انتظار تسجيل الإكمال" : "completion pending"));
  }
});

test("unavailable progress and inactive periods never render fake zero bars", () => {
  for (const locale of ["en", "ar"] as const) {
    const unavailable = renderChallenges(locale, null);
    assert.match(unavailable, /role="status"/);
    assert.doesNotMatch(unavailable, /role="progressbar"/);
    const inactive = renderChallenges(locale, []);
    assert.doesNotMatch(inactive, /role="progressbar"/);
    assert.ok(inactive.includes(locale === "ar" ? "لا توجد فترة نشطة" : "no active period"));
  }
});

test("challenge keys are unique and all requirements are positive integers", () => {
  assert.equal(new Set(challengeCatalog.map(c => c.key)).size, 4);
  for (const c of challengeCatalog) assert.ok(Number.isSafeInteger(c.target) && c.target > 0);
});
test("challenge rewards reuse central daily and weekly rules", () => {
  for (const c of challengeCatalog) assert.deepEqual(challengeRewards(c.kind), calculateChallengeRewards(c.kind));
  assert.deepEqual(challengeRewards("daily"), { xp: 50, coins: 10, constructionPoints: 0 });
  assert.deepEqual(challengeRewards("weekly"), { xp: 150, coins: 30, constructionPoints: 0 });
});
test("challenge progress previews clamp without awarding", () => {
  assert.deepEqual(challengeProgress(24,25), { progress:24, target:25, complete:false });
  assert.deepEqual(challengeProgress(30,25), { progress:25, target:25, complete:true });
});
test("invalid progress and targets are rejected", () => {
  for (const n of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(() => challengeProgress(n,25), RangeError);
    assert.throws(() => challengeProgress(1,n), RangeError);
  }
  assert.throws(() => challengeProgress(1,0), RangeError);
});
