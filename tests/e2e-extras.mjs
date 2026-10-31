// End-to-end tests of the v6 additions (headless Chromium + SwiftShader, file:// launch):
// seasons, the Archivist's journal, the valley's sounds, the sky chart, the page-sky compass, tilt, the postcard, the guided tour.
//   node tests/e2e-extras.mjs [screenshot-dir]
import { launch, URL0, sleep, navIdle } from "./e2e-lib.mjs"; import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = (page, n) => SH ? page.screenshot({ path: `${SH}/${n}.png`, timeout: 180000 }) : null;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ready = page => page.waitForFunction(() => window.MOE3D && MOE3D.hero && MOE3D.hero.isReady && MOE3D.hero.isReady(), null, { timeout: 300000, polling: 500 }).then(() => true, () => false);
const until = (page, f, arg, timeout = 60000) => page.waitForFunction(f, arg, { timeout, polling: 250 }).then(() => true, () => false);

/* ============================================================ A. a winter night: seasons, journal, sounds, sky chart, compass, postcard */
{
  const { browser, page, errors, requests } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0.replace("index.html", "index.html?season=winter&night=samhain&sky=2026-10-31T21:00Z")); ok(await ready(page), "valley built");
  const sk = await page.evaluate(() => MOE3D.hero.stats().sky);
  await page.evaluate(() => { window._crows = 0; addEventListener("moe:valley", e => { if (e.detail.type === "crow") window._crows++; }); });
  ok(sk && sk.season === "winter", "?season=winter gives the winter look (" + (sk && sk.season) + ")");
  ok(await until(page, () => /Winter/.test(document.querySelector(".hero-almanac").textContent) && /Samhain/.test(document.querySelector(".hero-almanac").textContent), null, 20000), "the caption names the season and the special night");
  ok(await until(page, () => MOE3D.journal.seen("night:samhain").n >= 1, null, 20000), "a special night is written in the Archivist's journal");
  await shot(page, "x1_winter");

  /* the valley's sounds: off by default, then they answer the valley's events */
  ok(await page.evaluate(() => !MOE3D.ui.ambientState().on), "sound is off by default");
  await page.evaluate(() => { dispatchEvent(new CustomEvent("moe:valley", { detail: { type: "crow", pan: 0.3 } })); });
  ok(await page.evaluate(() => !MOE3D.ui.ambientState().played.crow), "no sound is played while the sound is off");
  await page.click("#snd"); await sleep(400);
  ok(await page.evaluate(() => MOE3D.ui.ambientState().on), "the sound button switches the ambience on");
  await page.evaluate(() => { for (const t of ["crow", "wisp", "wisp-catch"]) dispatchEvent(new CustomEvent("moe:valley", { detail: { type: t, pan: -0.4 } })); dispatchEvent(new CustomEvent("moe:valley", { detail: { type: "water", k: 1 } })); dispatchEvent(new CustomEvent("moe:nav", { detail: { type: "start", name: "flight" } })); MOE3D.ui.cue("bell"); });
  const amb = await page.evaluate(() => MOE3D.ui.ambientState());
  ok(amb.played.crow === 1 && amb.played.wisp === 1 && amb.played["wisp-catch"] === 1 && amb.played.whoosh === 1 && amb.played.bell === 1, "crow, wisp chime, catch, whoosh and bell all play (" + JSON.stringify(amb.played) + ")");
  ok(amb.water === 1, "the lake's lapping follows the lantern over the water");
  await page.click("#snd"); await sleep(300);

  /* the journal: a forced event of the valley is noted after it has been on screen for a moment */
  await page.evaluate(() => MOE3D.hero.debug.trigger("ridge"));
  ok(await until(page, () => MOE3D.journal.seen("ridge").n >= 1, null, 120000), "the figure on the ridge, once seen, is written in the journal");
  ok(await until(page, () => /Archivist/.test(document.querySelector(".hero-almanac").textContent), null, 10000), "the caption says it was noted");
  const jn = await page.evaluate(() => ({ count: document.querySelector(".jn-count b").textContent, on: [...document.querySelectorAll(".jn-e.on")].map(e => e.dataset.entry), sealed: document.querySelectorAll(".jn-e:not(.on)").length }));
  ok(jn.on.includes("ridge") && jn.on.includes("night:samhain") && +jn.count === jn.on.length && jn.sealed === 9 - jn.on.length, "the journal in the Archive shows the sightings and sealed lines for the rest (" + JSON.stringify(jn) + ")");
  ok(await page.evaluate(() => !JSON.stringify(JSON.parse(localStorage.getItem("moe.archive.v1") || "{}")).includes("ridge")), "sightings stay out of the Archive's cards");

  /* the sky chart */
  await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
  await page.click(".hero-almanac"); ok(await until(page, () => !!document.querySelector("dialog.skychart[open]"), null, 10000), "clicking the caption opens the sky chart");
  const sc = await page.evaluate(() => ({ txt: document.querySelector("dialog.skychart").textContent, names: document.querySelectorAll("dialog.skychart .sc-name").length, dots: document.querySelectorAll("dialog.skychart circle").length }));
  ok(/Sunset/.test(sc.txt) && /Sunrise/.test(sc.txt) && /Moon(rise|set)/.test(sc.txt), "the chart gives sunset, sunrise and the Moon's rise or set");
  ok(sc.names >= 5 && sc.dots > 300, `the chart shows hundreds of stars and names the bright ones (${sc.names} names, ${sc.dots} dots)`);
  const cd = await page.evaluate(() => { const d = MOE3D.ui.chartData(MOE3D.hero.sky()); return { set: d.sunset && d.sunset.at, rise: d.sunrise && d.sunrise.at, named: d.named.map(s => s.name) }; });
  ok(cd.set && cd.rise && +cd.set.slice(0, 2) >= 16 && +cd.set.slice(0, 2) <= 17 && +cd.rise.slice(0, 2) === 7, `the Brocken on 31 Oct: sunset ~16:5x, sunrise ~07:0x (got ${cd.set}, ${cd.rise})`);
  ok(cd.named.includes("Capella") && cd.named.includes("Vega"), "Capella and Vega are up on an October evening");
  await shot(page, "x2_skychart");
  await page.keyboard.press("Escape"); ok(await until(page, () => !document.querySelector("dialog.skychart[open]"), null, 5000), "Esc closes the chart");

  /* the compass of the page sky */
  const cp = await page.evaluate(() => ({ ...MOE3D.ui.pageSky().compass(), vw: innerWidth, vh: innerHeight }));
  ok(["N", "E", "S", "W"].every(k => cp[k] && cp[k][0] >= 0 && cp[k][0] <= cp.vw && cp[k][1] >= 0 && cp[k][1] <= cp.vh) && cp.N[1] < cp.S[1] && cp.E[0] < cp.W[0], "the page sky has N/E/S/W at its edges (north up, east on the left)");

  /* tilt (simulated): the lantern follows the phone's tilt */
  await page.evaluate(() => { MOE3D.ui.setTilt(true); MOE3D.ui._tiltOrient(40, 0); });
  const tilt = async (b, g) => { for (let i = 0; i < 80; i++) { const x = await page.evaluate(() => { const m = /translate3d\(([-\d.]+)px/.exec(document.querySelector(".lantern").style.transform); return m ? +m[1] : null; }); if (x != null && (g < 0 ? x < 400 : x > 880)) break; await page.evaluate(([b, g]) => MOE3D.ui._tiltOrient(b, g), [b, g]); await sleep(150); } return page.evaluate(() => { const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(document.querySelector(".lantern").style.transform); return m ? [+m[1], +m[2]] : null; }); };
  const l1 = await tilt(40, -18), l2 = await tilt(40, 18);
  ok(l1 && l2 && l2[0] - l1[0] > 200, `tipping the phone left/right moves the lantern across the valley (${l1} -> ${l2})`);
  await page.evaluate(() => MOE3D.ui.setTilt(false));

  /* the postcard */
  const pc = await page.evaluate(async () => { const c = await MOE3D.ui.drawPostcard(MOE3D.hero); if (!c) return null; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; n++; } return { w: c.width, h: c.height, mean: s / n, sd: Math.sqrt(s2 / n - (s / n) ** 2) }; });
  ok(pc && pc.w === 1500 && pc.h === 1000 && pc.sd > 8 && pc.mean > 8, "the postcard is a 1500x1000 picture of the valley (" + JSON.stringify(pc) + ")");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }).catch(() => null), page.click(".hero-postcard")]);
  ok(dl && /^mysteries-of-europe-postcard-2026-10-31\.png$/.test(dl.suggestedFilename()), "the Postcard button downloads a dated PNG (" + (dl && dl.suggestedFilename()) + ")");
  if (dl && SH) await dl.saveAs(`${SH}/x3_postcard.png`);

  /* v9.1: looking up at tonight's real sky (the Moon, or the stars when it is down) and back */
  await page.click(".hero-gaze");
  ok(await until(page, () => document.querySelector(".hero").classList.contains("gazing") && MOE3D.hero.gazing(), null, 10000), "“Look at the sky” tilts the view up");
  ok(await until(page, () => /real (Moon|stars) over the Brocken/.test(document.querySelector(".hero-almanac").textContent), null, 10000), "the caption speaks of tonight's real Moon or stars (" + await page.evaluate(() => document.querySelector(".hero-almanac").textContent) + ")");
  ok(await until(page, () => document.querySelectorAll(".sky-marks .sm").length > 0, null, 180000), "the Moon and the bright stars in view are named (" + await page.evaluate(() => [...document.querySelectorAll(".sky-marks .sm")].map(e => e.textContent).join(", ")) + ")");
  if (SH) await page.screenshot({ path: `${SH}/x3b_sky.png` });
  await page.mouse.click(640, 300);
  ok(await until(page, () => !document.querySelector(".hero").classList.contains("gazing") && /Look at the sky/.test(document.querySelector(".hero-gaze").textContent), null, 10000), "a click on the sky goes back to the valley");
  ok(await until(page, () => !MOE3D.hero.gazing(), null, 180000), "…and the camera comes back down");

  await page.evaluate(() => scrollTo(0, 0));
  ok(await until(page, () => window._crows >= 1, null, 240000), "the valley sends its own crows over the keep while it is on screen");
  const real = errors.filter(e => !/GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no JS errors: " + real.join(" | "));
  ok(requests.length === 0, "nothing loaded from the network");
  await browser.close();
}

/* ============================================================ B. the guided tour */
{
  const { browser, page, errors } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0.replace("index.html", "index.html?tour")); ok(await ready(page), "valley built for the tour");
  ok(await until(page, () => !!document.querySelector(".tour-cap.on"), null, 60000), "?tour starts the guided tour with a caption");
  ok(await until(page, () => location.hash === "#mappe", null, 180000), "the tour flies to the map by itself");
  ok(await until(page, () => location.hash === "#leggende", null, 240000), "…then to the legends");
  ok(await until(page, () => Object.values(MOE3D.ui.pageSky().state()).some(v => v > 0.3), null, 30000), "…where it draws the legends' constellations");
  ok(await until(page, () => location.hash === "#archivio", null, 240000), "…then the Archive");
  ok(await until(page, () => (location.hash === "#intro" || location.hash === "") && MOE3D.hero.stats().castle && MOE3D.hero.stats().castle.animating, null, 300000), "…and back to the valley for a preview of the castle's finale");
  ok(await page.evaluate(() => !(JSON.parse(localStorage.getItem("moe.castle.v1") || "{}").finale)), "the preview saves nothing (the real finale is still to be earned)");
  await navIdle(page); await page.keyboard.press("x"); await sleep(800);
  ok(await page.evaluate(() => !document.querySelector(".tour-cap") && !document.documentElement.classList.contains("touring") && !MOE3D.ui.tourActive()), "any key leaves the tour");
  // the button starts it too, and a click leaves it
  await page.evaluate(() => MOE3D.navigator.go("#intro")); await navIdle(page);
  ok(await page.evaluate(() => !!document.querySelector(".hero-tour")), "the landing has a Guided tour button");
  await page.click(".hero-tour"); ok(await until(page, () => MOE3D.ui.tourActive(), null, 5000), "the button starts the tour");
  await sleep(1500); await page.mouse.click(640, 300); await sleep(600);
  ok(await page.evaluate(() => !MOE3D.ui.tourActive()), "a click leaves it");
  const real = errors.filter(e => !/GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no JS errors during the tour: " + real.join(" | "));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL V6 EXTRAS E2E CHECKS PASSED"); process.exit(fails ? 1 : 0);
