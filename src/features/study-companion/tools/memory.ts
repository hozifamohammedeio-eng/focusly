import { UUID, validDate } from "@/features/planning/logic";
import { parseAgentDecision, toolKeys, type AgentCall, type ToolKey } from "./registry";
import type { AgentRef } from "./resolve";

export const agentPages = ["home", "tasks", "subjects", "planner", "calendar", "schedule", "focus",
  "statistics", "settings", "profile", "challenges", "achievements", "city", "other"] as const;
export type AgentPage = typeof agentPages[number];
export type AgentUndo =
  | { kind: "goal"; before: number; after: number }
  | { kind: "block"; id: string; before: { title: string; start: string; end: string };
      after: { title: string; start: string; end: string } };
export type AgentMemory = { refs?: Partial<Record<AgentRef["kind"], AgentRef>>; lastDay?: string;
  lastIntent?: ToolKey; lastCall?: AgentCall; undo?: AgentUndo };
export type AgentContext = { page: AgentPage; memory: AgentMemory };

const validRef = (value: unknown): value is AgentRef => !!value && typeof value === "object" &&
  UUID.test((value as AgentRef).id) && ["task", "subject", "block", "reminder"].includes((value as AgentRef).kind) &&
  typeof (value as AgentRef).title === "string" && (value as AgentRef).title.length <= 200;

/** Client-held memory is only a hint. Every referenced row is resolved against owner-scoped data again. */
export function parseAgentContext(value: unknown): AgentContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!agentPages.includes(raw.page as AgentPage) || !raw.memory || typeof raw.memory !== "object" ||
    Array.isArray(raw.memory) || Object.keys(raw).some(key => !["page", "memory"].includes(key))) return null;
  const memory = raw.memory as Record<string, unknown>;
  if (Object.keys(memory).some(key => !["refs", "lastDay", "lastIntent", "lastCall", "undo"].includes(key))) return null;
  const refs = memory.refs;
  if (refs !== undefined && (!refs || typeof refs !== "object" || Array.isArray(refs) ||
    Object.entries(refs).some(([key, ref]) => !["task", "subject", "block", "reminder"].includes(key) ||
      !validRef(ref) || ref.kind !== key))) return null;
  if (memory.lastDay !== undefined && (typeof memory.lastDay !== "string" || !validDate(memory.lastDay))) return null;
  if (memory.lastIntent !== undefined && !toolKeys.includes(memory.lastIntent as ToolKey)) return null;
  if (memory.lastCall !== undefined && !parseAgentDecision({ message: "", explicit: false, calls: [memory.lastCall] })) return null;
  if (memory.undo !== undefined && !validUndo(memory.undo)) return null;
  return { page: raw.page as AgentPage, memory: memory as AgentMemory };
}

export function validUndo(value: unknown): value is AgentUndo {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.kind === "goal") return Number.isInteger(row.before) && Number.isInteger(row.after) &&
    Number(row.before) >= 5 && Number(row.before) <= 720 && Number(row.after) >= 5 && Number(row.after) <= 720;
  if (row.kind !== "block" || typeof row.id !== "string" || !UUID.test(row.id)) return false;
  const block = (part: unknown) => !!part && typeof part === "object" &&
    typeof (part as { title?: unknown }).title === "string" && (part as { title: string }).title.length <= 200 &&
    ["start", "end"].every(key => typeof (part as Record<string, unknown>)[key] === "string" &&
      Number.isFinite(Date.parse((part as Record<string, string>)[key]!)));
  return block(row.before) && block(row.after);
}

export function remember(memory: AgentMemory, call: AgentCall, ref: AgentRef | undefined, day: string | undefined,
  undo?: AgentUndo): AgentMemory {
  return { refs: { ...memory.refs, ...(ref ? { [ref.kind]: ref } : {}) },
    ...(day ?? memory.lastDay ? { lastDay: (day ?? memory.lastDay)! } : {}), lastIntent: call.tool, lastCall: call,
    ...(undo ? { undo } : {}) };
}
