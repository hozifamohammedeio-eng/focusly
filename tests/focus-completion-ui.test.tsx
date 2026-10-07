import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../src/features/i18n/locale-provider";
import type { CityGrowth } from "../src/features/city/receipt";
import { completionAlreadyShowsCityGrowth } from "../src/features/focus/completion";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });

const { CompletionMoment } = await import("../src/features/focus/completion-card");
const { CityGrowthToast } = await import("../src/features/city/growth-toast");

test("one confirmed City reward renders one City announcement while preserving completion and XP", () => {
  const growth: CityGrowth = { eventId: "reward-1", source: "direct", buildings: [{ key: "focus_tower", level: 1 }] };
  const completion = { growth };
  const markup = renderToStaticMarkup(<LocaleProvider initial="en">
    <CompletionMoment locale="en" message={0} xp={25} growth={growth} />
    <CityGrowthToast growth={growth} onDismiss={() => {}} suppressAnnouncement={completionAlreadyShowsCityGrowth(completion, growth)} />
  </LocaleProvider>);
  assert.match(markup, /Nicely done/);
  assert.match(markup, /\+25 XP/);
  assert.equal((markup.match(/Your city just grew/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /Your study helped your city grow/);
  const toastOnly = renderToStaticMarkup(<LocaleProvider initial="en">
    <CityGrowthToast growth={growth} onDismiss={() => {}} suppressAnnouncement={completionAlreadyShowsCityGrowth(null, growth)} />
  </LocaleProvider>);
  assert.match(toastOnly, /Your study helped your city grow/);
});
