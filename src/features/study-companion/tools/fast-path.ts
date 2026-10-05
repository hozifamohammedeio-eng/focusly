import { dateAdd, dayInZone, localParts, occurrences, toInstant, weekday } from "@/features/planning/logic";
import { resolveTime, type AgentCall } from "./registry";
import type { AgentContext } from "./memory";
import type { AgentSnapshot } from "./snapshot";

export type FastDecision = { calls: AgentCall[]; confirm?: boolean };
const call = (tool: AgentCall["tool"], args: AgentCall["args"] = {}): FastDecision => ({ calls: [{ tool, args }] });
const normalized = (text: string) => text.toLocaleLowerCase().normalize("NFKC")
  .replace(/[\u064b-\u065f\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).trim();
const timeFor = (raw: string, hour: number) => resolveTime(raw) ??
  (/^\d{1,2}(?::\d{2})?$/u.test(raw) && hour >= 12 ? resolveTime(`${raw} pm`) : null);

/** Only narrow, unambiguous grammar goes through this path. All writes still use the normal server executor. */
export function fastDecision(message: string, snapshot: AgentSnapshot, context: AgentContext): FastDecision | null {
  const text = normalized(message), memory = context.memory;
  if (/^(what do i have tomorrow\??|ايه اللي عندي بكره[؟?]?|ايه عندي بكره[؟?]?|عندي ايه بكره[؟?]?)$/u.test(text))
    return call("read_day", { day: "tomorrow" });
  if (/^(my tasks today|today.s tasks|مهامي النهارده|وريني مهامي النهارده)[؟?]?$/u.test(text))
    return call("list_tasks", { day: "today" });
  if (/^(what do i have this week\??|عندي ايه الاسبوع ده[؟?]?|ايه عندي الاسبوع ده[؟?]?)$/u.test(text))
    return call("read_week", { day: "today" });
  if (/^(and tomorrow\??|what about tomorrow\??|طب وبكره[؟?]?|طب بكره[؟?]?)$/u.test(text) &&
    ["read_day", "read_week", "list_schedule", "list_tasks"].includes(memory.lastIntent ?? ""))
    return call(memory.lastIntent === "list_tasks" ? "list_tasks" : "read_day", { day: "tomorrow" });
  if (/^(and today\??|what about today\??|طب النهارده[؟?]?)$/u.test(text) &&
    ["read_day", "read_week", "list_schedule", "list_tasks"].includes(memory.lastIntent ?? ""))
    return call(memory.lastIntent === "list_tasks" ? "list_tasks" : "read_day", { day: "today" });

  const goal = /^(?:set|change|update) (?:my )?(?:daily )?goal (?:to )?(\d{1,3})(?: minutes?)?$|^(?:غير|خلي|ظبط) هدف[ي]? (?:اليومي )?(?:ل|لي|الى)?\s*(\d{1,3})(?: دقيقه)?$/u.exec(text);
  if (goal) return call("set_goal", { value: (goal[1] ?? goal[2])! });
  const theme = /^(?:set|change) (?:my )?theme (?:to )?(dark|light|system)$|^(?:خلي|غير) (?:ال)?(?:ثيم|مظهر) (dark|light|system|داكن|فاتح|تلقائي)$/u.exec(text);
  if (theme) return call("set_theme", { value: ({ داكن: "dark", فاتح: "light", تلقائي: "system" } as Record<string, string>)[theme[1] ?? theme[2]!] ?? (theme[1] ?? theme[2])! });
  const accent = /^(?:set|change) (?:my )?(?:accent|color) (?:to )?(blue|green|orange|violet)$|^(?:خلي|غير) (?:ال)?لون (ازرق|اخضر|برتقالي|بنفسجي)$/u.exec(text);
  if (accent) return call("set_accent", { value: ({ ازرق: "blue", اخضر: "green", برتقالي: "orange", بنفسجي: "violet" } as Record<string, string>)[accent[1] ?? accent[2]!] ?? (accent[1] ?? accent[2])! });
  const name = /^(?:your name (?:is|should be)|call you) ([\p{L}\p{N} _-]{1,40})$|^(?:اسمك يبقى|هسميك|سميتك) ([\p{L}\p{N} _-]{1,40})$/iu.exec(message.trim());
  if (name) return call("set_companion_name", { value: (name[1] ?? name[2])! });

  const complete = /^(?:mark|complete|finish) (?:my )?(.+?) (?:task|homework) (?:as )?(?:complete|completed|done)$|^(?:خلص|علم) (?:مهمه|واجب) (.+?)(?: مكتمل[هة])?$/u.exec(text);
  if (complete) return call("complete_task", { query: (complete[1] ?? complete[2])! });
  const reminder = /^remind me (?:about |to )?(.+?) (today|tomorrow) at (\d{1,2}(?::\d{2})?\s*(?:am|pm))$|^فكرني ب?(.+?) (النهارده|بكره) (?:الساعه|على) (\d{1,2}(?::\d{2})?\s*(?:م|ص))$/u.exec(text);
  if (reminder) {
    const time = resolveTime((reminder[3] ?? reminder[6])!.trim());
    if (time) return call("create_reminder", { title: (reminder[1] ?? reminder[4])!.trim(),
      day: (reminder[2] ?? reminder[5])!, time });
  }

  const block = memory.refs?.block && snapshot.blocks.find(item => item.id === memory.refs?.block?.id);
  if (block) {
    const day = memory.lastDay ?? dayInZone(block.starts_at, snapshot.zone);
    const previousTime = localParts(block.starts_at, snapshot.zone).time;
    const hour = Number(previousTime.slice(0, 2));
    const follow = /^(?:خليها|خليه|انقلها|انقله|move it to|set it to)\s*(\d{1,2}(?::\d{2})?\s*(?:pm|am|م|ص)?)$/u.exec(text);
    if (follow) {
      const time = timeFor(follow[1]!.trim(), hour);
      if (time) return call("move_block", { query: "it", fromDay: day, day, time });
    }
    if (/^(?:زودلها|زودله|زود) نص ساعه$|^add half an hour to it$/u.test(text)) {
      const duration = Math.round((Date.parse(block.ends_at) - Date.parse(block.starts_at)) / 60000) + 30;
      if (duration <= 720) return call("move_block", { query: "it", fromDay: day, day, time: previousTime, duration });
    }
    if (/^(?:خليها|خليه) بعد (?:ال)?(?:انجليزي|english)$|^move it after english$/u.test(text)) {
      const english = (title: string) => /english|انجليزي/u.test(normalized(title));
      const blockEvents = occurrences(snapshot.blocks, day, day, snapshot.zone)
        .filter(item => item.block.id !== block.id && english(item.block.title))
        .map(item => item.ends);
      const lessons = snapshot.schedule.flatMap(item => {
        if (!english(item.title) || !item.time) return [];
        return [-1, 0, 1].flatMap(offset => {
          const lessonDay = dateAdd(day, offset);
          if (weekday(lessonDay) !== item.weekday) return [];
          const starts = toInstant(lessonDay, item.time!.slice(0, 5), item.zone);
          return starts && dayInZone(starts, snapshot.zone) === day
            ? [new Date(Date.parse(starts) + 3600000).toISOString()] : [];
        });
      });
      const ends = [...blockEvents, ...lessons];
      if (ends.length === 1) return call("move_block", { query: "it", fromDay: day, day,
        time: localParts(ends[0]!, snapshot.zone).time });
    }
    if (/^(?:فكرني بيها|فكرني بيه) قبلها بنص ساعه$|^remind me half an hour before it$/u.test(text)) {
      const at = new Date(Date.parse(block.starts_at) - 30 * 60000).toISOString();
      const parts = localParts(at, snapshot.zone);
      return call("create_reminder", { title: block.title, day: parts.day, time: parts.time });
    }
  }
  const move = /^(?:انقل|نقل) (.+?) (?:ل|للساعه|الساعة)\s*(\d{1,2}(?::\d{2})?\s*(?:pm|am|م|ص)?)$|^move (.+?) (?:to|at) (\d{1,2}(?::\d{2})?\s*(?:pm|am)?)$/u.exec(text);
  if (move) {
    const query = (move[1] ?? move[3])!.trim();
    const matches = snapshot.blocks.filter(item => normalized(item.title).includes(query));
    const current = matches.length === 1 ? matches[0] : null;
    const time = timeFor((move[2] ?? move[4])!.trim(), current ? Number(localParts(current.starts_at, snapshot.zone).time.slice(0, 2)) : 0);
    if (time) return call("move_block", { query,
      ...(current || memory.lastDay ? { day: current ? dayInZone(current.starts_at, snapshot.zone) : memory.lastDay! } : {}), time });
  }
  if (/^(?:لا مش دي|مش دي).*(?:بكره|tomorrow)$|^no,? (?:the one )?tomorrow$/u.test(text) && memory.lastCall) {
    const previous = memory.lastCall;
    if (["move_block", "update_task", "complete_task", "delete_task"].includes(previous.tool))
      return { calls: [{ tool: previous.tool, args: { ...previous.args, fromDay: "tomorrow",
        ...(previous.tool === "move_block" ? { day: "tomorrow" } : {}) } }], confirm: true };
  }
  if (/^(?:اعمل نفس الكلام لل|same thing for )(.+)$/u.test(text) && memory.lastCall) {
    const subject = text.replace(/^(?:اعمل نفس الكلام لل|same thing for )/u, "").trim();
    const previous = memory.lastCall;
    if (subject && ["create_block", "create_task"].includes(previous.tool)) return { calls: [{ tool: previous.tool,
      args: { ...previous.args, subject, title: subject } }], confirm: true };
  }
  return null;
}
