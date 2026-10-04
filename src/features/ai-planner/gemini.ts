import "server-only";
import { GoogleGenAI } from "@google/genai";

// One server-only Gemini configuration for both Focusly planning experiences.
export function configuredGemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.FOCUSLY_AI_PLANNER_MODEL;
  if (!key || !model) throw new Error("provider_unconfigured");
  return { client: new GoogleGenAI({ apiKey: key }), model };
}
