import { buildingCatalog, type BuildingKey } from "./domain";
import type { CityActivity } from "./overview";
import { challengeAwardsFromClaim } from "@/features/challenges/receipt";

export type CityGrowth = Readonly<{ eventId: string; source: "direct" | "challenge"; buildings: ReadonlyArray<{ key: BuildingKey; level: number }> }>;
export const CITY_GROWTH_STORAGE_KEY = "focusly-city-growth";

export function confirmedRecentGrowth(raw: string | null, activity: readonly CityActivity[], now: number): BuildingKey[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as { at?: unknown; growth?: unknown };
    if (typeof value.at !== "number" || now - value.at > 300_000 || now < value.at || !value.growth || typeof value.growth !== "object") return [];
    const growth = value.growth as Record<string, unknown>;
    if (typeof growth.eventId !== "string" || !Array.isArray(growth.buildings)) return [];
    return growth.buildings.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const match = activity.some(event => event.sourceRewardEventId === growth.eventId && event.key === row.key && event.level === row.level);
      return match ? [row.key as BuildingKey] : [];
    });
  } catch { return []; }
}

/** Notices originate only from a newly awarded trusted reward response. */
export function cityGrowthFromClaim(value: unknown): CityGrowth | null {
  if (!value || typeof value !== "object") return null;
  const claim = value as Record<string, unknown>;
  if (claim.awarded !== true) return null;
  const parseConstruction = (construction: unknown) => (Array.isArray(construction) ? construction : []).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const building = (item as Record<string, unknown>).building;
    if (!building || typeof building !== "object") return [];
    const row = building as Record<string, unknown>;
    const definition = buildingCatalog.find(entry => entry.key === row.building_key);
    if (!definition || !Number.isInteger(row.level) || (row.level as number) < 1 || (row.level as number) > definition.maxLevel) return [];
    return [{ key: definition.key, level: row.level as number }];
  });
  const direct = parseConstruction(claim.cityConstruction);
  if (direct.length && typeof claim.eventId === "string") return { eventId: claim.eventId, source: "direct", buildings: direct };
  const trustedAwards = challengeAwardsFromClaim(claim);
  for (const award of trustedAwards) {
    const row = (claim.challenges as unknown[]).find(item => item && typeof item === "object" && (item as Record<string, unknown>).eventId === award.eventId) as Record<string, unknown> | undefined;
    const buildings = parseConstruction(row?.cityConstruction);
    if (buildings.length) return { eventId: award.eventId, source: "challenge", buildings };
  }
  return null;
}
