import { getAchievementDefinition, type AchievementKey } from "./achievements";

export type AchievementAward = Readonly<{
  key: AchievementKey;
  unlockedAt: string;
  xp: number;
  coins: number;
}>;

export const NEW_ACHIEVEMENTS_KEY = "focusly-new-achievements";

/** Evaluation output is shown only in response to a newly awarded trusted claim. */
export function achievementAwardsFromEvaluation(claim: unknown, evaluation: unknown): AchievementAward[] {
  if (!claim || typeof claim !== "object" || (claim as Record<string, unknown>).awarded !== true || !Array.isArray(evaluation)) return [];
  const seen = new Set<AchievementKey>();
  return evaluation.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const definition = typeof row.achievementKey === "string" ? getAchievementDefinition(row.achievementKey) : undefined;
    const reward = row.reward && typeof row.reward === "object" ? row.reward as Record<string, unknown> : null;
    if (!definition || seen.has(definition.key) || typeof row.unlockedAt !== "string" ||
      !Number.isFinite(Date.parse(row.unlockedAt)) || !reward ||
      reward.xp !== definition.rewards.xp || reward.coins !== definition.rewards.coins ||
      reward.constructionPoints !== definition.rewards.constructionPoints) return [];
    seen.add(definition.key);
    return [{ key: definition.key, unlockedAt: row.unlockedAt, xp: definition.rewards.xp, coins: definition.rewards.coins }];
  });
}

/** A one-time UI hint; callers remove the storage item before showing it. */
export function recentAchievementKeys(raw: string | null, now: number): Array<{ key: AchievementKey; unlockedAt: string }> {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as { at?: unknown; unlocks?: unknown };
    if (typeof value.at !== "number" || now < value.at || now - value.at > 300_000 || !Array.isArray(value.unlocks)) return [];
    const seen = new Set<AchievementKey>();
    return value.unlocks.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.key !== "string" || !getAchievementDefinition(row.key) || seen.has(row.key as AchievementKey) ||
        typeof row.unlockedAt !== "string" || !Number.isFinite(Date.parse(row.unlockedAt))) return [];
      seen.add(row.key as AchievementKey);
      return [{ key: row.key as AchievementKey, unlockedAt: row.unlockedAt }];
    });
  } catch { return []; }
}
