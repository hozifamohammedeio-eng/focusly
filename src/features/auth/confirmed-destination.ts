import { confirmedPath } from "./confirmation";
import { createClient } from "@/lib/supabase/server";

export async function confirmedDestination(client: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return "/login?status=invalidLink";
  const profile = await client.from("profiles").select("onboarding_completed").eq("id", data.user.id).single();
  return confirmedPath(profile.data?.onboarding_completed === true);
}
