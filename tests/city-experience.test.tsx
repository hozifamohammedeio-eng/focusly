import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { buildingCatalog } from "../src/features/city/domain";
import { buildingView, citySummary, nextCityMilestone, type CityOverview } from "../src/features/city/overview";
import { cityGrowthFromClaim, confirmedRecentGrowth } from "../src/features/city/receipt";

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

function html(data: CityOverview | null, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><CityExperience overview={data} /></LocaleProvider>);
}

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
  assert.deepEqual(confirmedRecentGrowth(raw, activity, 400_001), []);
  assert.deepEqual(confirmedRecentGrowth(raw, [], 1001), []);
  assert.deepEqual(confirmedRecentGrowth(null, activity, 1001), []);
  const challengeClaim = { awarded: true, cityConstruction: [], challenges: [{ eventId: "challenge-1", challengeKey: "daily_focus_25", xp: 50, coins: 10, cityConstruction: [{ building: { building_key: "library_district", level: 1 } }] }] };
  assert.deepEqual(cityGrowthFromClaim(challengeClaim), { eventId: "challenge-1", source: "challenge", buildings: [{ key: "library_district", level: 1 }] });
  assert.equal(cityGrowthFromClaim({ ...challengeClaim, awarded: false }), null);
});

test("mobile, keyboard focus and reduced motion rules remain in the City stylesheet", () => {
  const css = readFileSync(new URL("../src/app/app/city/city.module.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 720px/);
  assert.match(css, /max-width: 440px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
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
