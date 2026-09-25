import "server-only";

import { cache } from "react";

import { getIdentity } from "@/features/auth/session";
import {
  achievementCatalog,
  isAchievementKey,
  type AchievementKey,
} from "./achievements";

import {
  calculateProgressionFromEvents,
  createProgressionSnapshot,
  EMPTY_PROGRESSION_BALANCES,
} from "./calculator";
import { createSubjectProgressSnapshots } from "./mastery";

import type {
  ProgressionBalances,
  ProgressionSnapshot,
  RewardEvent,
  RewardEventType,
  SubjectMasteryRow,
  SubjectProgressSnapshot,
} from "./types";

type ProgressionResult =
  | { kind: "anonymous" | "unconfigured" | "unavailable" }
  | {
      kind: "authenticated";
      snapshot: ProgressionSnapshot;
      events: RewardEvent[];
    };

function balancesFromRow(row: {
  total_xp: number;
  coins: number;
  construction_points: number;
}): ProgressionBalances {
  return {
    totalXp: Number(row.total_xp),
    coins: Number(row.coins),
    constructionPoints: Number(row.construction_points),
  };
}

function eventsFromRows(
  rows: Array<{
    id: string;
    user_id: string;
    event_type: string;
    source_id: string;
    subject_id: string | null;
    xp: number;
    coins: number;
    construction_points: number;
    created_at: string;
  }>,
): RewardEvent[] {
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type as RewardEventType,
    sourceId: row.source_id,
    subjectId: row.subject_id,
    rewards: {
      xp: Number(row.xp),
      coins: Number(row.coins),
      constructionPoints: Number(row.construction_points),
    },
    createdAt: row.created_at,
  }));
}

/**
 * Reads progression only for the authenticated server identity. This module is
 * intentionally disconnected from the current production UI until the local
 * Focusly 2 migrations are approved and applied remotely.
 */
export const getProgression = cache(async (): Promise<ProgressionResult> => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;

  try {
    const [profileResult, eventsResult] = await Promise.all([
      identity.client
        .from("progression_profiles")
        .select("total_xp, coins, construction_points")
        .eq("user_id", identity.user.id)
        .maybeSingle(),
      identity.client
        .from("progression_reward_events")
        .select(
          "id, user_id, subject_id, event_type, source_id, xp, coins, construction_points, created_at",
        )
        .eq("user_id", identity.user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (profileResult.error || eventsResult.error) {
      return { kind: "unavailable" };
    }

    const events = eventsFromRows(eventsResult.data ?? []);
    const snapshot = profileResult.data
      ? createProgressionSnapshot(balancesFromRow(profileResult.data))
      : calculateProgressionFromEvents(events);

    return { kind: "authenticated", snapshot, events };
  } catch {
    return { kind: "unavailable" };
  }
});

type SubjectMasteryResult =
  | { kind: "anonymous" | "unconfigured" | "unavailable" }
  | {
      kind: "authenticated";
      subjects: SubjectProgressSnapshot[];
    };

type UnlockedAchievement = Readonly<{
  id: string;
  achievementKey: AchievementKey;
  unlockedAt: string;
}>;

type AchievementsResult =
  | { kind: "anonymous" | "unconfigured" | "unavailable" }
  | {
      kind: "authenticated";
      catalog: typeof achievementCatalog;
      unlocked: UnlockedAchievement[];
    };

function parseSubjectMasteryRows(value: unknown): SubjectMasteryRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.subjectId !== "string" ||
      typeof row.subjectName !== "string" ||
      typeof row.totalXp !== "number" ||
      typeof row.totalStudyMinutes !== "number" ||
      typeof row.completedFocusSessions !== "number" ||
      typeof row.completedTasks !== "number"
    ) return [];
    return [{
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      archivedAt: typeof row.archivedAt === "string" ? row.archivedAt : null,
      totalXp: row.totalXp,
      totalStudyMinutes: row.totalStudyMinutes,
      completedFocusSessions: row.completedFocusSessions,
      completedTasks: row.completedTasks,
    }];
  });
}

/**
 * Loads the trusted subject mastery read model without connecting it to a
 * rendered route until the local migration is approved and deployed.
 */
export const getSubjectMastery = cache(async (): Promise<SubjectMasteryResult> => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  try {
    const result = await identity.client.rpc("get_subject_mastery");
    if (result.error) return { kind: "unavailable" };
    return {
      kind: "authenticated",
      subjects: createSubjectProgressSnapshots(parseSubjectMasteryRows(result.data)),
    };
  } catch {
    return { kind: "unavailable" };
  }
});

/** Reads the catalog and owner-scoped unlock ledger for future UI use. */
export const getAchievements = cache(async (): Promise<AchievementsResult> => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  try {
    const result = await identity.client
      .from("user_achievements")
      .select("id, achievement_key, unlocked_at")
      .eq("user_id", identity.user.id)
      .order("unlocked_at", { ascending: true });
    if (result.error) return { kind: "unavailable" };
    return {
      kind: "authenticated",
      catalog: achievementCatalog,
      unlocked: result.data.flatMap((row) =>
        isAchievementKey(row.achievement_key)
          ? [{
              id: row.id,
              achievementKey: row.achievement_key,
              unlockedAt: row.unlocked_at,
            }]
          : [],
      ),
    };
  } catch {
    return { kind: "unavailable" };
  }
});

export async function evaluateProgressionAchievements() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") {
    throw new Error("Authentication required");
  }
  const result = await identity.client.rpc("evaluate_progression_achievements");
  if (result.error) throw new Error("Achievement evaluation unavailable");
  return result.data;
}

export async function claimFocusProgressionReward(sessionId: string) {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") {
    throw new Error("Authentication required");
  }
  const result = await identity.client.rpc("claim_focus_progression_reward", {
    p_session_id: sessionId,
  });
  if (result.error) throw new Error("Focus reward unavailable");
  return result.data;
}

export async function claimTaskProgressionReward(taskId: string) {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") {
    throw new Error("Authentication required");
  }
  const result = await identity.client.rpc("claim_task_progression_reward", {
    p_task_id: taskId,
  });
  if (result.error) throw new Error("Task reward unavailable");
  return result.data;
}

export const emptyProgressionSnapshot = (): ProgressionSnapshot =>
  createProgressionSnapshot(EMPTY_PROGRESSION_BALANCES);
