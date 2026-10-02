export type GroupKey = "study" | "focus" | "progress";
export type PageKey = "home" | "subjects" | "tasks" | "planner" | "calendar" | "schedule" | "focus" | "statistics" | "challenges" | "achievements" | "city" | "profile" | "settings";

export const navigationGroups: ReadonlyArray<{ key: GroupKey; pages: ReadonlyArray<{ key: PageKey; url: string }> }> = [
  { key: "study", pages: [
    { key: "subjects", url: "/app/subjects" },
    { key: "tasks", url: "/app/tasks" },
    { key: "planner", url: "/app/planner" },
    { key: "calendar", url: "/app/calendar" },
    { key: "schedule", url: "/app/schedule" },
  ] },
  { key: "focus", pages: [
    { key: "focus", url: "/app/focus" },
    { key: "statistics", url: "/app/statistics" },
  ] },
  { key: "progress", pages: [
    { key: "challenges", url: "/app/challenges" },
    { key: "achievements", url: "/app/achievements" },
    { key: "city", url: "/app/city" },
  ] },
];

export function routeIsActive(path: string, url: string) {
  return url === "/app" ? path === url : path === url || path.startsWith(`${url}/`);
}

export function groupForRoute(path: string): GroupKey | null {
  return navigationGroups.find((group) => group.pages.some((page) => routeIsActive(path, page.url)))?.key ?? null;
}
