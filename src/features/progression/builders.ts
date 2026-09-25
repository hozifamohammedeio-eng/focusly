import {
  calculateAchievementRewards,
  calculateChallengeRewards,
  calculateFocusRewards,
  calculateTaskRewards,
  type ChallengeKind,
} from "./rewards";

import {
  normalizeRewardEventInput,
} from "./events";

import type {
  FocusRewardContext,
  RewardAmounts,
  RewardEventInput,
  TaskRewardContext,
} from "./types";

/**
 * Build a reward event for a completed Focus session.
 *
 * The Focus feature only supplies:
 *
 * - user
 * - session id
 * - duration
 *
 * Reward values are calculated centrally
 * by the progression system.
 */
export function buildFocusRewardEvent(
  userId: string,
  context: FocusRewardContext,
): RewardEventInput {
  const rewards =
    calculateFocusRewards(
      context.durationMinutes,
    );

  return normalizeRewardEventInput({
    userId,
    eventType: "focus_completed",
    sourceId:
      context.focusSessionId,
    rewards,
  });
}

/**
 * Build a reward event for a completed task.
 *
 * The Tasks feature does not decide
 * how much XP or currency is awarded.
 */
export function buildTaskRewardEvent(
  userId: string,
  context: TaskRewardContext,
): RewardEventInput {
  const rewards =
    calculateTaskRewards();

  return normalizeRewardEventInput({
    userId,
    eventType: "task_completed",
    sourceId: context.taskId,
    rewards,
  });
}

/**
 * Build a reward event for unlocking
 * an achievement.
 *
 * achievementId must represent the
 * unlocked achievement instance/catalog entry.
 */
export function buildAchievementRewardEvent(
  userId: string,
  achievementId: string,
  rewards:
    RewardAmounts =
      calculateAchievementRewards(),
): RewardEventInput {
  return normalizeRewardEventInput({
    userId,
    eventType:
      "achievement_unlocked",
    sourceId: achievementId,
    rewards,
  });
}

/**
 * Build a daily or weekly challenge reward.
 */
export function buildChallengeRewardEvent(
  userId: string,
  challengeCompletionId: string,
  kind: ChallengeKind,
): RewardEventInput {
  const rewards =
    calculateChallengeRewards(
      kind,
    );

  return normalizeRewardEventInput({
    userId,
    eventType:
      "challenge_completed",
    sourceId:
      challengeCompletionId,
    rewards,
  });
}

/**
 * Build a subject milestone reward.
 *
 * Milestone rewards can vary later,
 * so the caller supplies the amounts.
 *
 * Example sourceId:
 * "subject-id:1000-xp"
 *
 * The database unique constraint
 * will still guarantee one reward
 * for that milestone source.
 */
export function buildSubjectMilestoneRewardEvent(
  userId: string,
  milestoneId: string,
  rewards: RewardAmounts,
): RewardEventInput {
  return normalizeRewardEventInput({
    userId,
    eventType:
      "subject_milestone",
    sourceId: milestoneId,
    rewards,
  });
}