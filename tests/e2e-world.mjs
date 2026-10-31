// End-to-end test of v5: the living landing valley and the cinematic navigation (headless Chromium, file:// launch).
//   node tests/e2e-world.mjs [screenshot-dir]
// Covers: real sky caption + special night override, castle windows tied to the Archive (first light once, persistent,
// finale), lake anomalies, lantern, wisp -> secret card (once), presences, page sky + constellations (hover, keyboard,
// touch star), every journey between sections (forward and back), overlays in the URL, deep links, Back/Forward,
// no stuck transitions, reduced motion, phone layout.
import { launch, URL0, sleep, navIdle } from "./e2e-lib.mjs"; import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const shot = (page, n) => SH ? page.screenshot({ path: `${SH}/${n}.png`, timeout: 180000 }).catch(e => console.log("note: screenshot skipped (" + e.message.split("\n")[0] + ")")) : null;
const ready = page => page.waitForFunction(() => window.MOE3D && MOE3D.hero && MOE3D.hero.isReady && MOE3D.hero.isReady(), null, { timeout: 120000 }).then(() => true, () => false);
const st = page => page.evaluate(() => ({ hash: location.hash, sec: MOE3D.navigator.current(), busy: MOE3D.navigator.busy, last: MOE3D.navigator.log().slice(-1)[0] || null }));

/* ============================================================ A. the valley (desktop) */
{
  const { browser, page, errors, requests } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0 + "?sky=2026-10-31T22:30:00Z"); ok(await ready(page), "the 3D valley is built");
  const s = await page.evaluate(() => MOE3D.hero.stats());
  ok(s.sky && /Brocken/.test(s.sky.caption) && s.sky.night === "samhain" && !s.sky.live, `the sky of a chosen date: Samhain night over the Brocken (${s.sky && s.sky.caption})`);
  ok(await page.evaluate(() => /Samhain/.test(document.querySelector(".hero-almanac").textContent)), "the caption names the special night");
  ok(s.sky.fraction > 0.4 && s.sky.fraction < 0.8 && /gibbous|quarter/i.test(s.sky.phase), `the real phase of that night (${s.sky.phase}, ${s.sky.fraction})`);
  ok(s.castle && s.castle.lit.length === 0 && !s.castle.finale, "a new visitor: no Archive window lit in the castle");
  /* lake anomalies, presences */
  for (const ev of ["ruin", "figure", "redmoon", "veil", "ridge"]) {
    const started = await page.evaluate(n => MOE3D.hero.debug.trigger(n), ev); await sleep(500);
    const cur = await page.evaluate(() => MOE3D.hero.stats().event);
    ok(started && cur === ev, `the valley can show the "${ev}" event`);
  }
  await sleep(2500); await shot(page, "v1_valley_events");
  /* lantern */
  await page.mouse.move(700, 520, { steps: 6 }); await sleep(1200);
  ok(await page.evaluate(() => { const l = document.querySelector(".lantern"); return !!l && +getComputedStyle(l).opacity > 0.5 && document.getElementById("intro").classList.contains("has-lantern"); }), "the cursor becomes a lantern over the valley");
  await shot(page, "v2_lantern");
  /* wisp -> secret card */
  await page.mouse.move(40, 120); await sleep(600);   // the lantern away: wisps are shy
  ok(await page.evaluate(() => MOE3D.hero.debug.summonWisp() > 0), "a will-o'-the-wisp appears in the forest");
  let w = null; for (let i = 0; i < 16 && !w; i++) { await sleep(500); w = await page.evaluate(() => MOE3D.hero.debug.wisps().find(x => x.on && x.a > 0.15)); }
  ok(!!w, "the wisp is on screen"); if (w) await page.mouse.click(w.x, w.y); await sleep(1500);
  ok(await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("moe.archive.v1") || "{}"); return !!(a.secrets && a.secrets.wisp && a.cards["secret-wisp"]); }), "catching it unlocks the secret card (saved)");
  ok(await page.waitForSelector("dialog.reveal[open]", { timeout: 8000 }).then(() => true, () => false) && /Secret found/i.test(await page.textContent(".rv-kicker")), "the secret is revealed with its own card");
  await page.evaluate(() => { const d = document.querySelector("dialog.reveal"); d && d.querySelector("[data-act=skip]")?.click(); }); await sleep(300); await page.evaluate(() => document.querySelector('.reveal [data-act="next"]')?.click()); await sleep(400);
  await page.evaluate(() => MOE3D.hero.debug.summonWisp()); await sleep(1500); const caught2 = await page.evaluate(() => MOE3D.hero.debug.catchWisp()); await sleep(1200);
  ok(caught2 && await page.evaluate(() => !document.querySelector("dialog.reveal") && Object.keys(JSON.parse(localStorage.getItem("moe.archive.v1")).cards).filter(k => k === "secret-wisp").length === 1), "a second wisp gives no second card");
  ok(await page.evaluate(() => /already in your Archive/.test(document.querySelector(".hero-almanac").textContent)), "…and says so");
  /* castle windows follow the Archive (wait for the secret window's first light) */
  await page.waitForFunction(() => { const c = MOE3D.hero.stats().castle; return c && c.shown.includes("secret-wisp"); }, null, { timeout: 120000, polling: 1000 }).catch(() => {});
  const c1 = await page.evaluate(() => MOE3D.hero.stats().castle);
  ok(c1.lit.includes("secret-wisp") && c1.shown.includes("secret-wisp"), "the secret lights its own window, once (first light is remembered)");
  ok(errors.length === 0, "no JS errors in the valley: " + errors.join(" | ")); ok(requests.length === 0, "nothing loaded from the network");
  await browser.close();
}

/* ============================================================ B. progress lights the castle; the finale plays once */
{
  const { browser, page, errors } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    sessionStorage.setItem("moe.intro", "1");
    if (!localStorage.getItem("moe.test.seeded")) {
      localStorage.setItem("moe.test.seeded", "1");
      localStorage.setItem("moe.woolpit.endings.v1", JSON.stringify({ servant: 1, both: 1, bells: 1, font: 1, omen: 1, ink: 1 }));
      localStorage.setItem("moe.skye.endings.v1", JSON.stringify({ peace: 1, other: 1, stay: 1, leave: 1 }));
      localStorage.setItem("moe.archive.v1", JSON.stringify({ textEnds: { "hoia:d": 1, "hoia:e": 1 } }));
      localStorage.setItem("moe.hoia.endings.v1", JSON.stringify({ lights: 1, shepherd: 1 }));
      localStorage.setItem("moe.babayaga.endings.v1", JSON.stringify({ lantern: 1, flight: 1, stay: 1, leave: 1 }));
      localStorage.setItem("moe.sibilla.endings.v1", JSON.stringify({ dance: 1, return: 1, knowledge: 1, kingdom: 1 }));
      localStorage.setItem("moe.sibilla.finds.v1", JSON.stringify({ notebook: 1 }));
      localStorage.setItem("moe.bathory.endings.v1", JSON.stringify({ monster: 1, conspiracy: 1, unanswered: 1, palatine: 1 }));
      localStorage.setItem("moe.bathory.finds.v1", JSON.stringify({ letter: 1 }));
    }
  });
  await page.goto(URL0); ok(await ready(page), "valley built with a complete Archive");
  ok(await page.waitForFunction(() => { const c = MOE3D.hero.stats().castle; return c && c.finale; }, null, { timeout: 300000, polling: 1000 }).then(() => true, () => false), "every relic recovered: the castle's finale starts");
  ok(await page.evaluate(() => /Archive is complete/.test(document.querySelector(".hero-almanac").textContent)), "the finale has its caption");
  await sleep(5000); await shot(page, "v3_finale");
  await page.waitForFunction(() => !MOE3D.hero.stats().castle.animating, null, { timeout: 300000, polling: 1000 }).catch(() => {});
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("moe.castle.v1")));
  ok(saved.finale > 0 && Object.keys(saved.shown).length >= 37, "the windows and the finale are remembered (moe.castle.v1)");
  await page.reload(); ok(await ready(page), "valley rebuilt after a reload"); await sleep(3000);
  const c2 = await page.evaluate(() => MOE3D.hero.stats().castle);
  ok(c2.finale && !c2.animating && c2.pending === 0 && c2.lit.length >= 37, "after a reload the castle is simply lit: no animation repeats");
  ok(errors.length === 0, "no JS errors: " + errors.join(" | "));
  await browser.close();
}

/* ============================================================ C. the journeys */
{
  const { browser, page, errors } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0); ok(await ready(page), "ready for the journeys");
  ok(await page.evaluate(() => !!document.querySelector("canvas.page-sky")), "the night sky is drawn behind the whole site");
  const step = async (label, act, check) => { await act(); await sleep(300); await navIdle(page, 180000); const s = await st(page); ok(check(s), `${label} -> ${JSON.stringify({ hash: s.hash, via: s.last && s.last.name })}`); return s; };
  await step("Enter the Archive: the flight to the map", () => page.click(".hero-cta .btn-primary"), s => s.hash === "#mappe" && s.last.name === "flight" && s.sec.id === "mappe");
  ok(await page.evaluate(() => !document.getElementById("intro").classList.contains("flying") && !document.querySelector(".flight-map") && !document.querySelector(".flight-skip")), "the flight leaves nothing behind");
  ok(await page.evaluate(() => !!document.querySelector("#map .home")), "the castle's valley is marked on the map");
  await step("Back: the landing into the valley", () => page.goBack(), s => (s.hash === "#intro" || s.hash === "") && s.last.name === "landing" && s.sec.id === "intro");
  await step("Forward: the flight again", () => page.goForward(), s => s.hash === "#mappe" && s.last.name === "flight");
  await step("the castle on the map: back to the valley", () => page.evaluate(() => document.querySelector("#map .home").dispatchEvent(new MouseEvent("click", { bubbles: true }))), s => s.hash === "#intro" && s.last.name === "landing");
  await step("Discover the legends: the ascent into the sky", () => page.click(".hero-cta .btn-ghost"), s => s.hash === "#leggende" && s.last.name === "ascent");
  /* constellations */
  await page.mouse.move(5, 300); await sleep(400); await page.hover('.card[data-legend="woolpit"] .cf-body');
  const hov = await page.waitForFunction(() => MOE3D.ui.pageSky().state().woolpit > 0.5 && document.getElementById("cards").classList.contains("sky-focus"), null, { timeout: 8000, polling: 200 }).then(() => true, () => false);
  ok(hov, "hovering a legend card draws its constellation; the other cards step back");
  await shot(page, "v4_constellation");
  await page.mouse.move(5, 300); await sleep(2200); ok(await page.evaluate(() => MOE3D.ui.pageSky().state().woolpit < 0.2), "…and it fades when the pointer leaves");
  await page.focus('.card[data-legend="skye"]'); ok(await page.waitForFunction(() => MOE3D.ui.pageSky().state().skye > 0.5, null, { timeout: 8000, polling: 200 }).then(() => true, () => false), "keyboard focus shows the constellation too");
  await page.evaluate(() => document.activeElement.blur());
  await step("menu Archive: a passage through the mist", () => page.click('#menu a:has-text("Archive")'), s => s.hash === "#archivio" && s.last.name === "passage");
  await step("an Archive card lifts into the inspector", () => page.click("#archive-grid .acard.is-got >> nth=0"), s => /^#card\//.test(s.hash) && s.last.name === "cardOpen");
  ok(await page.evaluate(() => !!document.querySelector("dialog.inspect[open]")), "the inspector is open");
  await step("Back closes it (the card flies home)", () => page.goBack(), s => s.hash === "#archivio" && s.last.name === "cardClose");
  ok(await page.evaluate(() => !document.querySelector("dialog.inspect[open]")), "the inspector is closed");
  await step("menu Legends: a passage upwards", () => page.click('#menu a:has-text("Legends")'), s => s.hash === "#leggende" && s.last.name === "passage");
  await step("a legend opens through a portal", () => page.click('.card[data-legend="hoia"]'), s => s.hash === "#legend/hoia" && s.last.name === "portal");
  ok(await page.evaluate(() => !document.getElementById("adv").hidden && !!document.querySelector(".adv-title")), "the Hoia adventure's title screen is open");
  await step("its 'Back to the legends' button folds the portal back", () => page.click('.adv-title button[data-k="exit"]'), s => s.hash === "#leggende");
  await ready(page);
  await step("the 3D adventure opens through a portal", () => page.click('.card[data-legend="skye"]'), s => s.hash === "#legend/skye" && s.last.name === "portal");
  ok(await page.evaluate(() => !document.getElementById("adv").hidden), "the adventure is on screen");
  await step("Back leaves the adventure, back into its card", () => page.goBack(), s => s.hash === "#leggende" && s.last.name === "portalClose");
  ok(await page.evaluate(() => document.getElementById("adv").hidden && !document.body.classList.contains("adv-open")), "the adventure is closed and disposed");
  await step("the map pin of a legend opens it from the map", async () => { await page.evaluate(() => MOE3D.navigator.go("#mappe")); await navIdle(page, 180000); await page.evaluate(() => document.querySelector('#map .pin').dispatchEvent(new MouseEvent("click", { bubbles: true }))); }, s => /^#legend\//.test(s.hash) && s.last.name === "portal");
  await page.goBack(); await sleep(300); await navIdle(page, 180000);
  await ready(page);   // the valley is rebuilt a moment after an adventure closes; the descent needs it
  await step("menu Introduction: the descent from the sky", () => page.click('#menu a:has-text("Introduction")'), s => (s.hash === "#intro" || s.hash === "") && /descent|landing/.test(s.last.name));
  /* rapid clicks: no stuck or overlapping journeys */
  await page.evaluate(() => { for (const id of ["leggende", "archivio", "giochi", "mappe"]) document.querySelector(`#menu a[href="#${id}"]`).click(); });
  await navIdle(page, 240000); const s2 = await st(page);
  ok(!s2.busy && s2.hash === "#mappe", "a burst of clicks ends at the last destination, nothing stuck");
  ok(await page.evaluate(() => !document.querySelector(".passage,.portal,.flight-map,.flying-card") && !document.documentElement.classList.contains("nav-busy")), "no transition layer left on screen");
  ok(errors.length === 0, "no JS errors during the journeys: " + errors.join(" | "));
  await browser.close();
}

/* ============================================================ D. deep links, reduced motion, phone */
{
  const { browser, page, errors } = await launch({ width: 1280, height: 720 });
  await page.goto(URL0 + "#legend/hoia"); await page.waitForSelector(".adv-title", { timeout: 120000 }).catch(() => {});
  ok(await page.evaluate(() => /Hoia/.test((document.querySelector(".adv-title h2") || {}).textContent || "")), "#legend/hoia opens the legend directly");
  await page.goto(URL0 + "#card/legend-woolpit"); await page.waitForSelector("dialog.inspect[open]", { timeout: 60000 }).catch(() => {});
  ok(await page.evaluate(() => !!document.querySelector("dialog.inspect[open]")), "#card/<id> opens the Archive inspector directly");
  await browser.close();
}
{
  const { browser, ctx, page, errors } = await launch({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(URL0); await page.waitForSelector("#cards .card");
  // v9.1: measure the journey itself (navigator start -> end), once the page has finished starting up. Right after load,
  // software rasterisation stalls single frames for 1.5-2 s (first paint of the page and of the destination section), and
  // a 140 ms + 160 ms cross-fade that waits for two frames then measured 9-13 s although nothing in it is slow.
  await ready(page); await sleep(2500);
  const t0 = Date.now(); await page.click('#menu a:has-text("Archive")'); await navIdle(page);
  const s = await st(page); ok(s.hash === "#archivio" && s.last.name === "fade" && s.last.ms < 6000, `reduced motion: moves are short cross-fades (${s.last && s.last.name}, journey ${s.last && s.last.ms} ms, ${Date.now() - t0} ms with the click)`);
  ok(errors.length === 0, "no JS errors with reduced motion");
  await browser.close();
}
{
  const { browser, page, errors } = await launch({ width: 390, height: 780, dpr: 2, touch: true });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0); await page.waitForSelector("#cards .card"); await ready(page);
  // v9.1: the lantern fades in over a few rendered frames (its level is advanced by the valley's render loop, then a 0.25 s
  // CSS transition). Under software WebGL a phone-sized valley renders ~1.4 frames/s, so a fixed 900 ms wait failed
  // although the lantern does appear (measured: ~4.5 s here, i.e. 4-6 frames). Wait for it, up to 15 s.
  await page.touchscreen.tap(250, 560);
  ok(await page.waitForFunction(() => +getComputedStyle(document.querySelector(".lantern")).opacity > 0.3, null, { timeout: 15000, polling: 100 }).then(() => true, () => false), "phone: the lantern follows the finger");
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(600);
  const star = await page.$('.card[data-legend="hoia"] .cf-star'); ok(!!star, "phone: each legend card has a star button");
  if (star) { await star.scrollIntoViewIfNeeded(); await sleep(300); await star.tap(); }
  const shown = await page.waitForFunction(() => MOE3D.ui.pageSky().state().hoia > 0.5, null, { timeout: 8000, polling: 200 }).then(() => true, () => false);
  ok(shown && await page.evaluate(() => !document.getElementById("story").open), "phone: tapping the star shows the constellation without opening the legend");
  await page.tap('.card[data-legend="hoia"] .cf-body'); await sleep(300); await navIdle(page);
  ok(await page.waitForFunction(() => !!document.querySelector(".adv-title"), null, { timeout: 60000 }).then(() => true, () => false), "phone: tapping the card opens the legend");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "phone: no horizontal scroll");
  await shot(page, "v5_phone");
  ok(errors.length === 0, "no JS errors on the phone: " + errors.join(" | "));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL WORLD + NAVIGATION E2E CHECKS PASSED"); process.exit(fails ? 1 : 0);
