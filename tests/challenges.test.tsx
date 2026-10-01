import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { challengeCatalog, challengeRewards, challengeProgress } from "../src/features/challenges/catalog";
import { challengeViews, nextChallenge } from "../src/features/challenges/overview";
import { calculateChallengeRewards } from "../src/features/progression/rewards";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import type { ChallengeProgress } from "../src/features/challenges/data";
import { DailyChallengesWidget } from "../src/features/challenges/summary";
import { challengeAwardsFromClaim } from "../src/features/challenges/receipt";
import { ChallengeRewardToast } from "../src/features/challenges/reward-toast";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });
const { ChallengesExperience } = await import("../src/app/app/challenges/challenges-experience");

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
test("dashboard summarizes only the two active Daily challenges", () => {
  const daily = [
    { ...progressRow, completed: true, progress: 25 },
    { ...progressRow, challenge_key: "daily_tasks_2", target: 2, progress: 1 },
  ];
  for (const locale of ["en", "ar"] as const) {
    const html = renderToStaticMarkup(<LocaleProvider initial={locale}><DailyChallengesWidget snapshot={{ userId: "owner", challenges: daily }} /></LocaleProvider>);
    assert.ok(html.includes(locale === "ar" ? "مكتمل" : "complete"));
    const all = renderToStaticMarkup(<LocaleProvider initial={locale}><DailyChallengesWidget snapshot={{ userId: "owner", challenges: daily.map(row => ({ ...row, completed: true })) }} /></LocaleProvider>);
    assert.ok(all.includes(locale === "ar" ? "اكتملت تحديات اليوم" : "challenges complete"));
  }
});

test("only newly awarded trusted claim receipts yield challenge notices", () => {
  const challenge = { eventId: "event-1", challengeKey: "daily_focus_25", xp: 50, coins: 10, cityConstruction: [] };
  assert.deepEqual(challengeAwardsFromClaim({ awarded: false, challenges: [challenge] }), []);
  assert.deepEqual(challengeAwardsFromClaim({ awarded: true, challenges: [challenge, challenge] }), [
    { eventId: "event-1", challengeKey: "daily_focus_25", xp: 50, coins: 10, cityGrew: false },
  ]);
  assert.deepEqual(challengeAwardsFromClaim({ awarded: true, challenges: [{ ...challenge, xp: 5000 }] }), []);
  assert.deepEqual(challengeAwardsFromClaim({ awarded: true, challenges: [{ ...challenge, challengeKey: "unknown" }] }), []);
  assert.deepEqual(challengeAwardsFromClaim({ awarded: true, challenges: [] }), []);
});

test("receipt toast is accessible, localized and shows only actual reward values", () => {
  const awards = challengeAwardsFromClaim({ awarded: true, challenges: [
    { eventId: "a", challengeKey: "daily_focus_25", xp: 50, coins: 10, cityConstruction: [] },
    { eventId: "b", challengeKey: "weekly_focus_180", xp: 150, coins: 30, cityConstruction: [{ level: 1 }] },
  ] });
  for (const locale of ["en", "ar"] as const) {
    const html = renderToStaticMarkup(<LocaleProvider initial={locale}><ChallengeRewardToast awards={awards} onDismiss={() => {}} /></LocaleProvider>);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /\+200 XP/);
    assert.match(html, /\+40/);
    assert.ok(html.includes(locale === "ar" ? "مدينتك تطورت" : "Your city grew"));
  }
});

function renderChallenges(locale: "ar" | "en", challenges: ChallengeProgress[] | null) {
  return renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <ChallengesExperience challenges={challenges} timeZone="Africa/Cairo" />
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
    assert.match(html, /dateTime="2026-09-29T00:00:00Z"/);
    assert.match(html, /Africa\/Cairo/);
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
    assert.ok(inactive.includes(locale === "ar" ? "لا توجد فترة نشطة" : "No active period"));
  }
});

test("challenge presentation preserves server completion and missing-data states", () => {
  assert.equal(challengeViews(null).every(view => view.state === "unavailable" && view.percent === null), true);
  assert.equal(challengeViews([]).every(view => view.state === "inactive" && view.percent === null), true);
  const active = challengeViews([progressRow]);
  assert.deepEqual([active[0]?.state, active[0]?.percent, active[0]?.remaining], ["in_progress", 48, 13]);
  assert.equal(challengeViews([{ ...progressRow, progress: 25 }])[0]?.state, "pending");
  assert.equal(challengeViews([{ ...progressRow, progress: 25, completed: true }])[0]?.state, "completed");
  assert.deepEqual([challengeViews([{ ...progressRow, progress: 30 }])[0]?.percent, challengeViews([{ ...progressRow, progress: 30 }])[0]?.remaining], [100, 0]);
  assert.equal(challengeViews([{ ...progressRow, progress: -1 }])[0]?.state, "unavailable");
});

test("closest challenge uses only active, incomplete server progress", () => {
  const rows = [progressRow, { ...progressRow, challenge_key: "daily_tasks_2", progress: 1, target: 2 }];
  assert.equal(nextChallenge(challengeViews(rows), "daily")?.key, "daily_tasks_2");
  assert.equal(nextChallenge(challengeViews(rows.map(row => ({ ...row, completed: true }))), "daily"), null);
  assert.equal(nextChallenge(challengeViews(null), "daily"), null);
  assert.equal(nextChallenge(challengeViews(rows), "weekly"), null);
});

test("Challenges 2.0 keeps trusted reads, theme tokens, RTL and responsive controls", () => {
  for (const locale of ["en", "ar"] as const) {
    const html = renderChallenges(locale, [progressRow]);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /href="\/app\/focus"/);
    assert.match(html, /dateTime="2026-09-29T00:00:00Z"/);
    assert.match(html, /aria-label="[^\"]*12[^\"]*25|aria-valuenow="12"/);
    assert.doesNotMatch(html, /Claim<\/button>/);
    assert.match(html, new RegExp(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  }
  const css = readFileSync(new URL("../src/app/app/challenges/challenges.module.css", import.meta.url), "utf8");
  assert.match(css, /var\(--surface\)/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /max-width: 540px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const page = readFileSync(new URL("../src/app/app/challenges/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getChallenges\(\)/);
  assert.doesNotMatch(page, /evaluate_progression_challenges/);
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
