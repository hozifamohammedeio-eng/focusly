import "server-only";

import { cache } from "react";

import { getIdentity } from "@/features/auth/session";

import {
  calculateProgressionFromEvents,
  createProgressionSnapshot,
  EMPTY_PROGRESSION_BALANCES,
} from "./calculator";

import type {
  ProgressionBalances,
  ProgressionSnapshot,
  RewardEvent,
  RewardEventType,
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
          "id, user_id, event_type, source_id, xp, coins, construction_points, created_at",
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
