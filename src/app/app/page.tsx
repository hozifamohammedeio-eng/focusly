import { dashboardData } from "@/features/dashboard/data";
import { DashboardExperience } from "@/features/dashboard/experience";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <DashboardExperience data={await dashboardData()} />;
}
