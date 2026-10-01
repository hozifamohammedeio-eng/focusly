"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { challengeAwardsFromClaim, type ChallengeAward } from "@/features/challenges/receipt";
import { cityGrowthFromClaim, type CityGrowth } from "@/features/city/receipt";
import { achievementAwardsFromEvaluation, type AchievementAward } from "@/features/progression/achievement-receipt";
import {
  UUID,
  overlaps,
  toInstant,
  validSubject,
  validTask,
  validText,
  validDate,
  validZone,
  type Block,
  type Task,
} from "./logic";
export type MutationResult = {
  challengeAwards?: ChallengeAward[];
  cityGrowth?: CityGrowth | null;
  achievementAwards?: AchievementAward[];
  error?:
    | "invalid"
    | "expired"
    | "saveError"
    | "duplicate"
    | "notFound"
    | "overlap";
  success?: "saved" | "deleted" | "archived";
};
export async function mutate(form: FormData): Promise<MutationResult> {
  const field = (key: string) =>
    typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const entity = field("entity"),
    action = field("action"),
    id = field("id");
  if (
    !["subjects", "tasks", "study_blocks", "settings"].includes(entity) ||
    !["save", "delete", "complete", "restore"].includes(action) ||
    (id && !UUID.test(id))
  )
    return { error: "invalid" };
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { error: "expired" };
    const owner = auth.user.id;
    let challengeAwards: ChallengeAward[] = [];
    let cityGrowth: CityGrowth | null = null;
    let achievementAwards: AchievementAward[] = [];
    const profile = await client
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", owner)
      .single();
    if (profile.error || !profile.data.onboarding_completed)
      return { error: "expired" };
    const fail = (code?: string): MutationResult => {
      console.error("planning_write_failed", { entity, action, code });
      return {
        error:
          code === "23505"
            ? "duplicate"
            : code === "P0002"
              ? "notFound"
              : "saveError",
      };
    };
    if (entity === "settings") {
      const locale = field("locale"),
        theme = field("theme"),
        accent = field("accent"),
        name = field("name");
      if (action !== "save" ||
        (form.has("name") && !validText(name, 80)) ||
        (form.has("locale") && locale !== "ar" && locale !== "en") ||
        (form.has("theme") && !["light", "dark", "system"].includes(theme)) ||
        (form.has("accent") && !["violet", "blue", "green", "orange"].includes(accent)) ||
        !["locale", "theme", "accent"].some(key => form.has(key)))
        return { error: "invalid" };
      if (form.has("name")) {
        const p = await client.from("profiles").update({ display_name: name }).eq("id", owner).select("id").single();
        if (p.error) return fail(p.error.code);
      }
      // Patch only explicitly submitted preferences; never overwrite unrelated settings.
      const r = await client.from("user_settings").update({
        ...(form.has("locale") ? { locale: locale as "en" | "ar" } : {}),
        ...(form.has("theme") ? { theme: theme as "light" | "dark" | "system" } : {}),
        ...(form.has("accent") ? { accent: accent as "violet" | "blue" | "green" | "orange" } : {}),
      }).eq("user_id", owner).select("user_id").single();
      if (r.error) return fail(r.error.code);
    } else if (action === "delete") {
      if (!id) return { error: "invalid" };
      if (entity === "subjects") {
        const r = await client.rpc("remove_subject", { p_id: id });
        if (r.error) return fail(r.error.code);
        revalidatePath("/app", "layout");
        return { success: r.data ? "archived" : "deleted" };
      }
      const table = entity === "tasks" ? "tasks" : "study_blocks";
      const r = await client
        .from(table)
        .delete()
        .eq("id", id)
        .eq("user_id", owner)
        .select("id");
      if (r.error) return fail(r.error.code);
      if (!r.data.length) return { error: "notFound" };
    } else if (entity === "subjects") {
      if (action === "restore") {
        if (!id) return { error: "invalid" };
        const r = await client
          .from("subjects")
          .update({ archived_at: null })
          .eq("id", id)
          .eq("user_id", owner)
          .select("id")
          .single();
        if (r.error) return fail(r.error.code);
      } else {
        const name = field("name"),
          color = field("color");
        if (action !== "save" || !validSubject(name, color))
          return { error: "invalid" };
        const r = id
          ? await client
              .from("subjects")
              .update({ name, color })
              .eq("id", id)
              .eq("user_id", owner)
              .select("id")
              .single()
          : await client
              .from("subjects")
              .insert({ user_id: owner, name, color })
              .select("id")
              .single();
        if (r.error) return fail(r.error.code);
      }
    } else if (entity === "tasks" && action === "complete") {
      if (!id) return { error: "invalid" };
      const complete = field("completed");
      if (!["true", "false"].includes(complete)) return { error: "invalid" };
      const r = await client
        .from("tasks")
        .update({
          status: complete === "true" ? "completed" : "todo",
          completed_at: complete === "true" ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .eq("user_id", owner)
        .select("id")
        .single();
      if (r.error) return fail(r.error.code);
      if (complete === "true" && process.env.FOCUSLY2_REWARDS_ENABLED === "true") {
        try {
          const reward = await client.rpc("claim_task_progression_reward", { p_task_id: id });
          if (reward.error) console.error("task_reward_failed", { code: reward.error.code });
          else {
            challengeAwards = challengeAwardsFromClaim(reward.data);
            cityGrowth = cityGrowthFromClaim(reward.data);
            if (reward.data && typeof reward.data === "object" && !Array.isArray(reward.data) && reward.data.awarded === true)
              achievementAwards = achievementAwardsFromEvaluation(reward.data, reward.data.achievements);
          }
        } catch {
          console.error("task_reward_request_failed");
        }
      }
    } else if (action === "save") {
      const subject_id = field("subject_id") || null;
      if (subject_id) {
        if (!UUID.test(subject_id)) return { error: "invalid" };
        const s = await client
          .from("subjects")
          .select("id,archived_at")
          .eq("id", subject_id)
          .eq("user_id", owner)
          .single();
        if (s.error) return { error: "invalid" };
        if (s.data.archived_at) {
          const r = id
            ? await client
                .from(entity === "tasks" ? "tasks" : "study_blocks")
                .select("subject_id")
                .eq("id", id)
                .eq("user_id", owner)
                .single()
            : null;
          if (r?.data?.subject_id !== subject_id) return { error: "invalid" };
        }
      }
      if (entity === "tasks") {
        const day = field("date"),
          time = field("time");
        const settings = await client.from("user_settings").select("time_zone")
          .eq("user_id", owner).single();
        if (settings.error) return fail(settings.error.code);
        const zone = settings.data.time_zone || "UTC";
        const due_at = day && time ? toInstant(day, time, zone) : null,
          due_on = day && !time ? day : null;
        const priority = field("priority");
        const title = field("title"),
          notes = field("notes");
        if (
          !validDate(day) ||
          (day && time && !due_at) ||
          !validTask({ title, notes, priority, due_on, due_at }) ||
          (priority !== "low" && priority !== "medium" && priority !== "high")
        )
          return { error: "invalid" };
        const values: Pick<
          Task,
          "title" | "notes" | "subject_id" | "due_on" | "due_at" | "task_date" | "priority"
        > = {
          title,
          notes: notes || null,
          subject_id,
          due_on,
          due_at,
          task_date: day,
          priority,
        };
        const r = id
          ? await client
              .from("tasks")
              .update(values)
              .eq("id", id)
              .eq("user_id", owner)
              .select("id")
              .single()
          : await client
              .from("tasks")
              .insert({ ...values, user_id: owner })
              .select("id")
              .single();
        if (r.error) return fail(r.error.code);
      } else {
        const zone = field("zone"),
          start = toInstant(field("date"), field("time"), zone),
          duration = Number(field("duration")),
          repeat = field("repeat");
        if (
          !start ||
          !validZone(zone) ||
          !Number.isInteger(duration) ||
          duration < 5 ||
          duration > 720 ||
          !["never", "weekly"].includes(repeat) ||
          !subject_id
        )
          return { error: "invalid" };
        const title = field("title") || "Study"; // Internal fallback; UI displays the subject name.
        if (!validText(title, 200)) return { error: "invalid" };
        const values = {
          title,
          subject_id,
          starts_at: start,
          ends_at: new Date(Date.parse(start) + duration * 60000).toISOString(),
          repeat_weekly: repeat === "weekly",
          time_zone: zone,
        };
        const blocks: Block[] = [];
        for (let page = 0; ; page++) {
          const r = await client
            .from("study_blocks")
            .select("*")
            .eq("user_id", owner)
            .order("id")
            .range(page * 500, page * 500 + 499);
          if (r.error) return fail(r.error.code);
          blocks.push(...r.data);
          if (r.data.length < 500) break;
        }
        const candidate: Block = {
          ...values,
          id: id || "new",
          user_id: owner,
          notes: null,
          created_at: start,
          updated_at: start,
        };
        if (field("allow_overlap") !== "true" && overlaps(candidate, blocks))
          return { error: "overlap" };
        const r = id
          ? await client
              .from("study_blocks")
              .update(values)
              .eq("id", id)
              .eq("user_id", owner)
              .select("id")
              .single()
          : await client
              .from("study_blocks")
              .insert({ ...values, user_id: owner })
              .select("id")
              .single();
        if (r.error) return fail(r.error.code);
      }
    } else return { error: "invalid" };
    revalidatePath("/app", "layout");
    if (entity === "tasks" && action === "complete") revalidatePath("/app/challenges");
    if (entity === "tasks" && action === "complete") revalidatePath("/app/city");
    if (entity === "tasks" && action === "complete") revalidatePath("/app/achievements");
    return { success: action === "delete" ? "deleted" : "saved", challengeAwards, cityGrowth, achievementAwards };
  } catch {
    console.error("planning_request_failed", { entity, action });
    return { error: "saveError" };
  }
}
