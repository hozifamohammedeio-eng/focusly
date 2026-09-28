import { ChallengesExperience } from "./challenges-experience";
import { getChallenges } from "@/features/challenges/data";
import { ChallengeCompletionFeedback } from "@/features/challenges/summary";

export default async function ChallengesPage() {
  const result = await getChallenges();
  const snapshot = result.kind === "authenticated" ? { userId: result.userId, challenges: result.challenges } : null;
  return <ChallengesExperience challenges={snapshot?.challenges ?? null} feedback={<ChallengeCompletionFeedback snapshot={snapshot} />} />;
}
