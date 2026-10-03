export class PlannerRequestTimeout extends Error {
  constructor() { super("planner_request_timeout"); }
}

/** Claim the generation slot before React's next render can disable the button. */
export async function runGenerationOnce<T>(gate: { current: boolean }, request: () => Promise<T>, timeoutMs: number):
  Promise<{ started: false } | { started: true; result: T }> {
  if (gate.current) return { started: false };
  gate.current = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PlannerRequestTimeout()), timeoutMs);
      }),
    ]);
    return { started: true, result };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    gate.current = false;
  }
}
