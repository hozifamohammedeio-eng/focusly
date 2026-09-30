import { challengeCatalog, challengeRewards, type ChallengeKey } from "./catalog";

export type ChallengeAward = Readonly<{
  eventId: string;
  challengeKey: ChallengeKey;
  xp: number;
  coins: number;
  cityGrew: boolean;
}>;

/** Only a newly awarded, trusted claim response can produce a completion notice. */
export function challengeAwardsFromClaim(value: unknown): ChallengeAward[] {
  if (!value || typeof value !== "object") return [];
  const claim = value as Record<string, unknown>;
  if (claim.awarded !== true || !Array.isArray(claim.challenges)) return [];
  const seen = new Set<string>();
  return claim.challenges.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const definition = challengeCatalog.find((entry) => entry.key === row.challengeKey);
    if (!definition || typeof row.eventId !== "string" || seen.has(row.eventId)) return [];
    const reward = challengeRewards(definition.kind);
    if (row.xp !== reward.xp || row.coins !== reward.coins) return [];
    seen.add(row.eventId);
    return [{
      eventId: row.eventId,
      challengeKey: definition.key,
      xp: reward.xp,
      coins: reward.coins,
      cityGrew: Array.isArray(row.cityConstruction) && row.cityConstruction.length > 0,
    }];
  });
}
