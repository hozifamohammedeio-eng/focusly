"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";

export function createClient() {
  const { publishableKey, url } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
