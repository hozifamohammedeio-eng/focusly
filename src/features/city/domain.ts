import definitions from "./catalog.json";

export type BuildingKey = "knowledge_center" | "focus_tower" | "library_district" | "science_lab" | "language_academy" | "planner_hall";
export type RequirementMetric = "global_xp" | "focus_minutes" | "subject_xp" | "completed_tasks";
export type CityState = "locked" | "available" | "built" | "upgradeable";
export type CityBalances = Readonly<{ coins: number; constructionPoints: number }>;
export type CityEvidence = Readonly<Record<RequirementMetric, number>>;
export type BuildingDefinition = Readonly<CityBalances & {
  key: BuildingKey;
  maxLevel: number;
  metric: RequirementMetric;
  threshold: number;
}>;
// Presentation preview only. SQL catalog is authoritative; DB tests enforce parity.
export const buildingCatalog = definitions as readonly BuildingDefinition[];

export function buildingDefinition(key: string): BuildingDefinition {
  const definition = buildingCatalog.find(item => item.key === key);
  if (!definition) throw new RangeError("Unknown City building");
  return definition;
}

function targetLevel(definition: BuildingDefinition, level: number) {
  if (!Number.isInteger(level) || level < 1 || level > definition.maxLevel)
    throw new RangeError("Invalid target level");
}

/** Build is level 1; each upgrade costs base cost multiplied by its target level. */
export function buildingCost(definition: BuildingDefinition, level: number): CityBalances {
  targetLevel(definition, level);
  return { coins: definition.coins * level, constructionPoints: definition.constructionPoints * level };
}

export function meetsRequirement(definition: BuildingDefinition, level: number, evidence: CityEvidence): boolean {
  targetLevel(definition, level);
  const value = evidence[definition.metric];
  return Number.isSafeInteger(value) && value >= definition.threshold * level;
}

/** Availability means eligible, not necessarily affordable. Existing ownership is never revoked. */
export function deriveBuildingState(definition: BuildingDefinition, level: number, evidence: CityEvidence): CityState {
  if (!Number.isInteger(level) || level < 0 || level > definition.maxLevel)
    throw new RangeError("Invalid owned level");
  if (level === 0) return meetsRequirement(definition, 1, evidence) ? "available" : "locked";
  return level < definition.maxLevel && meetsRequirement(definition, level + 1, evidence) ? "upgradeable" : "built";
}

export function canAfford(balance: CityBalances, cost: CityBalances): boolean {
  return [balance.coins, balance.constructionPoints, cost.coins, cost.constructionPoints]
    .every(value => Number.isSafeInteger(value) && value >= 0)
    && balance.coins >= cost.coins && balance.constructionPoints >= cost.constructionPoints;
}
