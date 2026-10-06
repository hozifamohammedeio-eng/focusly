import { cookies } from "next/headers";
import { redirectAuthenticated } from "@/features/auth/session";
import { PENDING_EMAIL_COOKIE, RESEND_AFTER_COOKIE } from "@/features/auth/confirmation";
import { validEmail } from "@/features/auth/validation";
import { ConfirmationScreen } from "@/features/auth/confirmation-screen";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await redirectAuthenticated();
  const jar = await cookies();
  const email = jar.get(PENDING_EMAIL_COOKIE)?.value ?? "";
  const resendAt = Number(jar.get(RESEND_AFTER_COOKIE)?.value ?? 0);
  return <ConfirmationScreen email={validEmail(email) ? email : ""} initialNotice={(await searchParams).notice === "sent" && validEmail(email)} gmail={/^[^@]+@(gmail\.com|googlemail\.com)$/i.test(email)} resendAt={Number.isFinite(resendAt) ? resendAt : 0} />;
}
