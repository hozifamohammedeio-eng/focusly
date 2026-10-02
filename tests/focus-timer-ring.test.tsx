import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", source: "export default new Proxy({}, { get: (_, key) => String(key) });", shortCircuit: true };
  return nextLoad(url, context);
} });

const { FocusDial, stopwatchDigits } = await import("../src/features/focus/timer");
const css = readFileSync(new URL("../src/features/focus/timer.module.css", import.meta.url), "utf8");
const circumference = 2 * Math.PI * 162;

function dial(value: string, progress: number | null, ariaLabel = "Focus") {
  return renderToStaticMarkup(<FocusDial value={value} progress={progress} status="Running" ariaLabel={ariaLabel} />);
}

function circles(html: string) {
  return [...html.matchAll(/<circle\b[^>]*>/g)].map(([circle]) => circle);
}

function offset(circle: string) {
  return Number(circle.match(/stroke-dashoffset="([^"]+)"/)?.[1]);
}

test("Open Study has a static full track but no progress arc or dash", () => {
  const html = dial("00:00:04", null);
  assert.equal(circles(html).length, 1);
  assert.match(circles(html)[0]!, /ringTrack/);
  assert.doesNotMatch(html, /ringProgress|ringIdle|stroke-dasharray|stroke-dashoffset|role="progressbar"/);
  assert.doesNotMatch(css, /\.ringIdle|focusIdleRing/);
});

test("Open Study clock increases and keeps a stable eight-digit format", () => {
  assert.equal(stopwatchDigits(0), "00:00:00");
  assert.equal(stopwatchDigits(4), "00:00:04");
  assert.equal(stopwatchDigits(4532), "01:15:32");
  assert.equal(stopwatchDigits(45296), "12:34:56");
  assert.match(dial(stopwatchDigits(4), null), /00:00:04/);
});

test("Pomodoro renders a complete background track and a separate progress circle", () => {
  const html = dial("25:00", 1);
  assert.equal(circles(html).length, 2);
  assert.match(circles(html)[0]!, /ringTrack/);
  assert.match(circles(html)[1]!, /ringProgress/);
  assert.match(html, /viewBox="0 0 360 360"/);
  assert.match(css, /rotate\(-90deg\)/);
  assert.match(css, /transform-origin:\s*center/);
});

test("fixed ring is full at start, half at midpoint, and empty at completion", () => {
  const start = circles(dial("25:00", 1))[1]!;
  const half = circles(dial("12:30", 0.5))[1]!;
  const end = circles(dial("00:00", 0))[1]!;
  assert.equal(offset(start), 0);
  assert.ok(Math.abs(offset(half) - circumference / 2) < 0.001);
  assert.ok(Math.abs(offset(end) - circumference) < 0.001);
  assert.equal(start.match(/stroke-dasharray="([^"]+)"/)?.[1], `${circumference} ${circumference}`);
  assert.match(css, /stroke-linecap:\s*butt/);
});

test("fixed progress clamps to the valid range and rejects nonfinite values", () => {
  assert.equal(offset(circles(dial("25:00", 2))[1]!), 0);
  assert.ok(Math.abs(offset(circles(dial("00:00", -1))[1]!) - circumference) < 0.001);
  assert.ok(Math.abs(offset(circles(dial("00:00", Number.NaN))[1]!) - circumference) < 0.001);
});

test("pause and resume preserve the authoritative remaining fraction", () => {
  const pausedOffset = offset(circles(dial("12:30", 0.5))[1]!);
  const recoveredOffset = offset(circles(dial("12:30", 0.5))[1]!);
  const resumedOffset = offset(circles(dial("12:15", 0.49))[1]!);
  assert.ok(Math.abs(pausedOffset - circumference / 2) < 0.001);
  assert.equal(recoveredOffset, pausedOffset);
  assert.ok(resumedOffset > pausedOffset);
  assert.match(css, /stroke-dashoffset 900ms linear/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("long digits remain LTR and receive responsive, tabular typography", () => {
  for (const value of ["00:00:00", "01:15:32", "12:34:56"]) {
    const html = dial(value, null, "التركيز");
    assert.match(html, new RegExp(`dir="ltr"[^>]*class="time timeLong"[^>]*>${value}`));
    assert.match(html, new RegExp(`التركيز: ${value}`));
  }
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.timeLong\s*\{\s*font-size:\s*clamp\(/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /unicode-bidi:\s*isolate/);
});

test("desktop and 390px mobile dial sizes stay within the intended bounds", () => {
  assert.match(css, /\.dial\s*\{[^}]*clamp\(280px, 31vw, 340px\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.dial\s*\{[^}]*clamp\(220px, 68vw, 280px\)/);
  assert.match(css, /\.timeLong\s*\{\s*font-size:\s*clamp\(1\.65rem, 7\.5vw, 2rem\)/);
});
