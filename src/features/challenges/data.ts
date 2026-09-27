import "server-only";

import { getIdentity } from "@/features/auth/session";
import type { Database } from "@/types/database";

export type UserChallenge = Database["public"]["Tables"]["user_challenges"]["Row"];

/** Local-only foundation. No rendered route imports this module. Reads never award. */
export async function getChallenges() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  const result = await identity.client.from("user_challenges").select("*")
    .eq("user_id", identity.user.id).order("starts_at", { ascending: false });
  if (result.error) return { kind: "unavailable" as const };
  return { kind: "authenticated" as const, challenges: result.data };
}

/** No caller-controlled owner, clock, target, reward or construction parameters. */
export async function evaluateChallenges() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") throw new Error("Authentication required");
  const result = await identity.client.rpc("evaluate_progression_challenges");
  if (result.error) throw new Error("Challenge evaluation unavailable");
  return result.data;
}
