import "server-only";

import { getIdentity } from "@/features/auth/session";
import type { Database } from "@/types/database";

export type UserChallenge = Database["public"]["Tables"]["user_challenges"]["Row"];
export type ChallengeProgress = Database["public"]["Functions"]["get_challenge_progress"]["Returns"][number];

/** Read-only server snapshot. Missing local migrations report unavailable, never fake zero. */
export async function getChallenges() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  try {
    const result = await identity.client.rpc("get_challenge_progress");
    if (result.error || !result.data) return { kind: "unavailable" as const };
    return { kind: "authenticated" as const, challenges: result.data };
  } catch {
    return { kind: "unavailable" as const };
  }
}

/** No caller-controlled owner, clock, target, reward or construction parameters. */
export async function evaluateChallenges() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") throw new Error("Authentication required");
  const result = await identity.client.rpc("evaluate_progression_challenges");
  if (result.error) throw new Error("Challenge evaluation unavailable");
  return result.data;
}
