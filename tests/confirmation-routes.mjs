import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { confirmedPath } from "../src/features/auth/confirmation.ts";

function load(path, imports) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, exports);
  return exports;
}

test("verified confirmation routes to onboarding or app without signing out", async () => {
  const { confirmedDestination } = load("../src/features/auth/confirmed-destination.ts", {
    "./confirmation": { confirmedPath },
  });
  for (const [complete, expected] of [[false, "/onboarding?status=email-confirmed"], [true, "/app"]]) {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "owner", email_confirmed_at: "2026-10-03" } }, error: null }) },
      from: (table) => {
        assert.equal(table, "profiles");
        return { select: () => ({ eq: (key, value) => {
          assert.deepEqual([key, value], ["id", "owner"]);
          return { single: async () => ({ data: { onboarding_completed: complete }, error: null }) };
        } }) };
      },
    };
    assert.equal(await confirmedDestination(client), expected);
  }
  const anonymous = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  assert.equal(await confirmedDestination(anonymous), "/login?status=invalidLink");
});

function routeHarness(path, client) {
  return load(path, {
    "next/server": { NextResponse: { redirect: (url) => ({ url: String(url), headers: new Headers() }) } },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/env/server": { siteUrl: () => "https://focusly.example" },
    "@/features/auth/confirmed-destination": { confirmedDestination: async () => "/onboarding?status=email-confirmed" },
  });
}

test("token-hash route verifies email, retains session, and rejects stale links", async () => {
  const calls = [];
  const client = { auth: { verifyOtp: async (input) => { calls.push(input); return { error: null }; }, signOut: () => assert.fail("must retain session") } };
  const { GET } = routeHarness("../src/app/auth/confirm/route.ts", client);
  const request = (query) => ({ url: `https://focusly.example/auth/confirm${query}`, nextUrl: new URL(`https://focusly.example/auth/confirm${query}`) });
  const result = await GET(request("?token_hash=abc&type=email"));
  assert.equal(new URL(result.url).pathname, "/onboarding");
  assert.equal(new URL(result.url).origin, "https://focusly.example");
  assert.deepEqual(calls, [{ type: "email", token_hash: "abc" }]);
  const invalid = await GET(request("?token_hash=abc&type=unexpected"));
  assert.equal(new URL(invalid.url).searchParams.get("status"), "invalidLink");
  assert.equal(calls.length, 1);
});

test("PKCE callback retains verified session and opens onboarding", async () => {
  let exchanged = false;
  const client = { auth: { exchangeCodeForSession: async (code) => { assert.equal(code, "valid"); exchanged = true; return { error: null }; }, signOut: () => assert.fail("must retain session") } };
  const { GET } = routeHarness("../src/app/auth/callback/route.ts", client);
  const url = "https://focusly.example/auth/callback?code=valid";
  const result = await GET({ url, nextUrl: new URL(url) });
  assert.equal(exchanged, true);
  assert.equal(new URL(result.url).pathname, "/onboarding");
});

test("documented confirmation template matches local Supabase template", () => {
  const local = fs.readFileSync(new URL("../supabase/templates/confirmation.html", import.meta.url), "utf8");
  const documented = fs.readFileSync(new URL("../docs/supabase/confirmation-email.html", import.meta.url), "utf8");
  assert.equal(local, documented);
  assert.match(local, /\{\{ \.RedirectTo \}\}\?token_hash=\{\{ \.TokenHash \}\}&amp;type=email/);
  assert.match(local, /Confirm my Focusly account/);
});
