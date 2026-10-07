import { todaySeconds, type Progress } from "@/features/focus/logic";
import { confirmedRecentGrowth } from "./receipt";
import type { CityActivity, CityOverview } from "./overview";

export type PapercutStage = "foundation" | "walls" | "roof" | "completed";
export type AmbientLight = "dawn" | "morning" | "golden";

const stages = ["foundation", "walls", "roof", "completed"] as const;

/** Visual state is derived from owner-scoped reads. It never determines construction. */
export function papercutState(overview: CityOverview | null, progress: Progress | null, goalMinutes: number | null) {
  const tower = overview?.buildings.find(building => building.key === "focus_tower");
  // Match the existing Focus and Dashboard goal when an older profile has no saved goal.
  const effectiveGoal = goalMinutes ?? 120;
  if (!tower || !progress || !Number.isSafeInteger(tower.level) || tower.level < 0 || tower.level > 3 ||
    !Number.isFinite(effectiveGoal) || effectiveGoal <= 0 ||
    !Number.isSafeInteger(progress.streak) || progress.streak < 0 ||
    !Array.isArray(progress.days) || typeof progress.today !== "string") return null;
  const today = progress.days.find(day => day.day === progress.today);
  // The Focus RPC omits zero-study days, but a present day must be valid.
  if (today && (!Number.isFinite(today.seconds) || today.seconds < 0)) return null;
  const seconds = todaySeconds(progress);
  const ratio = seconds / (effectiveGoal * 60);
  return {
    stage: stages[tower.level],
    level: tower.level,
    ambient: (ratio >= .8 ? "golden" : ratio >= .25 ? "morning" : "dawn") as AmbientLight,
    todayMinutes: Math.floor(seconds / 60),
    goalMinutes: effectiveGoal,
    percent: Math.min(100, Math.round(ratio * 100)),
    streak: progress.streak,
    litWindows: progress.streak >= 7 ? 4 : progress.streak >= 3 ? 3 : progress.streak >= 1 ? 2 : 1,
  };
}

/** Only a consumed, recent receipt whose every Tower step matches persisted activity may animate. */
export function confirmedTowerTransition(raw: string | null, activity: readonly CityActivity[], now: number, currentLevel: number) {
  if (!confirmedRecentGrowth(raw, activity, now).includes("focus_tower") || !raw) return null;
  try {
    const growth = JSON.parse(raw).growth as { eventId?: unknown; buildings?: unknown };
    if (typeof growth.eventId !== "string" || !Array.isArray(growth.buildings)) return null;
    const levels = growth.buildings.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      return row.key === "focus_tower" && Number.isInteger(row.level) ? [row.level as number] : [];
    }).sort((a, b) => a - b);
    const firstLevel = levels[0];
    if (firstLevel === undefined || levels.at(-1) !== currentLevel || firstLevel < 1 ||
      levels.some((level, index) => level !== firstLevel + index ||
        !activity.some(event => event.sourceRewardEventId === growth.eventId && event.key === "focus_tower" && event.level === level))) return null;
    return { from: firstLevel - 1, to: currentLevel };
  } catch { return null; }
}
