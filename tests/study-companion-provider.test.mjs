import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const fakeSdk = `
  export const ThinkingLevel = { LOW: "LOW" };
  export class ApiError extends Error { constructor(status) { super("private provider details"); this.status = status; } }
  export class GoogleGenAI {
    models = { generateContent: async request => {
      globalThis.__companionRequest = request;
      return { text: globalThis.__companionResponse ?? JSON.stringify({ message: "Start with Chemistry.", intent: "suggest_task", taskId: null, reminder: null }) };
    } };
  }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  if (specifier === "@google/genai") return { url: `data:text/javascript,${encodeURIComponent(fakeSdk)}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { requestCompanionReply, companionProviderBusy } = await import("../src/features/study-companion/provider.ts");
const { ApiError } = await import("@google/genai");

const context = { today: "2026-10-04", zone: "Africa/Cairo", now: "2026-10-04T10:00:00Z",
  goalMinutes: 120, studiedMinutes: 0, tasks: [], blocks: [], upcoming: null };

test("companion shares server-only Gemini model config with AI planner and sends minimal context", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  process.env.FOCUSLY_AI_PLANNER_MODEL = "test-model";
  const response = await requestCompanionReply("What now?", "en", context, []);
  assert.equal(response?.intent, "suggest_task");
  const request = globalThis.__companionRequest;
  assert.equal(request.model, "test-model");
  assert.equal(request.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.equal(request.config.httpOptions.retryOptions.attempts, 1);
  const payload = JSON.parse(request.contents);
  assert.deepEqual(Object.keys(payload).sort(), ["goalRemainingMinutes", "locale", "message", "now", "recent", "tasks", "today", "upcoming", "zone"].sort());
  assert.ok(!request.contents.includes("GEMINI_API_KEY"));
});

test("malformed provider response fails closed to a non-action", async () => {
  globalThis.__companionResponse = '{"message":"saved","intent":"arbitrary_write"}';
  try { assert.equal(await requestCompanionReply("Do it", "en", context, []), null); }
  finally { globalThis.__companionResponse = undefined; }
  assert.equal(companionProviderBusy(new ApiError(429)), true);
  assert.equal(companionProviderBusy(new ApiError(503)), true);
  assert.equal(companionProviderBusy(new ApiError(400)), false);
});
