"use server";

import { siteUrl } from "@/lib/env/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authError, type FormState } from "./state";
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
    if (error) return { error: authError(error.code) };
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
        emailRedirectTo: `${siteUrl()}/auth/callback`,
      },
    });
    if (error) return { error: authError(error.code) };
    if (data.session) {
      await client.auth.signOut({ scope: "local" });
      return { error: "unavailable" }; // Hosted Confirm email must be ON; never falsely claim an email was sent.
    }
    return { success: "confirmation" };
  } catch {
    return { error: "unavailable" };
  }
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
