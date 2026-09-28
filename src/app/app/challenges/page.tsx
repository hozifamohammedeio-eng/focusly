import { ChallengesExperience } from "./challenges-experience";
import { getChallenges } from "@/features/challenges/data";

export default async function ChallengesPage() {
  const result = await getChallenges();
  return <ChallengesExperience challenges={result.kind === "authenticated" ? result.challenges : null} />;
}
