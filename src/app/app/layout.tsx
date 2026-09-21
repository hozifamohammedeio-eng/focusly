import type { ReactNode } from "react";
import { focusStudent } from "@/features/focus/data";
import { PlanningShell } from "@/features/planning/shell";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  const data = await focusStudent();
  return <PlanningShell settings={data.settings}>{children}</PlanningShell>;
}
