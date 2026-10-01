import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import { statisticsWeek, subjectShare } from "../src/features/focus/statistics-view";
import { dashboardFocusWeek } from "../src/features/dashboard/overview";
import { groupSessions, weekDays, type Progress } from "../src/features/focus/logic";
import { dayInZone, weekStart, type Subject } from "../src/features/planning/logic";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });
const { StatisticsExperience } = await import("../src/app/app/statistics/statistics-experience");

const progress: Progress = {
  zone: "Africa/Cairo", today: "2026-10-01", weekStart: "2026-09-26", streak: 2,
  totalSeconds: 7200, totalSessions: 4,
  days: [{ day: "2026-09-26", seconds: 1800, sessions: 1 }, { day: "2026-10-01", seconds: 1200, sessions: 1 }],
  subjects: [{ subject_id: "math", seconds: 3600 }, { subject_id: null, seconds: 2400 }, { subject_id: "deleted", seconds: 1200 }],
  recent: [{ id: "session-1", subject_id: null, duration_seconds: 1200, ended_at: "2026-10-01T12:00:00Z" }],
};
const subjects = [{ id: "math", name: "Mathematics" }] as Subject[];
function html(data: Progress, locale: "en" | "ar" = "en") {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><StatisticsExperience progress={data} subjects={subjects} /></LocaleProvider>);
}

test("Statistics uses the Dashboard focus source and Saturday–Friday saved-zone week", () => {
  const result = statisticsWeek(progress);
  assert.equal(weekStart(progress.today), "2026-09-26");
  assert.equal(result.days[0]?.day, "2026-09-26");
  assert.equal(result.days[6]?.day, "2026-10-02");
  assert.deepEqual(result.days, weekDays(progress));
  assert.equal(result.seconds, 3000);
  assert.equal(result.sessions, 2);
  assert.equal(result.activeDays, 2);
  assert.equal(result.streak, dashboardFocusWeek(progress).streak);
  assert.equal(result.seconds, dashboardFocusWeek(progress).weekSeconds);
  assert.equal(dayInZone("2026-09-30T22:30:00Z", progress.zone), progress.today);
  const grouped = groupSessions([{ completed: true, duration_seconds: 1200, ended_at: "2026-09-30T22:30:00Z", subject_id: null }], progress.zone);
  assert.equal(grouped.days.get(progress.today), 1200);
});

test("weekly visualization names all seven days, marks today and keeps zero honest", () => {
  const rendered = html(progress);
  assert.equal((rendered.match(/role="listitem"/g) ?? []).length, 7);
  assert.match(rendered, /Saturday: 30 min/);
  assert.match(rendered, /Thursday: 20 min, Today/);
  assert.match(rendered, /Friday: 0 min/);
  assert.match(rendered, /Current streak/);
  assert.doesNotMatch(rendered, /from last week|vs last week|\+18%/i);
});

test("subject shares preserve unassigned and removed-subject attribution", () => {
  assert.equal(subjectShare(2400, 7200), 33);
  assert.equal(subjectShare(0, 0), 0);
  const rendered = html(progress);
  assert.match(rendered, /Mathematics/);
  assert.match(rendered, /General \/ Unassigned/);
  assert.match(rendered, /Removed subject/);
  assert.match(rendered, /33%/);
  assert.match(rendered, /role="progressbar"/);
});

test("new users see a useful next action instead of a zero-card grid", () => {
  const rendered = html({ ...progress, totalSeconds: 0, totalSessions: 0, days: [], subjects: [], recent: [], streak: 0 });
  assert.match(rendered, /Your story starts with one session/);
  assert.match(rendered, /href="\/app\/focus"/);
  assert.doesNotMatch(rendered, /role="progressbar"|0 min/);
  assert.match(rendered, /How studying grows your world/);
});

test("a genuine zero-study week remains distinct from unavailable progress", () => {
  const rendered = html({ ...progress, days: [], streak: 0 });
  assert.match(rendered, /No Focus sessions this week yet/);
  assert.match(rendered, /Focus this week<\/span><strong>0 min/);
  assert.doesNotMatch(rendered, /Your story starts with one session/);
  const source = readFileSync(new URL("../src/features/focus/data.ts", import.meta.url), "utf8");
  assert.match(source, /if \(result\.error \|\| !result\.data\) throw new Error\("Progress unavailable"\)/);
});

test("resource explanation and bilingual RTL rendering stay lightweight", () => {
  const en = html(progress);
  const ar = html(progress, "ar");
  assert.match(en, /XP/);
  assert.match(en, /Coins/);
  assert.match(en, /Construction Points/);
  assert.match(en, /href="\/app\/achievements"/);
  assert.match(en, /href="\/app\/city"/);
  assert.match(ar, /dir="rtl"/);
  assert.match(ar, /وقت مذاكرتك حسب المادة/);
  assert.match(ar, /عام \/ بدون مادة/);
});

test("responsive, focus and reduced-motion styles are present without a chart package", () => {
  const css = readFileSync(new URL("../src/app/app/statistics/statistics.module.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 760px/);
  assert.match(css, /max-width: 520px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
