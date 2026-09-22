import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env/client";

export const getIdentity = cache(async () => {
  if (!isSupabaseConfigured()) return { kind: "unconfigured" } as const;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error && error.status && error.status >= 500)
      return { kind: "unavailable" } as const;
    if (!data.user) return { kind: "anonymous" } as const;
    return { kind: "authenticated", client, user: data.user } as const;
  } catch {
    return { kind: "unavailable" } as const;
  }
});

// React cache is scoped to one server render, never shared between users.
export const getSettings = cache(async () => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  try {
    const result = await identity.client.from("user_settings").select("*")
      .eq("user_id", identity.user.id).single();
    if (result.error) return { kind: "unavailable" } as const;
    return { ...identity, settings: result.data };
  } catch {
    return { kind: "unavailable" } as const;
  }
});

export const getStudent = cache(async () => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  const { client, user } = identity;
  try {
    const [profile, settings] = await Promise.all([
      client.from("profiles").select("*").eq("id", user.id).single(),
      getSettings(),
    ]);
    if (profile.error || settings.kind !== "authenticated")
      return { kind: "unavailable" } as const;
    return {
      ...identity,
      profile: profile.data,
      settings: settings.settings,
    };
  } catch {
    return { kind: "unavailable" } as const;
  }
});

export async function redirectAuthenticated() {
  const student = await getStudent();
  if (student.kind === "authenticated")
    redirect(student.profile.onboarding_completed ? "/app" : "/onboarding");
  return student;
}
