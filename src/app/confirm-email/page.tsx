import { cookies } from "next/headers";
import { redirectAuthenticated } from "@/features/auth/session";
import { PENDING_EMAIL_COOKIE, RESEND_AFTER_COOKIE, maskEmail } from "@/features/auth/confirmation";
import { ConfirmationScreen } from "@/features/auth/confirmation-screen";

export const dynamic = "force-dynamic";

export default async function Page() {
  await redirectAuthenticated();
  const jar = await cookies();
  const email = jar.get(PENDING_EMAIL_COOKIE)?.value ?? "";
  const resendAt = Number(jar.get(RESEND_AFTER_COOKIE)?.value ?? 0);
  return <ConfirmationScreen maskedEmail={maskEmail(email)} gmail={/^[^@]+@(gmail\.com|googlemail\.com)$/i.test(email)} resendAt={Number.isFinite(resendAt) ? resendAt : 0} />;
}
