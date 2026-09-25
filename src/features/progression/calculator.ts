import {
  calculateLevelProgress,
} from "./levels";

import type {
  ProgressionBalances,
  ProgressionSnapshot,
  RewardEvent,
  RewardAmounts,
} from "./types";

/**
 * Empty progression state for a new user.
 */
export const EMPTY_PROGRESSION_BALANCES:
  ProgressionBalances = {
    totalXp: 0,
    coins: 0,
    constructionPoints: 0,
  };

/**
 * Sum a list of reward amounts.
 */
export function sumRewards(
  rewards: readonly RewardAmounts[],
): RewardAmounts {
  return rewards.reduce<RewardAmounts>(
    (total, current) => ({
      xp:
        total.xp +
        current.xp,

      coins:
        total.coins +
        current.coins,

      constructionPoints:
        total.constructionPoints +
        current.constructionPoints,
    }),
    {
      xp: 0,
      coins: 0,
      constructionPoints: 0,
    },
  );
}

/**
 * Calculate balances from persisted reward events.
 *
 * Reward events are the source of truth for
 * progression history.
 */
export function calculateBalancesFromEvents(
  events: readonly RewardEvent[],
): ProgressionBalances {
  const totals =
    sumRewards(
      events.map(
        (event) =>
          event.rewards,
      ),
    );

  return {
    totalXp: totals.xp,
    coins: totals.coins,
    constructionPoints:
      totals.constructionPoints,
  };
}

/**
 * Build a complete progression snapshot
 * from current balances.
 */
export function createProgressionSnapshot(
  balances: ProgressionBalances,
): ProgressionSnapshot {
  assertValidBalances(
    balances,
  );

  return {
    balances,
    level:
      calculateLevelProgress(
        balances.totalXp,
      ),
  };
}

/**
 * Convenience helper:
 *
 * Reward events
 * → balances
 * → level progress
 */
export function calculateProgressionFromEvents(
  events: readonly RewardEvent[],
): ProgressionSnapshot {
  const balances =
    calculateBalancesFromEvents(
      events,
    );

  return createProgressionSnapshot(
    balances,
  );
}

/**
 * Apply a single reward safely in memory.
 *
 * Database writes will later be transactional.
 */
export function applyRewardToBalances(
  balances: ProgressionBalances,
  reward: RewardAmounts,
): ProgressionBalances {
  assertValidBalances(
    balances,
  );

  assertRewardAmounts(
    reward,
  );

  return {
    totalXp:
      balances.totalXp +
      reward.xp,

    coins:
      balances.coins +
      reward.coins,

    constructionPoints:
      balances
        .constructionPoints +
      reward
        .constructionPoints,
  };
}

function assertValidBalances(
  balances: ProgressionBalances,
): void {
  assertNonNegativeInteger(
    balances.totalXp,
    "totalXp",
  );

  assertNonNegativeInteger(
    balances.coins,
    "coins",
  );

  assertNonNegativeInteger(
    balances
      .constructionPoints,
    "constructionPoints",
  );
}

function assertRewardAmounts(
  reward: RewardAmounts,
): void {
  assertNonNegativeInteger(
    reward.xp,
    "reward.xp",
  );

  assertNonNegativeInteger(
    reward.coins,
    "reward.coins",
  );

  assertNonNegativeInteger(
    reward
      .constructionPoints,
    "reward.constructionPoints",
  );
}

function assertNonNegativeInteger(
  value: number,
  field: string,
): void {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RangeError(
      `${field} must be a non-negative integer.`,
    );
  }
}