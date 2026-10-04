import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { ServiceState } from "@/components/layout/service-state";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const student = await getStudent();
  if (student.kind === "anonymous" || student.kind === "unconfigured")
    redirect("/login");
  if (student.kind !== "authenticated") return <ServiceState />;
  if (student.profile.onboarding_completed) redirect("/app");
  const confirmed = (await searchParams).status === "email-confirmed";
  const locale = (await cookies()).get("focusly-locale")?.value === "ar" ? "ar" : student.settings.locale;
  return <>
    {confirmed && <p role="status" className="mx-auto mt-6 max-w-3xl px-4 text-sm font-medium text-[var(--accent)]">{locale === "ar" ? "تم تأكيد البريد ✓" : "Email confirmed ✓"}</p>}
    <OnboardingWizard profile={student.profile} />
  </>;
}
