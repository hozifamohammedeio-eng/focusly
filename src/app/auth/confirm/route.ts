import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  let path = "/login?status=invalidLink";
  if (
    token_hash &&
    token_hash.length <= 512 &&
    (type === "signup" || type === "recovery")
  ) {
    try {
      const client = await createClient();
      const { error } = await client.auth.verifyOtp({ type, token_hash });
      // verifyOtp verifies the email-link hash; this is not an OTP login flow.
      if (!error) {
        if (type === "recovery") path = "/reset-password";
        else {
          await client.auth.signOut({ scope: "local" });
          path = "/login?status=confirmed";
        }
      }
    } catch {
      /* Invalid/unavailable links never grant access. */
    }
  }
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
