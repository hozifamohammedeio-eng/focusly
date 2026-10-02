import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { groupForRoute, navigationGroups, routeIsActive } from "../src/features/planning/navigation-model";

test("four primary destinations cover every existing study and progress page without duplicates", () => {
  assert.deepEqual(navigationGroups.map(({ key }) => key), ["study", "focus", "progress"]);
  const urls = ["/app", ...navigationGroups.flatMap(({ pages }) => pages.map(({ url }) => url))];
  assert.equal(new Set(urls).size, urls.length);
  assert.deepEqual(urls, [
    "/app", "/app/subjects", "/app/tasks", "/app/planner", "/app/calendar", "/app/schedule",
    "/app/focus", "/app/statistics", "/app/challenges", "/app/achievements", "/app/city",
  ]);
});

test("the current route opens its group and highlights only its own page", () => {
  for (const group of navigationGroups) {
    for (const page of group.pages) {
      assert.equal(groupForRoute(page.url), group.key);
      assert.equal(groupForRoute(`${page.url}/detail`), group.key);
      assert.equal(routeIsActive(page.url, page.url), true);
    }
  }
  assert.equal(groupForRoute("/app"), null);
  assert.equal(groupForRoute("/app/profile"), null);
  assert.equal(groupForRoute("/app/settings"), null);
  assert.equal(routeIsActive("/app/tasks", "/app"), false);
  assert.equal(routeIsActive("/app/tasks-old", "/app/tasks"), false);
});

test("the compact timer and drawer retain mobile and reduced-motion boundaries", () => {
  const timer = readFileSync(new URL("../src/features/focus/timer.module.css", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../src/features/planning/liquid-navigation.module.css", import.meta.url), "utf8");
  assert.match(timer, /\.dial\s*\{[^}]*clamp\(280px, 31vw, 340px\)/);
  assert.match(timer, /@media \(max-width: 600px\)[\s\S]*?\.dial\s*\{[^}]*clamp\(220px, 68vw, 280px\)/);
  assert.match(timer, /prefers-reduced-motion: reduce/);
  assert.match(nav, /\.drawer\s*\{[^}]*min\(310px, 88vw\)/);
  assert.match(nav, /prefers-reduced-motion: reduce/);
});
