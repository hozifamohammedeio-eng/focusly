import type { LevelProgress } from "./types";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

export const BASE_LEVEL_XP = 100;
export const LEVEL_XP_GROWTH = 25;

/**
 * XP required to move from a given level
 * to the following level.
 *
 * Level 1 -> 2 = 100 XP
 * Level 2 -> 3 = 125 XP
 * Level 3 -> 4 = 150 XP
 * ...
 */
export function xpRequiredForNextLevel(
  level: number,
): number | null {
  assertValidLevel(level);

  if (level >= MAX_LEVEL) {
    return null;
  }

  return (
    BASE_LEVEL_XP +
    (level - MIN_LEVEL) *
      LEVEL_XP_GROWTH
  );
}

/**
 * Total lifetime XP required to reach a level.
 *
 * Level 1 = 0 XP
 * Level 2 = 100 XP
 * Level 3 = 225 XP
 * Level 4 = 375 XP
 */
export function totalXpRequiredForLevel(
  level: number,
): number {
  assertValidLevel(level);

  if (level === MIN_LEVEL) {
    return 0;
  }

  const completedLevels =
    level - MIN_LEVEL;

  return (
    (completedLevels *
      (2 * BASE_LEVEL_XP +
        (completedLevels - 1) *
          LEVEL_XP_GROWTH)) /
    2
  );
}

/**
 * Resolve the user's current level from lifetime XP.
 *
 * Levels are derived from total XP instead of being
 * stored separately. This avoids level/XP drift.
 */
export function levelFromTotalXp(
  totalXp: number,
): number {
  assertValidXp(totalXp);

  let level = MIN_LEVEL;

  while (
    level < MAX_LEVEL &&
    totalXp >=
      totalXpRequiredForLevel(
        level + 1,
      )
  ) {
    level += 1;
  }

  return level;
}

/**
 * Returns everything the UI needs to render
 * a level progress bar.
 */
export function calculateLevelProgress(
  totalXp: number,
): LevelProgress {
  assertValidXp(totalXp);

  const level =
    levelFromTotalXp(totalXp);

  const levelStartXp =
    totalXpRequiredForLevel(level);

  if (level >= MAX_LEVEL) {
    return {
      level,
      totalXp,
      levelStartXp,
      nextLevelXp: null,
      xpIntoLevel:
        totalXp - levelStartXp,
      xpNeededForNextLevel: null,
      progress: 1,
    };
  }

  const nextLevelXp =
    totalXpRequiredForLevel(
      level + 1,
    );

  const xpNeededForNextLevel =
    nextLevelXp - levelStartXp;

  const xpIntoLevel =
    totalXp - levelStartXp;

  const rawProgress =
    xpNeededForNextLevel > 0
      ? xpIntoLevel /
        xpNeededForNextLevel
      : 1;

  const progress =
    Math.min(
      1,
      Math.max(
        0,
        rawProgress,
      ),
    );

  return {
    level,
    totalXp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForNextLevel,
    progress,
  };
}

function assertValidLevel(
  level: number,
): void {
  if (
    !Number.isInteger(level) ||
    level < MIN_LEVEL ||
    level > MAX_LEVEL
  ) {
    throw new RangeError(
      `Level must be an integer between ${MIN_LEVEL} and ${MAX_LEVEL}.`,
    );
  }
}

function assertValidXp(
  totalXp: number,
): void {
  if (
    !Number.isFinite(totalXp) ||
    totalXp < 0 ||
    !Number.isInteger(totalXp)
  ) {
    throw new RangeError(
      "totalXp must be a non-negative integer.",
    );
  }
}