import { achievementCatalog, type AchievementKey } from "./achievements";
import type { AchievementProgress } from "./data";

export type AchievementState = "locked" | "in_progress" | "unlocked";

export type AchievementView = Readonly<{
  definition: (typeof achievementCatalog)[number];
  progress: number;
  target: number;
  percent: number;
  unlockedAt: string | null;
  state: AchievementState;
}>;

export function achievementViews(
  evidence: readonly AchievementProgress[],
  unlocked: readonly { achievementKey: AchievementKey; unlockedAt: string }[],
): AchievementView[] {
  const byKey = new Map(evidence.map((row) => [row.achievement_key, row]));
  const unlocks = new Map(unlocked.map((row) => [row.achievementKey, row.unlockedAt]));
  return achievementCatalog.map((definition) => {
    const row = byKey.get(definition.key);
    if (!row) throw new Error(`Missing achievement evidence: ${definition.key}`);
    const unlockedAt = unlocks.get(definition.key) ?? null;
    return {
      definition,
      progress: row.progress,
      target: row.target,
      percent: Math.min(100, Math.round(row.progress / row.target * 100)),
      unlockedAt,
      state: unlockedAt ? "unlocked" : row.progress > 0 ? "in_progress" : "locked",
    };
  });
}

export function almostThere(views: readonly AchievementView[], limit = 3) {
  return views.filter((view) => !view.unlockedAt && view.progress > 0 && view.progress < view.target)
    .sort((a, b) => b.progress / b.target - a.progress / a.target ||
      a.definition.key.localeCompare(b.definition.key))
    .slice(0, limit);
}

export function recentlyUnlocked(views: readonly AchievementView[], limit = 4) {
  return views.filter((view) => view.unlockedAt)
    .sort((a, b) => Date.parse(b.unlockedAt!) - Date.parse(a.unlockedAt!) ||
      a.definition.key.localeCompare(b.definition.key))
    .slice(0, limit);
}

/** A transient receipt may highlight only the matching persisted unlock. */
export function confirmedNewlyUnlockedKeys(
  views: readonly AchievementView[],
  receipts: readonly { key: AchievementKey; unlockedAt: string }[],
): AchievementKey[] {
  return receipts.filter((item) => views.some((view) =>
    view.definition.key === item.key && view.unlockedAt === item.unlockedAt))
    .map((item) => item.key);
}
