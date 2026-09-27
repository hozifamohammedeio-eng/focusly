import { calculateChallengeRewards, type ChallengeKind } from "../progression/rewards";

export type ChallengeMetric = "focus_minutes" | "completed_tasks" | "studied_subjects";
export type ChallengeDefinition = Readonly<{
  key: string;
  kind: ChallengeKind;
  metric: ChallengeMetric;
  target: number;
}>;

/** SQL is authoritative; database tests verify this catalog and reward parity. */
export const challengeCatalog = [
  { key: "daily_focus_25", kind: "daily", metric: "focus_minutes", target: 25 },
  { key: "daily_tasks_2", kind: "daily", metric: "completed_tasks", target: 2 },
  { key: "weekly_focus_180", kind: "weekly", metric: "focus_minutes", target: 180 },
  { key: "weekly_subjects_2", kind: "weekly", metric: "studied_subjects", target: 2 },
] as const satisfies readonly ChallengeDefinition[];

export type ChallengeKey = (typeof challengeCatalog)[number]["key"];

export function challengeRewards(kind: ChallengeKind) {
  if (kind !== "daily" && kind !== "weekly") throw new RangeError("Invalid challenge kind");
  return calculateChallengeRewards(kind);
}

/** Preview only; persisted progress and completion are always server-derived. */
export function challengeProgress(progress: number, target: number) {
  if (!Number.isSafeInteger(progress) || progress < 0 || !Number.isSafeInteger(target) || target <= 0)
    throw new RangeError("Invalid challenge progress or target");
  return { progress: Math.min(progress, target), target, complete: progress >= target };
}
