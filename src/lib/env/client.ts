type SupabasePublicEnv = { url: string; publishableKey: string };

export function isSupabaseConfigured(): boolean {
  try {
    getSupabasePublicEnv();
    return true;
  } catch {
    return false;
  }
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== "https:" &&
      !(
        parsedUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsedUrl.hostname)
      )
    )
      throw new Error();
    if (
      parsedUrl.hostname === "your-project-ref.supabase.co" ||
      parsedUrl.username ||
      parsedUrl.password
    )
      throw new Error();
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL or a localhost URL.",
    );
  }

  if (
    !publishableKey.startsWith("sb_publishable_") ||
    publishableKey === "sb_publishable_your-key" ||
    publishableKey.length < 24
  )
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not valid.");
  return { url, publishableKey };
}
