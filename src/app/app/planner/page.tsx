import { planningData } from "@/features/planning/data";
import { Workspace } from "@/features/planning/workspace";
export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <Workspace data={await planningData("planner", date)} view="planner" />;
}
