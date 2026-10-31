// Shared helpers for the Playwright end-to-end tests (headless Chromium + SwiftShader WebGL, loading index.html through file://).
import { chromium } from "playwright";
import path from "node:path"; import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const URL0 = "file://" + ROOT + "/index.html";
export async function launch({ width = 1280, height = 720, dpr = 1, touch = false } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); const errors = [], requests = [];
  page.setDefaultNavigationTimeout(120000);   // software WebGL compiles the landing scene's shaders slowly
  page.on("pageerror", e => errors.push("pageerror: " + e.message)); page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", r => { const u = r.url(); if (!u.startsWith("file:") && !u.startsWith("data:") && !u.startsWith("blob:")) requests.push(u); });
  return { browser, ctx, page, errors, requests };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// After an adventure ending the Archive may show the cinematic "relic recovered" dialog (only the first time a relic is earned).
// It sits on top of the ending screen, so tests dismiss it the way a player would (skip the animation, then Continue).
export async function closeReveal(page, wait = 4000) {
  const isNew = await page.evaluate(() => !!document.querySelector(".adv-end .relic-note.is-new, dialog.reveal"));
  if (isNew) { try { await page.waitForSelector("dialog.reveal", { timeout: wait }); } catch (e) { return; } }
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => { const d = document.querySelector("dialog.reveal"); if (!d) return false; const s = d.querySelector("[data-act=skip]:not([hidden])"); if (s) s.click(); const n = d.querySelector("[data-act=next]"); if (n && d.classList.contains("done")) n.click(); return true; });
    if (!open) return; await sleep(300);
  }
}
// v5: moving around the site is a cinematic journey (src/nav/). Tests wait for the journey to end before checking the result.
// Closing a legend/card overlay with its own UI returns through history.back(), which lands asynchronously (popstate).
// Until it lands the URL still reads #legend/<id> or #card/<id>: a reload in that window deep-links the overlay again.
// Wait for the real condition (overlay gone and URL back on a section) instead of a fixed delay.
export async function overlayClosed(page, timeout = 30000) {
  await page.waitForFunction(() => { const n = window.MOE3D && MOE3D.navigator; return !!n && !n.overlay && !n.busy && !/^#(legend|card)\//.test(location.hash); }, null, { timeout });
}
export async function navIdle(page, timeout = 120000) {
  await sleep(120);
  await page.waitForFunction(() => !(window.MOE3D && MOE3D.navigator && MOE3D.navigator.busy), null, { timeout }).catch(() => {});
  await sleep(150);
}
