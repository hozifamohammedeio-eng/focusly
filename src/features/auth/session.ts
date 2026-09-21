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

export const getStudent = cache(async () => {
  const identity = await getIdentity();
  if (identity.kind !== "authenticated") return identity;
  const { client, user } = identity;
  try {
    const [profile, settings, subjects] = await Promise.all([
      client.from("profiles").select("*").eq("id", user.id).single(),
      client.from("user_settings").select("*").eq("user_id", user.id).single(),
      client
        .from("subjects")
        .select("*")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("sort_order"),
    ]);
    if (profile.error || settings.error || subjects.error)
      return { kind: "unavailable" } as const;
    return {
      ...identity,
      profile: profile.data,
      settings: settings.data,
      subjects: subjects.data,
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
