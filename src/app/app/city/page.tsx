import { CityExperience } from "./city-experience";
import { getCityOverview } from "@/features/city/data";
import { focusStudent, getFocusProgress } from "@/features/focus/data";

export default async function CityPage() {
  const student = await focusStudent();
  const [city, focus] = await Promise.allSettled([getCityOverview(), getFocusProgress()]);
  const overview = city.status === "fulfilled" ? city.value : null;
  const progress = focus.status === "fulfilled" ? focus.value : null;
  const goal = student.profile.daily_goal_minutes;
  return <CityExperience overview={overview} focusProgress={progress} dailyGoal={goal} />;
}
