import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import manifest from "../src/app/manifest";
import nextConfig from "../next.config";
import { captureInstallPrompt, showInstallPrompt, type InstallPromptEvent } from "../src/features/pwa/install-prompt";

const publicFile = (name: string) => path.join(process.cwd(), "public", name);

test("manifest declares standalone launch and working icon sizes", async () => {
  const app = manifest();
  assert.equal(app.name, "Focusly");
  assert.equal(app.start_url, "/");
  assert.equal(app.display, "standalone");
  assert.equal(app.orientation, "any");

  for (const [file, size, purpose] of [
    ["icon-192.png", 192, "any"],
    ["icon-512.png", 512, "any"],
    ["icon-maskable-192.png", 192, "maskable"],
    ["icon-maskable-512.png", 512, "maskable"],
  ] as const) {
    assert.ok(app.icons?.some((icon) => icon.src === `/${file}` && icon.purpose === purpose));
    const png = await readFile(publicFile(file));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("notification worker cannot cache private or stale app responses", async () => {
  const worker = await readFile(publicFile("sw.js"), "utf8");
  assert.match(worker, /addEventListener\("push"/);
  assert.doesNotMatch(worker, /addEventListener\(["']fetch["']/);
  assert.doesNotMatch(worker, /caches\s*\./);

  const routes = await nextConfig.headers?.();
  const sw = routes?.find((route) => "source" in route && route.source === "/sw.js");
  assert.ok(sw && "headers" in sw);
  assert.ok(sw.headers.some((header) => header.key === "Cache-Control" && /no-store/.test(header.value)));
});

test("native install prompt is captured only outside standalone mode and used once", async () => {
  let prevented = 0;
  let prompted = 0;
  const event = {
    preventDefault: () => { prevented += 1; },
    prompt: async () => { prompted += 1; },
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  } as InstallPromptEvent;

  assert.equal(captureInstallPrompt(event, true), null);
  assert.equal(prevented, 1);
  const captured = captureInstallPrompt(event, false);
  assert.equal(captured, event);
  assert.equal(await showInstallPrompt(captured!), "accepted");
  assert.equal(prompted, 1);
  assert.equal(prevented, 2);
});
