import { getAchievements } from "@/features/progression/data";
import { achievementViews } from "@/features/progression/achievement-view";
import { AchievementsExperience } from "./achievements-experience";

export default async function AchievementsPage() {
  const result = await getAchievements();
  return <AchievementsExperience views={result.kind === "authenticated"
    ? achievementViews(result.progress, result.unlocked) : null} />;
}
