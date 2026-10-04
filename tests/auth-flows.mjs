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
import { PENDING_EMAIL_COOKIE, RESEND_AFTER_COOKIE, RESEND_COOLDOWN_MS, confirmedPath, maskEmail } from "../src/features/auth/confirmation.ts";
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
  const values = new Map();
  const jar = {
    get: (key) => values.has(key) ? { value: values.get(key) } : undefined,
    set: (key, value) => values.set(key, value),
  };
  const boundary = {
    "@/lib/env/server": { siteUrl: () => "https://focusly.example" },
    "next/navigation": {
      redirect: (path) => {
        throw Object.assign(new Error("redirect"), { path });
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "next/headers": { cookies: async () => jar },
    "@/lib/supabase/server": { createClient: async () => ({ auth, from: auth.from }) },
    "./confirmation": { PENDING_EMAIL_COOKIE, RESEND_AFTER_COOKIE, RESEND_COOLDOWN_MS, confirmedPath },
    "./state": { authError },
    "./validation": { validEmail, validName, validPassword, textField },
  };
  new Function("require", "exports", code)((name) => {
    assert.ok(name in boundary);
    return boundary[name];
  }, exports);
  return { ...exports, jar };
}
const form = (data) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};
test("signup opens confirmation screen and uses trusted token-hash destination", async () => {
  const app = harness({
    signUp: async (input) => {
      assert.equal(
        input.options.emailRedirectTo,
        "https://focusly.example/auth/confirm",
      );
      assert.equal(input.password, "test-password");
      return { data: { session: null }, error: null };
    },
  });
  await assert.rejects(
    app.signup(
      {},
      form({
        name: "Student",
        email: "student@example.com",
        password: "test-password",
        confirm: "test-password",
      }),
    ),
    (error) => error.path === "/confirm-email",
  );
  assert.equal(app.jar.get(PENDING_EMAIL_COOKIE)?.value, "student@example.com");
  assert.ok(Number(app.jar.get(RESEND_AFTER_COOKIE)?.value) > Date.now());
});
test("confirmation masking and owner-safe destination", () => {
  assert.equal(maskEmail("home@gmail.com"), "ho***@gmail.com");
  assert.equal(maskEmail("a@example.com"), "a***@example.com");
  assert.equal(confirmedPath(false), "/onboarding?status=email-confirmed");
  assert.equal(confirmedPath(true), "/app");
});
test("resend enforces cooldown and returns safe rate-limit state", async () => {
  let calls = 0;
  const app = harness({ resend: async ({ email, type, options }) => {
    calls++;
    assert.equal(email, "student@example.com");
    assert.equal(type, "signup");
    assert.equal(options.emailRedirectTo, "https://focusly.example/auth/confirm");
    return { error: { code: "over_email_send_rate_limit", status: 429 } };
  } });
  app.jar.set(PENDING_EMAIL_COOKIE, "student@example.com");
  app.jar.set(RESEND_AFTER_COOKIE, String(Date.now() + 60_000));
  assert.equal((await app.resendConfirmation({}, new FormData())).status, "rateLimit");
  assert.equal(calls, 0);
  app.jar.set(RESEND_AFTER_COOKIE, "0");
  assert.equal((await app.resendConfirmation({}, new FormData())).status, "rateLimit");
  assert.equal(calls, 1);
  assert.equal((await app.resendConfirmation({}, new FormData())).status, "rateLimit");
  assert.equal(calls, 1);
});
test("resend success and provider failure are classified without leaking errors", async () => {
  for (const [error, expected] of [[null, "sent"], [{ code: "internal_error", message: "secret" }, "unavailable"]]) {
    const app = harness({ resend: async () => ({ error }) });
    app.jar.set(PENDING_EMAIL_COOKIE, "student@example.com");
    assert.equal((await app.resendConfirmation({}, new FormData())).status, expected);
  }
});
test("confirmed-user check refreshes verified identity and routes to onboarding", async () => {
  const app = harness({
    getUser: async () => ({ data: { user: { id: "owner", email_confirmed_at: "2026-10-03" } }, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { onboarding_completed: false }, error: null }) }) }) }),
  });
  await assert.rejects(app.checkConfirmation(), (error) => error.path === "/onboarding?status=email-confirmed");
  const waiting = harness({ getUser: async () => ({ data: { user: null }, error: null }) });
  assert.equal(await waiting.checkConfirmation(), "waiting");
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
