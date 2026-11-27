import { chromium } from "playwright";

const BASE = process.env.MOSS_QA_BASE || "http://127.0.0.1:17331";
const failures = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  const user = `qr_${Date.now().toString().slice(-8)}`;
  await page.goto(`${BASE}/?qa=1#qa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.click("#accountBtn");
  await page.click("[data-account-mode='register']");
  await page.fill("#accountUser", user);
  await page.fill("#accountPass", "12345678");
  await page.click("[data-account-submit]");
  await page.waitForSelector(".account-user", { timeout: 20000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const state = window.__moss.state();
    state.stamps = 777777;
    state.gens.snail = 33;
  });
  await page.click("#stampBtn");
  await page.waitForTimeout(6000);

  const remoteBefore = await page.evaluate(async () => {
    const account = JSON.parse(localStorage.getItem("moss-post-office.account.v1"));
    const response = await fetch("/api/v1/save", {
      headers: { Authorization: `Bearer ${account.token}` }
    });
    const body = await response.json();
    return { stamps: body.payload?.stamps || 0, revision: body.revision };
  });
  check("cloud backup exists", remoteBefore.stamps > 700000, JSON.stringify(remoteBefore));

  await page.evaluate(() => {
    localStorage.setItem("moss-post-office.save.v1", "{ broken json");
  });
  await page.goto(`${BASE}/?qa=2#qa`, { waitUntil: "networkidle" });

  let restored = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(700);
    try {
      restored = await page.evaluate(() =>
        window.__moss ? Number(window.__moss.state().stamps) || 0 : 0
      );
    } catch (error) {
      restored = 0;
    }
    if (restored > 0) break;
  }
  check("local save recovers from cloud", restored > 700000, String(restored));

  const remoteAfter = await page.evaluate(async () => {
    const account = JSON.parse(localStorage.getItem("moss-post-office.account.v1"));
    const response = await fetch("/api/v1/save", {
      headers: { Authorization: `Bearer ${account.token}` }
    });
    const body = await response.json();
    return { stamps: body.payload?.stamps || 0, revision: body.revision };
  });
  check("cloud backup is not overwritten", remoteAfter.stamps > 600000, JSON.stringify(remoteAfter));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\n${4 - failures.length}/4 checks passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
