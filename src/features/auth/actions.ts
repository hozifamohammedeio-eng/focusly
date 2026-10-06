"use server";

import { siteUrl } from "@/lib/env/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authError, type FormState } from "./state";
import { PENDING_EMAIL_COOKIE, RESEND_AFTER_COOKIE, RESEND_COOLDOWN_MS, confirmedPath } from "./confirmation";
import { textField, validEmail, validName, validPassword } from "./validation";

export async function login(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = textField(form, "email").trim();
  const password = textField(form, "password");
  if (!validEmail(email) || !password || password.length > 128)
    return { error: "invalid" };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "email_not_confirmed") {
        const jar = await cookies();
        jar.set(PENDING_EMAIL_COOKIE, email, { httpOnly: true, sameSite: "lax", secure: siteUrl().startsWith("https:"), path: "/", maxAge: 3600 });
      }
      return { error: authError(error.code) };
    }
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/", "layout");
  redirect("/app"); // /app's server guard decides whether onboarding is required.
}

export async function signup(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const name = textField(form, "name").trim();
  const email = textField(form, "email").trim();
  const password = textField(form, "password");
  if (
    !validName(name) ||
    !validEmail(email) ||
    !validPassword(password) ||
    password !== textField(form, "confirm")
  )
    return { error: "invalid" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${siteUrl()}/auth/confirm`,
      },
    });
    if (error) return { error: authError(error.code) };
    if (data.session) {
      await client.auth.signOut({ scope: "local" });
      return { error: "unavailable" }; // Hosted Confirm email must be ON; never falsely claim an email was sent.
    }
    const jar = await cookies();
    const options = { httpOnly: true, sameSite: "lax" as const, secure: siteUrl().startsWith("https:"), path: "/", maxAge: 3600 };
    jar.set(PENDING_EMAIL_COOKIE, email, options);
    jar.set(RESEND_AFTER_COOKIE, String(Date.now() + RESEND_COOLDOWN_MS), options);
  } catch {
    return { error: "unavailable" };
  }
  redirect("/confirm-email?notice=sent");
}

export type ResendState = { status?: "sent" | "rateLimit" | "unavailable" | "missing"; retryAt?: number };

export async function resendConfirmation(_previous: ResendState, _form: FormData): Promise<ResendState> {
  void _previous;
  void _form;
  const jar = await cookies();
  const email = jar.get(PENDING_EMAIL_COOKIE)?.value;
  if (!email || !validEmail(email)) return { status: "missing" };
  const retryAt = Number(jar.get(RESEND_AFTER_COOKIE)?.value ?? 0);
  if (Number.isFinite(retryAt) && retryAt > Date.now()) return { status: "rateLimit", retryAt };
  const nextRetryAt = Date.now() + RESEND_COOLDOWN_MS;
  jar.set(RESEND_AFTER_COOKIE, String(nextRetryAt), { httpOnly: true, sameSite: "lax", secure: siteUrl().startsWith("https:"), path: "/", maxAge: 3600 });
  try {
    const client = await createClient();
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${siteUrl()}/auth/confirm` } });
    if (error) return { status: authError(error.code) === "rateLimit" || error.status === 429 ? "rateLimit" : "unavailable", retryAt: nextRetryAt };
    return { status: "sent", retryAt: nextRetryAt };
  } catch {
    return { status: "unavailable", retryAt: nextRetryAt };
  }
}

export async function checkConfirmation(): Promise<"waiting" | "unavailable"> {
  let path: string | undefined;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error) return error.status && error.status >= 500 ? "unavailable" : "waiting";
    if (!data.user?.email_confirmed_at) return "waiting";
    const profile = await client.from("profiles").select("onboarding_completed").eq("id", data.user.id).single();
    path = confirmedPath(profile.data?.onboarding_completed === true);
  } catch {
    return "unavailable";
  }
  revalidatePath("/", "layout");
  redirect(path);
}

export async function logout(): Promise<FormState> {
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut();
    if (error) return { error: "unavailable" };
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgot(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = textField(form, "email").trim();
  if (!validEmail(email)) return { error: "invalid" };
  try {
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl() + "/auth/callback?flow=recovery",
    });
    if (error) return { error: authError(error.code) };
    return { success: "recovery" };
  } catch {
    return { error: "unavailable" };
  }
}
export async function reset(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const password = textField(form, "password");
  if (!validPassword(password) || password !== textField(form, "confirm"))
    return { error: "invalid" };
  try {
    const client = await createClient();
    const { data, error: identityError } = await client.auth.getUser();
    if (identityError || !data.user) return { error: "expired" };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { error: authError(error.code) };
    const { error: signoutError } = await client.auth.signOut();
    if (signoutError) return { error: "unavailable" };
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/", "layout");
  redirect("/login?status=changed");
}
