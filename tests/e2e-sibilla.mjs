// End-to-end test of the Sibyl of the Apennines (headless Chromium + SwiftShader, file:// launch).
//   node tests/e2e-sibilla.mjs [screenshot-dir]
// Software rendering runs at a few frames per second, so the game runs at 4x speed (_t.setTimeScale) and the player is moved
// with _t.tp / _t.tpk; every conversation, choice, set piece, save and Archive unlock goes through the real game code.
import { launch, URL0, sleep, closeReveal, navIdle } from "./e2e-lib.mjs";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png`, timeout: 180000 }).catch(() => {}); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ev = (page, f, a) => page.evaluate(f, a);
const until = async (page, f, ms = 240000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(f, a).catch(() => false)) return true; await sleep(300); } return false; };
/** read the dialogue through, choosing the options whose label contains the queued words (else the first one) */
const drive = (page, q = [], max = 400) => page.evaluate(async ([q, max]) => {
  const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); q = [...q]; let idle = 0;
  for (let n = 0; n < max; n++) {
    if (!t.talking && !t.busy && !t.cine) { if (++idle > 6) return "done"; await w(250); continue; } idle = 0;
    if (t.talking && !t.busy) { t.skip(); await w(30); const v = t.view(); if (v) { if (v.choices.length) { let k = q.length ? v.choices.findIndex(c => c.label.includes(q[0])) : 0; if (k >= 0 && q.length) q.shift(); t.pick(Math.max(0, k)); } else t.press(); } }
    await w(220);
  }
  return "max";
}, [q, max]);
/** stand near something and use it */
const use = async (page, id, at, q = [], kingdom = false) => {
  await ev(page, ([x, z, k]) => k ? advCur._t.tpk(x, z) : advCur._t.tp(x, z), [at[0], at[1], kingdom]); await sleep(500);
  const near = await ev(page, () => advCur._t.near()); ok(near.includes(id), `can reach ${id} (${near.join(",")})`);
  await ev(page, id => { const t = advCur._t; const c = t.near(); if (c[0] !== id) { /* nearest first */ } t.interact(); }, id); await sleep(300); return drive(page, q);
};
async function openSib(page, reload = true) {
  if (reload) { await page.goto(URL0); await page.waitForSelector("#cards .card"); }
  await navIdle(page); await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(300);
  await page.click('.card[data-legend="sibilla"]'); await page.waitForSelector(".adv-title", { timeout: 180000 });
}
async function newGame(page, sel = '.adv-title button[data-k="new"], .adv-title button.primary') {
  await page.click(sel);
  await page.waitForFunction(() => advCur && advCur._t && advCur._t.running, null, { timeout: 240000 }); await ev(page, () => advCur._t.setTimeScale(4));
}
async function endingScreen(page, title) {
  ok(await until(page, () => !!document.querySelector(".adv-end"), 300000), "the ending screen appears"); await sleep(2500);
  const h = await ev(page, () => (document.querySelector(".adv-end h2") || {}).textContent || ""); ok(h.includes(title), `ending “${title}” (${h})`);
  await until(page, () => !document.querySelector(".adv-end .relic-note.is-new") || !!document.querySelector("dialog.reveal.done"), 60000);
  for (let i = 0; i < 3; i++) { await closeReveal(page, 30000); await sleep(500); }
  await until(page, () => !document.querySelector("dialog.reveal"), 30000);
}
async function replay(page) {
  await page.click('.adv-end button[data-k="again"]'); await page.waitForFunction(() => advCur._t.running && !advCur._t.S.ending, null, { timeout: 120000 });
  await ev(page, () => advCur._t.setTimeScale(4)); await until(page, () => advCur._t.talking, 20000); await drive(page);
}

{
  const { browser, page, errors, requests } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0); await page.waitForSelector("#cards .card"); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  /* ---------- site integration ---------- */
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  ok(await ev(page, () => !!document.querySelector('.card[data-legend="sibilla"] .play')), "the Sibyl has a legend card marked as a 3D adventure");
  ok(await ev(page, () => /Medieval legend/.test(document.querySelector('.card[data-legend="sibilla"]').textContent) && !!document.querySelector('.card[data-legend="sibilla"] svg')), "…with its category and its own artwork");
  ok(await ev(page, () => [...document.querySelectorAll('#map .pin')].some(p => /Sibyl of the Apennines/.test(p.getAttribute("aria-label")))), "a pin for the Sibyl stands on the map");
  ok(await ev(page, () => { const p = document.querySelector('#map path[data-c="IT"]'); return p && p.classList.contains("leg"); }), "Italy is marked as a country with a legend");
  ok(await ev(page, () => { const pin = [...document.querySelectorAll('#map .pin')].find(p => /Sibyl/.test(p.getAttribute("aria-label"))), it = document.querySelector('#map path[data-c="IT"]'); const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(pin.getAttribute("transform")); const pt = document.getElementById("map").createSVGPoint(); pt.x = +m[1]; pt.y = +m[2]; return it.isPointInFill(pt); }), "the pin stands inside Italy (Monte Sibilla, 42.90 N 13.26 E)");
  await ev(page, () => document.querySelector('#map path[data-c="IT"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(800);
  ok(await ev(page, () => /Sibyl of the Apennines/.test(document.getElementById("preview").textContent) && /3D adventure/.test(document.getElementById("preview").textContent)), "clicking Italy on the map offers the 3D adventure");
  ok(await ev(page, () => MOE3D.archive.CARDS.filter(c => c.legend === "sibilla").length === 7), "the Archive has its case file, five relics and the Sibyl's Seal");
  ok(await ev(page, () => MOE3D.ui.pageSky && MOE3D.ui.pageSky().state().hasOwnProperty("sibilla")), "the legend has a constellation in the page sky");

  /* ---------- title screen and text version ---------- */
  await openSib(page, false); await sleep(600); await shot(page, "s01_title");
  const title = await ev(page, () => document.querySelector(".adv-title").textContent);
  ok(/Sibyl of the Apennines/.test(title) && /Barberino/.test(title) && /La Sale/.test(title), "the title screen names the legend and both literary sources");
  await ev(page, () => document.querySelector('.adv-title button[data-k="text"]').click()); await page.waitForSelector("#story[open]", { timeout: 60000 });
  ok(/Sibyl/.test(await ev(page, () => document.getElementById("st-title").textContent)), "the short text version opens");
  await page.keyboard.press("Escape"); await navIdle(page); await sleep(800);

  /* ---------- Act I: the village ---------- */
  await openSib(page, false); await newGame(page); await until(page, () => advCur._t.talking, 20000); await drive(page); await shot(page, "s02_village");
  ok(await ev(page, () => !!document.querySelector("#adv canvas.gl") && advCur._t.zone === "surface" && advCur._t.phase === "dusk"), "3D canvas, Montemonaco at dusk");
  ok(/0 \/ 3/.test(await ev(page, () => document.querySelector(".adv-obj span").textContent)), "objective: ask the villagers (0 / 3)");
  { const p0 = await ev(page, () => advCur._t.pos()); await page.keyboard.down("KeyW"); for (let i = 0; i < 80; i++) { await sleep(250); const p = await ev(page, () => advCur._t.pos()); if (Math.hypot(p[0] - p0[0], p[1] - p0[1]) > 1) break; } await page.keyboard.up("KeyW"); const p1 = await ev(page, () => advCur._t.pos()); ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1, "W walks the player through the village"); }
  await use(page, "gate", [0.5, -27]); ok(await ev(page, () => !!advCur._t.S.seen.gate_wait && advCur._t.S.act === 1), "the north gate turns an ignorant traveller back");
  await use(page, "lasale", [-3.6, 13.6], ["What have they told you", "Have you been up", "I am going up tonight", "Take the notebook", "Leave"]);
  ok(await ev(page, () => !!advCur._t.S.items.notebook && !!JSON.parse(localStorage.getItem("moe.sibilla.finds.v1")).notebook), "Antoine de La Sale gives his notebook (recorded as a find)");
  ok(await until(page, () => !!document.querySelector("dialog.reveal"), 30000), "…and the Archive reveals it at once, mid-game"); await shot(page, "s03_reveal");
  await closeReveal(page, 30000); await until(page, () => !document.querySelector("dialog.reveal"), 30000);
  ok(await ev(page, () => MOE3D.archive.isUnlocked("sibilla-notebook")), "La Sale’s Notebook is in the Archive");
  await use(page, "shepherd", [-3, -19.2], ["Why not", "anything strange", "Where do they dance", "Did you ever find", "Leave"]);
  ok(await ev(page, () => ["dawn", "feet", "meadow", "basket"].every(k => advCur._t.S.clues[k])), "Nicola: dawn, the hooves, the meadow, the basket");
  await use(page, "vittoria", [-16.6, 15.6], ["How do I keep", "Did you ever go up", "Show her your half", "Leave"]);
  ok(await ev(page, () => advCur._t.S.items.thread && advCur._t.S.clues.medal_match), "Vittoria: the red thread, her sister Lucia, the medallion");
  await ev(page, () => advCur._t.toggleJournal()); await sleep(400);
  await ev(page, () => document.querySelector('.journal [data-t="codex"]').click()); await sleep(300);
  ok(await ev(page, () => { const t = document.querySelector(".journal").textContent; return /Historical/.test(t) && /Literary source/.test(t) && /Local folklore/.test(t) && /Invented for this game/.test(t); }), "the codex labels history, literature, folklore and invention"); await shot(page, "s04_codex");
  await ev(page, () => advCur._t.toggleJournal());
  /* save and Continue */
  await ev(page, () => advCur._t.persist()); ok(await ev(page, () => { const s = JSON.parse(localStorage.getItem("moe.sibilla.save.v1")); return s.s.items.notebook && s.s.items.thread && s.pos.length === 3; }), "progress is saved");
  await ev(page, () => document.querySelector('.abtn[data-a="pause"]').click()); await sleep(400);
  await ev(page, () => setTimeout(() => document.querySelector('.adv-pause button[data-k="exit"]').click(), 0));
  ok(await until(page, () => !document.body.classList.contains("adv-open"), 120000), "exit returns to the site");
  ok(await ev(page, () => /In progress/.test(document.querySelector('.card[data-legend="sibilla"]').textContent)), "the card shows the adventure in progress");
  await openSib(page, false); ok(await ev(page, () => !!document.querySelector('.adv-title button[data-k="cont"]')), "the title screen offers Continue");
  await newGame(page, '.adv-title button[data-k="cont"]');
  ok(await ev(page, () => advCur._t.S.items.notebook && advCur._t.S.clues.medal_match && advCur._t.S.act === 1), "Continue restores the story");

  /* ---------- Act II: the mountain ---------- */
  await use(page, "gate", [0.5, -27], ["Climb"]);
  ok(await until(page, () => advCur._t.S.area === "mountain" && advCur._t.phase === "night" && !advCur._t.cine, 60000), "through the north gate into the night: Act II"); await drive(page); await shot(page, "s05_trail");
  await use(page, "stazzo", [-16.5, -83]); ok(await ev(page, () => !!advCur._t.S.clues.tally), "the shepherd’s hut and its tally");
  await ev(page, () => advCur._t.tp(15, -106)); ok(await until(page, () => advCur._t.talking && advCur._t.S.flags.met_fairies, 120000), "on the high meadow the fairies are dancing, and one speaks");
  ok(await ev(page, () => advCur._t.music > 0.2), "…to the saltarello"); await shot(page, "s06_fairies");
  await drive(page, ["Watch their feet", "An old shepherd", "Dance.", "ask the way", "home before dawn"]);
  ok(await until(page, () => advCur._t.S.guide === "fairy" && advCur._t.S.susp === 0 && advCur._t.fairyMode === "gone" && !advCur._t.cine, 120000), "knowing the dawn rule, the dancers guide you up without enchantment");
  await use(page, "mouth", [0.5, -209], ["Crawl inside"]);
  ok(await until(page, () => advCur._t.zone === "kingdom" && advCur._t.S.stage === "bridge" && !advCur._t.cine, 120000), "into the mountain: Act III, the bridge over the abyss"); await drive(page); await shot(page, "s07_bridge");
  ok(/Day \d+ of 330/.test(await ev(page, () => document.querySelector(".sib-day").textContent)), "the HUD counts the days with Vittoria’s thread");

  /* ---------- Act III: the kingdom ---------- */
  for (const z of [-10, -20, -31.9]) { await ev(page, z => advCur._t.tpk(0, z), z); await sleep(400); }
  ok(await until(page, () => advCur._t.S.stage === "doors", 30000), "across the bridge: the beating bronze doors"); await drive(page); await shot(page, "s08_doors");
  ok(await until(page, () => advCur._t.doorK < 0.15, 30000) && !(await ev(page, () => advCur._t.canWalk(0, -34))), "the doors block the way when shut");
  ok(await until(page, () => advCur._t.doorK > 0.7, 30000) && await ev(page, () => advCur._t.canWalk(0, -34)), "…and let you through when open");
  await ev(page, () => advCur._t.tpk(0, -36)); ok(await until(page, () => advCur._t.S.stage === "door", 30000), "through the doors, to the crystal door");
  await use(page, "porter", [0.4, -41.2], ["Lucia"], true);
  ok(await until(page, () => advCur._t.S.stage === "kingdom" && advCur._t.crystalK > 0.95 && advCur._t.S.clues.porter_lie, 60000), "the porter lies about Lucia; the crystal door opens"); await shot(page, "s09_hall");
  await use(page, "porter", [2.6, -46.4], ["half-medallion"], true); ok(await ev(page, () => !!advCur._t.S.clues.medal_seen), "she wears the other half of the medallion");
  const d0 = await ev(page, () => advCur._t.S.day);
  await use(page, "knight", [-12.5, -88.3], ["What should I beware", "Leave"], true);
  ok(await ev(page, d0 => advCur._t.S.flags.k_knight && advCur._t.S.day > d0 + 20, d0), "the German knight’s warnings cost days");
  await use(page, "window", [-41.6, -108], [], true);
  ok(await until(page, () => advCur._t.S.flags.summoned && !advCur._t.talking && !advCur._t.cine, 120000) || await drive(page) && await ev(page, () => advCur._t.S.flags.summoned), "two discoveries, and the queen sends for you"); await drive(page);
  await use(page, "pool", [31, -101.5], [], true); ok(await ev(page, () => !!advCur._t.S.clues.serpents), "Saturday in the lower garden: the serpents in the pool");
  // (the dialogue runner keeps reading after "Enter": the throne hall opens and the queen speaks within the same conversation flow)
  await use(page, "throne", [0, -103], ["Enter", "Frenchman", "already know", "Let her come home", "Walk out with her"], true);
  ok(await ev(page, () => advCur._t.S.act === 4 && !!advCur._t.S.seen.sibyl_1 && !!advCur._t.S.seen.sibyl_lasale && !!advCur._t.S.seen.sibyl_already), "Act IV: the queen asks why you came; you answer for the Frenchman, and tell her what you found");
  await endingScreen(page, "The Return");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("sibilla-return") && MOE3D.archive.isUnlocked("sibilla-seal")), "The Upward Hourglass and the Sibyl’s Seal are in the Archive");
  ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.sibilla.endings.v1")).return === true && !localStorage.getItem("moe.sibilla.save.v1")), "ending recorded, save cleared");
  ok(/medallion/.test(await ev(page, () => document.querySelector(".adv-end .story").textContent)), "knowing your mother changes the epilogue");

  /* ---------- replay: forget to count (past the 330th day) ---------- */
  await replay(page);
  await ev(page, () => { const t = advCur._t; t.patch({ act: 3, area: "kingdom", stage: "kingdom", day: 290, susp: 6, items: { medallion: true, thread: true }, flags: { k_knight: true, k_time: true, summoned: true } }); t.tpk(-19, -67.6); });
  await sleep(600); await use(page, "feast", [-19, -67.6], ["Eat"], true);
  ok(await ev(page, () => advCur._t.S.day > 330), "the queen’s table costs the last days (" + await ev(page, () => advCur._t.S.day) + ")");
  ok(await until(page, () => document.querySelector(".sib-day").classList.contains("late"), 10000), "the thread closes into a ring");
  await use(page, "throne", [0, -103], ["Enter", "To learn who my mother", "Then tell me"], true);
  ok(await ev(page, () => !!advCur._t.S.seen.sibyl_free), "past the last day the queen asks no price, and offers no way home");
  await endingScreen(page, "The Kingdom Under the Mountain");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("sibilla-kingdom")), "The Unwithering Rose is in the Archive");

  /* ---------- replay: pay for the answer ---------- */
  await replay(page);
  await ev(page, () => { const t = advCur._t; t.patch({ act: 3, area: "kingdom", stage: "kingdom", day: 60, know: 9, items: { medallion: true }, flags: { summoned: true } }); });
  await use(page, "throne", [0, -103], ["Enter", "To learn who my mother", "What is the price", "Take my name"], true);
  await endingScreen(page, "The Sibyl’s Answer");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("sibilla-knowledge")), "The Sibyl’s Leaf is in the Archive");

  /* ---------- replay: dance until dawn ---------- */
  await replay(page);
  await ev(page, () => { const t = advCur._t; t.patch({ act: 2, area: "mountain", flags: {} }); t.tp(15, -106); });
  ok(await until(page, () => advCur._t.talking && advCur._t.S.flags.met_fairies, 120000), "(fourth run) the dancers on the meadow");
  await drive(page, ["Dance.", "Dance until dawn"]);
  await endingScreen(page, "The Fairies’ Road");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("sibilla-dance") && MOE3D.archive.legendStatus("sibilla").state === "mastered"), "The Fairy’s Ribbon is in the Archive, and every ending has been found");
  await ev(page, () => setTimeout(() => document.querySelector('.adv-end button[data-k="exit"]').click(), 0)); await sleep(1500);   // (closing a big scene blocks software rendering for a while)
  ok(await until(page, () => !document.body.classList.contains("adv-open"), 300000), "exit returns to the site");
  ok(await ev(page, () => /4\/4 endings/.test(document.querySelector('.card[data-legend="sibilla"]').textContent)), "the legend card shows 4/4 endings");
  ok(await ev(page, () => !document.querySelector("#adv canvas")), "the adventure’s canvas is gone (resources released)");
  ok(requests.length === 0, "nothing loaded from the network");
  const real = errors.filter(e => !/GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no page errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL SIBILLA E2E TESTS PASSED"); process.exit(fails ? 1 : 0);
