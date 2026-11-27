import { chromium } from "playwright";

const BASE = process.env.MOSS_QA_BASE || "http://127.0.0.1:17331";
const results = [];
const failures = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function registerViaDialog(page, user) {
  await page.click("#accountBtn");
  await page.click("[data-account-mode='register']");
  await page.fill("#accountUser", user);
  await page.fill("#accountPass", "12345678");
  await page.click("[data-account-submit]");
  await page.waitForSelector(".account-user", { timeout: 20000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

async function logoutViaDialog(page) {
  await page.click("#accountBtn");
  await page.waitForSelector("[data-account-logout]");
  await page.click("[data-account-logout]");
  await page.waitForTimeout(900);
}

async function loginViaDialog(page, user) {
  await page.click("#accountBtn");
  await page.click("[data-account-mode='login']");
  await page.fill("#accountUser", user);
  await page.fill("#accountPass", "12345678");
  await page.click("[data-account-submit]");
  try {
    await page.waitForSelector(".account-user", { timeout: 5000 });
  } catch (error) {
    /* a remote save reloads the page */
  }
  await page.waitForTimeout(2000);
  if (!(await page.locator("#modal").isHidden())) await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

async function ensureQaHook(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto(`${BASE}/?qa=${Date.now()}-${attempt}#qa`, { waitUntil: "networkidle" });
    try {
      await page.waitForFunction(() => Boolean(window.__moss), null, { timeout: 3500 });
      return true;
    } catch (error) {
      await page.waitForTimeout(600);
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];

  const desktop = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await desktop.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const room = (name) => page.locator(`section.room[data-room="${name}"]`);
  const navLabels = await page.locator(".room-label").allInnerTexts();
  check("nav has four rooms", navLabels.join(",") === "邮局,镇口,邮路,守夜", navLabels.join(","));
  check("hall is the default room", await room("hall").isVisible());
  check("no modal on boot", await page.locator("#modal").isHidden());

  const stampBefore = Number((await page.innerText("#stampCount")).replace(/,/g, ""));
  await page.click("#stampBtn");
  await page.waitForTimeout(250);
  const stampAfter = Number((await page.innerText("#stampCount")).replace(/,/g, ""));
  check("stamp click works", stampAfter > stampBefore, `${stampBefore} -> ${stampAfter}`);

  for (const [tab, marker] of [
    ["orders", "柜台"],
    ["upgrades", "邮戳"],
    ["album", "已贴"],
    ["moon", "夜班"]
  ]) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(250);
    const text = await page.locator("#panelBody").innerText();
    check(`hall tab ${tab} renders`, text.includes(marker), text.slice(0, 20));
  }

  await page.evaluate(() => {
    window.__moss.state().ink = 100;
  });
  await page.click('[data-tab="orders"]');
  await page.waitForTimeout(300);
  const inkBefore = await page.evaluate(() => window.__moss.state().ink);
  const reroll = page.locator(".order-reroll").first();
  if (await reroll.count()) {
    await reroll.dblclick();
    await page.waitForTimeout(450);
    const inkAfter = await page.evaluate(() => window.__moss.state().ink);
    check("double-click reroll charges once", inkBefore - inkAfter === 8, `${inkBefore} -> ${inkAfter}`);
  }

  await page.locator(".room-btn", { hasText: "镇口" }).click();
  await page.waitForTimeout(400);
  check("town room opens", await room("town").isVisible());
  check("hash follows room", (await page.evaluate(() => location.hash)) === "#/town");
  check("town logged-out copy", (await room("town").innerText()).includes("还没有登录"));

  const transition = await page.evaluate(() => {
    const visible = document.querySelector("section.room:not([hidden])");
    return visible ? getComputedStyle(visible).animationName : "";
  });
  check("room enter animation is wired", transition.includes("room-in"), transition);

  const user = `qa_${Date.now().toString().slice(-8)}`;
  await registerViaDialog(page, user);
  await page.waitForTimeout(1800);
  check("town loads after register", (await room("town").locator(".friend-code-row").count()) > 0);
  check("town keeps garden", (await room("town").locator(".garden-grid").count()) > 0);
  check("closing account modal keeps town", (await room("town").locator("[data-town-root]").count()) > 0);

  const playerGarden = room("town").locator("button", { hasText: "后院" }).first();
  if (await playerGarden.count()) {
    await playerGarden.click();
    await page.waitForTimeout(1200);
    check("friend garden is a town view", (await room("town").locator("[data-garden-root] .garden-plot").count()) > 0);
    check("friend garden is not a modal", await page.locator("#modal").isHidden());
    await room("town").locator("[data-town-back]").click();
    await page.waitForTimeout(600);
    check("town returns from garden", (await room("town").locator(".friend-code-row").count()) > 0);
  }

  const composerButton = room("town").locator("button", { hasText: "寄明信片" }).first();
  if (await composerButton.count()) {
    await composerButton.click();
    await page.waitForTimeout(600);
    check("postcard composer is a town view", (await room("town").locator(".town-template").count()) > 0);
    check("postcard composer is not a modal", await page.locator("#modal").isHidden());
    await room("town").locator(".town-template").first().click();
    await page.waitForTimeout(1600);
    check(
      "postcard send returns to town",
      (await room("town").locator(".friend-code-row").count()) > 0 &&
        (await room("town").locator(".town-composer").count()) === 0
    );
  }

  const friendCode = (await room("town").locator(".friend-code-row b").innerText()).trim();
  const friendUser = `qb_${Date.now().toString().slice(-8)}`;
  await page.evaluate(() => {
    window.__moss.state().stamps = 55555;
    const raw = JSON.parse(localStorage.getItem("moss-post-office.save.v1") || "{}");
    raw.stamps = 55555;
    localStorage.setItem("moss-post-office.save.v1", JSON.stringify(raw));
  });
  await logoutViaDialog(page);
  await registerViaDialog(page, friendUser);
  check("new account does not inherit old save", (await page.evaluate(() => window.__moss.state().stamps)) < 1000);
  await page.locator(".room-btn", { hasText: "镇口" }).click();
  await page.waitForTimeout(1200);
  await room("town").locator("#friendCodeInput").fill(friendCode);
  await room("town").locator(".friend-add-btn").click();
  await page.waitForTimeout(1200);
  await logoutViaDialog(page);
  await loginViaDialog(page, user);
  await page.locator(".room-btn", { hasText: "镇口" }).click();
  await page.waitForTimeout(1800);
  const accept = room("town").locator(".friend-request button", { hasText: "接受" }).first();
  if (await accept.count()) {
    await accept.click();
    await page.waitForTimeout(1500);
  }
  check("friend request accepted", (await room("town").locator(".friend-row").count()) > 0);
  const visit = room("town").locator(".friend-row button", { hasText: "串门" }).first();
  if (await visit.count()) {
    await visit.click();
    await page.waitForTimeout(1000);
    check("friend profile is a town view", (await room("town").locator("[data-friend-profile-root] .friend-profile-stats span").count()) === 4);
    check("friend profile is not a modal", await page.locator("#modal").isHidden());
    await room("town").locator("[data-town-back]").click();
    await page.waitForTimeout(600);
    check("town returns from profile", (await room("town").locator(".friend-code-row").count()) > 0);
  }

  check("QA hook survives login reload", await ensureQaHook(page));
  await page.evaluate(() => {
    const state = window.__moss.state();
    state.totalEarned = 9000;
    state.stamps = 9000;
    state.ink = 60;
  });
  await page.locator(".room-btn", { hasText: "邮路" }).click();
  await page.waitForTimeout(500);
  check("routes room opens", await room("routes").isVisible());
  check("routes list renders", (await room("routes").locator(".route-card").count()) > 0);

  const routeButton = page.locator(".route-btn:not(:disabled)").first();
  if (await routeButton.count()) {
    await routeButton.click();
    await page.waitForTimeout(500);
    check("dispatch starts a trip", (await room("routes").locator(".trip-card").count()) > 0);
    const timeOne = await room("routes").locator("[data-trip-time]").first().innerText();
    await page.waitForTimeout(2500);
    const timeTwo = await room("routes").locator("[data-trip-time]").first().innerText();
    check("dispatch countdown ticks", timeOne !== "0:00" && timeOne !== timeTwo, `${timeOne} -> ${timeTwo}`);
  }

  await room("routes").locator("[data-expedition-open]").click();
  await page.waitForTimeout(500);
  check("expedition prep is a room view", (await page.locator("[data-exp-prep-root]").count()) > 0);
  check("prep is not a modal", await page.locator("#modal").isHidden());
  await page.locator("[data-room-back='routes']").click();
  await page.waitForTimeout(300);
  check("prep back returns to routes", (await page.locator("[data-dispatch-root]").count()) > 0);

  await room("routes").locator("[data-expedition-open]").click();
  await page.waitForTimeout(300);
  await page.locator(".exp-secondary").click();
  await page.waitForTimeout(900);
  check("expedition shell opens", (await page.locator(".exp-shell").count()) > 0);
  await page.locator(".exp-shell .link-btn").filter({ hasText: "收起" }).first().click();
  await page.waitForTimeout(400);
  check("expedition back returns to routes", (await page.locator("[data-dispatch-root]").count()) > 0);

  await page.evaluate(() => {
    window.__moss.state().nightWatch.night = 9;
  });
  await page.locator(".room-btn", { hasText: "守夜" }).click();
  await page.waitForTimeout(500);
  check("night panel renders", (await page.locator(".nw-panel").count()) > 0);
  await page.locator(".nw-start").click();
  await page.waitForTimeout(500);
  check("night battle opens", (await page.locator(".nw-board").count()) > 0);
  check("night battle is not a modal", await page.locator("#modal").isHidden());
  check("wave preview lists shadows", (await page.locator(".nw-wave-chip").count()) > 0);
  check("blocked fog cells render", (await page.locator(".nw-cell.is-blocked[disabled]").count()) === 3);

  await page.locator(".nw-ready-actions .primary-btn").click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__moss.nightwatchOil(500));
  await page.evaluate(() => window.__moss.nightwatchPlace("letter", 2, 1));
  const beforeSell = await page.evaluate(() => window.__moss.nightwatch().oil);
  await page.locator(".nw-tool").click();
  await page.locator(".nw-cell").nth(1 * 8 + 2).click();
  await page.waitForTimeout(400);
  const sold = await page.evaluate(() => ({
    oil: window.__moss.nightwatch().oil,
    towers: window.__moss.nightwatch().towers.length
  }));
  check("shovel sells a plant", sold.towers === 0 && sold.oil > beforeSell, JSON.stringify(sold));
  await page.waitForTimeout(3000);
  const progressed = await page.evaluate(() => {
    const snap = window.__moss.nightwatch();
    return { enemies: snap.enemies.length, kills: snap.kills, oil: snap.oil };
  });
  check("night battle actually ticks", progressed.enemies > 0 || progressed.kills > 0, JSON.stringify(progressed));
  await page.locator("[data-room-back='night']").click();
  await page.waitForTimeout(300);
  check("night back pauses first", await page.evaluate(() => Boolean(window.__moss.nightwatch()?.paused)));
  await page.locator("[data-room-back='night']").click();
  await page.waitForTimeout(400);
  check("night back returns to panel", (await page.locator(".nw-panel").count()) > 0);
  check("battle unmounted", (await page.locator(".nw-board").count()) === 0);

  await page.goto(`${BASE}/#/town`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("deep link to town", await room("town").isVisible());
  check("deep link marks nav", (await page.locator(".room-btn.is-active .room-label").innerText()) === "镇口");
  await page.goBack();
  await page.waitForTimeout(500);
  check("browser back changes room", (await page.evaluate(() => location.hash)) !== "#/town");

  check("no console errors (desktop)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  const mobileErrors = [];
  mpage.on("pageerror", (error) => mobileErrors.push(String(error)));
  await mpage.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(700);
  const box = await mpage.locator(".room-nav").boundingBox();
  check("mobile nav is a bottom bar", Boolean(box) && box.y > 700 && Math.round(box.height) === 64, JSON.stringify(box));
  check("mobile page has no horizontal overflow",
    (await mpage.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  for (const label of ["镇口", "邮路", "守夜", "邮局"]) {
    await mpage.locator(".room-btn", { hasText: label }).click();
    await mpage.waitForTimeout(300);
    const visible = await mpage.locator(`section.room[data-room="${label === "邮局" ? "hall" : label === "镇口" ? "town" : label === "邮路" ? "routes" : "night"}"]`).isVisible();
    check(`mobile nav ${label}`, visible);
  }
  check("no console errors (mobile)", mobileErrors.length === 0, mobileErrors.slice(0, 3).join(" | "));
  await mobile.close();
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
