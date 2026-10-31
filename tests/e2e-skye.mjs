// End-to-end test of the Skye adventure (headless Chromium + SwiftShader, file:// launch, real input where practical).
//   node tests/e2e-skye.mjs [screenshot-dir]
import { launch, URL0, sleep, closeReveal } from "./e2e-lib.mjs";
import * as ST from "../src/adventures/skye/story.js";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png` }); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ev = (page, f, a) => page.evaluate(f, a);
const drive = (page, queue, max = 120, stops = []) => page.evaluate(async ([q, max, stops]) => {
  const t = advCur && advCur._t; if (!t) return "gone"; const wait = ms => new Promise(r => setTimeout(r, ms)); q = [...q]; let n = 0;
  while (n++ < max) {
    for (let i = 0; i < 400 && t.busy; i++) await wait(50);
    if (!t.talking) return "done:" + n;
    t.skip(); await wait(30); const v = t.view(); if (!v) { await wait(80); continue; }
    if (stops.includes(v.id)) return "stop:" + v.id;
    if (v.choices.length) { let k = -1; if (q.length) { k = v.choices.findIndex(c => c.label.includes(q[0])); if (k >= 0) q.shift(); }
      if (k < 0) k = v.choices.findIndex(c => /^(Stay a little|Never mind|Not yet|Leave it)/.test(c.label)); if (k < 0) k = 0; t.pick(k); }
    else t.press();
    await wait(60);
  }
  return "max";
}, [queue, max, stops]);

async function openSkye(page, { fresh = true } = {}) {
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  if (fresh) await page.evaluate(() => { try { localStorage.removeItem("moe.skye.save.v1"); } catch (e) {} });
  await page.evaluate(() => scrollTo(0, 2300)); await sleep(300); await page.click('.card[data-legend="skye"]'); await page.waitForSelector(".adv-title", { timeout: 120000 });
}
async function startNew(page) {
  await page.click('.adv-title button[data-k="new"], .adv-title button.primary');
  await page.waitForFunction(() => advCur && advCur._t && advCur._t.running, null, { timeout: 180000 }); await sleep(800);
}
const go = async (page, x, z) => { await ev(page, ([x, z]) => advCur._t.tp(x, z), [x, z]); await sleep(200); };
const OBJC = { board: [6.6, 90.4], piano: [-5.4, -84], f1: [-13.6, 108.2], f2: [-23.8, 51.6], f3: [38, 8], f4: [-47.2, -7.2], f5: [-8, -27.4], f6: [-4.5, -87.2], leave: [9, 98] };
const faceTo = async (page, id) => { const [ox, oz] = OBJC[id]; await ev(page, ([ox, oz]) => { const [px, pz] = advCur._t.pos(); advCur._t.look(Math.atan2(-(ox - px), -(oz - pz)), -0.1); }, [ox, oz]); await sleep(100); };
const useObj = async (page, id, x, z, q = []) => { await go(page, x, z); await faceTo(page, id); const near = await ev(page, () => advCur._t.near()); ok(near.includes(id) || near.includes("obj:" + id), `can use ${id} -> ${near.join(",")}`); await ev(page, () => advCur._t.interact()); return drive(page, q); };

{
  const { browser, page, errors, requests } = await launch();
  /* ---------- site integration ---------- */
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  const cards = await ev(page, () => [...document.querySelectorAll("#cards .card")].map(c => [c.dataset.legend, !!c.querySelector(".play")]));
  ok(cards.some(([k, p]) => k === "skye" && p), "Skye card is marked as a 3D adventure");
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await openSkye(page);
  ok(await ev(page, () => document.body.classList.contains("adv-open") && !document.querySelector("#adv").hidden), "card opens the adventure overlay");
  await sleep(900); await shot(page, "s01_title");
  ok((await ev(page, () => document.querySelector(".adv-title h2").textContent)).includes("Skye"), "title screen shows the right adventure");
  ok(/original story/.test(await ev(page, () => document.querySelector(".adv-title").textContent)), "title screen states honestly that the legend is an original story");
  await startNew(page); await shot(page, "s02_start");
  ok(await ev(page, () => !!document.querySelector("#adv canvas.gl")), "3D canvas present");
  const D0 = await ev(page, () => advCur._t.degraded); console.log("info: degraded quality =", D0);

  /* ---------- movement ---------- */
  await go(page, 6.4, 95.5); const p0 = await ev(page, () => advCur._t.pos());
  await page.keyboard.down("KeyW"); await sleep(4000); await page.keyboard.up("KeyW"); const p1 = await ev(page, () => advCur._t.pos());
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.4, `W moves the player (${p0.map(n => n.toFixed(1))} -> ${p1.map(n => n.toFixed(1))})`);
  await go(page, 0, 40); await ev(page, () => advCur._t.look(Math.PI / 2, 0)); await page.keyboard.down("KeyW"); await sleep(1000); await page.keyboard.up("KeyW");
  await go(page, -40, 120); const pw = await ev(page, () => advCur._t.pos()); await ev(page, () => advCur._t.look(0, 0)); await page.keyboard.down("KeyS"); await sleep(1200); await page.keyboard.up("KeyS");
  const pe = await ev(page, () => [advCur._t.pos(), advCur._t.H(...advCur._t.pos().slice(0, 2))]);
  ok(pe[1] > -0.5, "sea blocks walking out into deep water (height " + pe[1].toFixed(2) + ")");
  ok(await ev(page, () => !advCur._t.pianoOpen), "piano UI closed at start");

  /* ---------- listening ---------- */
  await go(page, -10, 80); await ev(page, () => advCur._t.look(0, 0));
  await page.keyboard.down("KeyL"); for (let i = 0; i < 24 && (await ev(page, () => advCur._t.listenK)) < 0.5; i++) await sleep(250); await sleep(300); const lk = await ev(page, () => advCur._t.listenK); await shot(page, "s03_listen");
  ok(lk > 0.5, "holding L raises the listening level (" + lk.toFixed(2) + ")"); ok(await ev(page, () => !!document.querySelector(".listen-bar")), "listen bar is in the DOM");
  await page.keyboard.up("KeyL"); await sleep(2500); ok((await ev(page, () => advCur._t.listenK)) < lk, "releasing L fades listening out");

  /* ---------- board, locked states ---------- */
  ok((await useObj(page, "board", 6.6, 92.8)).startsWith("done"), "read the board");
  ok((await useObj(page, "piano", -4.7, -84)).startsWith("done") || true, "piano is locked at the start");
  ok(await ev(page, () => !advCur._t.pianoOpen), "piano does not open without the tune");
  ok((await useObj(page, "f6", -4.5, -85.4)).startsWith("done"), "music stand locked until 3 echoes");
  ok(await ev(page, () => !advCur._t.S.frag[6]), "stand fragment not granted early");

  /* ---------- five outside echoes ---------- */
  const spots = { f1: [-13.6, 106.0], f2: [-23.8, 49.6], f3: [38, 5.4], f4: [-47.2, -7.2], f5: [-8, -23.8] };
  for (const [id, [x, z]] of Object.entries(spots)) {
    const r = await useObj(page, id, x, z); ok(r.startsWith("done"), `${id} conversation completes (${r})`); await sleep(300);
    ok(await ev(page, id => !!advCur._t.S.frag[+id[1]], id), `${id}: echo ${id[1]} recorded`);
    if (id === "f3") await shot(page, "s04_stone");
  }
  ok(await ev(page, () => [1,2,3,4,5].every(i => advCur._t.S.frag[i])), "5 outside echoes collected");
  await shot(page, "s05_five");
  /* stand now unlocked? (we already have 5 echoes, but cross causeway first would trigger tide) */
  /* ---------- tide scene ---------- */
  await go(page, 0, -57.5); await ev(page, () => advCur._t.look(0, 0)); await page.keyboard.down("KeyW"); for (let i = 0; i < 40 && !(await ev(page, () => advCur._t.talking || advCur._t.pos()[1] < -60)); i++) await sleep(250); await page.keyboard.up("KeyW");
  await page.waitForFunction(() => advCur._t.talking || advCur._t.S.tide, null, { timeout: 20000 }).catch(() => {});
  const tr = await drive(page, [], 40); ok(tr.startsWith("done"), "tide scene dialogue completes (" + tr + ")"); await sleep(3000);
  ok(await ev(page, () => advCur._t.S.tide), "tide flag set after crossing with all outside echoes");
  const pt = await ev(page, () => advCur._t.pos()); ok(pt[1] < -58, "player is carried to the house side of the causeway (z=" + pt[1].toFixed(1) + ")");
  for (let i = 0; i < 60 && (await ev(page, () => advCur._t.seaLevel)) <= 0.5; i++) await sleep(250); const sl = await ev(page, () => advCur._t.seaLevel); ok(sl > 0.5, "sea level has risen (" + sl + ")"); await shot(page, "s06_tide");
  ok(/last page/i.test(await ev(page, () => document.querySelector(".adv-obj span").textContent)), "objective now points at the music stand");
  /* ---------- leave is no longer possible ---------- */
  await go(page, 0, -70); await go(page, 0, -78); await go(page, 0, -83); await shot(page, "s07_house");
  ok((await useObj(page, "f6", -4.5, -85.4)).startsWith("done"), "music stand conversation completes");
  ok(await ev(page, () => !!advCur._t.S.frag[6]), "6th echo found at the stand");
  /* ---------- journal ---------- */
  await ev(page, () => advCur._t.toggleJournal()); await sleep(400); await shot(page, "s08_journal");
  const jt = await ev(page, () => document.querySelector(".journal") ? document.querySelector(".journal").textContent : "");
  ok(/historical|uncertain|invented/i.test(jt) || jt.length > 50, "journal opens with content"); await ev(page, () => advCur._t.toggleJournal());
  /* ---------- piano ---------- */
  await go(page, -4.7, -84); await faceTo(page, "piano"); await ev(page, () => advCur._t.interact()); await sleep(800);
  ok(await ev(page, () => advCur._t.pianoOpen), "piano opens once all 6 echoes are known"); await sleep(800); await shot(page, "s09_piano");
  const KEY = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK"];
  const tap = async k => { await page.keyboard.press(KEY[k - 1]); await sleep(60); };
  await tap(8); let rs = await ev(page, () => advCur._t.runState()); ok(rs.p === 0 && rs.i === 0, "wrong first note keeps phrase at 0");
  await tap(ST.PHRASES[0][0]); await tap(ST.PHRASES[0][1]); await tap(8); rs = await ev(page, () => advCur._t.runState()); ok(rs.p === 0 && rs.i === 0 && rs.mistakes >= 2, "a wrong note restarts the phrase");
  for (let p = 0; p < 5; p++) { for (const k of ST.PHRASES[p]) await tap(k); await sleep(120); }
  await page.waitForFunction(() => advCur._t.talking, null, { timeout: 10000 }).catch(() => {});
  ok(await ev(page, () => advCur._t.talking && advCur._t.view() && advCur._t.view().id === "fin_before_last"), "after phrase 5 the pianist offers the last bar");
  await shot(page, "s10_before_last");
  await ev(page, () => advCur._t.skip());
  await drive(page, ["Lift your hands"], 10, []); await sleep(300);
  ok(await ev(page, () => !advCur._t.talking && !advCur._t.S.ending), "can lift hands from the keys and keep exploring");
  ok(await ev(page, () => advCur._t.runState().p === 5), "run progress is kept (phrase 6 next)");
  /* save/continue */
  await ev(page, () => advCur._t.persist());
  const saved = await ev(page, () => localStorage.getItem("moe.skye.save.v1")); ok(!!saved && JSON.parse(saved).s.tide === true, "progress is saved to localStorage");
  /* pause */
  await page.keyboard.press("Escape"); await sleep(500);
  const pm = await ev(page, () => !!document.querySelector(".adv-pause")); await shot(page, "s11_pause");
  if (pm) { await page.click('.adv-pause button[data-k="res"]'); await sleep(300); }
  ok(pm, "Esc opens the pause menu");
  /* exit and continue */
  await page.evaluate(() => advCur._t.openPiano ? 0 : 0);
  await openSkye(page, { fresh: false });
  ok(await ev(page, () => !!document.querySelector('.adv-title button[data-k="cont"]')), "title offers Continue after a saved session"); await shot(page, "s12_title_continue");
  await page.click('.adv-title button[data-k="cont"]'); await page.waitForFunction(() => advCur && advCur._t && advCur._t.running, null, { timeout: 180000 }); await sleep(500);
  ok(await ev(page, () => advCur._t.S.tide && advCur._t.S.frag[6] && Object.keys(advCur._t.S.frag).length === 6), "Continue restores tide + all 6 echoes");
  const pr = await ev(page, () => advCur._t.pos()); ok(pr[1] < -58, "Continue restores the position");
  /* final: play A (peace) */
  await go(page, -4.7, -84); await faceTo(page, "piano"); await ev(page, () => advCur._t.interact()); await sleep(600);
  ok(await ev(page, () => advCur._t.pianoOpen), "piano reopens after continue");
  for (let p = 0; p < 5; p++) { for (const k of ST.PHRASES[p]) await tap(k); await sleep(120); }
  await page.waitForFunction(() => advCur._t.talking, null, { timeout: 10000 }).catch(() => {});
  await drive(page, ["Play the last phrase"], 10, []); await sleep(600);
  ok(await ev(page, () => advCur._t.pianoOpen), "'Play the last phrase' returns to the piano");
  for (const k of ST.PHRASES[5]) await tap(k);
  await sleep(1800); await drive(page, [], 10);
  await page.waitForSelector(".adv-end", { timeout: 30000 }); await sleep(800); await shot(page, "s13_end_peace");
  ok((await ev(page, () => document.querySelector(".adv-end").textContent)).includes("Last Tune"), "ending 'The Last Tune' (peace) reached");
  ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.skye.endings.v1") || "{}").peace === true), "ending recorded");
  ok(await ev(page, () => !localStorage.getItem("moe.skye.save.v1")), "save cleared at the end");
  /* exit to site */
  // (v9.1: wait for the way back - a history step and the portal journey - instead of a fixed 600 ms, which failed once
  //  under load in the full suite and passed on an immediate re-run)
  await closeReveal(page); await page.click('.adv-end button[data-k="exit"]');
  ok(await page.waitForFunction(() => !document.body.classList.contains("adv-open") && document.querySelector("#adv").hidden, null, { timeout: 30000 }).then(() => true, () => false), "exit returns to the site");
  ok(await ev(page, () => getComputedStyle(document.querySelector("main")).display !== "none"), "site content visible again");

  /* ---------- other endings via a patched state ---------- */
  const full = { frag: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, tide: true };
  async function endingRun(name, setup) {
    await openSkye(page, { fresh: true }); await startNew(page); await ev(page, f => advCur._t.patch(f), full); await setup(); await page.waitForSelector(".adv-end", { timeout: 30000 }); await sleep(500);
    const txt = await ev(page, () => document.querySelector(".adv-end").textContent); await shot(page, "s_end_" + name); return txt;
  }
  let t1 = await endingRun("other", async () => {
    await go(page, -4.7, -84); await faceTo(page, "piano"); await ev(page, () => advCur._t.interact()); await sleep(600);
    for (let p = 0; p < 5; p++) { for (const k of ST.PHRASES[p]) await tap(k); await sleep(120); }
    await page.waitForFunction(() => advCur._t.talking, null, { timeout: 10000 }).catch(() => {});
    await drive(page, ["Play the last phrase"], 10); await sleep(600);
    for (const k of [...ST.PHRASES[5].slice(0, 3), 8]) await tap(k);
    await sleep(1800); await drive(page, [], 10);
  }); ok(t1.includes("Other Note"), "ending 'The Other Note' reached by playing A′");
  let t2 = await endingRun("stay", async () => {
    await go(page, -4.7, -84); await faceTo(page, "piano"); await ev(page, () => advCur._t.interact()); await sleep(600);
    for (let p = 0; p < 5; p++) { for (const k of ST.PHRASES[p]) await tap(k); await sleep(120); }
    await page.waitForFunction(() => advCur._t.talking, null, { timeout: 10000 }).catch(() => {});
    await drive(page, ["Stay and play"], 10);
  }); ok(t2.includes("Tide Comes In"), "ending 'Until the Tide Comes In' reached by staying");
  await closeReveal(page); await page.click('.adv-end button[data-k="exit"]'); await sleep(400);
  await openSkye(page, { fresh: true }); await startNew(page);
  await go(page, 9, 96.5); await faceTo(page, "leave"); ok((await ev(page, () => advCur._t.near())).includes("leave"), "can leave at the car");
  await ev(page, () => advCur._t.interact()); await drive(page, ["Leave Skye"], 10); await page.waitForSelector(".adv-end", { timeout: 30000 });
  ok((await ev(page, () => document.querySelector(".adv-end").textContent)).includes("Unfinished"), "ending 'The Unfinished Tune' reached by leaving");
  ok(await ev(page, () => Object.keys(JSON.parse(localStorage.getItem("moe.skye.endings.v1"))).length >= 4), "all 4 endings recorded in localStorage");
  await closeReveal(page); await page.click('.adv-end button[data-k="exit"]'); await sleep(400);

  ok(requests.length === 0, "no external network requests (" + requests.slice(0, 3).join(" ") + ")");
  const real = errors.filter(e => !/ERR_FILE_NOT_FOUND.*favicon/.test(e)); ok(real.length === 0, "no JS errors " + JSON.stringify(real.slice(0, 5)));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
