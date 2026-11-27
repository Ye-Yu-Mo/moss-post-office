// Multi-tab save synchronization: a second tab must adopt newer progress
// instead of overwriting it five seconds later with a stale snapshot.
//
// Runs against the local QA build (window.__moss is only exposed on loopback).

import { chromium } from "playwright";

const BASE = process.env.MOSS_QA_BASE || "http://127.0.0.1:17331";
const SAVE_KEY = "moss-post-office.save.v1";
const results = [];
const failures = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// Write stamps and force the app's own save path (hide + show). This mirrors
// closing the lid or switching tabs, which is when a real conflict shows up.
const FORCE_SAVE = (value) => {
  window.__moss.state().stamps = value;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  document.dispatchEvent(new Event("visibilitychange"));
};

async function memory(page) {
  return page.evaluate(() => window.__moss.state().stamps);
}

async function stored(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).stamps : null;
  }, SAVE_KEY);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const errors = [];

  const p1 = await context.newPage();
  p1.on("pageerror", (error) => errors.push(`p1: ${error}`));
  await p1.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
  await p1.waitForTimeout(500);
  if (!(await p1.evaluate(() => Boolean(window.__moss)))) {
    console.error("window.__moss missing: use the loopback QA build");
    process.exit(1);
  }
  await p1.evaluate(FORCE_SAVE, 1000);
  await p1.waitForTimeout(250);
  check("first tab writes its save", (await stored(p1)) === 1000, String(await stored(p1)));

  const p2 = await context.newPage();
  p2.on("pageerror", (error) => errors.push(`p2: ${error}`));
  await p2.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(600);
  check("second tab loads the shared save", (await memory(p2)) === 1000, String(await memory(p2)));

  await p1.evaluate(FORCE_SAVE, 5000);
  await p2.waitForTimeout(500);
  check(
    "second tab adopts a newer save",
    (await memory(p2)) === 5000,
    String(await memory(p2))
  );

  // A throttled background tab can miss storage events entirely. Block the
  // listener from before the app boots to simulate that, then let it write.
  const p3 = await context.newPage();
  p3.on("pageerror", (error) => errors.push(`p3: ${error}`));
  await p3.addInitScript(() => {
    window.addEventListener("storage", (event) => event.stopImmediatePropagation(), true);
  });
  await p3.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
  await p3.waitForTimeout(600);
  check("stale tab starts from the old save", (await memory(p3)) === 5000, String(await memory(p3)));

  await p1.evaluate(FORCE_SAVE, 8000);
  await p3.waitForTimeout(400);
  check("stale tab misses the event", (await memory(p3)) === 5000, String(await memory(p3)));

  await p3.evaluate(FORCE_SAVE, 6500);
  await p3.waitForTimeout(400);
  check(
    "stale tab reads before writing instead of clobbering",
    (await memory(p3)) === 8000 && (await stored(p3)) === 8000,
    `${await memory(p3)} / stored ${await stored(p3)}`
  );
  check("the other tab stays on the newer save", (await memory(p1)) === 8000, String(await memory(p1)));

  // Idle autosave must not rewrite identical text every five seconds, which
  // would keep waking the other tab and make adoption churn.
  await p1.evaluate((key) => {
    window.__saveWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) window.__saveWrites += 1;
      return original.call(this, name, value);
    };
  }, SAVE_KEY);
  await p1.waitForTimeout(5600);
  const writes = await p1.evaluate(() => window.__saveWrites);
  check("idle autosave does not churn identical saves", writes <= 1, String(writes));

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((item) => `- ${item}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
