import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { buildingCatalog } from "../src/features/city/domain";
import { buildingView, citySummary, nextCityMilestone, type CityOverview } from "../src/features/city/overview";
import { cityGrowthFromClaim, confirmedRecentGrowth } from "../src/features/city/receipt";
import { confirmedTowerTransition, papercutState } from "../src/features/city/papercut";
import type { Progress } from "../src/features/focus/logic";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });
const { CityExperience } = await import("../src/app/app/city/city-experience");
const { CityBuildingArt } = await import("../src/app/app/city/city-building-art");

function overview(levels: number[] = [0, 0, 0, 0, 0, 0]): CityOverview {
  return {
    buildings: buildingCatalog.map((entry, index) => ({ ...entry, level: levels[index] ?? 0, autoPriority: index + 1 })),
    balances: { totalXp: 250, coins: 3, constructionPoints: 1 },
    evidence: { global_xp: 250, focus_minutes: 26, subject_xp: 105, completed_tasks: 1 },
    activity: [],
  };
}

function progress(seconds = 0, streak = 0): Progress {
  return { zone: "Africa/Cairo", today: "2026-10-07", weekStart: "2026-10-03", streak,
    totalSeconds: seconds, totalSessions: seconds ? 1 : 0,
    days: seconds ? [{ day: "2026-10-07", seconds, sessions: 1 }] : [], subjects: [], recent: [] };
}

function html(data: CityOverview | null, locale: "en" | "ar" = "en", focusProgress: Progress | null = null, dailyGoal: number | null = null) {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><CityExperience overview={data} focusProgress={focusProgress} dailyGoal={dailyGoal} /></LocaleProvider>);
}

test("Papercut stage uses only the persisted Focus Tower level", () => {
  for (const [level, stage] of ["foundation", "walls", "roof", "completed"].entries()) {
    const data = overview([3, level, 3, 3, 3, 3]);
    assert.equal(papercutState(data, progress(12_000), 60)?.stage, stage);
  }
  assert.equal(papercutState(overview([0, 0, 0, 0, 0, 0]), progress(12_000), 60)?.stage, "foundation");
});

test("today-to-goal ambient and streak windows are decorative, bounded and owner-read derived", () => {
  const data = overview();
  assert.deepEqual([0, 15, 48, 60].map(minutes => papercutState(data, progress(minutes * 60), 60)?.ambient), ["dawn", "morning", "golden", "golden"]);
  assert.deepEqual([0, 1, 3, 7].map(streak => papercutState(data, progress(0, streak), 60)?.litWindows), [1, 2, 3, 4]);
  assert.equal(papercutState(data, progress(9000, 7), 60)?.percent, 100);
  assert.equal(papercutState(data, progress(), 60)?.todayMinutes, 0);
});

test("unavailable City, Focus or goal never renders invented Papercut progress", () => {
  assert.equal(papercutState(null, progress(), 60), null);
  assert.equal(papercutState(overview(), null, 60), null);
  assert.equal(papercutState(overview(), progress(), null)?.goalMinutes, 120);
  assert.equal(papercutState(overview(), progress(), 0), null);
  const rendered = html(overview(), "en", null, 60);
  assert.match(rendered, /Focus Tower scene is unavailable/);
  assert.doesNotMatch(rendered, /TODAY&#x27;S FOCUS/);
});

test("Papercut matches Focus and Dashboard's 120-minute fallback for an unset saved goal", () => {
  const state = papercutState(overview([0, 1, 0, 0, 0, 0]), progress(60 * 60), null);
  assert.equal(state?.goalMinutes, 120);
  assert.equal(state?.ambient, "morning");
  assert.match(html(overview(), "en", progress(60 * 60), null), /60 \/ 120/);
});

test("Papercut SVG preserves LTR/RTL UI without mirroring the artwork", () => {
  const en = html(overview([0, 2, 0, 0, 0, 0]), "en", progress(1800, 3), 60);
  const ar = html(overview([0, 2, 0, 0, 0, 0]), "ar", progress(1800, 3), 60);
  assert.match(en, /data-ambient="morning"/);
  assert.match(en, /Roof/);
  assert.match(en, /30 \/ 60/);
  assert.match(ar, /dir="rtl"/);
  assert.match(ar, /السقف/);
  assert.match(ar, /<bdi dir="ltr">30 \/ 60<\/bdi>/);
  assert.match(en, /viewBox="0 0 640 310"/);
  assert.match(ar, /viewBox="0 0 640 310"/);
});

test("all six authoritative buildings render with owner levels and bilingual direction", () => {
  const en = html(overview([0, 1, 2, 3, 0, 0]));
  const ar = html(overview([0, 1, 2, 3, 0, 0]), "ar");
  assert.equal((en.match(/aria-controls="city-building-details"/g) ?? []).length, 6);
  assert.match(en, /Knowledge Center/);
  assert.match(en, /Focus Tower, Level 1/);
  assert.match(en, /Library District, Level 2/);
  assert.match(en, /Science Lab, Level 3, Max Level/);
  assert.match(en, /Language Academy, Level 0, Locked/);
  assert.match(ar, /dir="rtl"/);
  assert.match(ar, /مركز المعرفة/);
  assert.match(ar, /نقاط البناء/);
});

test("real requirements, balances, insufficient cost and automatic state are visible", () => {
  const rendered = html(overview());
  assert.match(rendered, /Total XP/);
  assert.match(rendered, /Construction Points/);
  assert.match(rendered, /100/);
  assert.match(rendered, /250/);
  assert.match(rendered, /10 \/ 3/);
  assert.match(rendered, /progresses automatically/);
  assert.doesNotMatch(rendered, /Upgrade now/);
  const first = buildingView(overview().buildings[0]!, overview());
  assert.equal(first.state, "available");
  assert.equal(first.affordable, false);
  const locked = buildingView(overview().buildings[5]!, overview());
  assert.equal(locked.state, "locked");
});

test("City completion is exactly 18 levels and max level has no next cost", () => {
  const data = overview([3, 3, 3, 3, 3, 3]);
  assert.deepEqual(citySummary(data), { completedLevels: 18, totalLevels: 18, built: 6, totalBuildings: 6, percent: 100 });
  assert.equal(nextCityMilestone(data), null);
  assert.equal(buildingView(data.buildings[0]!, data).cost, null);
  assert.match(html(data), /Every building is at its highest level/);
  const partial = html(overview([3, 2, 1, 0, 0, 0]));
  assert.match(partial, /This building has reached its highest level/);
  assert.doesNotMatch(partial, /Every building is at its highest level/);
  assert.equal(nextCityMilestone(overview())?.key, "knowledge_center");
});

test("unavailable reads never become fake zero progress", () => {
  const rendered = html(null);
  assert.match(rendered, /temporarily unavailable/);
  assert.doesNotMatch(rendered, /role="progressbar"/);
});

test("only a newly awarded, matching City receipt can animate and cannot replay", () => {
  const receipt = { awarded: true, eventId: "event-1", cityConstruction: [{ building: { building_key: "focus_tower", level: 1 } }] };
  assert.equal(cityGrowthFromClaim({ ...receipt, awarded: false }), null);
  assert.equal(cityGrowthFromClaim({ ...receipt, cityConstruction: [] }), null);
  const growth = cityGrowthFromClaim(receipt);
  assert.deepEqual(growth, { eventId: "event-1", source: "direct", buildings: [{ key: "focus_tower", level: 1 }] });
  const activity = [{ key: "focus_tower" as const, level: 1, at: "2026-09-30T00:00:00Z", sourceRewardEventId: "event-1" }];
  const raw = JSON.stringify({ at: 1000, growth });
  assert.deepEqual(confirmedRecentGrowth(raw, activity, 1001), ["focus_tower"]);
  assert.deepEqual(confirmedTowerTransition(raw, activity, 1001, 1), { from: 0, to: 1 });
  assert.equal(confirmedTowerTransition(raw, activity, 1001, 2), null);
  assert.equal(confirmedTowerTransition(raw, [], 1001, 1), null);
  assert.equal(confirmedTowerTransition(raw, activity, 400_001, 1), null);
  assert.deepEqual(confirmedRecentGrowth(raw, activity, 400_001), []);
  assert.deepEqual(confirmedRecentGrowth(raw, [], 1001), []);
  assert.deepEqual(confirmedRecentGrowth(null, activity, 1001), []);
  const challengeClaim = { awarded: true, cityConstruction: [], challenges: [{ eventId: "challenge-1", challengeKey: "daily_focus_25", xp: 50, coins: 10, cityConstruction: [{ building: { building_key: "library_district", level: 1 } }] }] };
  assert.deepEqual(cityGrowthFromClaim(challengeClaim), { eventId: "challenge-1", source: "challenge", buildings: [{ key: "library_district", level: 1 }] });
  assert.equal(cityGrowthFromClaim({ ...challengeClaim, awarded: false }), null);
});

test("multi-step Tower reveal requires each persisted transaction and a one-time consumed hint", () => {
  const growth = { eventId: "focus-award", buildings: [{ key: "focus_tower", level: 2 }, { key: "focus_tower", level: 3 }] };
  const raw = JSON.stringify({ at: 1000, growth });
  const activity = [2, 3].map(level => ({ key: "focus_tower" as const, level, at: "2026-10-07T00:00:00Z", sourceRewardEventId: "focus-award" }));
  assert.deepEqual(confirmedTowerTransition(raw, activity, 1001, 3), { from: 1, to: 3 });
  assert.equal(confirmedTowerTransition(raw, activity.slice(1), 1001, 3), null);
  assert.equal(confirmedTowerTransition(null, activity, 1001, 3), null);
  const presentation = readFileSync(new URL("../src/app/app/city/city-experience.tsx", import.meta.url), "utf8");
  const visual = readFileSync(new URL("../src/app/app/city/papercut-city.tsx", import.meta.url), "utf8");
  assert.match(presentation, /sessionStorage\.removeItem\(CITY_GROWTH_STORAGE_KEY\)/);
  assert.doesNotMatch(visual, /\.rpc\(|\.from\(|focusAction|claimReward/);
});

test("mobile, keyboard focus and reduced motion rules remain in the City stylesheet", () => {
  const css = readFileSync(new URL("../src/app/app/city/city.module.css", import.meta.url), "utf8");
  const papercutCss = readFileSync(new URL("../src/app/app/city/papercut-city.module.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 720px/);
  assert.match(css, /max-width: 440px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(papercutCss, /max-width: 600px/);
  assert.match(papercutCss, /:focus-visible/);
  assert.match(papercutCss, /prefers-reduced-motion: reduce/);
  assert.match(papercutCss, /animation: none/);
});

test("six distinct vector buildings reflect persisted levels without client-side guesses", () => {
  for (const entry of buildingCatalog) {
    const art = renderToStaticMarkup(<CityBuildingArt kind={entry.key} level={1} />);
    assert.match(art, new RegExp(`data-art-kind="${entry.key}"`));
    assert.match(art, /class="artPlatform"/);
  }
  const locked = renderToStaticMarkup(<CityBuildingArt kind="science_lab" level={0} />);
  const built = renderToStaticMarkup(<CityBuildingArt kind="science_lab" level={1} />);
  const upgraded = renderToStaticMarkup(<CityBuildingArt kind="science_lab" level={2} />);
  const max = renderToStaticMarkup(<CityBuildingArt kind="science_lab" level={3} />);
  assert.match(locked, /artScaffold/);
  assert.doesNotMatch(built, /artScaffold/);
  assert.notEqual(built, upgraded);
  assert.match(max, /artGold/);
  assert.doesNotMatch(upgraded, /artGold/);
});

test("selection stays a stationary semantic hit target with a linked live details panel", () => {
  const rendered = html(overview([2, 3, 1, 0, 2, 0]));
  const css = readFileSync(new URL("../src/app/app/city/city.module.css", import.meta.url), "utf8");
  assert.equal((rendered.match(/data-building="/g) ?? []).length, 6);
  assert.match(rendered, /data-building="knowledge_center"[^>]*aria-pressed="true"/);
  assert.match(rendered, /id="city-building-details"[^>]*aria-label="Building details"/);
  assert.match(rendered, /aria-live="polite"/);
  assert.match(rendered, /Your city progresses automatically/);
  assert.match(rendered, /Recent City Activity/);
  assert.match(css, /\.building \{[^}]*transition: none/);
  assert.match(css, /\.city \.map \.building:hover, \.city \.map \.building:active \{[^}]*transform: translate\(-50%,-50%\)/);
  assert.match(css, /\.building:hover \.buildingArt/);
  assert.match(css, /\.map \{[^}]*overflow: hidden/);
});
