import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { mutate } from "@/features/planning/actions";
import { getAchievements } from "@/features/progression/data";
import { getChallenges } from "@/features/challenges/data";
import { getCityOverview } from "@/features/city/data";
import { dateAdd, dayInZone, localParts, overlaps, toInstant, validSubject, validTask, validText, validZone, weekday,
  type Block } from "@/features/planning/logic";
import { saveCompanionName, saveCompanionPreferences, createStudyReminder } from "../actions";
import { reminderFromLocal, validCompanionName, type Locale } from "../model";
import { resolveDay, resolveTime, type AgentCall } from "./registry";
import { blockMatch, refFor, reminderMatch, subjectMatch, taskMatch, type AgentRef, type Match } from "./resolve";
import { dayEvents, type AgentSnapshot, type Student } from "./snapshot";

export type ToolResult = { ok: boolean; message: string; ref?: AgentRef; ambiguous?: boolean };
const phrase = (locale: Locale, en: string, ar: string) => locale === "ar" ? ar : en;
const error = (locale: Locale, en: string, ar: string): ToolResult => ({ ok: false, message: phrase(locale, en, ar) });
const found = <T>(match: Match<T>, locale: Locale): match is { kind: "found"; value: T } => { void locale; return match.kind === "found"; };
function missing<T extends { title?: string; name?: string; day?: string }>(match: Match<T>, locale: Locale): ToolResult {
  if (match.kind === "ambiguous") return { ok: false, ambiguous: true,
    message: phrase(locale, `I found several matches: ${match.choices.map(row => `${row.title ?? row.name}${row.day ? ` (${row.day})` : ""}`).join("; ")}. Which one?`,
      `لقيت أكتر من واحدة: ${match.choices.map(row => `${row.title ?? row.name}${row.day ? ` (${row.day})` : ""}`).join("؛ ")}. تقصد أنهي؟`) };
  return error(locale, "I couldn't find a matching item in your Focusly data. Can you be more specific?", "ملقتش حاجة مطابقة في بياناتك. ممكن توضح أكتر؟");
}
function form(values: Record<string, string | number | null | undefined>): FormData {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) result.set(key, String(value));
  return result;
}
function requestUuid(requestId: string, index: number): string {
  const hex = createHash("sha256").update(`${requestId}:${index}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function dayValue(raw: string | undefined, snapshot: AgentSnapshot, locale: Locale): string | ToolResult {
  const day = resolveDay(raw, snapshot.today);
  return day ?? error(locale, "I need a clear day for that.", "محتاج أعرف اليوم بالضبط.");
}
function timeValue(raw: string | undefined, locale: Locale): string | ToolResult {
  const time = resolveTime(raw);
  return time ?? error(locale, "What time should I use?", "تحب الساعة كام؟");
}
const isError = (value: string | ToolResult): value is ToolResult => typeof value !== "string";
function confirmMutation(result: Awaited<ReturnType<typeof mutate>>, locale: Locale): ToolResult | null {
  if (result.success) return null;
  if (result.error === "overlap") return error(locale, "That overlaps another Planner block. Try another time.", "الوقت ده متعارض مع حاجة في المخطط. نجرب معاد تاني؟");
  if (result.error === "expired") return error(locale, "Please sign in again before changing anything.", "سجل دخولك تاني قبل ما نغير حاجة.");
  return error(locale, "I couldn't change that, so I left it as it was.", "معرفتش أغيرها، فسيبتها زي ما هي.");
}

async function lessonConflict(student: Student, owner: string, start: string, end: string): Promise<boolean | null> {
  const result = await student.client.from("study_schedule_items").select("weekday,local_time,time_zone")
    .eq("user_id", owner).eq("enabled", true);
  if (result.error) return null;
  return result.data.some(item => {
    if (!item.local_time || !validZone(item.time_zone)) return false;
    const local = dayInZone(start, item.time_zone);
    return [-1, 0, 1].some(offset => {
      const day = dateAdd(local, offset);
      if (weekday(day) !== item.weekday) return false;
      const lesson = toInstant(day, item.local_time!.slice(0, 5), item.time_zone);
      return !!lesson && Date.parse(start) < Date.parse(lesson) + 3600000 && Date.parse(lesson) < Date.parse(end);
    });
  });
}

async function allOwnedBlocks(student: Student, owner: string): Promise<Block[] | null> {
  const blocks: Block[] = [];
  for (let page = 0; page < 20; page++) {
    const result = await student.client.from("study_blocks").select("*").eq("user_id", owner).order("id")
      .range(page * 500, page * 500 + 499);
    if (result.error) return null;
    blocks.push(...result.data);
    if (result.data.length < 500) return blocks;
  }
  return null; // Never proceed with an incomplete conflict set.
}

export async function executeTool(call: AgentCall, snapshot: AgentSnapshot, student: Student, locale: Locale,
  memory: AgentRef | null, requestId: string, index: number): Promise<ToolResult> {
  const a = call.args, owner = student.user.id;
  const okay = (en: string, ar: string, ref?: AgentRef): ToolResult => ({ ok: true, message: phrase(locale, en, ar), ...(ref ? { ref } : {}) });
  try {
    switch (call.tool) {
      case "read_day": case "read_week": case "list_schedule": {
        const day = dayValue(a.day, snapshot, locale); if (isError(day)) return day;
        const days = call.tool === "read_week" ? Array.from({ length: 7 }, (_, i) => dateAdd(day, i)) : [day];
        const results = days.map(value => ({ day: value, ...dayEvents(snapshot, value) }));
        const tasks = results.flatMap(row => row.tasks.map(task => `${task.title} (${row.day})`)).slice(0, 8);
        const blocks = results.flatMap(row => row.blocks.map(block => `${block.block.title} (${row.day} ${localParts(block.starts, snapshot.zone).time})`)).slice(0, 8);
        const lessons = results.flatMap(row => row.lessons.map(lesson => `${lesson.title} (${row.day} ${localParts(lesson.starts, snapshot.zone).time})`)).slice(0, 8);
        const parts = call.tool === "list_schedule" ? lessons : [...lessons, ...blocks, ...tasks];
        return okay(parts.length ? `${parts.join("; ")}.` : `Nothing scheduled for ${day}.`,
          parts.length ? `${parts.join("؛ ")}.` : `مفيش حاجة متسجلة ليوم ${day}.`);
      }
      case "list_tasks": {
        const day = a.day ? dayValue(a.day, snapshot, locale) : null; if (day && isError(day)) return day;
        const rows = snapshot.tasks.filter(task => (!day || task.day === day) &&
          (!a.query || task.title.toLocaleLowerCase().includes(a.query.toLocaleLowerCase()))).slice(0, 8);
        return okay(rows.length ? rows.map(task => `${task.title} (${task.day}, ${task.status})`).join("; ") : "No matching tasks.",
          rows.length ? rows.map(task => `${task.title} (${task.day})`).join("؛ ") : "مفيش مهام مطابقة.");
      }
      case "list_subjects": {
        const names = snapshot.subjects.filter(subject => !subject.archived).map(subject => subject.name).slice(0, 20);
        return okay(names.length ? names.join(", ") : "You haven't added subjects yet.", names.length ? names.join("، ") : "لسه مفيش مواد متضافة.");
      }
      case "list_reminders": {
        const rows = snapshot.reminders.slice(0, 8).map(item => `${item.title} (${localParts(item.remindAt, snapshot.zone).day} ${localParts(item.remindAt, snapshot.zone).time})`);
        return okay(rows.length ? rows.join("; ") : "No upcoming reminders.", rows.length ? rows.join("؛ ") : "مفيش تذكيرات جاية.");
      }
      case "read_settings": return okay(`Your daily goal is ${snapshot.goal} minutes. Language: ${snapshot.locale}; theme: ${snapshot.theme}; accent: ${snapshot.accent}. Auto greeting is ${snapshot.autoGreetingEnabled ? "on" : "off"}.`,
        `هدفك اليومي ${snapshot.goal} دقيقة. اللغة ${snapshot.locale === "ar" ? "عربي" : "إنجليزي"}، والمظهر ${({ light: "فاتح", dark: "داكن", system: "حسب الجهاز" } as Record<string, string>)[snapshot.theme] ?? "غير معروف"}. الترحيب التلقائي ${snapshot.autoGreetingEnabled ? "شغال" : "متوقف"}.`);
      case "read_focus": {
        const sessions = await student.client.from("focus_sessions").select("duration_seconds,completed,started_at")
          .eq("user_id", owner).order("started_at", { ascending: false }).limit(3);
        if (sessions.error) return error(locale, "Focus history isn't available right now.", "سجل التركيز مش متاح دلوقتي.");
        const durations = sessions.data.filter(item => item.completed).map(item => Math.floor(item.duration_seconds / 60));
        const recentEn = durations.map(value => `${value} min`).join(", ");
        const recentAr = durations.map(value => `${value} دقيقة`).join("، ");
        const stateAr = snapshot.activeFocus?.state === "paused" ? "متوقف مؤقتًا" : "شغال";
        return okay(snapshot.activeFocus ? `Your Focus timer is ${snapshot.activeFocus.state}. Recent sessions: ${recentEn || "none"}.`
          : snapshot.focusMinutesToday === null ? `Today's focus total isn't available. Recent sessions: ${recentEn || "none"}.`
            : `You've studied ${snapshot.focusMinutesToday} minutes today. Recent sessions: ${recentEn || "none"}.`,
        snapshot.activeFocus ? `مؤقت التركيز ${stateAr}. آخر جلسات: ${recentAr || "مفيش"}.`
          : snapshot.focusMinutesToday === null ? `إجمالي تركيز النهارده مش متاح. آخر جلسات: ${recentAr || "مفيش"}.`
            : `ذاكرت ${snapshot.focusMinutesToday} دقيقة النهارده. آخر جلسات: ${recentAr || "مفيش"}.`);
      }
      case "read_progress": {
        const [profile, achievements, city] = await Promise.all([
          student.client.from("progression_profiles").select("total_xp,coins,construction_points").eq("user_id", owner).maybeSingle(),
          student.client.from("user_achievements").select("id", { count: "exact", head: true }).eq("user_id", owner),
          student.client.from("user_city_buildings").select("level").eq("user_id", owner),
        ]);
        if (profile.error || !profile.data || achievements.error || city.error) return error(locale,
          "Your progress is unavailable right now.", "بيانات تقدمك مش متاحة دلوقتي.");
        const levels = city.data.reduce((sum, item) => sum + item.level, 0);
        return okay(`You have ${profile.data.total_xp} XP, ${profile.data.coins} coins, ${achievements.count ?? "?"} achievements and ${levels} City levels.`,
          `عندك ${profile.data.total_xp} نقطة خبرة، و${profile.data.coins} عملة، و${achievements.count ?? "؟"} إنجازات، و${levels} مستويات مدينة.`);
      }
      case "read_achievements": {
        const result = await getAchievements();
        return result.kind === "authenticated" ? okay(`You've unlocked ${result.unlocked.length} of ${result.catalog.length} achievements.`,
          `فتحت ${result.unlocked.length} من ${result.catalog.length} إنجازات.`)
          : error(locale, "Achievements aren't available right now.", "الإنجازات مش متاحة دلوقتي.");
      }
      case "read_challenges": {
        const result = await getChallenges();
        return result.kind === "authenticated" ? okay(`You have ${result.challenges.length} current challenges. Open Challenges for their live progress.`,
          `عندك ${result.challenges.length} تحديات حالية. افتح التحديات عشان تشوف التقدم.`)
          : error(locale, "Challenges aren't available right now.", "التحديات مش متاحة دلوقتي.");
      }
      case "read_city": {
        const result = await getCityOverview();
        return result ? okay(`Your City has ${result.buildings.reduce((sum, item) => sum + item.level, 0)} building levels. You have ${result.balances.coins} coins and ${result.balances.constructionPoints} construction points.`,
          `مدينتك فيها ${result.buildings.reduce((sum, item) => sum + item.level, 0)} مستويات مباني. عندك ${result.balances.coins} عملة و${result.balances.constructionPoints} نقطة بناء.`)
          : error(locale, "City progress isn't available right now.", "تقدم المدينة مش متاح دلوقتي.");
      }
      case "create_task": {
        if (!a.day) return error(locale, "Which day should I put that task on?", "تحب أحط المهمة في أنهي يوم؟");
        const title = a.title?.trim() ?? "", day = dayValue(a.day, snapshot, locale);
        if (isError(day)) return day;
        const priority = a.priority ?? "medium";
        const subject = a.subject ? subjectMatch(snapshot, a.subject, memory) : null;
        if (subject && !found(subject, locale)) return missing(subject, locale);
        const time = a.time ? timeValue(a.time, locale) : null; if (time && isError(time)) return time;
        const dueAt = time ? toInstant(day, time, snapshot.zone) : null;
        if (time && !dueAt || !validTask({ title, notes: a.notes ?? "", priority, due_on: time ? null : day, due_at: dueAt }))
          return error(locale, "I need a valid task title and date.", "محتاج عنوان ويوم مناسبين للمهمة.");
        const id = requestUuid(requestId, index);
        const row = { id, user_id: owner, title, notes: a.notes ?? null, priority: priority as "low" | "medium" | "high",
          subject_id: subject?.kind === "found" ? subject.value.id : null, task_date: day, due_on: time ? null : day, due_at: dueAt };
        const inserted = await student.client.from("tasks").insert(row).select("id").single();
        if (inserted.error) {
          if (inserted.error.code !== "23505") return error(locale, "I couldn't add that task.", "معرفتش أضيف المهمة دي.");
          const existing = await student.client.from("tasks").select("title,task_date,subject_id,priority,notes,due_on,due_at")
            .eq("user_id", owner).eq("id", id).maybeSingle();
          if (existing.error || existing.data?.title !== title || existing.data.task_date !== day ||
            existing.data.subject_id !== row.subject_id || existing.data.priority !== row.priority ||
            existing.data.notes !== row.notes || existing.data.due_on !== row.due_on || existing.data.due_at !== row.due_at)
            return error(locale, "That request changed; I didn't add a duplicate.", "الطلب اتغير، فمضفتش نسخة تانية.");
        }
        revalidatePath("/app", "layout");
        return okay(`Done — ${title} is on your list for ${day} 👍`, `تمام، ضفت «${title}» ليوم ${day} 👌`, { kind: "task", id, title });
      }
      case "update_task": case "complete_task": case "delete_task": {
        const match = taskMatch(snapshot, a.query, a.fromDay ?? a.day, memory);
        if (!found(match, locale)) return missing(match, locale);
        const task = match.value;
        if (call.tool === "delete_task") {
          const result = await mutate(form({ entity: "tasks", action: "delete", id: task.id }));
          return confirmMutation(result, locale) ?? okay(`Removed ${task.title}.`, `مسحت «${task.title}».`);
        }
        if (call.tool === "complete_task") {
          if (a.status && !["todo", "completed"].includes(a.status))
            return error(locale, "Should I mark it complete or put it back on your list?", "أعلّمها مكتملة ولا أرجعها للمهام؟");
          const completed = a.status !== "todo";
          if (completed && task.status === "completed" || !completed && task.status !== "completed")
            return okay(`That task is already ${completed ? "complete" : "open"}.`, `المهمة ${completed ? "مكتملة" : "لسه مفتوحة"} بالفعل.`, refFor("task", task));
          const result = await mutate(form({ entity: "tasks", action: "complete", id: task.id, completed: String(completed) }));
          return confirmMutation(result, locale) ?? okay(completed ? `Nice, ${task.title} is done 👏` : `${task.title} is back on your list.`,
            completed ? `عاش، خلصت «${task.title}» 👏` : `رجّعت «${task.title}» للمهام.`, refFor("task", task));
        }
        const day = dayValue(a.day ?? task.day, snapshot, locale); if (isError(day)) return day;
        const time = a.time ? timeValue(a.time, locale) : task.dueAt ? localParts(task.dueAt, snapshot.zone).time : null;
        if (time && isError(time)) return time;
        const subject = a.subject ? subjectMatch(snapshot, a.subject, memory) : null;
        if (subject && !found(subject, locale)) return missing(subject, locale);
        const result = await mutate(form({ entity: "tasks", action: "save", id: task.id, title: a.title ?? task.title,
          date: day, time: time ?? "", priority: a.priority ?? task.priority, notes: a.notes ?? task.notes ?? "",
          subject_id: subject?.kind === "found" ? subject.value.id : task.subjectId }));
        return confirmMutation(result, locale) ?? okay(`Done — I updated ${a.title ?? task.title}.`, `تمام، ظبطت «${a.title ?? task.title}» 👌`, refFor("task", task));
      }
      case "create_subject": case "update_subject": case "delete_subject": {
        const match = call.tool === "create_subject" ? null : subjectMatch(snapshot, a.query, memory);
        if (match && !found(match, locale)) return missing(match, locale);
        const subject = match?.kind === "found" ? match.value : null;
        if (call.tool === "delete_subject") {
          const result = await mutate(form({ entity: "subjects", action: "delete", id: subject?.id }));
          return confirmMutation(result, locale) ?? okay(`${subject?.name} is off your active subjects.`, `شلت «${subject?.name}» من المواد النشطة.`);
        }
        const title = a.title ?? subject?.name ?? "", color = a.color ?? subject?.color ?? "#6558d3";
        if (!validSubject(title, color)) return error(locale, "I need a valid subject name and color.", "محتاج اسم ولون مناسبين للمادة.");
        const result = await mutate(form({ entity: "subjects", action: "save", id: subject?.id, name: title, color }));
        return confirmMutation(result, locale) ?? okay(`Done — ${title} is in your subjects.`, `تمام، «${title}» بقت في موادك 👌`, subject ? refFor("subject", subject) : undefined);
      }
      case "create_block": case "move_block": case "delete_block": {
        const match = call.tool === "create_block" ? null : blockMatch(snapshot, a.query, a.fromDay ?? a.day, a.fromTime, memory);
        if (match && !found(match, locale)) return missing(match, locale);
        const block = match?.kind === "found" ? match.value : null;
        if (call.tool === "delete_block") {
          const result = await mutate(form({ entity: "study_blocks", action: "delete", id: block?.id }));
          return confirmMutation(result, locale) ?? okay(`Removed ${block?.title} from Planner.`, `شلت «${block?.title}» من المخطط.`);
        }
        if (!block && !a.day) return error(locale, "Which day should I add that session?", "تحب أضيف الجلسة في أنهي يوم؟");
        const day = dayValue(a.day ?? (block ? dayInZone(block.starts_at, snapshot.zone) : undefined), snapshot, locale);
        if (isError(day)) return day;
        const time = timeValue(a.time ?? (block ? localParts(block.starts_at, snapshot.zone).time : undefined), locale);
        if (isError(time)) return time;
        const existingSubject = block?.subject_id ? snapshot.subjects.find(item => item.id === block.subject_id) : null;
        const subject = a.subject ? subjectMatch(snapshot, a.subject, memory) : existingSubject
          ? { kind: "found" as const, value: existingSubject } : null;
        if (!subject || !found(subject, locale)) return subject ? missing(subject, locale) : error(locale,
          "Which subject is this study session for?", "جلسة المذاكرة دي لأي مادة؟");
        const duration = a.duration ?? (block ? Math.round((Date.parse(block.ends_at) - Date.parse(block.starts_at)) / 60000) : 25);
        if (!Number.isInteger(duration) || duration < 5 || duration > 720 || !validText(a.title ?? block?.title ?? subject.value.name, 200))
          return error(locale, "I need a valid duration and title.", "محتاج مدة واسم مناسبين.");
        const title = a.title ?? block?.title ?? subject.value.name;
        const start = toInstant(day, time, snapshot.zone);
        if (!start) return error(locale, "That local time doesn't exist. Try another time.", "الوقت ده مش موجود في منطقتك الزمنية. جرّب وقت تاني.");
        const end = new Date(Date.parse(start) + duration * 60000).toISOString();
        const lesson = await lessonConflict(student, owner, start, end);
        if (lesson === null) return error(locale, "I couldn't check your lessons, so nothing moved.", "معرفتش أتأكد من دروسك، فمغيرتش حاجة.");
        if (lesson) return error(locale, "That overlaps a lesson. Want to try another time?", "الوقت ده متعارض مع درس. نجرب معاد تاني؟");
        if (!block) {
          const id = requestUuid(requestId, index);
          const existing = await student.client.from("study_blocks").select("title,subject_id,starts_at,ends_at")
            .eq("user_id", owner).eq("id", id).maybeSingle();
          if (existing.error) return error(locale, "I couldn't check that session.", "معرفتش أتأكد من الجلسة دي.");
          if (existing.data) return existing.data.title === title && existing.data.subject_id === subject.value.id &&
            existing.data.starts_at === start && existing.data.ends_at === end
            ? okay(`That ${title} session is already in Planner.`, `جلسة «${title}» موجودة بالفعل في المخطط.`, { kind: "block", id, title })
            : error(locale, "That request changed; I didn't add a duplicate.", "الطلب اتغير، فمضفتش نسخة تانية.");
          const all = await allOwnedBlocks(student, owner);
          if (!all) return error(locale, "I couldn't check Planner conflicts.", "معرفتش أتأكد من تعارضات المخطط.");
          const candidate: Block = { id, user_id: owner, title, subject_id: subject.value.id, task_id: null,
            starts_at: start, ends_at: end, repeat_weekly: false, time_zone: snapshot.zone, notes: null,
            created_at: start, updated_at: start };
          if (overlaps(candidate, all)) return error(locale, "That overlaps another Planner block.", "الوقت ده متعارض مع جلسة تانية في المخطط.");
          const inserted = await student.client.from("study_blocks").insert({ id, user_id: owner, title,
            subject_id: subject.value.id, starts_at: start, ends_at: end, repeat_weekly: false,
            time_zone: snapshot.zone }).select("id").single();
          if (inserted.error) return error(locale, "I couldn't add that study session.", "معرفتش أضيف جلسة المذاكرة دي.");
          revalidatePath("/app", "layout");
          return okay(`Done — ${title} is at ${time} on ${day}.`, `تمام 👌 ${title} بقت الساعة ${time} يوم ${day}.`, { kind: "block", id, title });
        }
        const result = await mutate(form({ entity: "study_blocks", action: "save", id: block.id, title,
          subject_id: subject.value.id, date: day, time, duration, zone: snapshot.zone, repeat: block?.repeat_weekly ? "weekly" : "never" }));
        return confirmMutation(result, locale) ?? okay(`Done — ${a.title ?? block?.title ?? subject.value.name} is at ${time} on ${day}.`,
          `تمام 👌 ${a.title ?? block?.title ?? subject.value.name} بقت الساعة ${time} يوم ${day}.`, block ? refFor("block", block) : undefined);
      }
      case "create_reminder": case "edit_reminder": case "cancel_reminder": {
        const match = call.tool === "create_reminder" ? null : reminderMatch(snapshot, a.query, memory);
        if (match && !found(match, locale)) return missing(match, locale);
        const reminder = match?.kind === "found" ? match.value : null;
        if (call.tool === "cancel_reminder") {
          const result = await student.client.from("study_reminders").update({ status: "cancelled" })
            .eq("user_id", owner).eq("id", reminder!.id).eq("status", "scheduled").select("id").single();
          if (result.error) return error(locale, "I couldn't cancel that reminder.", "معرفتش ألغي التذكير ده.");
          return okay(`Okay, I cancelled ${reminder!.title}.`, `تمام، لغيت تذكير «${reminder!.title}».`);
        }
        if (!reminder && !a.day) return error(locale, "Which day should I remind you?", "تحب أفكرك في أنهي يوم؟");
        const day = dayValue(a.day ?? (reminder ? dayInZone(reminder.remindAt, snapshot.zone) : undefined), snapshot, locale);
        if (isError(day)) return day;
        const time = timeValue(a.time ?? (reminder ? localParts(reminder.remindAt, snapshot.zone).time : undefined), locale);
        if (isError(time)) return time;
        const title = a.title ?? reminder?.title ?? "";
        const proposal = reminderFromLocal(title, day, time, snapshot.zone, Date.now(), requestUuid(requestId, index));
        if (!proposal) return error(locale, "That reminder needs a future date and time.", "التذكير محتاج يوم ووقت جايين.");
        if (reminder) {
          const result = await student.client.from("study_reminders").update({ title: proposal.title, remind_at: proposal.remindAt })
            .eq("user_id", owner).eq("id", reminder.id).eq("status", "scheduled").select("id").single();
          if (result.error) return error(locale, "I couldn't update that reminder.", "معرفتش أعدل التذكير ده.");
          return okay(`Done — I'll remind you about ${title} at ${time} on ${day}.`, `تمام، هفكرك بـ«${title}» الساعة ${time} يوم ${day}.`, refFor("reminder", reminder));
        }
        const result = await createStudyReminder(proposal);
        if (!result.ok) return error(locale, "I couldn't save that reminder.", "معرفتش أحفظ التذكير ده.");
        return okay(`Got it — I'll remind you about ${title} at ${time} on ${day}.`, `تمام، هفكرك بـ«${title}» الساعة ${time} يوم ${day}.`,
          { kind: "reminder", id: result.value.id, title });
      }
      case "set_goal": {
        const goal = Number(a.value);
        if (!Number.isInteger(goal) || goal < 5 || goal > 720) return error(locale, "Choose a goal between 5 and 720 minutes.", "اختار هدف بين ٥ و٧٢٠ دقيقة.");
        const result = await student.client.from("profiles").update({ daily_goal_minutes: goal }).eq("id", owner).select("id").single();
        if (result.error) return error(locale, "I couldn't change your goal.", "معرفتش أغير هدفك.");
        revalidatePath("/app", "layout");
        return okay(`Your daily goal is now ${goal} minutes 👍`, `هدفك اليومي بقى ${goal} دقيقة 👌`);
      }
      case "set_locale": case "set_theme": case "set_accent": case "set_display_name": {
        const key = call.tool === "set_locale" ? "locale" : call.tool === "set_theme" ? "theme" : call.tool === "set_accent" ? "accent" : "name";
        const value = a.value ?? "";
        if (key === "name" && !validText(value, 80)) return error(locale, "I need a valid profile name.", "محتاج اسم مناسب للملف الشخصي.");
        const result = await mutate(form({ entity: "settings", action: "save", [key]: value,
          ...(key === "name" ? { locale: snapshot.locale } : {}) }));
        return confirmMutation(result, locale) ?? okay(`Done — I changed your ${key}.`, `تمام، غيرت ${key === "name" ? "اسمك" : "الإعداد"} 👌`);
      }
      case "set_companion_name": {
        if (!validCompanionName(a.value)) return error(locale, "What name would you like to use?", "تحب تسميني إيه؟");
        const result = await saveCompanionName(a.value!);
        return result.ok ? okay(`You can call me ${result.value.name} now ✨`, `من دلوقتي اسمي ${result.value.name} ✨`)
          : error(locale, "I couldn't save that name.", "معرفتش أحفظ الاسم ده.");
      }
      case "set_companion_enabled": case "set_auto_greeting": {
        if (a.value !== "true" && a.value !== "false") return error(locale, "Should I turn it on or off?", "تحب أشغله ولا أوقفه؟");
        const enabled = a.value === "true";
        const result = await saveCompanionPreferences(call.tool === "set_companion_enabled" ? enabled : snapshot.companionEnabled,
          call.tool === "set_auto_greeting" ? enabled : snapshot.autoGreetingEnabled);
        return result.ok ? okay(`Okay, that companion setting is ${enabled ? "on" : "off"}.`,
          `تمام، الإعداد ده ${enabled ? "اشتغل" : "اتوقف"}.`)
          : error(locale, "I couldn't save that setting.", "معرفتش أحفظ الإعداد ده.");
      }
      case "plan_day": return error(locale, "Let's review that day first, then choose a study slot together.", "خلينا نبص على اليوم الأول، وبعدين نختار وقت للمذاكرة سوا.");
    }
  } catch {
    return error(locale, "I couldn't finish that change, so please check the page before trying again.", "معرفتش أكمل التغيير، راجع الصفحة قبل ما نجرب تاني.");
  }
}
