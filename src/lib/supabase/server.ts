import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; src/proxy.ts refreshes them.
        }
      },
    },
  });
}
