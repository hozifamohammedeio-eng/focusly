"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dateAdd, dayInZone, localParts, occurrences, toInstant, validZone, weekStart, type Block } from "@/features/planning/logic";
import { hasWorkload, parsePlan, validateInput, validatePlan, type GeneratedPlan, type PlannerInput } from "./model";
import { isProviderBusyError, requestPlan } from "./provider";

type Result = { ok: true; plan: GeneratedPlan } | { ok: false; error: "invalid" | "unavailable" | "expired" | "conflict" | "provider" | "busy" };
type SaveResult = { ok: true; tasks: number; sessions: number; alreadySaved: boolean } | { ok: false; error: "invalid" | "unavailable" | "expired" | "conflict" };

function adjustmentItemsMatch(candidate: GeneratedPlan, current: GeneratedPlan) {
  if (candidate.items.length !== current.items.length) return false;
  const previous = new Map(current.items.map(item => [item.id, item]));
  return candidate.items.every(item => {
    const original = previous.get(item.id);
    return !!original && item.subjectId === original.subjectId && item.type === original.type &&
      item.estimatedMinutes === original.estimatedMinutes && item.priority === original.priority &&
      item.isBacklog === original.isBacklog && item.deadline === original.deadline;
  });
}

async function context(input: unknown) {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) return { error: "expired" as const };
  const owner = auth.data.user.id;
  const [profile, settings, subjects] = await Promise.all([
    client.from("profiles").select("onboarding_completed").eq("id", owner).single(),
    client.from("user_settings").select("time_zone").eq("user_id", owner).single(),
    client.from("subjects").select("id,name,archived_at").eq("user_id", owner).is("archived_at", null),
  ]);
  if (profile.error || !profile.data.onboarding_completed) return { error: "expired" as const };
  if (settings.error || subjects.error) return { error: "unavailable" as const };
  const subjectIds = new Set(subjects.data.map(x => x.id));
  if (!validateInput(input, subjectIds) || !validZone(input.zone) || input.zone !== (settings.data.time_zone || "UTC")) return { error: "invalid" as const };
  const today = dayInZone(Date.now(), input.zone);
  if (input.weekStart < weekStart(today) || input.weekStart > dateAdd(weekStart(today), 28)) return { error: "invalid" as const };
  const end = dateAdd(input.weekStart, 6);
  const blocks: Block[] = [];
  for (let page = 0; ; page++) {
    const result = await client.from("study_blocks").select("*").eq("user_id", owner).order("id")
      .range(page * 500, page * 500 + 499);
    if (result.error) return { error: "unavailable" as const };
    blocks.push(...result.data);
    if (result.data.length < 500) break;
  }
  const existing = occurrences(blocks, input.weekStart, end, input.zone).map(x => ({
    ...x.block, starts_at: x.starts, ends_at: x.ends, repeat_weekly: false,
  }));
  return { client, owner, input, subjects: subjects.data, subjectIds, existing };
}

export async function generateAiPlan(input: PlannerInput, current?: GeneratedPlan, adjustment?: string): Promise<Result> {
  const receivedAt = new Date().toISOString();
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const attempts: Array<{ attempt: number; gemini_start?: number; gemini_response?: number;
    schema_parse_complete?: number; validation_complete?: number; outcome?: string }> = [];
  let contextComplete: number | undefined;
  let outcome = "provider";
  let signal: AbortSignal | undefined;
  const fail = (error: Exclude<Result, { ok: true }>["error"]): Result => {
    outcome = error;
    return { ok: false, error };
  };
  try {
    const ctx = await context(input);
    contextComplete = elapsed();
    if ("error" in ctx) return fail(ctx.error);
    if (!hasWorkload(input)) return fail("invalid");
    if (adjustment && (adjustment.length > 500 || !adjustment.trim())) return fail("invalid");
    if (current && (!adjustment || !parsePlan(current) || !validatePlan(current, input, ctx.subjectIds, ctx.existing).ok)) return fail("invalid");
    const occupied = ctx.existing.map(x => {
      const start = localParts(x.starts_at, input.zone), end = localParts(x.ends_at, input.zone);
      return { date: start.day, start: start.time, end: end.time };
    });
    // Both attempts share one deadline. A second call is reserved for a
    // malformed or invalid model response, never for a provider failure.
    signal = AbortSignal.timeout(28000);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) return fail("provider");
      const timing: typeof attempts[number] = { attempt: attempt + 1 };
      attempts.push(timing);
      const raw = await requestPlan(input, ctx.subjects.map(x => ({ id: x.id, name: x.name })), occupied, current, adjustment,
        { signal, onStage: stage => { timing[stage] = elapsed(); } });
      const plan = parsePlan(raw);
      if (!plan) { timing.outcome = "shape"; console.error("ai_planner_output_invalid", { kind: "shape" }); continue; }
      const check = validatePlan(plan, input, ctx.subjectIds, ctx.existing);
      timing.validation_complete = elapsed();
      if (!check.ok) { timing.outcome = check.reason; console.error("ai_planner_output_invalid", { kind: check.reason }); continue; }
      if (current && !adjustmentItemsMatch(plan, current)) {
        timing.outcome = "adjustment_changed_items";
        console.error("ai_planner_output_invalid", { kind: "adjustment_changed_items" }); continue;
      }
      // Adjustments may be localized by Gemini. Keep the original validated
      // work-item labels and metadata; only the schedule's flexible sessions
      // are allowed to change.
      const resultPlan = current ? { ...plan, items: current.items } : plan;
      timing.outcome = "valid";
      outcome = "success";
      return { ok: true, plan: resultPlan };
    }
    return fail("provider");
  } catch (error) {
    const busy = isProviderBusyError(error);
    console.error("ai_planner_generation_failed", { kind: busy ? "busy" : signal?.aborted ? "timeout" : "provider" });
    return fail(busy ? "busy" : "provider");
  } finally {
    console.info("ai_planner_timing", { receivedAt, contextCompleteMs: contextComplete,
      attempts, totalMs: elapsed(), outcome });
  }
}

export async function saveAiPlan(input: PlannerInput, candidate: GeneratedPlan, requestId: string): Promise<SaveResult> {
  try {
    const ctx = await context(input);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const plan = parsePlan(candidate);
    if (!plan || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) return { ok: false, error: "invalid" };
    // The RPC checks live conflicts under a database lock and handles same-request
    // replays before its conflict check. Do not let our preflight defeat idempotency.
    const check = validatePlan(plan, input, ctx.subjectIds, []);
    if (!check.ok) return { ok: false, error: check.reason === "overlap" ? "conflict" : "invalid" };
    const resolved = (entry: { date: string; start: string; end: string }) => ({
      ...entry,
      startInstant: toInstant(entry.date, entry.start, input.zone),
      endInstant: toInstant(entry.date, entry.end, input.zone),
    });
    const payload = { input: { ...input, fixed: input.fixed.map(resolved) },
      plan: { ...plan, sessions: plan.sessions.map(resolved) } };
    const result = await ctx.client.rpc("save_ai_weekly_plan", { p_request_id: requestId, p_payload: payload });
    if (result.error) {
      console.error("ai_planner_save_failed", { code: result.error.code });
      return { ok: false, error: result.error.code === "23P01" ? "conflict" : "unavailable" };
    }
    const value = result.data;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "unavailable" };
    revalidatePath("/app", "layout");
    return { ok: true, tasks: Number(value.tasks) || 0, sessions: Number(value.sessions) || 0, alreadySaved: value.alreadySaved === true };
  } catch {
    console.error("ai_planner_save_request_failed");
    return { ok: false, error: "unavailable" };
  }
}
