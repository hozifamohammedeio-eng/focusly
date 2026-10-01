import { CityExperience } from "./city-experience";
import { getCityOverview } from "@/features/city/data";

export default async function CityPage() {
  const overview = await getCityOverview();
  return <CityExperience overview={overview} />;
}
