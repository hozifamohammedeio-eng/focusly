// Unit tests use an injected Auth boundary. They do not claim SMTP/live Auth verification.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {
  validEmail,
  validName,
  validPassword,
  textField,
} from "../src/features/auth/validation.ts";
import { authError } from "../src/features/auth/state.ts";
const source = fs.readFileSync(
  new URL("../src/features/auth/actions.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
function harness(auth) {
  const exports = {};
  const boundary = {
    "@/lib/env/server": { siteUrl: () => "https://focusly.example" },
    "next/navigation": {
      redirect: (path) => {
        throw Object.assign(new Error("redirect"), { path });
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": { createClient: async () => ({ auth }) },
    "./state": { authError },
    "./validation": { validEmail, validName, validPassword, textField },
  };
  new Function("require", "exports", code)((name) => {
    assert.ok(name in boundary);
    return boundary[name];
  }, exports);
  return exports;
}
const form = (data) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};
test("signup returns confirmation state and uses trusted PKCE callback", async () => {
  const app = harness({
    signUp: async (input) => {
      assert.equal(
        input.options.emailRedirectTo,
        "https://focusly.example/auth/callback",
      );
      assert.equal(input.password, "test-password");
      return { data: { session: null }, error: null };
    },
  });
  assert.deepEqual(
    await app.signup(
      {},
      form({
        name: "Student",
        email: "student@example.com",
        password: "test-password",
        confirm: "test-password",
      }),
    ),
    { success: "confirmation" },
  );
});
test("misconfigured immediate signup never falsely reports email delivery", async () => {
  let signedOut = false;
  const app = harness({
    signUp: async () => ({ data: { session: {} }, error: null }),
    signOut: async () => {
      signedOut = true;
      return { error: null };
    },
  });
  assert.deepEqual(
    await app.signup(
      {},
      form({
        name: "Student",
        email: "student@example.com",
        password: "test-password",
        confirm: "test-password",
      }),
    ),
    { error: "unavailable" },
  );
  assert.equal(signedOut, true);
});
test("recovery is enumeration-safe and uses fixed trusted destination", async () => {
  const app = harness({
    resetPasswordForEmail: async (email, options) => {
      assert.equal(email, "student@example.com");
      assert.equal(
        options.redirectTo,
        "https://focusly.example/auth/callback?flow=recovery",
      );
      return { error: null };
    },
  });
  assert.deepEqual(
    await app.forgot(
      {},
      form({ email: "student@example.com", next: "https://evil.example" }),
    ),
    { success: "recovery" },
  );
});
test("password update rejects anonymous identity and mismatched passwords", async () => {
  let updated = false;
  const app = harness({
    getUser: async () => ({ data: { user: null }, error: null }),
    updateUser: async () => {
      updated = true;
      return { error: null };
    },
  });
  assert.deepEqual(
    await app.reset(
      {},
      form({ password: "new-password", confirm: "new-password" }),
    ),
    { error: "expired" },
  );
  assert.deepEqual(
    await app.reset(
      {},
      form({ password: "new-password", confirm: "different" }),
    ),
    { error: "invalid" },
  );
  assert.equal(updated, false);
});
test("authenticated password reset updates then signs out before login", async () => {
  const calls = [];
  const app = harness({
    getUser: async () => ({ data: { user: { id: "verified" } }, error: null }),
    updateUser: async () => {
      calls.push("update");
      return { error: null };
    },
    signOut: async () => {
      calls.push("signout");
      return { error: null };
    },
  });
  await assert.rejects(
    app.reset({}, form({ password: "new-password", confirm: "new-password" })),
    (error) => error.path === "/login?status=changed",
  );
  assert.deepEqual(calls, ["update", "signout"]);
});
test("password login handles unconfirmed email and redirects success to guarded app", async () => {
  const denied = harness({
    signInWithPassword: async () => ({
      error: { code: "email_not_confirmed" },
    }),
  });
  assert.deepEqual(
    await denied.login(
      {},
      form({ email: "student@example.com", password: "test-password" }),
    ),
    { error: "unconfirmed" },
  );
  const allowed = harness({
    signInWithPassword: async () => ({ error: null }),
  });
  await assert.rejects(
    allowed.login(
      {},
      form({ email: "student@example.com", password: "test-password" }),
    ),
    (error) => error.path === "/app",
  );
});
