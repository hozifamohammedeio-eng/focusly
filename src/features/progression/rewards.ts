import type {
  RewardAmounts,
} from "./types";

/**
 * Focusly 2.0 reward balancing.
 *
 * Keep all progression numbers centralized here.
 * Never hard-code reward values inside UI components.
 */
export const rewardRules = {
  focus: {
    xpPerMinute: 1,

    coinIntervalMinutes: 5,
    coinsPerInterval: 1,

    constructionIntervalMinutes: 5,
    constructionPointsPerInterval: 1,
  },

  task: {
    xp: 15,
    coins: 2,
    constructionPoints: 1,
  },

  achievement: {
    defaultXp: 25,
    defaultCoins: 5,
  },

  challenge: {
    dailyXp: 50,
    dailyCoins: 10,

    weeklyXp: 150,
    weeklyCoins: 30,
  },
} as const;

/**
 * Calculate rewards for a completed Focus session.
 *
 * Examples:
 *
 * 25 minutes:
 * 25 XP
 * 5 Coins
 * 5 Construction Points
 *
 * 50 minutes:
 * 50 XP
 * 10 Coins
 * 10 Construction Points
 */
export function calculateFocusRewards(
  durationMinutes: number,
): RewardAmounts {
  assertValidDuration(
    durationMinutes,
  );

  const xp =
    durationMinutes *
    rewardRules.focus.xpPerMinute;

  const coinIntervals =
    Math.floor(
      durationMinutes /
        rewardRules.focus
          .coinIntervalMinutes,
    );

  const constructionIntervals =
    Math.floor(
      durationMinutes /
        rewardRules.focus
          .constructionIntervalMinutes,
    );

  const coins =
    coinIntervals *
    rewardRules.focus
      .coinsPerInterval;

  const constructionPoints =
    constructionIntervals *
    rewardRules.focus
      .constructionPointsPerInterval;

  return {
    xp,
    coins,
    constructionPoints,
  };
}

/**
 * Rewards for completing a real task.
 *
 * This remains intentionally smaller than
 * a Focus session so users are rewarded
 * primarily for actual study time.
 */
export function calculateTaskRewards():
  RewardAmounts {
  return {
    xp:
      rewardRules.task.xp,

    coins:
      rewardRules.task.coins,

    constructionPoints:
      rewardRules.task
        .constructionPoints,
  };
}

/**
 * Default achievement rewards.
 *
 * Individual achievements may later override
 * these values from the achievement catalog.
 */
export function calculateAchievementRewards():
  RewardAmounts {
  return {
    xp:
      rewardRules.achievement
        .defaultXp,

    coins:
      rewardRules.achievement
        .defaultCoins,

    constructionPoints: 0,
  };
}

export type ChallengeKind =
  | "daily"
  | "weekly";

export function calculateChallengeRewards(
  kind: ChallengeKind,
): RewardAmounts {
  if (kind === "daily") {
    return {
      xp:
        rewardRules.challenge
          .dailyXp,

      coins:
        rewardRules.challenge
          .dailyCoins,

      constructionPoints: 0,
    };
  }

  return {
    xp:
      rewardRules.challenge
        .weeklyXp,

    coins:
      rewardRules.challenge
        .weeklyCoins,

    constructionPoints: 0,
  };
}

function assertValidDuration(
  durationMinutes: number,
): void {
  if (
    !Number.isFinite(
      durationMinutes,
    ) ||
    !Number.isInteger(
      durationMinutes,
    ) ||
    durationMinutes <= 0
  ) {
    throw new RangeError(
      "durationMinutes must be a positive integer.",
    );
  }
}