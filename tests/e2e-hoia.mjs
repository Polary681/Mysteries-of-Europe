// End-to-end test of the Hoia Baciu adventure (headless Chromium + SwiftShader, file:// launch).
//   node tests/e2e-hoia.mjs [screenshot-dir]
import { launch, URL0, sleep, closeReveal, navIdle } from "./e2e-lib.mjs";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png` }); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ev = (page, f, a) => page.evaluate(f, a);
const drive = (page, queue, max = 80) => page.evaluate(async ([q, max]) => {
  const t = advCur && advCur._t; if (!t) return "gone"; const wait = ms => new Promise(r => setTimeout(r, ms)); q = [...q]; let n = 0;
  while (n++ < max) {
    for (let i = 0; i < 400 && t.busy; i++) await wait(50);
    if (!t.talking) return "done:" + n;
    t.skip(); await wait(30); const v = t.view(); if (!v) { await wait(80); continue; }
    if (v.choices.length) { let k = -1; if (q.length) { k = v.choices.findIndex(c => c.label.includes(q[0])); if (k >= 0) q.shift(); } if (k < 0) k = 0; t.pick(k); }
    else t.press();
    await wait(60);
  }
  return "max";
}, [queue, max]);

async function openHoia(page, reload = true) {
  if (reload) { await page.goto(URL0); await page.waitForSelector("#cards .card"); }
  await navIdle(page); await page.evaluate(() => scrollTo(0, 2300)); await sleep(300); await page.click('.card[data-legend="hoia"]');
  try { await page.waitForSelector(".adv-title", { timeout: 90000 }); } catch (e) { await page.screenshot({ path: "/tmp/hoia-fail.png" }); console.log(await page.evaluate(() => [location.href, document.body.className, !!document.querySelector("#story[open]")].join(" | "))); throw e; }
}
async function startNew(page) {
  await page.click('.adv-title button[data-k="new"], .adv-title button.primary');
  await page.waitForFunction(() => advCur && advCur._t && advCur._t.running, null, { timeout: 180000 }); await sleep(800);
}
const SITES = { sign: [2.6, 66.5], t1: [-31, 34], t2: [29, 22], t3: [-34, -14], t4: [33, -30], t5: [-10, -52], circle: [0, -10], leave: [0, 72] };
const useObj = async (page, id, q = []) => {
  const [ox, oz] = SITES[id], [x, z] = id === "circle" ? [ox, oz + 3] : [ox + 1.2, oz + 1.2];
  await ev(page, ([x, z, ox, oz]) => { advCur._t.tp(x, z); advCur._t.look(Math.atan2(-(ox - x), -(oz - z)), -0.1); }, [x, z, ox, oz]); await sleep(250);
  const near = await ev(page, () => advCur._t.near()); ok(near.includes(id), `can use ${id} -> ${near.join(",")}`);
  await ev(page, () => advCur._t.interact()); return drive(page, q);
};

{
  const { browser, page, errors } = await launch();
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  const cards = await ev(page, () => [...document.querySelectorAll("#cards .card")].map(c => [c.dataset.legend, !!c.querySelector(".play")]));
  ok(cards.some(([k, p]) => k === "hoia" && p), "the Hoia card is now marked as a 3D adventure");
  await openHoia(page); await sleep(800); await shot(page, "h01_title");
  const title = await ev(page, () => document.querySelector(".adv-title").textContent);
  ok(/Hoia Baciu/.test(title) && /folklore/i.test(title), "title screen names the forest and says the stories are folklore");
  ok(await ev(page, () => !!document.querySelector('.adv-title button[data-k="text"]')), "the short text story is still offered on the title screen");

  /* ---- the text story is still reachable and still records its endings ---- */
  await page.click('.adv-title button[data-k="text"]'); await page.waitForSelector("#story[open]", { timeout: 20000 });
  ok(await ev(page, () => !document.body.classList.contains("adv-open")), "the text version closes the 3D overlay");
  for (const t of ["I stay on the path", "Leave the forest"]) { await page.evaluate(t => { const b = [...document.querySelectorAll("#story[open] #st-choices button")].find(b => b.textContent.includes(t)); b && b.click(); }, t); await sleep(500); }
  await sleep(1500); await closeReveal(page);
  ok(await ev(page, () => MOE3D.archive.isUnlocked("hoia-watching")), "leaving in the text story still unlocks The Watching Trees");
  await page.keyboard.press("Escape"); await navIdle(page); await sleep(800);
  ok(await ev(page, () => !document.querySelector("#story[open]")), "the story closes");

  /* ---- the adventure ---- */
  await openHoia(page, false); await startNew(page); await shot(page, "h02_start");
  ok(await ev(page, () => !!document.querySelector("#adv canvas.gl")), "3D canvas present");
  { const wt = await ev(page, () => document.querySelector(".adv-hud .watch").textContent); ok(/2[12]:\d\d/.test(wt), "the watch is shown on the HUD (" + wt + ")"); }
  const p0 = await ev(page, () => advCur._t.pos()); await page.keyboard.down("KeyW"); for (let i = 0; i < 120; i++) { await sleep(250); const p = await ev(page, () => advCur._t.pos()); if (Math.hypot(p[0] - p0[0], p[1] - p0[1]) > 1) break; } await page.keyboard.up("KeyW"); const p1 = await ev(page, () => advCur._t.pos());
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.8, `W walks into the forest (${p0.map(n => n.toFixed(1))} -> ${p1.map(n => n.toFixed(1))})`);
  await page.keyboard.down("KeyL"); for (let i = 0; i < 60 && (await ev(page, () => advCur._t.raiseK)) < 0.6; i++) await sleep(250); const rk = await ev(page, () => advCur._t.raiseK); await page.keyboard.up("KeyL");
  ok(rk > 0.5, "holding L raises the lantern (" + rk.toFixed(2) + ")");

  await useObj(page, "sign");
  ok((await useObj(page, "circle")).startsWith("done") && !(await ev(page, () => advCur._t.S.ending)), "the clearing stays closed with no traces");
  await useObj(page, "t2", ["Take the camera"]); await useObj(page, "t3", ["Pick up the stick"]); await useObj(page, "t1");
  const S1 = await ev(page, () => ({ n: Object.keys(advCur._t.S.trace).length, cam: advCur._t.S.flags.camera, tally: advCur._t.S.flags.tally }));
  ok(S1.n === 3 && S1.cam && S1.tally, "three traces found, camera and stick carried");
  ok(await ev(page, () => document.querySelectorAll(".adv-hud .echoes b.on").length === 3), "the HUD marks three traces");
  await ev(page, () => advCur._t.tp(0, 10));
  ok(await page.waitForFunction(() => advCur._t.lightsK > 0.05, null, { timeout: 30000, polling: 250 }).then(() => true, () => false), "lights appear over the clearing once it is open"); await shot(page, "h03_lights");
  // save & continue
  await ev(page, () => advCur._t.persist()); ok(await ev(page, () => { const s = JSON.parse(localStorage.getItem("moe.hoia.save.v1")); return s && s.s.trace.t3; }), "progress is saved");
  ok(await ev(page, () => MOE3D.archive.legendStatus("hoia").state) === "completed", "the legend card shows Hoia as started/completed (text ending found)");

  await useObj(page, "circle", ["Raise the camera"]);
  await page.waitForSelector(".adv-end", { timeout: 60000 }); await sleep(2500); await shot(page, "h04_end");
  ok(/One Frame Left/.test(await ev(page, () => document.querySelector(".adv-end h2").textContent)), "the 'lights' ending plays");
  await closeReveal(page);
  ok(await ev(page, () => MOE3D.archive.isUnlocked("hoia-negative")), "The 1968 Negative is recovered");
  ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.hoia.endings.v1")).lights === true && !localStorage.getItem("moe.hoia.save.v1")), "ending recorded, save cleared");
  // play again -> shepherd
  await page.click('.adv-end button[data-k="again"]'); await page.waitForFunction(() => advCur._t.running && !advCur._t.S.ending, null, { timeout: 120000 }); await sleep(600);
  await ev(page, () => advCur._t.patch({ trace: { t1: true, t2: true, t3: true }, flags: { tally: true } }));
  await useObj(page, "circle", ["Follow the sheep track"]);
  await page.waitForSelector(".adv-end", { timeout: 60000 }); await sleep(2500); await closeReveal(page);
  ok(await ev(page, () => MOE3D.archive.isUnlocked("hoia-tally") && MOE3D.archive.legendStatus("hoia").found === 3), "the shepherd ending recovers the tally stick (3 / 4 endings counting the text one)");
  { const t0 = Date.now(); await ev(page, () => setTimeout(() => document.querySelector('.adv-end button[data-k="exit"]').click(), 0)); await sleep(500); await ev(page, () => 1); console.log("info: exit took", Date.now() - t0, "ms"); }
  await sleep(1500);
  ok(await ev(page, () => !document.body.classList.contains("adv-open") && !advCur), "exit returns to the site");
  const real = errors.filter(e => !/favicon|ERR_FILE_NOT_FOUND|GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no page errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL HOIA E2E TESTS PASSED"); process.exit(fails ? 1 : 0);
