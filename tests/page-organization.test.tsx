import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { LocaleProvider } from "../src/features/i18n/locale-provider";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "next/navigation") {
      return { url: "data:text/javascript,export function useRouter(){return {refresh(){}}};export function redirect(){}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".module.css")) return { format: "module", source: "export default {}", shortCircuit: true };
    return nextLoad(url, context);
  },
});

const { ScheduleManager } = await import("../src/features/schedule/schedule-manager");
const { ProfileView } = await import("../src/features/profile/profile-ui");

test("Schedule presents the timetable first and keeps editing behind its primary action", () => {
  const markup = renderToStaticMarkup(<ScheduleManager items={[]} subjects={[]} zone="Africa/Cairo" locale="en" />);
  assert.match(markup, /Add schedule item/);
  assert.match(markup, /No schedule items yet/);
  assert.match(markup, /Schedule notifications/);
  assert.doesNotMatch(markup, /<form/);
  assert.ok(markup.indexOf("No schedule items yet") < markup.indexOf("Schedule notifications"));
  const hidden = { id: "disabled", enabled: false, weekday: 6 } as Parameters<typeof ScheduleManager>[0]["items"][number];
  const withoutVisibleItems = renderToStaticMarkup(<ScheduleManager items={[hidden]} subjects={[]} zone="Africa/Cairo" locale="en" />);
  assert.match(withoutVisibleItems, /No schedule items yet/);
  const lesson = {
    id: "lesson", title: "Physics class", kind: "lesson", enabled: true, weekday: 6,
    local_time: "10:30:00", subject_id: null, remind_before_minutes: 30,
  } as Parameters<typeof ScheduleManager>[0]["items"][number];
  const withLesson = renderToStaticMarkup(<ScheduleManager items={[lesson]} subjects={[]} zone="Africa/Cairo" locale="en" />);
  assert.ok(withLesson.indexOf("Physics class") < withLesson.indexOf("Schedule notifications"));
  assert.match(withLesson, /10:30/);
  assert.match(withLesson, /30 minutes before/);
  const arabic = renderToStaticMarkup(<ScheduleManager items={[lesson]} subjects={[]} zone="Africa/Cairo" locale="ar" />);
  assert.match(arabic, /جدول الدروس والمحاضرات/);
  assert.match(arabic, /قبل 30 دقيقة/);
});

test("Profile presents one study summary before its secondary edit form in both languages", () => {
  const profile = {
    display_name: "QA Student", school_stage: null, school_year: null, education_system: null,
    academic_branch: null, academic_track: null, specialization_subject: null, daily_goal_minutes: 120,
  } as Parameters<typeof ProfileView>[0]["profile"];
  const progress = {
    zone: "Africa/Cairo", today: "2026-10-02", weekStart: "2026-09-26", streak: 0,
    totalSeconds: 0, totalSessions: 0, days: [], subjects: [], recent: [],
  };
  for (const locale of ["en", "ar"] as const) {
    const markup = renderToStaticMarkup(<LocaleProvider initial={locale}>
      <ProfileView profile={profile} email="qa@example.test" subjectsCount={2} progress={progress} />
    </LocaleProvider>);
    assert.equal((markup.match(/<dt /g) ?? []).length, 6);
    assert.ok(markup.indexOf('class="profile-facts"') < markup.indexOf('class="profile-editor"'));
    assert.match(markup, /<details class="profile-editor" open=""/);
    assert.ok(markup.includes(locale === "ar" ? "ملخص المذاكرة" : "Study at a glance"));
  }
});
