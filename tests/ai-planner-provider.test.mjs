import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Keep the server-only boundary in production. These test hooks replace only
// the SDK transport and Next's server-only marker in this test process.
const fakeSdk = `
  export const ThinkingLevel = { LOW: "LOW" };
  export class ApiError extends Error { constructor(status) { super("provider details stay private"); this.status = status; } }
  export class GoogleGenAI {
    models = { generateContent: async request => {
      globalThis.__plannerRequest = request;
      if (globalThis.__plannerAbortTest) {
        return new Promise((_, reject) => request.config.abortSignal.addEventListener(
          "abort", () => reject(new Error("aborted")), { once: true }));
      }
      return { text: JSON.stringify({ items: [], sessions: [], summary: "Ready", reasoning: [] }) };
    } };
  }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  if (specifier === "@google/genai") return { url: `data:text/javascript,${encodeURIComponent(fakeSdk)}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { isProviderBusyError, requestPlan } = await import("../src/features/ai-planner/provider.ts");
const { ApiError } = await import("@google/genai");

const ids = ["97000000-0000-4000-8000-000000000001", "97000000-0000-4000-8000-000000000002"];
const subjects = ids.map((id, i) => ({ id, name: ["Math", "Science"][i] }));
const input = {
  weekStart: "2026-10-03", zone: "Africa/Cairo", locale: "en", workload: { [ids[0]]: "One lecture", [ids[1]]: "" },
  backlog: "", exams: "", fixed: [], dailyMinutes: 120, preferred: "afternoon", sessionMinutes: 45,
  daysOff: [], busyDays: [], prioritySubjects: [], style: "balanced",
};

test("provider sends only relevant subjects with low thinking, structured output and bounded retries", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  process.env.FOCUSLY_AI_PLANNER_MODEL = "gemini-3.8-flash";
  const stages = [];
  const result = await requestPlan(input, subjects, [], undefined, undefined, { onStage: stage => stages.push(stage) });
  const request = globalThis.__plannerRequest;
  const payload = JSON.parse(request.contents);
  assert.deepEqual(result, { items: [], sessions: [], summary: "Ready", reasoning: [] });
  assert.deepEqual(stages, ["gemini_start", "gemini_response", "schema_parse_complete"]);
  assert.deepEqual(payload.subjects, [subjects[0]]);
  assert.deepEqual(payload.input.workload, { [ids[0]]: "One lecture" });
  assert.equal(request.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.ok(request.config.responseJsonSchema.properties.sessions);
  assert.equal(request.config.httpOptions.timeout, 28000);
  assert.equal(request.config.httpOptions.retryOptions.attempts, 2);
  assert.equal(request.model, "gemini-3.8-flash");
});

test("provider honors the shared abort signal and does not parse an aborted response", async () => {
  globalThis.__plannerAbortTest = true;
  const signal = AbortSignal.timeout(10);
  const stages = [];
  try {
    await assert.rejects(requestPlan(input, subjects, [], undefined, undefined,
      { signal, onStage: stage => stages.push(stage) }), /aborted/);
    assert.deepEqual(stages, ["gemini_start"]);
  } finally {
    globalThis.__plannerAbortTest = false;
  }
});

test("only transient Gemini 429 and 503 errors use the busy message", () => {
  assert.equal(isProviderBusyError(new ApiError(429)), true);
  assert.equal(isProviderBusyError(new ApiError(503)), true);
  assert.equal(isProviderBusyError(new ApiError(400)), false);
  assert.equal(isProviderBusyError(new Error("unavailable")), false);
  assert.equal(isProviderBusyError({ status: 429 }), false);
});
