import test from "node:test";
import assert from "node:assert/strict";
import { challengeCatalog, challengeRewards, challengeProgress } from "../src/features/challenges/catalog";
import { calculateChallengeRewards } from "../src/features/progression/rewards";

test("challenge keys are unique and all requirements are positive integers", () => {
  assert.equal(new Set(challengeCatalog.map(c => c.key)).size, 4);
  for (const c of challengeCatalog) assert.ok(Number.isSafeInteger(c.target) && c.target > 0);
});
test("challenge rewards reuse central daily and weekly rules", () => {
  for (const c of challengeCatalog) assert.deepEqual(challengeRewards(c.kind), calculateChallengeRewards(c.kind));
  assert.deepEqual(challengeRewards("daily"), { xp: 50, coins: 10, constructionPoints: 0 });
  assert.deepEqual(challengeRewards("weekly"), { xp: 150, coins: 30, constructionPoints: 0 });
});
test("challenge progress previews clamp without awarding", () => {
  assert.deepEqual(challengeProgress(24,25), { progress:24, target:25, complete:false });
  assert.deepEqual(challengeProgress(30,25), { progress:25, target:25, complete:true });
});
test("invalid progress and targets are rejected", () => {
  for (const n of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(() => challengeProgress(n,25), RangeError);
    assert.throws(() => challengeProgress(1,n), RangeError);
  }
  assert.throws(() => challengeProgress(1,0), RangeError);
});
