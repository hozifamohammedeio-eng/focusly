"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/features/i18n/locale-provider";
import { checkConfirmation, resendConfirmation, type ResendState } from "./actions";

const copy = {
  en: {
    title: "Confirm your email",
    intro: "We sent you a confirmation email. Open it and press the confirmation button to continue setting up Focusly.",
    missing: "Can't find it? Check Spam, Junk, or Promotions.",
    sentTo: "Sent to",
    gmail: "Open Gmail",
    resend: "Resend email",
    change: "Change email",
    check: "I've confirmed my email",
    sent: "A new confirmation email is on its way.",
    rateLimit: "Please wait before requesting another email.",
    unavailable: "We couldn't send the email right now. Please try again shortly.",
    waiting: "We haven't detected confirmation yet. Open the link in this browser, or try again shortly.",
    checking: "Checking…",
    cooldown: (seconds: number) => `Resend available in ${seconds}s`,
  },
  ar: {
    title: "أكد بريدك الإلكتروني",
    intro: "بعتنالك رسالة تأكيد. افتح بريدك واضغط زر تأكيد الحساب عشان تكمل إعداد Focusly.",
    missing: "مش لاقي الرسالة؟ دور في Spam / الرسائل غير المرغوب فيها / Promotions.",
    sentTo: "اترسلت إلى",
    gmail: "فتح Gmail",
    resend: "إعادة إرسال الرسالة",
    change: "تغيير البريد",
    check: "أكدت البريد",
    sent: "بعتنالك رسالة تأكيد جديدة.",
    rateLimit: "استنى شوية قبل ما تطلب رسالة تانية.",
    unavailable: "مش قادرين نبعت الرسالة دلوقتي. جرّب كمان شوية.",
    waiting: "لسه ما وصلناش تأكيد البريد. افتح الرابط في المتصفح ده أو جرّب كمان شوية.",
    checking: "بنتأكد…",
    cooldown: (seconds: number) => `إعادة الإرسال بعد ${seconds} ث`,
  },
} as const;

export function ConfirmationScreen({ maskedEmail, gmail, resendAt }: { maskedEmail: string; gmail: boolean; resendAt: number }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const [now, setNow] = useState<number | null>(null);
  const [state, resend, sending] = useActionState<ResendState, FormData>(resendConfirmation, {});
  const [checking, startCheck] = useTransition();
  const [checkMessage, setCheckMessage] = useState<"waiting" | "unavailable" | null>(null);
  const lastAutomaticCheck = useRef(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const checkOnReturn = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastAutomaticCheck.current < 5000) return;
      lastAutomaticCheck.current = Date.now();
      startCheck(async () => setCheckMessage(await checkConfirmation()));
    };
    window.addEventListener("focus", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);
    return () => {
      window.removeEventListener("focus", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [startCheck]);
  const seconds = now === null ? 0 : Math.max(0, Math.ceil((Math.max(resendAt, state.retryAt ?? 0) - now) / 1000));
  return <>
    <SiteHeader />
    <main id="main" className="auth-page">
      <section className="auth-form max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        <p className="muted mt-4 leading-7">{t.intro}</p>
        {maskedEmail && <p className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm"><span className="muted">{t.sentTo}: </span><b dir="ltr" className="inline-block">{maskedEmail}</b></p>}
        <p className="muted mt-5 text-sm leading-6">{t.missing}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {gmail && <a className="focusly-button button-secondary inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--foreground)] px-5 py-2.5 text-sm font-medium" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">{t.gmail}</a>}
          <form action={resend}>
            <Button type="submit" variant="secondary" className="w-full" disabled={!maskedEmail || sending || now === null || seconds > 0}>{now === null ? t.checking : seconds > 0 ? t.cooldown(seconds) : t.resend}</Button>
          </form>
          <ButtonLink href="/signup" variant="ghost" className="w-full">{t.change}</ButtonLink>
          <Button className="w-full" disabled={checking} onClick={() => startCheck(async () => setCheckMessage(await checkConfirmation()))}>{checking ? t.checking : t.check}</Button>
        </div>
        {state.status && <p className="mt-5 text-sm" role={state.status === "sent" ? "status" : "alert"}>{t[state.status === "missing" ? "unavailable" : state.status]}</p>}
        {checkMessage && <p className="mt-5 text-sm" role="status">{t[checkMessage]}</p>}
        <p className="muted mt-6 text-sm"><Link href="/login" className="underline underline-offset-4">{locale === "ar" ? "العودة لتسجيل الدخول" : "Back to login"}</Link></p>
      </section>
    </main>
  </>;
}
