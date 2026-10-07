import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });

const { TimerDemo, TaskDemo, CityDemo, CompanionDemo, demoTimerNext, demoCityVisibleBuildings } = await import("../src/features/landing/demos");

test("illustrative timer counts down to zero and stays stopped", () => {
  let remaining: number | null = 8;
  for (let tick = 0; tick < 8; tick++) remaining = demoTimerNext(remaining);
  assert.equal(remaining, 0);
  assert.equal(demoTimerNext(remaining), 0);
  assert.equal(demoTimerNext(null), null);
  const markup = renderToStaticMarkup(<TimerDemo ar={false} />);
  assert.match(markup, /25:00/);
  assert.match(markup, /8-second illustrative demo/);
  assert.match(markup, /Start Focus Session/);
});

test("task and City demos identify their illustrative, non-persistent controls", () => {
  const task = renderToStaticMarkup(<TaskDemo ar={false} />);
  const city = renderToStaticMarkup(<CityDemo ar={false} />);
  assert.match(task, /type="checkbox"/);
  assert.doesNotMatch(task, /\+10 XP/);
  assert.equal((city.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(city, /not the real progression formula/);
  assert.deepEqual([0, 1, 2, 3].map(demoCityVisibleBuildings), [2, 3, 5, 6]);
});

test("Arabic demos retain explanatory copy and the Companion action", () => {
  const timer = renderToStaticMarkup(<TimerDemo ar />);
  const companion = renderToStaticMarkup(<CompanionDemo ar><p>محادثة توضيحية</p></CompanionDemo>);
  assert.match(timer, /تجربة توضيحية/);
  assert.match(companion, /جرّب التغيير التوضيحي/);
  assert.match(companion, /الهدف اليومي/);
  assert.match(companion, /اضغط عشان تشوف رد الرفيق/);
  assert.doesNotMatch(companion, /هدفك اليومي بقى ٩٠ دقيقة/);
});
