import test from "node:test";
import assert from "node:assert/strict";
import { buildingCatalog, buildingDefinition, buildingCost, meetsRequirement, deriveBuildingState, canAfford, type CityEvidence } from "../src/features/city/domain";

const empty: CityEvidence = { global_xp: 0, focus_minutes: 0, subject_xp: 0, completed_tasks: 0 };
test("City catalog has the six stable unique keys and generic science/language requirements", () => {
  assert.deepEqual(buildingCatalog.map(item => item.key), ["knowledge_center", "focus_tower", "library_district", "science_lab", "language_academy", "planner_hall"]);
  assert.equal(new Set(buildingCatalog.map(item => item.key)).size, 6);
  assert.equal(buildingDefinition("science_lab").metric, "subject_xp");
  assert.equal(buildingDefinition("language_academy").metric, "subject_xp");
  assert.throws(() => buildingDefinition("unknown"));
});
test("City cost scales once per target level and rejects invalid levels", () => {
  for (const definition of buildingCatalog) {
    for (let level = 1; level <= definition.maxLevel; level++) {
      assert.deepEqual(buildingCost(definition, level), { coins: definition.coins * level, constructionPoints: definition.constructionPoints * level });
    }
    for (const level of [0, -1, 1.5, NaN, 4]) assert.throws(() => buildingCost(definition, level));
  }
});
test("City requirements are deterministic and enforce exact thresholds", () => {
  for (const definition of buildingCatalog) {
    for (let level = 1; level <= definition.maxLevel; level++) {
      const evidence = { ...empty, [definition.metric]: definition.threshold * level };
      assert.equal(meetsRequirement(definition, level, evidence), true);
      assert.equal(meetsRequirement(definition, level, { ...evidence, [definition.metric]: definition.threshold * level - 1 }), false);
      assert.equal(meetsRequirement(definition, level, { ...evidence, [definition.metric]: Infinity }), false);
      assert.equal(meetsRequirement(definition, level, evidence), true);
    }
  }
});
test("City derived states preserve ownership when requirements no longer hold", () => {
  const definition = buildingDefinition("knowledge_center");
  assert.equal(deriveBuildingState(definition, 0, empty), "locked");
  assert.equal(deriveBuildingState(definition, 0, { ...empty, global_xp: 100 }), "available");
  assert.equal(deriveBuildingState(definition, 1, empty), "built");
  assert.equal(deriveBuildingState(definition, 1, { ...empty, global_xp: 200 }), "upgradeable");
  assert.equal(deriveBuildingState(definition, 3, { ...empty, global_xp: 10000 }), "built");
  assert.throws(() => deriveBuildingState(definition, -1, empty));
});
test("City affordability requires both currencies and safe nonnegative numbers", () => {
  const cost = { coins: 20, constructionPoints: 10 };
  assert.equal(canAfford(cost, cost), true);
  assert.equal(canAfford({ coins: 19, constructionPoints: 10 }, cost), false);
  assert.equal(canAfford({ coins: 20, constructionPoints: 9 }, cost), false);
  assert.equal(canAfford({ coins: Infinity, constructionPoints: 10 }, cost), false);
  assert.equal(canAfford(cost, { coins: -1, constructionPoints: 0 }), false);
});
