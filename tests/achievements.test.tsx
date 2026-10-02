import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { achievementCatalog } from "../src/features/progression/achievements";
import { achievementViews, almostThere, recentlyUnlocked, confirmedNewlyUnlockedKeys } from "../src/features/progression/achievement-view";
import { achievementAwardsFromEvaluation, recentAchievementKeys } from "../src/features/progression/achievement-receipt";
import { AchievementSummaryWidget } from "../src/features/progression/achievement-summary";
import { AchievementRewardToast } from "../src/features/progression/achievement-toast";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });
const { AchievementsExperience } = await import("../src/app/app/achievements/achievements-experience");

const targets: Record<string, number> = {
  first_focus: 1, focus_5: 5, focus_60_minutes: 60, focus_300_minutes: 300,
  first_task: 1, tasks_10: 10, level_2: 100, level_5: 550, first_subject_level_2: 100,
};
const evidence = achievementCatalog.map((item) => ({ achievement_key: item.key, progress: 0, target: targets[item.key]! }));
function views(progress: Record<string, number> = {}, unlocked: Array<{ achievementKey: (typeof achievementCatalog)[number]["key"]; unlockedAt: string }> = []) {
  return achievementViews(evidence.map((item) => ({ ...item, progress: progress[item.achievement_key] ?? 0 })), unlocked);
}
function html(value: ReturnType<typeof views> | null, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><AchievementsExperience views={value} /></LocaleProvider>);
}

test("full catalog, locked starting state, bilingual RTL, and no manual claim", () => {
  const en = html(views());
  const ar = html(views(), "ar");
  assert.equal((en.match(/data-state="locked"/g) ?? []).length, 9);
  assert.match(en, /Your collection starts here/);
  assert.match(en, /First Focus/);
  assert.match(en, /Subject Scholar/);
  assert.match(ar, /dir="rtl"/);
  assert.match(ar, /إنجازاتك/);
  assert.doesNotMatch(en, />Claim</);
  assert.doesNotMatch(ar, />استلام</);
});

test("in-progress and unlocked states use numeric evidence and persisted dates", () => {
  const value = views({ focus_5: 3, tasks_10: 5 }, [{ achievementKey: "first_focus", unlockedAt: "2026-09-30T12:00:00Z" }]);
  const rendered = html(value);
  assert.match(rendered, /3 \/ 5 sessions/);
  assert.match(rendered, /aria-valuenow="3"/);
  assert.match(rendered, /data-state="in_progress"/);
  assert.match(rendered, /data-state="unlocked"/);
  assert.match(rendered, /Recently unlocked/);
  assert.ok(rendered.indexOf('id="achievements-collection-title"') < rendered.indexOf('id="achievements-recent-title"'));
  assert.match(rendered, /\+50 XP/);
  assert.equal(value.find((item) => item.definition.key === "first_focus")?.state, "unlocked");
});

test("reached evidence without an unlock row remains in progress", () => {
  const value = views({ first_focus: 1 });
  assert.equal(value[0]?.state, "in_progress");
  assert.equal(value[0]?.percent, 100);
  assert.equal(value[0]?.unlockedAt, null);
});

test("almost-there sorting excludes binary zero progress and completed unlocks", () => {
  const value = views({ focus_5: 4, focus_60_minutes: 30, tasks_10: 8, level_2: 100 },
    [{ achievementKey: "tasks_10", unlockedAt: "2026-09-30T12:00:00Z" }]);
  assert.deepEqual(almostThere(value).map((item) => item.definition.key), ["focus_5", "focus_60_minutes"]);
});

test("recent unlocks use actual timestamps and remain visible when all complete", () => {
  const keys = achievementCatalog.map((item, index) => ({ achievementKey: item.key, unlockedAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString() }));
  const value = views({}, keys);
  assert.deepEqual(recentlyUnlocked(value, 3).map((item) => item.definition.key), ["first_subject_level_2", "level_5", "level_2"]);
  assert.match(html(value), /Every achievement is yours/);
  assert.equal((html(value).match(/data-state="unlocked"/g) ?? []).length, 9);
});

test("unavailable reads never render fake zero progress", () => {
  const rendered = html(null);
  assert.match(rendered, /progress is unavailable/);
  assert.doesNotMatch(rendered, /role="progressbar"/);
});

test("only new trusted evaluated unlocks produce receipts and one-time hints", () => {
  const row = { achievementKey: "first_focus", unlockedAt: "2026-10-01T09:00:00Z", reward: { xp: 5, coins: 5, constructionPoints: 0 } };
  assert.deepEqual(achievementAwardsFromEvaluation({ awarded: false }, [row]), []);
  assert.deepEqual(achievementAwardsFromEvaluation({ awarded: true }, [{ ...row, reward: { xp: 500, coins: 5, constructionPoints: 0 } }]), []);
  assert.deepEqual(achievementAwardsFromEvaluation({ awarded: true }, [{ ...row, achievementKey: "made_up" }]), []);
  const awards = achievementAwardsFromEvaluation({ awarded: true }, [row, row]);
  assert.deepEqual(awards, [{ key: "first_focus", unlockedAt: row.unlockedAt, xp: 5, coins: 5 }]);
  const toast = renderToStaticMarkup(<LocaleProvider initial="en"><AchievementRewardToast awards={awards} onDismiss={() => {}} /></LocaleProvider>);
  assert.match(toast, /Newly unlocked/);
  assert.match(toast, /\+5 XP/);
  assert.deepEqual(recentAchievementKeys(JSON.stringify({ at: 1000, unlocks: [{ key: "first_focus", unlockedAt: row.unlockedAt }, { key: "first_focus", unlockedAt: row.unlockedAt }, { key: "unknown", unlockedAt: row.unlockedAt }] }), 1001), [{ key: "first_focus", unlockedAt: row.unlockedAt }]);
  assert.deepEqual(recentAchievementKeys(JSON.stringify({ at: 1000, unlocks: [{ key: "first_focus", unlockedAt: row.unlockedAt }] }), 301_001), []);
  const persisted = views({ first_focus: 1 }, [{ achievementKey: "first_focus", unlockedAt: row.unlockedAt }]);
  assert.deepEqual(confirmedNewlyUnlockedKeys(persisted, [{ key: "first_focus", unlockedAt: row.unlockedAt }]), ["first_focus"]);
  assert.deepEqual(confirmedNewlyUnlockedKeys(persisted, [{ key: "first_focus", unlockedAt: "2026-09-01T00:00:00Z" }]), []);
});

test("Dashboard widget reads compact summary and localizes both languages", () => {
  const summary = { count: 1, total: 9, latest: { key: "first_focus" as const, unlockedAt: "2026-10-01T09:00:00Z" } };
  for (const locale of ["en", "ar"] as const) {
    const rendered = renderToStaticMarkup(<LocaleProvider initial={locale}><AchievementSummaryWidget summary={summary} /></LocaleProvider>);
    assert.match(rendered, /href="\/app\/achievements"/);
    assert.match(rendered, /1 \/ 9/);
    assert.ok(rendered.includes(locale === "ar" ? "أول تركيز" : "First Focus"));
  }
});

test("mobile, keyboard focus, themes, and reduced motion are supported by styles", () => {
  const css = readFileSync(new URL("../src/app/app/achievements/achievements.module.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 720px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /var\(--surface\)/);
});
