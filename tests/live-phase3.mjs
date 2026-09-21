// Explicit live integration test. Credentials stay in ignored .supabase until cleanup.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import {
  filterTasks,
  occurrences,
  dayInZone,
  dateAdd,
} from "../src/features/planning/logic.ts";
if (!process.argv.includes("--run-live"))
  throw new Error("Explicit --run-live required");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "lxlpnynpatnsfvvvxwwx.supabase.co");
const manifest = JSON.parse(
  await readFile(".next/server/server-reference-manifest.json", "utf8"),
);
const actionId = Object.entries(manifest.node).find(
  ([, v]) => v.exportedName === "mutate",
)[0];
const reusable = process.argv.includes("--reuse")
  ? JSON.parse(await readFile(".supabase/phase3-test-accounts.json", "utf8"))
  : null;
const runId = reusable?.runId || randomUUID(),
  users = [],
  checks = [];
let status = "passed",
  failure;
const check = (ok, label) => {
  assert.ok(ok, label);
  checks.push(label);
};
const data = (r, label) => {
  if (r.error) throw new Error(label + ": " + r.error.code);
  checks.push(label);
  return r.data;
};
function client(jar) {
  return createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (xs) =>
        xs.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  });
}
async function action(user, values) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set("_1_" + k, String(v));
  f.set("0", '["$K1"]');
  const r = await fetch("http://localhost:3000/app/tasks", {
    method: "POST",
    headers: {
      "Next-Action": actionId,
      origin: "http://localhost:3000",
      cookie: [...user.jar].map(([k, v]) => k + "=" + v).join("; "),
    },
    body: f,
  });
  const body = await r.text();
  const match = body.match(/\{"(success|error)":"([^"]+)"\}/);
  if (!match)
    throw new Error("Unrecognized server-action response " + r.status);
  return { [match[1]]: match[2] };
}
try {
  for (let i = 0; i < 2; i++) {
    if (reusable) {
      const u = reusable.users[i],
        jar = new Map(),
        c = client(jar);
      data(
        await c.auth.signInWithPassword({
          email: u.email,
          password: u.password,
        }),
        "Resume temporary user " + i,
      );
      users.push({ ...u, jar, c });
      continue;
    }
    const jar = new Map(),
      c = client(jar),
      email = `focusly-phase3-${runId}-${i}@example.com`,
      password = randomBytes(32).toString("base64url") + "Aa1!";
    const signup = data(
      await c.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: "Phase 3 Test " + (i + 1),
            focusly_test_run: runId,
          },
        },
      }),
      "Register temporary user " + i,
    );
    users.push({ id: signup.user.id, email, password, jar, c });
    for (const [p_step, p_value] of [
      [1, { name: "Phase 3 Test " + (i + 1) }],
      [2, { stage: "secondary" }],
      [3, { year: "secondary_2" }],
      [4, { minutes: 120 }],
      [5, { subjects: ["Mathematics", "Arabic"] }],
    ])
      data(
        await c.rpc("save_onboarding_step", { p_step, p_value }),
        "Onboarding step " + p_step + " user " + i,
      );
    data(
      await c.rpc("complete_onboarding", {
        p_locale: "en",
        p_theme: "light",
        p_accent: "violet",
      }),
      "Complete onboarding " + i,
    );
  }
  await mkdir(".supabase", { recursive: true });
  await writeFile(
    ".supabase/phase3-test-accounts.json",
    JSON.stringify({
      runId,
      users: users.map(({ id, email, password }) => ({ id, email, password })),
    }),
  );
  const [a, b] = users;
  const today = dayInZone(Date.now(), "Africa/Cairo");
  check(
    data(await a.c.from("subjects").select("*"), "Read onboarding subjects")
      .length === 2,
    "Two onboarding subjects exist",
  );
  check(
    (
      await action(a, {
        entity: "subjects",
        action: "save",
        name: "Physics",
        color: "#2878d0",
        user_id: b.id,
      })
    ).success === "saved",
    "Server action creates subject and ignores submitted owner",
  );
  let physics = data(
    await a.c.from("subjects").select("*").eq("name", "Physics").single(),
    "Read created subject",
  );
  check(physics.user_id === a.id, "Subject ownership comes from session");
  check(
    (
      await action(a, {
        entity: "subjects",
        action: "save",
        id: physics.id,
        name: "Physics lab",
        color: "#187d58",
      })
    ).success === "saved",
    "Rename and recolor subject",
  );
  check(
    (
      await action(a, {
        entity: "subjects",
        action: "save",
        name: " physics LAB ",
        color: "#2878d0",
      })
    ).error === "duplicate",
    "Friendly duplicate validation",
  );
  check(
    (
      await action(a, {
        entity: "subjects",
        action: "save",
        name: " ",
        color: "#bad",
      })
    ).error === "invalid",
    "Trusted subject validation",
  );
  for (const [title, date, time] of [
    ["Read chapter", today, ""],
    ["Practice problems", dateAdd(today, 1), "18:00"],
  ])
    check(
      (
        await action(a, {
          entity: "tasks",
          action: "save",
          title,
          notes: "Live Phase 3 validation",
          subject_id: physics.id,
          date,
          time,
          zone: "Africa/Cairo",
          priority: "high",
        })
      ).success === "saved",
      "Create task: " + title,
    );
  let tasks = data(await a.c.from("tasks").select("*"), "Read created tasks");
  let first = tasks.find((t) => t.title === "Read chapter");
  check(
    first.due_on === today && first.due_at === null,
    "Date-only deadline persisted without UTC conversion",
  );
  check(
    (
      await action(a, {
        entity: "tasks",
        action: "save",
        id: first.id,
        title: "Read chapter carefully",
        notes: "Updated",
        subject_id: physics.id,
        date: today,
        time: "",
        zone: "Africa/Cairo",
        priority: "low",
      })
    ).success === "saved",
    "Edit task through server action",
  );
  check(
    (
      await action(a, {
        entity: "tasks",
        action: "complete",
        id: first.id,
        completed: "true",
      })
    ).success === "saved",
    "Complete task through server action",
  );
  tasks = data(await a.c.from("tasks").select("*"), "Reload tasks");
  check(
    !!tasks.find((t) => t.id === first.id).completed_at,
    "Completion timestamp persisted",
  );
  check(
    filterTasks(tasks, "completed", "", "", today, "Africa/Cairo").length === 1,
    "Completed filter with live data",
  );
  check(
    filterTasks(tasks, "upcoming", "", "high", today, "Africa/Cairo").length ===
      1,
    "Upcoming/priority filters with live data",
  );
  const base = {
    entity: "study_blocks",
    action: "save",
    subject_id: physics.id,
    title: "Physics lab",
    date: today,
    time: "16:00",
    zone: "Africa/Cairo",
    duration: "45",
    repeat: "weekly",
  };
  check(
    (await action(a, base)).success === "saved",
    "Schedule weekly study block",
  );
  check(
    (await action(a, { ...base, time: "16:15", repeat: "never" })).error ===
      "overlap",
    "Trusted overlap warning appears",
  );
  check(
    (
      await action(a, {
        ...base,
        time: "16:15",
        repeat: "never",
        allow_overlap: "true",
      })
    ).success === "saved",
    "Explicit overlap acknowledgement saves",
  );
  let blocks = data(
    await a.c.from("study_blocks").select("*"),
    "Read scheduled blocks",
  );
  const weekly = blocks.find((b) => b.repeat_weekly);
  check(
    (await action(a, { ...base, id: weekly.id, time: "17:30", duration: "60" }))
      .success === "saved",
    "Edit entire weekly series",
  );
  blocks = data(
    await a.c.from("study_blocks").select("*"),
    "Reload edited blocks",
  );
  check(
    occurrences(blocks, today, dateAdd(today, 7), "Africa/Cairo").length === 3,
    "Weekly projection uses real persisted blocks",
  );
  for (const path of [
    "/app",
    "/app/tasks",
    "/app/subjects",
    "/app/planner",
    "/app/calendar",
  ]) {
    const r = await fetch("http://localhost:3000" + path, {
      headers: { cookie: [...a.jar].map(([k, v]) => k + "=" + v).join("; ") },
    });
    const html = await r.text();
    check(
      r.status === 200 &&
        !html.includes("Study workspace unavailable") &&
        html.includes("Physics lab"),
      "Authenticated route renders real data " + path,
    );
  }
  for (const table of ["subjects", "tasks", "study_blocks"]) {
    check(
      data(
        await b.c.from(table).select("*").eq("user_id", a.id),
        table + " cross-user query",
      ).length === 0,
      table + " hidden from other user",
    );
    const id =
      table === "subjects"
        ? physics.id
        : table === "tasks"
          ? first.id
          : weekly.id;
    const attempt = await action(b, { entity: table, action: "delete", id });
    check(
      !!attempt.error,
      "Server action rejects cross-user deletion " + table,
    );
  }
  check(
    (
      await action(b, {
        entity: "subjects",
        action: "save",
        id: physics.id,
        name: "Intrusion",
        color: "#2878d0",
      })
    ).error,
    "Other user cannot rename subject",
  );
  check(
    (
      await action(b, {
        entity: "tasks",
        action: "save",
        title: "Intrusion",
        subject_id: physics.id,
        date: today,
        time: "",
        zone: "UTC",
        priority: "medium",
      })
    ).error === "invalid",
    "Server rejects cross-user subject in task",
  );
  check(
    (await action(b, { ...base, subject_id: physics.id })).error === "invalid",
    "Server rejects cross-user subject in block",
  );
  check(
    (
      await b.c
        .from("tasks")
        .insert({ user_id: b.id, subject_id: physics.id, title: "Intrusion" })
    ).error?.code === "23503",
    "Database rejects cross-user task FK",
  );
  check(
    (
      await b.c
        .from("study_blocks")
        .insert({
          user_id: b.id,
          subject_id: physics.id,
          title: "Intrusion",
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 60000).toISOString(),
        })
    ).error?.code === "23503",
    "Database rejects cross-user block FK",
  );
  check(
    (await action(a, { entity: "subjects", action: "delete", id: physics.id }))
      .success === "archived",
    "In-use subject safely archives",
  );
  check(
    data(await a.c.from("tasks").select("*"), "Tasks after archive").length ===
      2,
    "Archiving preserves tasks",
  );
  check(
    (await action(a, { entity: "subjects", action: "restore", id: physics.id }))
      .success === "saved",
    "Archived subject restores",
  );
  data(await a.c.auth.signOut(), "Logout");
  data(
    await a.c.auth.signInWithPassword({ email: a.email, password: a.password }),
    "Login again",
  );
  check(
    data(await a.c.from("tasks").select("*"), "Tasks after login again")
      .length === 2,
    "Tasks persist after logout and login",
  );
  check(
    data(await a.c.from("study_blocks").select("*"), "Blocks after login again")
      .length === 2,
    "Study blocks persist after logout and login",
  );
} catch (e) {
  status = "failed";
  failure = e.message;
  process.exitCode = 1;
} finally {
  for (const u of users) await u.c.auth.signOut();
  await writeFile(
    "../outputs/Focusly-Phase-3-Live-Tests.json",
    JSON.stringify(
      { status, failure, runId, testUserIds: users.map((x) => x.id), checks },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status, failure, checks: checks.length }));
}
