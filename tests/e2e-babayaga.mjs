// End-to-end test of the Baba Yaga adventure (headless Chromium + SwiftShader, file:// launch).
//   node tests/e2e-babayaga.mjs [screenshot-dir]
// Software rendering runs at a few frames per second, so the tale is played at 4x game speed (_t.setTimeScale) and the
// player is moved with _t.tp; every choice still goes through the real dialogue, set pieces and save/Archive code.
import { launch, URL0, sleep, closeReveal, navIdle } from "./e2e-lib.mjs";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png`, timeout: 180000 }).catch(() => {}); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ev = (page, f, a) => page.evaluate(f, a);
const until = async (page, f, ms = 240000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(f, a).catch(() => false)) return true; await sleep(300); } return false; };
/** read the dialogue through, choosing the options whose label contains the queued words (else the first one) */
const drive = (page, q = [], max = 400) => page.evaluate(async ([q, max]) => {
  const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); q = [...q];
  for (let n = 0; n < max; n++) {
    if (!t.talking && !t.busy && !t.cine) return "done";
    if (t.talking && !t.busy) { t.skip(); await w(30); const v = t.view(); if (v) { if (v.choices.length) { let k = q.length ? v.choices.findIndex(c => c.label.includes(q[0])) : 0; if (k >= 0 && q.length) q.shift(); t.pick(Math.max(0, k)); } else t.press(); } }
    await w(250);
  }
  return "max";
}, [q, max]);
const use = async (page, id, q = []) => {
  const p = await ev(page, id => { const t = advCur._t, S = t.sites, I = t.INT, P = { well: S.well, barrel: S.barrel, broom: S.broom, door: S.door, pile1: S.pile1, pile2: S.pile2, pile3: S.pile3, edge: S.edge, hut: [0, 0], exit: [I.x, I.z + 1.9], poppy: [I.x + 1.3, I.z - 0.7], stove: [I.x - 1.95, I.z - 0.4], cat: [I.x - 1.6, I.z - 1.0] }[id]; return P; }, id);
  const off = { hut: [0, 8], edge: [0, -1.5], exit: [0, -1.0], poppy: [0, 0.9], stove: [0.3, 1.0], cat: [0.6, 1.2] }[id] || [0.9, 1.0];
  await ev(page, ([x, z, ox, oz]) => { const t = advCur._t; t.tp(x + ox, z + oz); t.look(Math.atan2(ox, oz), -0.1); }, [p[0], p[1], off[0], off[1]]); await sleep(400);
  const near = await ev(page, () => advCur._t.near()); ok(near.includes(id), `can use ${id} (${near.join(",")})`);
  await ev(page, () => advCur._t.interact()); await sleep(300); return drive(page, q);
};
async function openBY(page, reload = true) {
  if (reload) { await page.goto(URL0); await page.waitForSelector("#cards .card"); }
  await navIdle(page); await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(300);
  await page.click('.card[data-legend="babayaga"]'); await page.waitForSelector(".adv-title", { timeout: 180000 });
}
async function newGame(page) {
  await page.click('.adv-title button[data-k="new"], .adv-title button.primary');
  await page.waitForFunction(() => advCur && advCur._t && advCur._t.running, null, { timeout: 240000 }); await ev(page, () => advCur._t.setTimeScale(4));
  await until(page, () => advCur._t.talking, 20000);   // the opening lines start once the scene has faded in
}
async function endingScreen(page, title) {
  ok(await until(page, () => !!document.querySelector(".adv-end"), 240000), "the ending screen appears"); await sleep(2500);
  const h = await ev(page, () => (document.querySelector(".adv-end h2") || {}).textContent || ""); ok(h.includes(title), `ending “${title}” (${h})`);
  // a new relic is revealed a moment after the ending (slowly, in software rendering): wait for it, then put it away
  await until(page, () => !document.querySelector(".adv-end .relic-note.is-new") || !!document.querySelector("dialog.reveal.done"), 60000);
  await closeReveal(page, 30000); await until(page, () => !document.querySelector("dialog.reveal"), 30000);
}

{
  const { browser, page, errors, requests } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0); await page.waitForSelector("#cards .card"); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  /* ---------- site integration ---------- */
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  ok(await ev(page, () => !!document.querySelector('.card[data-legend="babayaga"] .play')), "Baba Yaga has a legend card marked as a 3D adventure");
  ok(await ev(page, () => /Fairy tale/.test(document.querySelector('.card[data-legend="babayaga"]').textContent) && !!document.querySelector('.card[data-legend="babayaga"] svg')), "…with its category and its own artwork");
  ok(await ev(page, () => !!document.querySelector('#map .pin') && [...document.querySelectorAll('#map .pin')].some(p => /Baba Yaga/.test(p.getAttribute("aria-label")))), "a pin for Baba Yaga stands on the map");
  ok(await ev(page, () => { const p = document.querySelector('#map path[data-c="RU"]'); return p && p.classList.contains("leg"); }), "Russia is marked as a country with a legend");
  await ev(page, () => document.querySelector('#map path[data-c="RU"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(800);
  ok(await ev(page, () => /Baba Yaga/.test(document.getElementById("preview").textContent) && !/Not part of our project/.test(document.getElementById("preview").textContent)), "clicking Russia on the map offers the legend");
  ok(await ev(page, () => MOE3D.archive.CARDS.filter(c => c.legend === "babayaga").length === 5), "the Archive has its case file and four relics");
  ok(await ev(page, () => MOE3D.ui.pageSky && !!MOE3D.ui.pageSky().state().hasOwnProperty("babayaga")), "the legend has a constellation in the page sky");

  /* ---------- the title screen and the text version ---------- */
  await openBY(page, false); await sleep(600); await shot(page, "y01_title");
  const title = await ev(page, () => document.querySelector(".adv-title").textContent);
  ok(/Baba Yaga/.test(title) && /Afanasyev/.test(title), "the title screen names the tale and its collector");
  await ev(page, () => document.querySelector('.adv-title button[data-k="text"]').click()); await page.waitForSelector("#story[open]", { timeout: 60000 });
  ok(/Baba Yaga/.test(await ev(page, () => document.getElementById("st-title").textContent)), "the short text version opens");
  await page.keyboard.press("Escape"); await navIdle(page); await sleep(800);

  /* ---------- the road: three horsemen ---------- */
  await openBY(page, false); await newGame(page); await drive(page); await shot(page, "y02_road");
  ok(await ev(page, () => !!document.querySelector("#adv canvas.gl")), "3D canvas present");
  ok(/In your hands: the doll/.test(await ev(page, () => document.querySelector(".adv-hud .watch").textContent)), "the HUD shows the doll in your hands");
  { const p0 = await ev(page, () => advCur._t.pos()); await page.keyboard.down("KeyW"); for (let i = 0; i < 80; i++) { await sleep(250); const p = await ev(page, () => advCur._t.pos()); if (Math.hypot(p[0] - p0[0], p[1] - p0[1]) > 1) break; } await page.keyboard.up("KeyW"); const p1 = await ev(page, () => advCur._t.pos()); ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.8, "W walks along the forest path"); }
  await ev(page, () => advCur._t.ask(true)); await sleep(500); ok(/doll whispers/.test(await ev(page, () => document.querySelector(".adv-toasts") ? document.querySelector(".adv-toasts").textContent : document.body.textContent)), "holding L: the doll whispers the way"); await ev(page, () => advCur._t.ask(false));
  await ev(page, () => advCur._t.tp(0.3, 74)); ok(await until(page, () => advCur._t.riders > 0, 30000), "the white horseman rides past"); await sleep(3500); await shot(page, "y03_white"); await drive(page);
  ok(await ev(page, () => advCur._t.tod > 0.9), "…and day breaks");
  await ev(page, () => advCur._t.tp(0.3, 46)); ok(await until(page, () => advCur._t.riders > 0, 30000), "the red horseman rides past"); await drive(page);
  ok(await ev(page, () => advCur._t.tod > 1.9), "…and the sun rises");
  await ev(page, () => advCur._t.tp(0.3, 27)); ok(await until(page, () => advCur._t.riders > 0, 30000), "the black horseman gallops to the gate"); await drive(page);
  ok(await ev(page, () => advCur._t.S.phase === "gate" && advCur._t.tod > 3.9), "…and night falls");
  ok(await until(page, () => advCur._t.eyesLit > 40, 30000), "the eyes of the skulls on the fence light up"); await shot(page, "y04_fence");
  await ev(page, () => advCur._t.persist()); ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.babayaga.save.v1")).s.phase === "gate"), "progress is saved");

  /* ---------- the hut turns, Baba Yaga arrives ---------- */
  await use(page, "hut", ["Knock", "Walk away"]);   /* walk away after knocking: the next step says the words itself */ ok(await ev(page, () => !!advCur._t.S.seen.hut_knock), "knocking does nothing: there are words for this");
  await use(page, "hut", ["Say the old words"]);
  ok(await until(page, () => Math.abs(advCur._t.hut.yaw) < 0.05 && advCur._t.hut.crouch > 0.95, 240000), "the hut turns round on its chicken legs and squats");
  ok(await until(page, () => advCur._t.yaga.on && (advCur._t.talking || !!advCur._t.S.seen.yaga_meet), 240000), "Baba Yaga flies in on her mortar and speaks");   // (the runner may already have read her first line) await shot(page, "y05_yaga");
  await drive(page, ["It is I"]);
  ok(await until(page, () => advCur._t.S.phase === "tasks" && !advCur._t.cine && !advCur._t.talking, 240000), "the night passes; at dawn she flies away and the chores begin");
  ok(await ev(page, () => !advCur._t.yaga.on && advCur._t.tod > 0.9), "…and she is gone for the day"); await shot(page, "y06_dawn");

  /* ---------- the chores ---------- */
  await use(page, "well", ["Draw a bucket"]); ok(await ev(page, () => !!advCur._t.S.items.bucket), "a bucket of water from the well");
  await use(page, "barrel"); ok(await ev(page, () => !!advCur._t.S.tasks.water && !advCur._t.S.items.bucket), "the barrel is filled (1 / 4)");
  await use(page, "broom", ["Take the broom"]); ok(await ev(page, () => !!advCur._t.S.items.broom), "the broom is taken");
  for (const k of ["pile1", "pile2", "pile3"]) { await use(page, k); await until(page, () => !advCur._t.cine, 60000); }
  ok(await ev(page, () => !!advCur._t.S.tasks.sweep), "the yard is swept (2 / 4)");
  ok(await until(page, () => advCur._t.S.riders.red2 && advCur._t.tod > 1.9, 240000), "at midday the red horseman passes again"); await drive(page);
  await use(page, "door"); ok(await until(page, () => advCur._t.S.inside && !advCur._t.cine, 60000), "into the hut"); await drive(page); await shot(page, "y07_inside");
  await use(page, "stove", ["Light the stove"]); ok(await ev(page, () => !!advCur._t.S.tasks.supper), "the supper is cooked (3 / 4)");
  await use(page, "cat", ["Give the cat"]); ok(await ev(page, () => !!advCur._t.S.flags.cat_fed), "the cat is fed, and will remember");
  await use(page, "poppy", ["Pick the earth out yourself"]); ok(await until(page, () => advCur._t.poppyOpen, 20000), "the poppy-seed task opens");
  await shot(page, "y08_poppy");
  { const c = await ev(page, () => advCur._t.poppyCrumbs()); await ev(page, ([x, y]) => advCur._t.poppyPick(x, y), [c[0][0], c[0][1]]); await sleep(300); ok(await ev(page, () => advCur._t.poppyCrumbs()[0][2] > 0), "clicking a crumb of earth picks it out"); }
  await ev(page, () => advCur._t.poppySolve()); ok(await until(page, () => !advCur._t.poppyOpen && advCur._t.S.tasks.poppy, 20000), "every crumb picked out by hand (4 / 4)");
  ok(await ev(page, () => advCur._t.S.flags.poppy_self === true), "…and Baba Yaga will know you did it yourself");

  /* ---------- evening: the black horseman, her return, the hands, the questions ---------- */
  ok(await until(page, () => advCur._t.S.phase === "return", 60000), "with all four chores done, evening comes");
  ok(await until(page, () => advCur._t.yaga.on && advCur._t.talking, 300000), "she comes home at nightfall"); await shot(page, "y09_return");
  await drive(page, [], 6); ok(await until(page, () => advCur._t.cine > 0 || advCur._t.S.seen.yaga_ask, 120000), "three pairs of hands appear"); await shot(page, "y10_hands");
  await until(page, () => advCur._t.talking && !advCur._t.cine, 240000);
  await drive(page, ["Who was the white horseman", "That is enough", "By my mother"]);
  ok(await until(page, () => advCur._t.S.phase === "lantern" && !!advCur._t.S.items.skull, 120000), "“by my mother’s blessing”: she gives you a skull from the fence as fire");
  ok(await until(page, () => !advCur._t.cine && Math.abs(Math.abs(advCur._t.hut.yaw) - Math.PI) < 0.05, 240000), "the hut stands up and turns its back on you again"); await shot(page, "y11_lantern");
  for (const z of [30, 60, 84, 88]) { await ev(page, z => advCur._t.tp(0.3, z), z); await sleep(400); }
  await until(page, () => advCur._t.talking, 60000); await drive(page); await endingScreen(page, "Fire from the Fence");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("babayaga-lantern")), "The Skull Lantern is in the Archive");
  ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.babayaga.endings.v1")).lantern === true && !localStorage.getItem("moe.babayaga.save.v1")), "ending recorded, save cleared");

  /* ---------- replay: ask about the hands, and run ---------- */
  await page.click('.adv-end button[data-k="again"]'); await page.waitForFunction(() => advCur._t.running && !advCur._t.S.ending, null, { timeout: 120000 }); await ev(page, () => advCur._t.setTimeScale(4)); await until(page, () => advCur._t.talking, 20000); await drive(page);
  await ev(page, () => { const t = advCur._t; t.patch({ phase: "tasks", riders: { white: true, red: true, black: true, white2: true, red2: true }, tasks: { water: true, sweep: true, poppy: true, supper: true }, flags: { cat_fed: true }, inside: false }); t.tp(1.5, 8); t.evening(); });
  ok(await until(page, () => advCur._t.yaga.on && advCur._t.talking, 300000), "(second run) she comes home");
  await drive(page, [], 6); await until(page, () => advCur._t.talking && !advCur._t.cine && !!advCur._t.S.seen.yaga_ask, 240000);
  await drive(page, ["what are the hands"]);
  ok(await until(page, () => advCur._t.S.phase === "flight" && advCur._t.S.items.towel && advCur._t.S.items.comb, 240000), "the forbidden question: the cat gives you a towel and a comb");
  ok(await until(page, () => advCur._t.chase.on && advCur._t.yaga.on, 120000), "Baba Yaga comes after you in her mortar"); await shot(page, "y12_chase");
  // run along the path, keeping a few steps ahead of her (software rendering is slow: never outrun the frame rate)
  { let z = 12; for (let i = 0; i < 900 && await ev(page, () => advCur._t.chase.out < 2); i++) { const c = await ev(page, () => advCur._t.chase); if (c.dist < 9 && c.stop == null) await ev(page, () => advCur._t.throwNext()); if (c.dist < 14 || c.stop != null) { z = Math.min(80, z + 0.5); await ev(page, z => advCur._t.tp(0.3, z), z); } await sleep(200); } }
  ok(await ev(page, () => advCur._t.chase.comb && !advCur._t.S.items.towel && !advCur._t.S.items.comb), "the towel became a river, the comb a forest"); await shot(page, "y13_forest");
  await ev(page, () => advCur._t.tp(0.3, 88)); await until(page, () => advCur._t.talking, 60000); await drive(page); await endingScreen(page, "Over River and Forest");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("babayaga-flight")), "The Comb and the Towel is in the Archive");

  /* ---------- replay: stay as her apprentice ---------- */
  await page.click('.adv-end button[data-k="again"]'); await page.waitForFunction(() => advCur._t.running && !advCur._t.S.ending, null, { timeout: 120000 }); await ev(page, () => advCur._t.setTimeScale(4)); await until(page, () => advCur._t.talking, 20000); await drive(page);
  await ev(page, () => { const t = advCur._t; t.patch({ phase: "tasks", riders: { white: true, red: true, black: true, white2: true, red2: true }, tasks: { water: true, sweep: true, poppy: true, supper: true }, flags: { poppy_self: true }, inside: false }); t.tp(1.5, 8); t.evening(); });
  await until(page, () => advCur._t.yaga.on && advCur._t.talking, 300000); await drive(page, [], 6); await until(page, () => advCur._t.talking && !advCur._t.cine && !!advCur._t.S.seen.yaga_ask, 240000);
  await drive(page, ["Who was the white horseman", "That is enough", "With my own two hands", "Stay with Baba Yaga"]);
  await endingScreen(page, "The Mortar’s Apprentice");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("babayaga-stay")), "The Mortar and Pestle is in the Archive");

  /* ---------- replay: go home without fire ---------- */
  await page.click('.adv-end button[data-k="again"]'); await page.waitForFunction(() => advCur._t.running && !advCur._t.S.ending, null, { timeout: 120000 }); await until(page, () => advCur._t.talking, 20000); await drive(page);
  await use(page, "edge", ["Go home without fire"]); await endingScreen(page, "The Birch Path");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("babayaga-leave") && MOE3D.archive.legendStatus("babayaga").state === "mastered"), "The Little Doll is in the Archive, and every ending of the legend has been found");
  await page.click('.adv-end button[data-k="exit"]').catch(() => {}); await sleep(1500);
  ok(await until(page, () => !document.body.classList.contains("adv-open"), 120000), "exit returns to the site");
  ok(requests.length === 0, "nothing loaded from the network");
  const real = errors.filter(e => !/GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no page errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL BABA YAGA E2E TESTS PASSED"); process.exit(fails ? 1 : 0);
