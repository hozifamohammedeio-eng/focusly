import { planningData } from "@/features/planning/data";
import { Workspace } from "@/features/planning/workspace";
export default async function Page() {
  return <Workspace data={await planningData("calendar")} view="calendar" />;
}
