import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmedDestination } from "@/features/auth/confirmed-destination";
import { siteUrl } from "@/lib/env/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let path = "/login?status=invalidLink";
  if (code && code.length <= 2048) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        if (request.nextUrl.searchParams.get("flow") === "recovery")
          path = "/reset-password";
        else path = await confirmedDestination(client);
      }
    } catch {
      /* Keep the safe failure destination. */
    }
  }
  const response = NextResponse.redirect(new URL(path, siteUrl()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
