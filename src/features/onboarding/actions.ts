"use server";

import { createClient } from "@/lib/supabase/server";
import { textField, validName } from "@/features/auth/validation";
import type { ErrorCode } from "@/features/auth/state";
import { educationFrom, validEducation } from "@/features/education/config";
import type { Json } from "@/types/database";

export type StepResult = {
  error?: ErrorCode;
  step?: number;
  complete?: boolean;
};

export async function saveStep(form: FormData): Promise<StepResult> {
  const step = Number(textField(form, "step"));
  let value: Json = {};
  if (step === 1) {
    const name = textField(form, "name").trim();
    if (!validName(name)) return { error: "invalid" };
    value = { name };
  } else if (step === 2) {
    const stage = textField(form, "stage");
    if (stage !== "preparatory" && stage !== "secondary")
      return { error: "invalid" };
    value = { stage };
  } else if (step === 3) {
    const education = educationFrom(Object.fromEntries(form));
    if (!validEducation(education)) return { error: "invalid" };
    value = { ...education, year: education.school_year };
  } else if (step === 4) {
    const minutes = Number(textField(form, "minutes"));
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720)
      return { error: "invalid" };
    value = { minutes };
  } else if (step === 5) {
    const subjects = form.getAll("subject");
    if (
      subjects.length < 1 ||
      subjects.length > 20 ||
      subjects.some(
        (name) => typeof name !== "string" || !validName(name.trim()),
      )
    )
      return { error: "invalid" };
    value = { subjects: subjects.map((name) => String(name).trim()) };
  } else if (step !== 6) return { error: "invalid" };

  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return { error: "expired" };
    // Server identity is checked here and auth.uid() is checked independently in SQL.
    if (step === 3 || step === 6) {
      // Fail closed until the additive migration is installed; the older RPC
      // would otherwise accept step 3 but silently ignore its new fields.
      const { data: profile, error } = await client
        .from("profiles")
        .select(
          "school_stage,school_year,education_system,academic_branch,academic_track,specialization_subject",
        )
        .eq("id", data.user.id)
        .single();
      if (error || !profile) return { error: "unavailable" };
      if (step === 6 && !validEducation(educationFrom(profile)))
        return { error: "invalid" };
    }
    if (step === 6) {
      const locale = textField(form, "locale");
      const theme = textField(form, "theme");
      const accent = textField(form, "accent");
      if (
        (locale !== "en" && locale !== "ar") ||
        (theme !== "light" && theme !== "dark" && theme !== "system") ||
        (accent !== "violet" &&
          accent !== "blue" &&
          accent !== "green" &&
          accent !== "orange")
      )
        return { error: "invalid" };
      const { error } = await client.rpc("complete_onboarding", {
        p_locale: locale,
        p_theme: theme,
        p_accent: accent,
      });
      return error ? { error: "unavailable" } : { complete: true };
    }
    const { error } = await client.rpc("save_onboarding_step", {
      p_step: step,
      p_value: value,
    });
    return error
      ? {
          error:
            error.code === "22023" || error.code === "23514"
              ? "invalid"
              : "unavailable",
        }
      : { step: step + 1 };
  } catch {
    return { error: "unavailable" };
  }
}
