import "server-only";
import { cache } from "react";
import { getIdentity } from "@/features/auth/session";
import type { Database } from "@/types/database";

type Table = "subjects" | "tasks" | "study_blocks";
// One paginated read per table per render, including archived subject labels.
// No persistent cache: every request verifies identity and applies ownership/RLS.
export const ownedRows = cache(async <T extends Table>(table: T) => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") throw new Error("Workspace unavailable");
  const items = [];
  for (let page = 0; ; page++) {
    const result = await identity.client.from(table as Table).select("*")
      .eq("user_id", identity.user.id).order("id")
      .range(page * 500, page * 500 + 499);
    if (result.error) throw new Error("Study workspace unavailable");
    items.push(...result.data);
    if (result.data.length < 500) break;
  }
  return items as Database["public"]["Tables"][T]["Row"][];
});

// Date-bounded task reads share the same canonical rows across the app.
export const ownedTasks = cache(async (from: string, to: string) => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") throw new Error("Workspace unavailable");
  const items: Database["public"]["Tables"]["tasks"]["Row"][] = [];
  for (let page = 0; ; page++) {
    const result = await identity.client.from("tasks").select("*")
      .eq("user_id", identity.user.id)
      .gte("task_date", from).lte("task_date", to)
      .order("task_date").order("created_at").order("id")
      .range(page * 500, page * 500 + 499);
    if (result.error) throw new Error("Study workspace unavailable");
    items.push(...result.data);
    if (result.data.length < 500) break;
  }
  return items;
});
