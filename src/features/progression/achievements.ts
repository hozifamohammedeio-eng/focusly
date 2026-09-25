import type { RewardAmounts } from "./types";

// This catalog is presentation metadata for future UI previews. The database
// evaluator remains authoritative for eligibility and persisted reward values.
export const achievementCatalog = [
  {
    key: "first_focus",
    category: "focus",
    label: "First Focus",
    rewards: { xp: 5, coins: 5, constructionPoints: 0 },
  },
  {
    key: "focus_5",
    category: "focus",
    label: "Five Focus Sessions",
    rewards: { xp: 50, coins: 10, constructionPoints: 0 },
  },
  {
    key: "focus_60_minutes",
    category: "focus",
    label: "Sixty Study Minutes",
    rewards: { xp: 60, coins: 12, constructionPoints: 0 },
  },
  {
    key: "focus_300_minutes",
    category: "focus",
    label: "Three Hundred Study Minutes",
    rewards: { xp: 150, coins: 30, constructionPoints: 0 },
  },
  {
    key: "first_task",
    category: "tasks",
    label: "First Task",
    rewards: { xp: 5, coins: 5, constructionPoints: 0 },
  },
  {
    key: "tasks_10",
    category: "tasks",
    label: "Ten Completed Tasks",
    rewards: { xp: 100, coins: 20, constructionPoints: 0 },
  },
  {
    key: "level_2",
    category: "progression",
    label: "Level Two",
    rewards: { xp: 100, coins: 20, constructionPoints: 0 },
  },
  {
    key: "level_5",
    category: "progression",
    label: "Level Five",
    rewards: { xp: 250, coins: 50, constructionPoints: 0 },
  },
  {
    key: "first_subject_level_2",
    category: "mastery",
    label: "Subject Mastery Level Two",
    rewards: { xp: 100, coins: 20, constructionPoints: 0 },
  },
] as const satisfies readonly {
  key: string;
  category: "focus" | "tasks" | "progression" | "mastery";
  label: string;
  rewards: RewardAmounts;
}[];

export type AchievementDefinition = (typeof achievementCatalog)[number];
export type AchievementKey = AchievementDefinition["key"];

const catalogByKey = new Map(
  achievementCatalog.map((achievement) => [achievement.key, achievement]),
);

export function getAchievementDefinition(
  key: string,
): AchievementDefinition | undefined {
  return catalogByKey.get(key as AchievementKey);
}

export function isAchievementKey(
  value: string,
): value is AchievementKey {
  return catalogByKey.has(value as AchievementKey);
}
