import "server-only";
import { getIdentity } from "@/features/auth/session";
import { getSubjectMastery } from "@/features/progression/data";
import { buildingCatalog, type BuildingKey, type RequirementMetric } from "./domain";
import type { CityActivity, CityBuilding, CityOverview } from "./overview";

const keys = new Set<string>(buildingCatalog.map(building => building.key));
const metrics = new Set<string>(["global_xp", "focus_minutes", "subject_xp", "completed_tasks"]);
const validNumber = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Owner-scoped SELECTs only. A failed read is unavailable, never fabricated as zero. */
export async function getCityOverview(): Promise<CityOverview | null> {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return null;
  const { client, user } = identity;
  try {
    const [catalog, owned, profile, tasks, mastery, activity] = await Promise.all([
      client.from("city_building_catalog").select("key,max_level,coins,construction_points,metric,threshold,auto_priority").order("auto_priority"),
      client.from("user_city_buildings").select("building_key,level").eq("user_id", user.id),
      client.from("progression_profiles").select("total_xp,coins,construction_points").eq("user_id", user.id).maybeSingle(),
      client.from("tasks").select("id", { head: true, count: "exact" }).eq("user_id", user.id).eq("status", "completed").not("completed_at", "is", null),
      getSubjectMastery(),
      client.from("city_transactions").select("building_key,target_level,created_at,source_reward_event_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (catalog.error || owned.error || profile.error || tasks.error || mastery.kind !== "authenticated" || activity.error || tasks.count === null) return null;
    if (!profile.data && (owned.data.length || activity.data.length)) return null;
    if (catalog.data.length !== buildingCatalog.length || new Set(catalog.data.map(row => row.key)).size !== buildingCatalog.length) return null;
    const ownedLevels = new Map(owned.data.map(row => [row.building_key, row.level]));
    if (ownedLevels.size !== owned.data.length || owned.data.some(row => !keys.has(row.building_key))) return null;
    const buildings: CityBuilding[] = catalog.data.map(row => ({
      key: row.key as BuildingKey, level: ownedLevels.get(row.key) ?? 0, maxLevel: row.max_level,
      metric: row.metric as RequirementMetric, threshold: row.threshold,
      coins: row.coins, constructionPoints: row.construction_points, autoPriority: row.auto_priority,
    }));
    if (buildings.some(row => !keys.has(row.key) || !metrics.has(row.metric) || ![row.level, row.maxLevel, row.threshold, row.coins, row.constructionPoints, row.autoPriority].every(validNumber) || row.level > row.maxLevel || row.maxLevel !== 3)) return null;
    const balances = profile.data ? { totalXp: profile.data.total_xp, coins: profile.data.coins, constructionPoints: profile.data.construction_points } : { totalXp: 0, coins: 0, constructionPoints: 0 };
    if (![balances.totalXp, balances.coins, balances.constructionPoints, tasks.count].every(validNumber)) return null;
    // The transaction engine only needs 75 focus minutes to satisfy every Focus Tower level.
    // Read in pages to avoid PostgREST's row cap and stop once that threshold is reached.
    let focusMinutes = 0;
    for (let offset = 0; focusMinutes < 75; offset += 500) {
      const page = await client.from("focus_sessions").select("duration_seconds")
        .eq("user_id", user.id).eq("completed", true).not("ended_at", "is", null)
        .gte("duration_seconds", 60).range(offset, offset + 499);
      if (page.error) return null;
      focusMinutes += page.data.reduce((sum, row) => sum + Math.floor(row.duration_seconds / 60), 0);
      if (page.data.length < 500) break;
    }
    const activityRows: CityActivity[] = activity.data.filter(row => keys.has(row.building_key) && validNumber(row.target_level) && row.target_level >= 1 && row.target_level <= 3).map(row => ({
      key: row.building_key as BuildingKey, level: row.target_level, at: row.created_at,
      sourceRewardEventId: row.source_reward_event_id,
    }));
    return {
      buildings, balances,
      evidence: { global_xp: balances.totalXp, focus_minutes: focusMinutes, completed_tasks: tasks.count, subject_xp: Math.max(0, ...mastery.subjects.map(subject => subject.totalXp)) },
      activity: activityRows,
    };
  } catch {
    return null;
  }
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
