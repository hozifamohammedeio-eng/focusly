import "server-only";
import { getIdentity } from "@/features/auth/session";
import type { BuildingKey } from "./domain";

// Intentionally not imported by active routes until remote migration approval.
export async function getCityBuildings() {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  const result = await identity.client.from("user_city_buildings")
    .select("id, user_id, building_key, level, built_at, upgraded_at")
    .eq("user_id", identity.user.id).order("building_key");
  if (result.error) return { kind: "unavailable" as const };
  return { kind: "authenticated" as const, buildings: result.data };
}

type CityRequest = {
  requestId: string;
  buildingKey: BuildingKey;
} & ({ action: "build" } | { action: "upgrade"; buildingId: string; expectedLevel: number });

/** Reuse requestId for retries. expectedLevel is a stale-request guard, never a desired level. */
export async function transactCity(request: CityRequest) {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") throw new Error("Authentication required");
  const result = await identity.client.rpc("city_transaction", {
    p_action: request.action,
    p_building_key: request.buildingKey,
    p_request_id: request.requestId,
    ...(request.action === "upgrade" ? {
      p_building_id: request.buildingId,
      p_expected_level: request.expectedLevel,
    } : {}),
  });
  if (result.error) throw new Error("City transaction rejected", { cause: result.error });
  return result.data;
}
