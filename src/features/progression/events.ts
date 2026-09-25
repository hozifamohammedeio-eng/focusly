import {
  rewardEventTypes,
  type RewardEventInput,
  type RewardEventType,
} from "./types";

const MAX_SOURCE_ID_LENGTH = 200;
const MAX_USER_ID_LENGTH = 200;

/**
 * Represents the unique identity of one reward source.
 *
 * In the database, this will later map to a UNIQUE constraint:
 *
 * user_id + event_type + source_id
 *
 * That combination is the core protection against duplicate rewards.
 */
export type RewardEventIdentity =
  Readonly<{
    userId: string;
    eventType: RewardEventType;
    sourceId: string;
  }>;

/**
 * Create a normalized reward identity.
 *
 * Example:
 *
 * userId:
 * "user-123"
 *
 * eventType:
 * "focus_completed"
 *
 * sourceId:
 * "focus-session-456"
 *
 * The same combination must never receive
 * another reward event.
 */
export function createRewardEventIdentity(
  input: RewardEventIdentity,
): RewardEventIdentity {
  const userId =
    normalizeIdentifier(
      input.userId,
      "userId",
      MAX_USER_ID_LENGTH,
    );

  const sourceId =
    normalizeIdentifier(
      input.sourceId,
      "sourceId",
      MAX_SOURCE_ID_LENGTH,
    );

  assertRewardEventType(
    input.eventType,
  );

  return {
    userId,
    eventType: input.eventType,
    sourceId,
  };
}

/**
 * Stable in-memory key for Maps/Sets/tests.
 *
 * This is NOT intended to replace
 * the database UNIQUE constraint.
 */
export function rewardEventIdentityKey(
  identity: RewardEventIdentity,
): string {
  const normalized =
    createRewardEventIdentity(
      identity,
    );

  return JSON.stringify([
    normalized.userId,
    normalized.eventType,
    normalized.sourceId,
  ]);
}

/**
 * Compare two reward sources safely.
 */
export function isSameRewardSource(
  first: RewardEventIdentity,
  second: RewardEventIdentity,
): boolean {
  return (
    rewardEventIdentityKey(first) ===
    rewardEventIdentityKey(second)
  );
}

/**
 * Validate and normalize a complete reward event input.
 *
 * The database layer will later call this before
 * attempting to persist rewards.
 */
export function normalizeRewardEventInput(
  input: RewardEventInput,
): RewardEventInput {
  const identity =
    createRewardEventIdentity({
      userId: input.userId,
      eventType: input.eventType,
      sourceId: input.sourceId,
    });

  assertRewardAmount(
    input.rewards.xp,
    "xp",
  );

  assertRewardAmount(
    input.rewards.coins,
    "coins",
  );

  assertRewardAmount(
    input.rewards
      .constructionPoints,
    "constructionPoints",
  );

  return {
    ...identity,

    rewards: {
      xp: input.rewards.xp,
      coins: input.rewards.coins,
      constructionPoints:
        input.rewards
          .constructionPoints,
    },
  };
}

/**
 * Ensures an event type belongs to
 * Focusly's known reward event catalog.
 */
export function isRewardEventType(
  value: string,
): value is RewardEventType {
  return (
    rewardEventTypes as
      readonly string[]
  ).includes(value);
}

function assertRewardEventType(
  value: string,
): asserts value is RewardEventType {
  if (!isRewardEventType(value)) {
    throw new RangeError(
      `Unknown reward event type: ${value}`,
    );
  }
}

function normalizeIdentifier(
  value: string,
  field: string,
  maxLength: number,
): string {
  const normalized =
    value.trim();

  if (normalized.length === 0) {
    throw new RangeError(
      `${field} cannot be empty.`,
    );
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new RangeError(
      `${field} cannot exceed ${maxLength} characters.`,
    );
  }

  return normalized;
}

function assertRewardAmount(
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