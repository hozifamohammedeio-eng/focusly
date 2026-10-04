export const RESEND_COOLDOWN_MS = 60_000;
export const PENDING_EMAIL_COOKIE = "focusly-pending-email";
export const RESEND_AFTER_COOKIE = "focusly-confirm-resend-after";

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function confirmedPath(onboardingComplete: boolean): string {
  return onboardingComplete ? "/app" : "/onboarding?status=email-confirmed";
}
