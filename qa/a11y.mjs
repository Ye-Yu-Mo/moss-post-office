// Accessibility regressions for the night room and shared dialogs.
// Runs at 320px (smallest supported phone) and 390px.

import { chromium } from "playwright";

const BASE = process.env.MOSS_QA_BASE || "http://127.0.0.1:17331";
const results = [];
const failures = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${BASE}/#qa`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Help is long and has no footer buttons: the X must be the visible way out.
    await page.click("#helpBtn");
    await page.waitForTimeout(350);
    const close = await page.evaluate(() => {
      const button = document.getElementById("modalClose");
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return {
        hidden: button.hidden,
        inView: rect.width > 0 && rect.height > 0 &&
          rect.top >= 0 && rect.left >= 0 &&
          rect.bottom <= innerHeight && rect.right <= innerWidth
      };
    });
    check(`[${width}] help close button is visible`, Boolean(close && !close.hidden && close.inView), JSON.stringify(close));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Result card must not be clipped inside the fixed-ratio board.
    await page.evaluate(() => window.__moss.openNightWatch());
    await page.waitForTimeout(350);
    await page.evaluate(() => window.__moss.nightwatchWin());
    await page.waitForTimeout(350);
    const overlay = await page.evaluate(() => {
      const card = document.querySelector(".nw-overlay-done");
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const closeButton = Array.from(card.querySelectorAll("button"))
        .find((button) => button.textContent.includes("收工"));
      const buttonRect = closeButton ? closeButton.getBoundingClientRect() : null;
      return {
        role: card.getAttribute("role"),
        labelled: card.getAttribute("aria-labelledby"),
        focused: document.activeElement === card,
        onScreen: rect.top >= 0 && rect.bottom <= innerHeight,
        closeVisible: Boolean(buttonRect) && buttonRect.top >= 0 &&
          buttonRect.bottom <= innerHeight
      };
    });
    check(`[${width}] result is a focused dialog`,
      Boolean(overlay && overlay.role === "dialog" && overlay.labelled && overlay.focused),
      JSON.stringify(overlay));
    check(`[${width}] result and 收工 are not clipped`,
      Boolean(overlay && overlay.onScreen && overlay.closeVisible),
      JSON.stringify(overlay));
    const closed = await page
      .locator(".nw-overlay-done button", { hasText: "收工" })
      .click()
      .then(() => page.waitForTimeout(250))
      .then(async () => (await page.locator(".nw-overlay-done").count()) === 0)
      .catch(() => false);
    check(`[${width}] 收工 closes the result`, closed);

    // Roving tablist: arrow keys move 守夜 → 档案 and the panel follows.
    await page.goto(`${BASE}/#night`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.locator("#nw-tab-watch").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    const tabs = await page.evaluate(() => ({
      selected: document.getElementById("nw-tab-archive").getAttribute("aria-selected"),
      focused: document.activeElement.id,
      panel: Boolean(document.getElementById("nw-panel-archive"))
    }));
    check(`[${width}] night tabs support arrow keys`,
      tabs.selected === "true" && tabs.focused === "nw-tab-archive" && tabs.panel,
      JSON.stringify(tabs));

    check(`[${width}] no horizontal overflow`,
      (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
    check(`[${width}] no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await context.close();
  }

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
