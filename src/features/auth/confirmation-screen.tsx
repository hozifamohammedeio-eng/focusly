"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/features/i18n/locale-provider";
import { checkConfirmation, resendConfirmation, type ResendState } from "./actions";

const copy = {
  en: {
    title: "Confirm your email 📩",
    intro: "We sent you a confirmation email. Open it and press the confirmation button to continue setting up Focusly.",
    missing: "Can't find it? Check Spam, Junk, or Promotions.",
    sentTo: "Sent to",
    gmail: "Open Gmail",
    resend: "Resend email",
    change: "Change email",
    check: "I've confirmed my email",
    sent: "Sent again ✅ If it’s not in your Inbox, check Spam / Junk.",
    rateLimit: "Please wait before requesting another email.",
    unavailable: "We couldn't send the email right now. Please try again shortly.",
    waiting: "We haven't detected confirmation yet. Open the link in this browser, or try again shortly.",
    checking: "Checking…",
    cooldown: (seconds: number) => `Resend available in ${seconds}s`,
  },
  ar: {
    title: "أكد إيميلك 📩",
    intro: "افتح رسالة Focusly واضغط على زر التأكيد.",
    missing: "مش لاقي الرسالة؟ دور في Spam / الرسائل غير المرغوب فيها / Promotions.",
    sentTo: "اترسلت إلى",
    gmail: "فتح Gmail",
    resend: "إعادة إرسال الرسالة",
    change: "تغيير البريد",
    check: "أكدت البريد",
    sent: "اتبعتت تاني ✅ ولو مش ظاهرة في Inbox، راجع Spam / Junk.",
    rateLimit: "استنى شوية قبل ما تطلب رسالة تانية.",
    unavailable: "مش قادرين نبعت الرسالة دلوقتي. جرّب كمان شوية.",
    waiting: "لسه ما وصلناش تأكيد البريد. افتح الرابط في المتصفح ده أو جرّب كمان شوية.",
    checking: "بنتأكد…",
    cooldown: (seconds: number) => `إعادة الإرسال بعد ${seconds} ث`,
  },
} as const;

export function ConfirmationScreen({ email, gmail, resendAt, initialNotice = false }: { email: string; gmail: boolean; resendAt: number; initialNotice?: boolean }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const [notice, setNotice] = useState(initialNotice);
  const title = useRef<HTMLHeadingElement>(null);
  const resendLock = useRef(false);
  const [now, setNow] = useState<number | null>(null);
  const [state, resend, sending] = useActionState<ResendState, FormData>(async (previous, form) => {
    try { return await resendConfirmation(previous, form); }
    catch { return { status: "unavailable" as const }; }
    finally { resendLock.current = false; }
  }, {});
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
      <section className="auth-form max-w-xl" dir={locale === "ar" ? "rtl" : "ltr"}>
        <span className="auth-mark" aria-hidden="true">f.</span>
        {notice ? <div>
          <h1 className="text-3xl font-semibold tracking-tight">{locale === "ar" ? "رسالة التأكيد اتبعتت 📩" : "Confirmation email sent 📩"}</h1>
          <p className="muted mt-4">{locale === "ar" ? "بعتنالك رسالة على:" : "We sent a confirmation email to:"}</p>
          <p className="auth-email mt-2" dir="ltr">{email}</p>
          <div className="auth-info mt-6" role="note">
            <strong>{locale === "ar" ? "مهم 👀" : "Good to know"}</strong>
            <p className="mt-2">{locale === "ar" ? "لو مش لاقي الرسالة قدامك في Inbox، افتح Spam أو Junk لأن رسالة التأكيد ممكن تظهر هناك." : "Can’t see it in your Inbox? Check Spam or Junk — confirmation emails can sometimes appear there."}</p>
          </div>
          <Button className="mt-6 min-h-12 w-full" onClick={() => { setNotice(false); window.history.replaceState(null, "", "/confirm-email"); window.requestAnimationFrame(() => title.current?.focus()); }}>{locale === "ar" ? "فهمت" : "Got it"}</Button>
        </div> : <>
        <h1 ref={title} tabIndex={-1} className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        <p className="muted mt-4 leading-7">{t.intro}</p>
        {email && <p className="mt-5 rounded-2xl border border-[var(--border)] p-4 text-sm"><span className="muted">{t.sentTo}: </span><b dir="ltr" className="auth-email inline-block">{email}</b></p>}
        <p className="auth-info mt-5">{t.missing}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {gmail && <a className="focusly-button button-secondary inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--foreground)] px-5 py-2.5 text-sm font-medium" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer">{t.gmail}</a>}
          <form action={resend} onSubmit={event => { if (resendLock.current || seconds > 0) { event.preventDefault(); return; } resendLock.current = true; }}>
            <Button type="submit" variant="secondary" className="w-full" disabled={!email || sending || now === null || seconds > 0}>{sending || now === null ? t.checking : seconds > 0 ? t.cooldown(seconds) : t.resend}</Button>
          </form>
          <ButtonLink href="/signup" variant="ghost" className="w-full">{t.change}</ButtonLink>
          <Button className="w-full" disabled={checking} onClick={() => startCheck(async () => setCheckMessage(await checkConfirmation()))}>{checking ? t.checking : t.check}</Button>
        </div>
        {state.status && <p className="mt-5 text-sm" role={state.status === "sent" ? "status" : "alert"}>{t[state.status === "missing" ? "unavailable" : state.status]}</p>}
        {checkMessage && <p className="mt-5 text-sm" role="status">{t[checkMessage]}</p>}
        <p className="muted mt-6 text-sm"><Link href="/login" className="underline underline-offset-4">{locale === "ar" ? "العودة لتسجيل الدخول" : "Back to login"}</Link></p>
        </>}
      </section>
    </main>
  </>;
}
