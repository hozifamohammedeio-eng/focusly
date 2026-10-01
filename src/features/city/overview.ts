import { buildingCost, deriveBuildingState, type BuildingKey, type CityEvidence, type CityState, type RequirementMetric } from "./domain";

export type CityBuilding = Readonly<{
  key: BuildingKey;
  level: number;
  maxLevel: number;
  metric: RequirementMetric;
  threshold: number;
  coins: number;
  constructionPoints: number;
  autoPriority: number;
}>;

export type CityActivity = Readonly<{
  key: BuildingKey;
  level: number;
  at: string;
  sourceRewardEventId: string | null;
}>;

export type CityOverview = Readonly<{
  buildings: CityBuilding[];
  balances: { totalXp: number; coins: number; constructionPoints: number };
  evidence: CityEvidence;
  activity: CityActivity[];
}>;

export function buildingView(building: CityBuilding, overview: CityOverview): {
  state: CityState | "max";
  nextLevel: number | null;
  requirement: number | null;
  progress: number;
  cost: { coins: number; constructionPoints: number } | null;
  affordable: boolean;
} {
  if (building.level >= building.maxLevel) return { state: "max", nextLevel: null, requirement: null, progress: overview.evidence[building.metric], cost: null, affordable: true };
  const nextLevel = building.level + 1;
  const cost = buildingCost(building, nextLevel);
  return {
    state: deriveBuildingState(building, building.level, overview.evidence),
    nextLevel,
    requirement: building.threshold * nextLevel,
    progress: overview.evidence[building.metric],
    cost,
    affordable: overview.balances.coins >= cost.coins && overview.balances.constructionPoints >= cost.constructionPoints,
  };
}

export function citySummary(overview: { buildings: readonly Pick<CityBuilding, "level" | "maxLevel">[] }) {
  const completedLevels = overview.buildings.reduce((sum, building) => sum + building.level, 0);
  const totalLevels = overview.buildings.reduce((sum, building) => sum + building.maxLevel, 0);
  return {
    completedLevels,
    totalLevels,
    built: overview.buildings.filter(building => building.level > 0).length,
    totalBuildings: overview.buildings.length,
    percent: totalLevels ? Math.round(completedLevels / totalLevels * 100) : 0,
  };
}

/** Mirrors the automatic engine's level-first, then catalog-priority traversal. */
export function nextCityMilestone(overview: CityOverview) {
  return [...overview.buildings]
    .filter(building => building.level < building.maxLevel)
    .sort((a, b) => a.level - b.level || a.autoPriority - b.autoPriority || a.key.localeCompare(b.key))[0] ?? null;
}
