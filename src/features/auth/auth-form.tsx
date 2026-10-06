"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { emailCopy } from "./email-copy";
import { useLocale } from "@/features/i18n/locale-provider";
import { login, signup, forgot, reset } from "./actions";
import type { FormState } from "./state";
import { useCopy } from "@/features/i18n/use-copy";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { PasswordField } from "./password-field";
const actions = { login, signup, forgot, reset };
export type AuthMode = keyof typeof actions;
export function AuthForm({
  mode,
  status,
}: {
  mode: AuthMode;
  status?: string | undefined;
}) {
  const { locale } = useLocale();
  const e = emailCopy[locale];
  const t = useCopy();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const submitting = useRef(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (previous, form) => {
      try { return await actions[mode](previous, form); }
      finally { submitting.current = false; }
    },
    {},
  );
  const signingUp = mode === "signup";
  return (
    <>
      <SiteHeader />
      <main id="main" className="auth-page">
        <section className="auth-form" dir={locale === "ar" ? "rtl" : "ltr"}>
          <span className="auth-mark" aria-hidden="true">f.</span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "forgot"
              ? e.forgotTitle
              : mode === "reset"
                ? e.resetTitle
                : signingUp
                  ? t.signupTitle
                  : locale === "ar" ? "نورت تاني 👋" : "Welcome back 👋"}
          </h1>
          <p className="muted mt-3 leading-6">
            {mode === "forgot"
              ? e.forgotHint
              : mode === "reset"
                ? e.resetHint
                : signingUp
                  ? t.signupSubtitle
                  : locale === "ar" ? "يلا نكمّل من حيث وقفنا." : "Let’s get you back to your study plan."}
          </p>
          {status &&
            ["confirmed", "changed", "invalidLink"].includes(status) && (
              <p role="status" className="mt-4">
                {e[status as "confirmed" | "changed" | "invalidLink"]}
              </p>
            )}
          {state.success ? (
            <div role="status" className="mt-6">
              <h2>{e.check}</h2>
              <p className="muted mt-3">{e[state.success]}</p>
            </div>
          ) : (
            <form
              action={action}
              className="mt-7 grid gap-5"
              aria-busy={pending}
              onSubmit={event => {
                if (submitting.current) { event.preventDefault(); return; }
                const form = event.currentTarget;
                if (signingUp || mode === "reset") {
                  const password = form.elements.namedItem("password") as HTMLInputElement;
                  const confirm = form.elements.namedItem("confirm") as HTMLInputElement;
                  confirm.setCustomValidity(password.value === confirm.value ? "" : locale === "ar" ? "كلمتا السر مش متطابقتين." : "Passwords don’t match.");
                  if (!form.reportValidity()) { event.preventDefault(); return; }
                }
                submitting.current = true;
              }}
            >
              <fieldset disabled={pending} className="grid min-w-0 gap-5">
                {signingUp && (
                  <Field
                    label={t.name}
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                  />
                )}
                {mode !== "reset" && (
                  <Field
                    label={t.email}
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    maxLength={254}
                    required
                  />
                )}
                {mode !== "forgot" && (
                  <PasswordField label={mode === "reset" ? locale === "ar" ? "كلمة السر الجديدة" : "New password" : t.password}
                    name="password" fresh={signingUp || mode === "reset"}
                    hint={signingUp || mode === "reset" ? t.passwordHint : undefined} />
                )}
                {(signingUp || mode === "reset") && (
                  <PasswordField label={t.confirm} name="confirm" fresh />
                )}
              </fieldset>
              {state.error && (
                <p className="form-error" role="alert">
                  {state.error === "unconfirmed" ? e.unconfirmed : state.error === "credentials" ? locale === "ar" ? "الإيميل أو كلمة السر مش صح." : "The email or password isn’t right." : t.errors[state.error]}
                </p>
              )}
              {state.error === "unconfirmed" && <div className="auth-info grid gap-3">
                <p>{locale === "ar" ? "مش لاقيها؟ راجع Spam / Junk." : "Can’t find it? Check Spam / Junk."}</p>
                <Link className="underline" href="/confirm-email">{locale === "ar" ? "إعادة إرسال الرسالة" : "Resend confirmation email"}</Link>
                <button type="button" className="text-start underline" onClick={() => { setEmail(""); document.getElementById("email")?.focus(); }}>{locale === "ar" ? "تغيير الإيميل" : "Change email"}</button>
              </div>}
              <Button type="submit" disabled={pending} className="!h-12 w-full">
                {pending
                  ? t.working
                  : mode === "forgot"
                    ? e.send
                    : mode === "reset"
                      ? e.reset
                      : signingUp
                        ? t.signup
                        : t.login}
              </Button>
            </form>
          )}
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="mt-5 inline-block text-[var(--accent)] underline"
            >
              {e.forgot}
            </Link>
          )}
          <p className="muted mt-7 text-sm leading-6">
            {mode === "login" ? t.noAccount : t.already}{" "}
            <Link
              className="font-semibold text-[var(--accent)] underline underline-offset-4"
              href={mode === "login" ? "/signup" : "/login"}
            >
              {mode === "login" ? t.signup : t.login}
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
