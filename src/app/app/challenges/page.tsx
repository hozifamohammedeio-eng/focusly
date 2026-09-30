import { ChallengesExperience } from "./challenges-experience";
import { getChallenges } from "@/features/challenges/data";
import { getSettings } from "@/features/auth/session";

export default async function ChallengesPage() {
  const [result, settings] = await Promise.all([getChallenges(), getSettings()]);
  const snapshot = result.kind === "authenticated" ? { userId: result.userId, challenges: result.challenges } : null;
  return <ChallengesExperience challenges={snapshot?.challenges ?? null} timeZone={settings.kind === "authenticated" ? settings.settings.time_zone ?? "UTC" : "UTC"} />;
}
