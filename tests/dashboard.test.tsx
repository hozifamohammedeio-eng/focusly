import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { dayInZone, filterTasks, weekStart, type Task } from "../src/features/planning/logic";
import { todaySeconds, weekSeconds, weekDays, type Progress } from "../src/features/focus/logic";
import { challengeViews } from "../src/features/challenges/overview";
import { dashboardChallengePeriod, dashboardFocusWeek, dashboardTodayTasks } from "../src/features/dashboard/overview";
import { achievementCatalog } from "../src/features/progression/achievements";
import { achievementViews, almostThere } from "../src/features/progression/achievement-view";
import { citySummary } from "../src/features/city/overview";
import type { DashboardData } from "../src/features/dashboard/data";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });
const { DashboardExperience } = await import("../src/features/dashboard/experience");

const progress: Progress = {
  zone: "Africa/Cairo", today: "2026-10-01", weekStart: "2026-09-26", streak: 2,
  totalSeconds: 7200, totalSessions: 4,
  days: [{ day: "2026-09-30", seconds: 600, sessions: 1 }, { day: "2026-10-01", seconds: 1200, sessions: 1 }],
  subjects: [], recent: [],
};
function task(id: string, day: string, status: "pending" | "completed", title = id): Task {
  return { id, title, task_date: day, status, subject_id: null, due_at: null,
    created_at: `2026-09-28T00:00:0${id.length}Z` } as Task;
}
const challenges = challengeViews([
  { challenge_key: "daily_focus_25", progress: 12, target: 25, completed: false, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-02T00:00:00Z" },
  { challenge_key: "daily_tasks_2", progress: 1, target: 2, completed: false, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-02T00:00:00Z" },
  { challenge_key: "weekly_focus_180", progress: 90, target: 180, completed: false, starts_at: "2026-09-26T00:00:00Z", ends_at: "2026-10-03T00:00:00Z" },
  { challenge_key: "weekly_subjects_2", progress: 1, target: 2, completed: false, starts_at: "2026-09-26T00:00:00Z", ends_at: "2026-10-03T00:00:00Z" },
]);
const evidence = achievementCatalog.map(item => ({ achievement_key: item.key, progress: item.key === "focus_5" ? 3 : 0, target: item.key === "focus_5" ? 5 : 1 }));
const achievement = almostThere(achievementViews(evidence, []), 1)[0]!;
function fixture(patch: Partial<DashboardData> = {}): DashboardData {
  return {
    name: "Hozifa", now: "2026-10-01T12:00:00Z", today: "2026-10-01", zone: "Africa/Cairo",
    goal: 25, progress, activeFocus: null,
    tasks: [task("today-a", "2026-10-01", "pending"), task("today-b", "2026-10-01", "completed"), task("yesterday", "2026-09-30", "pending")],
    subjects: [], challenges, achievements: { unlocked: 0, total: 9, next: achievement },
    city: citySummary({ buildings: [0, 1, 2, 0, 0, 0].map(level => ({ level, maxLevel: 3 })) }),
    ...patch,
  };
}
function html(data: DashboardData, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><DashboardExperience data={data} /></LocaleProvider>);
}

test("saved-timezone Today boundary and Tasks Today use the canonical task day", () => {
  assert.equal(dayInZone("2026-09-30T22:30:00Z", "Africa/Cairo"), "2026-10-01");
  const rows = [task("previous", "2026-09-30", "pending"), task("done", "2026-10-01", "completed"), task("open", "2026-10-01", "pending"), task("future", "2026-10-02", "pending")];
  const allToday = dashboardTodayTasks(rows, "2026-10-01", "Africa/Cairo");
  assert.deepEqual(allToday.map(row => row.id), ["open", "done"]);
  assert.deepEqual(allToday.filter(row => row.status !== "completed").map(row => row.id),
    filterTasks(rows, "today", "", "", "2026-10-01", "Africa/Cairo").map(row => row.id));
});

test("Focus Today and Saturday–Friday weekly values reuse Statistics helpers", () => {
  const week = dashboardFocusWeek(progress);
  assert.equal(weekStart(progress.today), progress.weekStart);
  assert.equal(week.todaySeconds, todaySeconds(progress));
  assert.equal(week.weekSeconds, weekSeconds(progress));
  assert.deepEqual(week.days, weekDays(progress));
  assert.equal(week.days[0]?.day, "2026-09-26");
  assert.equal(week.days[6]?.day, "2026-10-02");
  assert.equal(week.studyDays, 2);
});

test("Daily and Weekly Dashboard challenges reuse the Challenges 2.0 read model", () => {
  assert.equal(dashboardChallengePeriod(challenges, "daily")?.next?.key, "daily_tasks_2");
  assert.equal(dashboardChallengePeriod(challenges, "weekly")?.next?.key, "weekly_focus_180");
  assert.equal(dashboardChallengePeriod(challenges, "daily")?.completed, 0);
  assert.equal(dashboardChallengePeriod(challenges, "daily")?.percent, 49);
  assert.equal(dashboardChallengePeriod(challenges, "weekly")?.percent, 50);
  assert.equal(dashboardChallengePeriod(null, "daily"), null);
});

test("populated Dashboard matches source progress, achievement and City summaries", () => {
  const rendered = html(fixture());
  assert.match(rendered, /1 \/ 2/);
  assert.match(rendered, /20 min/);
  assert.match(rendered, /30 min/);
  assert.match(rendered, /Get Things Done/);
  assert.match(rendered, /Focused Five/);
  assert.match(rendered, /3 \/ 5/);
  assert.match(rendered, /3 \/ 18/);
  assert.match(rendered, /href="\/app\/city"/);
  assert.doesNotMatch(rendered, /yesterday/);
  assert.equal(fixture().city?.completedLevels, citySummary({ buildings: [0, 1, 2, 0, 0, 0].map(level => ({ level, maxLevel: 3 })) }).completedLevels);
});

test("new user and empty states have one clear path without fabricated activity", () => {
  const rendered = html(fixture({ progress: { ...progress, days: [], streak: 0 }, tasks: [], challenges: challengeViews([]),
    achievements: { unlocked: 0, total: 9, next: null }, city: citySummary({ buildings: Array.from({ length: 6 }, () => ({ level: 0, maxLevel: 3 })) }) }));
  assert.match(rendered, /Your day is clear/);
  assert.match(rendered, /The week is ready/);
  assert.match(rendered, /0 min/);
  assert.doesNotMatch(rendered, /Less than 1 min/);
  assert.match(rendered, /first achievement/);
  assert.match(rendered, /ready to grow/);
  assert.match(rendered, /href="\/app\/focus"/);
});

test("fully complete state uses persisted completion, not inferred reward state", () => {
  const complete = challengeViews(challenges.map(view => ({ ...view.current!, completed: true, progress: view.current!.target })));
  const rendered = html(fixture({ challenges: complete, tasks: [task("done", "2026-10-01", "completed")],
    city: citySummary({ buildings: Array.from({ length: 6 }, () => ({ level: 3, maxLevel: 3 })) }),
    achievements: { unlocked: 9, total: 9, next: null } }));
  assert.match(rendered, /All challenges for this period are complete/);
  assert.match(rendered, /Every achievement is unlocked/);
  assert.match(rendered, /Every City level is complete/);
});

test("unavailable subsystem reads never masquerade as genuine zero", () => {
  const rendered = html(fixture({ progress: null, tasks: null, challenges: null, achievements: null, city: null }));
  assert.match(rendered, /tasks are unavailable right now/);
  assert.match(rendered, /Challenge progress is unavailable/);
  assert.match(rendered, /Achievement progress is unavailable/);
  assert.match(rendered, /City progress is unavailable/);
  assert.doesNotMatch(rendered, /role="progressbar"/);
});

test("Arabic, English, long content and active Focus have accessible responsive markup", () => {
  const longTitle = "Long study task ".repeat(25);
  const data = fixture({ tasks: [task("long", "2026-10-01", "pending", longTitle)], activeFocus: "paused" });
  const en = html(data), ar = html(data, "ar");
  assert.match(en, /dir="ltr"/); assert.match(ar, /dir="rtl"/);
  assert.match(en, /Return to Focus/); assert.match(ar, /ارجع للتركيز/);
  assert.match(en, /aria-valuenow="1200"/);
  assert.match(en, /role="list"/);
  assert.match(en, /Long study task/);
  const css = readFileSync(new URL("../src/features/dashboard/dashboard.module.css", import.meta.url), "utf8");
  assert.match(css, /var\(--surface\)/); assert.match(css, /var\(--accent\)/);
  assert.match(css, /max-width: 390px/); assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /overflow-wrap: anywhere/); assert.match(css, /focus-visible/);
});

test("Dashboard aggregation and rendering are read-only with no receipt replay", () => {
  const data = readFileSync(new URL("../src/features/dashboard/data.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../src/features/dashboard/experience.tsx", import.meta.url), "utf8");
  assert.match(data, /Promise\.allSettled/);
  assert.match(data, /getFocusProgress\(\)/);
  assert.match(data, /getAchievements\(\)/);
  assert.match(data, /getChallenges\(\)/);
  assert.match(data, /getCityDashboardProgress\(\)/);
  assert.doesNotMatch(data + view, /evaluate_progression|claim_focus|claim_task|focusAction|mutate\(|sessionStorage|localStorage/);
  assert.doesNotMatch(view, /RewardToast|CityGrowthToast|AchievementRewardToast/);
});
