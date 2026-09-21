"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { emailCopy } from "./email-copy";
import { useLocale } from "@/features/i18n/locale-provider";
import { login, signup, forgot, reset } from "./actions";
import type { FormState } from "./state";
import { useCopy } from "@/features/i18n/use-copy";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
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
  const [state, action, pending] = useActionState<FormState, FormData>(
    actions[mode],
    {},
  );
  const signingUp = mode === "signup";
  return (
    <>
      <SiteHeader />
      <main id="main" className="auth-page">
        <section className="auth-form">
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "forgot"
              ? e.forgotTitle
              : mode === "reset"
                ? e.resetTitle
                : signingUp
                  ? t.signupTitle
                  : t.welcome}
          </h1>
          <p className="muted mt-3 leading-6">
            {mode === "forgot"
              ? e.forgotHint
              : mode === "reset"
                ? e.resetHint
                : signingUp
                  ? t.signupSubtitle
                  : t.loginSubtitle}
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
                  <Field
                    label={t.password}
                    name="password"
                    type="password"
                    autoComplete={
                      signingUp || mode === "reset"
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={signingUp || mode === "reset" ? 8 : 1}
                    maxLength={128}
                    hint={
                      signingUp || mode === "reset" ? t.passwordHint : undefined
                    }
                    required
                  />
                )}
                {(signingUp || mode === "reset") && (
                  <Field
                    label={t.confirm}
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                )}
              </fieldset>
              {state.error && (
                <p className="form-error" role="alert">
                  {t.errors[state.error]}
                </p>
              )}
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
