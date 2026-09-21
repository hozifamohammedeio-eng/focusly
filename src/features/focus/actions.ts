"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validName } from "@/features/auth/validation";
import { educationFrom, validEducation } from "@/features/education/config";
import { UUID, validZone } from "@/features/planning/logic";
import type { TimerReply } from "./logic";
export async function focusAction(
  form: FormData,
): Promise<TimerReply | { error: true }> {
  try {
    const action = String(form.get("action") ?? ""),
      id = String(form.get("id") ?? ""),
      subject = String(form.get("subject") ?? ""),
      task = String(form.get("task") ?? ""),
      revision = String(form.get("revision") ?? "");
    if (
      !["start", "recover", "pause", "resume", "finish", "discard"].includes(
        action,
      ) ||
      [id, subject, task].some((v) => v && !UUID.test(v)) ||
      (revision && !Number.isFinite(Date.parse(revision)))
    )
      return { error: true };
    const client = await createClient();
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) return { error: true };
    const r = await client.rpc("focus_transition", {
      p_action: action,
      ...(id ? { p_id: id } : {}),
      p_minutes: Number(form.get("minutes") ?? 25),
      ...(subject ? { p_subject: subject } : {}),
      ...(task ? { p_task: task } : {}),
      ...(revision ? { p_revision: revision } : {}),
    });
    if (r.error) {
      console.error("focus_transition_failed", { code: r.error.code });
      return { error: true };
    }
    revalidatePath("/app", "layout");
    return r.data as unknown as TimerReply;
  } catch {
    return { error: true };
  }
}
export async function saveStudySettings(
  form: FormData,
): Promise<{ ok: boolean }> {
  try {
    const client = await createClient(),
      { data } = await client.auth.getUser();
    if (!data.user) return { ok: false };
    const zone = String(form.get("time_zone") ?? "");
    if (!validZone(zone)) return { ok: false };
    if (form.get("initialize") === "true") {
      const r = await client
        .from("user_settings")
        .update({ time_zone: zone })
        .eq("user_id", data.user.id)
        .is("time_zone", null);
      if (r.error) return { ok: false };
    } else {
      const focus = Number(form.get("focus_minutes")),
        short = Number(form.get("short_break_minutes")),
        long = Number(form.get("long_break_minutes"));
      if (
        ![focus, short, long].every(Number.isInteger) ||
        focus < 5 ||
        focus > 180 ||
        short < 1 ||
        short > 60 ||
        long < 1 ||
        long > 60
      )
        return { ok: false };
      const r = await client
        .from("user_settings")
        .update({
          focus_minutes: focus,
          short_break_minutes: short,
          long_break_minutes: long,
          time_zone: zone,
        })
        .eq("user_id", data.user.id)
        .select("user_id")
        .single();
      if (r.error) return { ok: false };
    }
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function saveProfileSettings(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const education = educationFrom(Object.fromEntries(form));
  const dailyGoal = Number(form.get("daily_goal_minutes"));
  if (
    !validName(name) ||
    !validEducation(education) ||
    !Number.isInteger(dailyGoal) ||
    dailyGoal < 5 ||
    dailyGoal > 720
  )
    return { ok: false as const };
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false as const };
    const subjects = form.getAll("suggested_subject").map(String);
    if (subjects.length > 20 || subjects.some(name => !validName(name))) return { ok: false as const };
    const { error } = await client.rpc("save_education", {
      p_value: { ...education, display_name: name, daily_goal_minutes: dailyGoal },
      p_subjects: subjects,
    });
    if (error) return { ok: false as const };
    revalidatePath("/app", "layout");
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}
