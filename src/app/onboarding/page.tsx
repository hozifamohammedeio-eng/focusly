import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { ServiceState } from "@/components/layout/service-state";
export const dynamic = "force-dynamic";
export default async function Page() {
  const student = await getStudent();
  if (student.kind === "anonymous" || student.kind === "unconfigured")
    redirect("/login");
  if (student.kind !== "authenticated") return <ServiceState />;
  if (student.profile.onboarding_completed) redirect("/app");
  return <OnboardingWizard profile={student.profile} />;
}
