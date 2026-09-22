import { cache } from "react";
import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import { ownedRows } from "@/features/planning/rows";
import type { Progress } from "./logic";
export const focusStudent = cache(async () => {
  const s = await getStudent();
  if (s.kind === "anonymous" || s.kind === "unconfigured") redirect("/login");
  if (s.kind !== "authenticated") throw new Error("Workspace unavailable");
  if (!s.profile.onboarding_completed) redirect("/onboarding");
  return s;
});
export const progressData = cache(async () => {
  const s = await focusStudent();
  const [result, subjects] = await Promise.all([
    s.client.rpc("focus_progress"),
    ownedRows("subjects"),
  ]);
  if (result.error) throw new Error("Progress unavailable");
  return {
    progress: result.data as unknown as Progress,
    subjects: [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    settings: s.settings,
    profile: s.profile,
  };
});

export const profileData = cache(async () => {
  const s = await focusStudent();
  const progress = await progressData();
  return { ...progress, email: s.user.email ?? "" };
});
