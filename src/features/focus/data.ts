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
  const [progress, subjects] = await Promise.all([
    getFocusProgress(),
    ownedRows("subjects"),
  ]);
  return {
    progress,
    subjects: [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    settings: s.settings,
    profile: s.profile,
  };
});

/** The Focus and Statistics source-of-truth RPC, shared with Dashboard. */
export const getFocusProgress = cache(async (): Promise<Progress> => {
  const s = await focusStudent();
  const result = await s.client.rpc("focus_progress");
  if (result.error || !result.data) throw new Error("Progress unavailable");
  return result.data as unknown as Progress;
});

export const profileData = cache(async () => {
  const s = await focusStudent();
  const progress = await progressData();
  return { ...progress, email: s.user.email ?? "" };
});
