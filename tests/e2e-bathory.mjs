// End-to-end test of Elizabeth Báthory — The Blood Countess (headless Chromium + SwiftShader, file:// launch).
//   node tests/e2e-bathory.mjs [screenshot-dir]
// Software rendering runs at a few frames per second, so the game runs at 4x speed (_t.setTimeScale) and the player is moved
// with _t.tp (outdoors) / _t.tpi (interior, local coordinates). Every conversation, choice, document, connection, set piece,
// save and Archive unlock goes through the real game code. The first run plays Acts I–IV in full to the Unanswered ending;
// the Palatine ending is reached for real in the inn; the Monster and Conspiracy runs start from a patched Act III state
// (the evidence those routes need, as the story test gathers it through the dialogue graph) and play the night and report.
import { launch, URL0, sleep, closeReveal, navIdle } from "./e2e-lib.mjs";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png`, timeout: 180000 }).catch(() => {}); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const ev = (page, f, a) => page.evaluate(f, a);
const until = async (page, f, ms = 240000, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(f, a).catch(() => false)) return true; await sleep(300); } return false; };
/** read the dialogue through (closing documents as a player would), choosing the options whose label contains the queued words; stops at a choice when the queue is empty */
const drive = (page, q = [], max = 400, keepDocs = false) => page.evaluate(async ([q, max, keepDocs]) => {
  const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); q = [...q]; let idle = 0;
  for (let n = 0; n < max; n++) {
    if (t.docOpen) { if (keepDocs && !t.talking) return "doc"; t.closeDoc(); idle = 0; await w(400); continue; }
    if (t.revealing) return "reveal";   // the Archive reveal is handled by the test, as a player would
    if (!t.talking && !t.busy && !t.cine) { if (++idle > 8) return "done"; await w(250); continue; } idle = 0;
    if (t.talking && !t.busy) { t.skip(); await w(30); const v = t.view(); if (v) { if (v.choices.length) { if (!q.length) return "choice"; let k = v.choices.findIndex(c => c.label.includes(q[0])); if (k >= 0) q.shift(); t.pick(Math.max(0, k)); } else t.press(); } }
    await w(220);
  }
  return "max";
}, [q, max, keepDocs]);
/** read on until the dialogue offers a choice (without choosing) */
const toChoices = page => page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms));
  for (let n = 0; n < 200; n++) { if (t.talking && !t.busy) { t.skip(); await w(30); const v = t.view(); if (v && v.choices.length) return v.choices.map(c => c.label); if (v) t.press(); } await w(220); } return []; });
/** stand at a place and use what is nearest */
const use = async (page, id, at, q = [], inside = false, keepDocs = false) => {
  await ev(page, ([x, z, k]) => k ? advCur._t.tpi(x, z) : advCur._t.tp(x, z), [at[0], at[1], inside]); await sleep(500);
  const near = await ev(page, () => advCur._t.near()); ok(near[0] === id, `can reach ${id} (${near.join(",")})`);
  await ev(page, () => advCur._t.interact()); await sleep(300); return drive(page, q, 400, keepDocs);
};
async function openBt(page, reload = true) {
  if (reload) { await page.goto(URL0); await page.waitForSelector("#cards .card"); }
  await navIdle(page); await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(300);
  await page.click('.card[data-legend="bathory"]'); await page.waitForSelector(".adv-title", { timeout: 180000 });
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
  await ev(page, () => advCur._t.setTimeScale(4)); await until(page, () => advCur._t.talking, 60000); await drive(page);
}
/** the night and the report, from a patched Act III state */
async function nightAndReport(page, patch, finalPicks, reportPick, title) {
  await ev(page, p => { const t = advCur._t; t.patch(p); t.tpi(-15, 3.4); }, patch); await sleep(600);
  await ev(page, () => advCur._t.connect("ev_testimonies", "ev_servants"));   // the first new connection of the run makes the case complete
  ok(await until(page, () => advCur._t.talking && advCur._t.view() && advCur._t.view().id === "summons", 60000), "the castellan comes to fetch you");
  await drive(page);
  ok(await until(page, () => advCur._t.S.act === 4 && advCur._t.room === "chambers" && (advCur._t.talking || advCur._t.S.seen.eliza_final), 120000), "night: you stand in her apartments");
  await drive(page, finalPicks); ok(await ev(page, () => !!advCur._t.S.flags.final_done), "the last conversation is over");
  await use(page, "report", [-15, 3.4], [reportPick], true);
  await endingScreen(page, title);
}

{
  const { browser, page, errors, requests } = await launch({ width: 1280, height: 720 });
  await page.addInitScript(() => sessionStorage.setItem("moe.intro", "1"));
  await page.goto(URL0); await page.waitForSelector("#cards .card"); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  /* ---------- site integration ---------- */
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  ok(await ev(page, () => !!document.querySelector('.card[data-legend="bathory"] .play')), "Báthory has a legend card marked as a 3D adventure");
  ok(await ev(page, () => /Historical case/.test(document.querySelector('.card[data-legend="bathory"]').textContent) && !!document.querySelector('.card[data-legend="bathory"] svg')), "…with its category and its own artwork");
  ok(await ev(page, () => { const t = document.querySelector('.card[data-legend="bathory"]').textContent; return /Čachtice/.test(t) && /Slovakia/.test(t) && /Kingdom of Hungary/.test(t); }), "…and its place: Čachtice, Slovakia, then the Kingdom of Hungary");
  const pinLabel = await ev(page, () => { const p = [...document.querySelectorAll('#map .pin')].find(p => /Báthory/.test(p.getAttribute("aria-label"))); return p ? p.getAttribute("aria-label") : ""; });
  ok(/Kingdom of Hungary/.test(pinLabel) && /Slovakia/.test(pinLabel), "a pin for Báthory stands on the map, labelled with Slovakia and the Kingdom of Hungary (" + pinLabel + ")");
  ok(await ev(page, () => { const pin = [...document.querySelectorAll('#map .pin')].find(p => /Báthory/.test(p.getAttribute("aria-label"))), sk = document.querySelector('#map path[data-c="SK"]'), hu = document.querySelector('#map path[data-c="HU"]'); const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(pin.getAttribute("transform")); const pt = document.getElementById("map").createSVGPoint(); pt.x = +m[1]; pt.y = +m[2]; return sk && sk.isPointInFill(pt) && !(hu && hu.isPointInFill(pt)); }), "the pin stands inside Slovakia (Čachtice Castle, 48.725 N 17.761 E), not inside modern Hungary");
  ok(await ev(page, () => { const p = document.querySelector('#map path[data-c="SK"]'); return p && p.classList.contains("leg"); }), "Slovakia is marked as a country with a legend");
  await ev(page, () => { const pin = [...document.querySelectorAll('#map .pin')].find(p => /Báthory/.test(p.getAttribute("aria-label"))); pin.dispatchEvent(new MouseEvent("mouseenter")); }); await sleep(200);
  ok(/Kingdom of Hungary/.test(await ev(page, () => (document.getElementById("tip") || {}).textContent || "")), "the pin's tooltip names the Kingdom of Hungary");
  await ev(page, () => document.querySelector('#map path[data-c="SK"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(800);
  ok(await ev(page, () => /Blood Countess/.test(document.getElementById("preview").textContent) && /3D adventure/.test(document.getElementById("preview").textContent) && /Kingdom of Hungary/.test(document.getElementById("preview").textContent)), "clicking Slovakia on the map offers the 3D adventure and explains the historical kingdom");
  ok(await ev(page, () => MOE3D.archive.CARDS.filter(c => c.legend === "bathory").length === 7 && MOE3D.archive.CARDS.length === 38), "the Archive has her case file, five relics and the family seal (38 cards)");
  ok(await ev(page, () => MOE3D.ui.pageSky && MOE3D.ui.pageSky().state().hasOwnProperty("bathory")), "the legend has a constellation in the page sky");

  /* ---------- title screen and text version ---------- */
  await openBt(page, false); await sleep(600); await shot(page, "b01_title");
  const title = await ev(page, () => document.querySelector(".adv-title").textContent);
  ok(/Blood Countess/.test(title) && /Kingdom of Hungary/.test(title) && /legend, not established fact/.test(title), "the title screen names the place and separates legend from fact");
  await ev(page, () => document.querySelector('.adv-title button[data-k="text"]').click()); await page.waitForSelector("#story[open]", { timeout: 60000 });
  ok(/Báthory/.test(await ev(page, () => document.getElementById("st-title").textContent)), "the short text version opens");
  await page.keyboard.press("Escape"); await navIdle(page); await sleep(800);

  /* ---------- Act I: the village of Čachtice ---------- */
  await openBt(page, false); await newGame(page);
  ok(await until(page, () => advCur._t.cine > 0, 20000), "the first sight of the castle is a cinematic"); await shot(page, "b02_castle_first_sight");
  await until(page, () => advCur._t.talking, 120000); await drive(page); await shot(page, "b03_village");
  ok(await ev(page, () => !!document.querySelector("#adv canvas.gl") && advCur._t.zone === "surface" && advCur._t.phase === "afternoon" && advCur._t.S.act === 1), "3D canvas, Čachtice in the July afternoon, Act I");
  ok(/secretary/.test(await ev(page, () => document.querySelector(".adv-obj span").textContent)), "objective: find the Palatine’s secretary");
  { const p0 = await ev(page, () => advCur._t.pos()); await page.keyboard.down("KeyW"); for (let i = 0; i < 80; i++) { await sleep(250); const p = await ev(page, () => advCur._t.pos()); if (Math.hypot(p[0] - p0[0], p[1] - p0[1]) > 1) break; } await page.keyboard.up("KeyW"); const p1 = await ev(page, () => advCur._t.pos()); ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1, "W walks the clerk through the village"); }
  ok(!(await ev(page, () => { const t = advCur._t; t.tp(0, 20); return [[0, 40], [50, 0], [20, -60]].some(([x, z]) => t.canWalk(x - t.I.x, z - t.I.z)); })), "the village has edges (no walking off the map)");
  await use(page, "road", [0.5, -25]); ok(await ev(page, () => !!advCur._t.S.seen.road_wait && advCur._t.S.act === 1), "the castle road waits until you have listened");
  await use(page, "secretary", [10.5, -1.2], ["Why has there been no trial", "Leave"], false, true);
  ok(await ev(page, () => advCur._t.S.clues.ev_king && advCur._t.S.clues.ev_walled), "Lőrinc Vass: the King’s letter and the Palatine’s description");
  ok(await until(page, () => advCur._t.docOpen, 10000), "a letter opens in the document reader"); await shot(page, "b04_document");
  ok(await ev(page, () => /Reliability/.test(document.querySelector(".bt-docview").textContent) && /Historical record|Disputed|Invented/.test(document.querySelector(".bt-docview").textContent)), "…showing its reliability and its basis");
  await drive(page);
  await use(page, "marta", [4.2, 7.6], ["What do people say", "Did you know anyone", "I will ask about Anka", "Leave"]);
  ok(await ev(page, () => advCur._t.S.clues.ev_rumour && advCur._t.S.clues.ev_marta && advCur._t.S.flags.paid_marta), "Marta: the blood-bath story, her daughter Anka, your promise");
  await use(page, "gergely", [-7.8, 15], ["What was she like", "And the accusations", "Leave"]);
  await use(page, "sexton", [-12.2, -2], ["Show me the burials", "Did the old pastor", "Leave"]);
  await use(page, "zuzana", [21.4, 12.4], ["I am not here to accuse"]);
  ok(await ev(page, () => ["ev_gergely", "ev_burials", "ev_zuzana"].every(k => advCur._t.S.clues[k])), "Gergely, the sexton’s register and the washerwoman’s account");
  ok(/7/.test(await ev(page, () => document.querySelector(".bt-ev b").textContent)), "the HUD counts seven pieces of evidence");
  /* the investigation board, by clicking the cards like a player */
  await ev(page, () => advCur._t.toggleJournal()); await sleep(400);
  ok(await ev(page, () => document.querySelectorAll(".journal .bt-card").length === 7 && /Investigation/.test(document.querySelector(".journal .jtabs").textContent)), "the journal opens on the investigation board with seven cards");
  await ev(page, () => document.querySelector('.journal .bt-card[data-ev="ev_marta"]').click()); await sleep(200);
  ok(await ev(page, () => document.querySelector('.journal .bt-card[data-ev="ev_marta"]').classList.contains("sel") && !document.querySelector(".journal .bt-read").hidden), "selecting a card shows it and waits for a second one");
  await ev(page, () => document.querySelector('.journal .bt-card[data-ev="ev_king"]').click()); await sleep(200);
  ok(await ev(page, () => /do not seem to bear/.test(document.querySelector(".journal .bt-read").textContent) && Object.keys(advCur._t.S.links).length === 0), "two unrelated pieces do not connect");
  await ev(page, () => document.querySelector('.journal .bt-card[data-ev="ev_marta"]').click()); await sleep(150);
  await ev(page, () => document.querySelector('.journal .bt-card[data-ev="ev_burials"]').click()); await sleep(300);
  ok(await ev(page, () => advCur._t.S.links.l_anka && /Corroborates/.test(document.querySelector(".journal .bt-read").textContent) && document.querySelectorAll(".journal .bt-links li").length === 1), "Marta’s daughter + the burial register: a corroboration, listed on the board"); await shot(page, "b05_board");
  ok(await ev(page, () => /The case for the accusations/.test(document.querySelector(".journal .bt-bars").textContent) && /connections 1\/2/.test(document.querySelector(".journal .bt-bars").textContent)), "the board shows how far each conclusion is from being defensible");
  await ev(page, () => document.querySelector('.journal [data-t="codex"]').click()); await sleep(300);
  ok(await ev(page, () => { const t = document.querySelector(".journal").textContent; return /Historical/.test(t) && /Later legend/.test(t) && /Invented for this game/.test(t); }), "the codex labels history, legend and invention");
  await ev(page, () => document.querySelector('.journal [data-t="journal"]').click()); await sleep(300);
  ok(await ev(page, () => /Reliability/.test(document.querySelector(".journal").textContent)), "the journal tab lists every document with its reliability");
  await ev(page, () => advCur._t.toggleJournal());
  /* save and Continue */
  await ev(page, () => advCur._t.persist()); ok(await ev(page, () => { const s = JSON.parse(localStorage.getItem("moe.bathory.save.v1")); return s.s.clues.ev_zuzana && s.s.links.l_anka && s.pos.length === 3; }), "progress is saved (evidence and connections)");
  await ev(page, () => document.querySelector('.abtn[data-a="pause"]').click()); await sleep(400);
  await ev(page, () => setTimeout(() => document.querySelector('.adv-pause button[data-k="exit"]').click(), 0));
  ok(await until(page, () => !document.body.classList.contains("adv-open"), 120000), "exit returns to the site");
  ok(await ev(page, () => /In progress/.test(document.querySelector('.card[data-legend="bathory"]').textContent)), "the card shows the adventure in progress");
  await openBt(page, false); ok(await ev(page, () => !!document.querySelector('.adv-title button[data-k="cont"]')), "the title screen offers Continue");
  await newGame(page, '.adv-title button[data-k="cont"]');
  ok(await ev(page, () => advCur._t.S.links.l_anka && advCur._t.S.clues.ev_zuzana && advCur._t.S.act === 1), "Continue restores the investigation");

  /* ---------- Act II: the castle ---------- */
  const c0 = await ev(page, () => advCur._t.cines);
  await use(page, "road", [0.5, -25], ["Climb to the castle"]);
  ok(await until(page, c0 => advCur._t.S.act === 2 && advCur._t.S.area === "castle" && advCur._t.cines > c0, 60000, c0), "the climb ends in the courtyard: Act II, with its cinematic"); await shot(page, "b06_courtyard");
  ok(await until(page, () => !advCur._t.cine && advCur._t.phase === "dusk", 120000), "dusk over the upper castle");
  await use(page, "door_in", [0, -125.6]);
  ok(await until(page, () => advCur._t.zone === "inside" && advCur._t.room === "hall" && !advCur._t.cine, 120000), "through the palace door into the great hall"); await shot(page, "b07_hall");
  ok(await ev(page, () => advCur._t.phase === "inside" && !advCur._t.wopt.store && !advCur._t.canWalk(24, -4.4)), "the storeroom is locked");
  await use(page, "store_door", [24, -5.6], [], true); ok(await ev(page, () => !!advCur._t.S.seen.store_locked), "…and says the castellan has the key");
  await use(page, "door_out", [0, -1.4], [], true);
  ok(await until(page, () => advCur._t.zone === "surface" && advCur._t.S.area === "castle" && !advCur._t.cine, 120000), "back out to the courtyard");
  await use(page, "castellan", [3.2, -113.4], ["May I have the key", "Leave"]);
  ok(await ev(page, () => !!advCur._t.S.items.storekey && advCur._t.wopt.store), "the King’s letter earns the storeroom key");
  await use(page, "door_in", [0, -125.6]); await until(page, () => advCur._t.zone === "inside" && !advCur._t.cine, 120000);
  ok(await ev(page, () => advCur._t.canWalk(24, -4.4)), "the storeroom door now opens");
  await use(page, "hall_chest", [0, -9.4], [], true); await use(page, "library_lectern", [-19, 2.6], [], true); await use(page, "library_shelf", [-23.6, -1.8], [], true);
  ok(await ev(page, () => ["ev_testimonies", "ev_servants", "ev_verdict"].every(k => advCur._t.S.clues[k])), "the statements, the confessions, the verdict");
  await use(page, "library_desk", [-15, 2], [], true); ok(await ev(page, () => advCur._t.S.clues.ev_register && advCur._t.S.flags.draught), "the household register — and a draught behind the bookcase");
  ok(!(await ev(page, () => advCur._t.canWalk(-25, 1))), "the bookcase still blocks the wall");
  await use(page, "library_case", [-23.6, 1.4], [], true);
  ok(await until(page, () => advCur._t.S.flags.passage_open && advCur._t.secretK > 0.95 && !advCur._t.cine, 60000) && await ev(page, () => advCur._t.canWalk(-25, 1)), "the bookcase swings open on a walled passage"); await shot(page, "b08_passage");
  await use(page, "passage_niche", [-32, 1], [], true); ok(await ev(page, () => !!advCur._t.S.clues.ev_comb), "a comb marked D. Sz. in the niche");
  await use(page, "ilka", [-18, -11.2], ["What do the other servants say", "Is she ever allowed", "Leave"], true);
  ok(await ev(page, () => advCur._t.S.clues.ev_650 && advCur._t.S.clues.ev_ilka), "Ilka: the 650 — a report of a report");
  await use(page, "gallery_portrait", [16, -6], [], true);
  /* ---------- the first meeting ---------- */
  ok(await ev(page, () => advCur._t.wopt.chambers && advCur._t.canWalk(24, -7.6)), "with enough evidence her apartments are open");
  await ev(page, () => advCur._t.tpi(26, -15)); await sleep(500);
  ok((await ev(page, () => advCur._t.near()))[0] === "elizabeth", "the countess is in her apartments");
  await ev(page, () => advCur._t.interact());
  ok(await until(page, () => advCur._t.cine > 0, 10000), "the first meeting is a cinematic"); await shot(page, "b09_first_meeting");
  ok(await until(page, () => advCur._t.talking && advCur._t.view() && advCur._t.view().who === "elizabeth", 120000), "she speaks"); await shot(page, "b10_elizabeth");
  const opts = await toChoices(page);
  ok(opts.some(l => /servants confessed/.test(l)) && opts.some(l => /bathe in blood/.test(l)) && opts.some(l => /Anka/.test(l)) && !opts.some(l => /Crown owes/.test(l)), "her questions depend on what you found (servants, the rumour, Anka — not the debt you have not read)");
  await drive(page, ["I have come to hear", "In the village they say", "Four of your servants", "That is enough", "I don’t know yet"]);
  ok(await ev(page, () => advCur._t.S.act === 3 && advCur._t.S.clues.ev_freely && advCur._t.S.flags.eliza_leave), "Act III: what you saw yourself, and her leave to read the chests");
  /* ---------- Act III: the investigation ---------- */
  await use(page, "chamber_desk", [19.6, -16.4], [], true);
  ok(await ev(page, () => advCur._t.S.clues.ev_letter && !!JSON.parse(localStorage.getItem("moe.bathory.finds.v1")).letter), "her letter to her husband (recorded as a find)");
  ok(await until(page, () => !!document.querySelector("dialog.reveal"), 30000), "…and the Archive reveals it at once, mid-game"); await shot(page, "b11_reveal");
  await closeReveal(page, 30000); await until(page, () => !document.querySelector("dialog.reveal"), 30000); await drive(page);
  ok(await ev(page, () => MOE3D.archive.isUnlocked("bathory-letter")), "Her Letter to Ferenc is in the Archive");
  ok(await ev(page, () => advCur._t.S.act === 3 && !advCur._t.S.flags.summoned), "no summons before the connections are made");
  await ev(page, () => { const t = advCur._t; for (const [a, b] of [["ev_rumour", "ev_testimonies"], ["ev_650", "ev_register"], ["ev_walled", "ev_freely"], ["ev_comb", "ev_servants"]]) t.connect(a, b); });
  ok(await ev(page, () => ["l_baths", "l_count", "l_cell", "l_dorka"].every(k => advCur._t.S.links[k])), "four contradictions found on the board");
  ok(await until(page, () => advCur._t.talking && advCur._t.view() && advCur._t.view().id === "summons", 60000), "the castellan comes to fetch you: she asks for you tonight");
  await drive(page);
  ok(await until(page, () => advCur._t.S.act === 4 && advCur._t.room === "chambers", 120000), "Act IV: night, her apartments"); await shot(page, "b12_night");
  ok(await until(page, () => advCur._t.talking && advCur._t.view() && advCur._t.view().who === "elizabeth", 60000), "the final conversation begins");
  await drive(page, ["Dorottya Szentes", "Thurzó wrote", "Did you do what they say", "I have heard enough"]);
  ok(await ev(page, () => advCur._t.S.flags.final_done && advCur._t.S.seen.eliza_f_comb && advCur._t.S.seen.eliza_f_cell), "questions only your evidence allows (the comb, the walled room)");
  ok(/library/.test(await ev(page, () => document.querySelector(".adv-obj span").textContent)), "objective: write your report in the library");
  await use(page, "report", [-15, 3.4], [], true);
  ok(await ev(page, () => advCur._t.talking && advCur._t.view().choices.some(c => /cannot be established/.test(c.label)) && !advCur._t.view().choices.some(c => /substantially/.test(c.label))), "the report offers only the conclusions your evidence supports");
  await drive(page, ["cannot be established"]);
  await endingScreen(page, "The Unanswered History"); await shot(page, "b13_end_unanswered");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("bathory-unanswered") && MOE3D.archive.isUnlocked("bathory-seal")), "The Countess’s Portrait and the Báthory Family Seal are in the Archive");
  ok(await ev(page, () => JSON.parse(localStorage.getItem("moe.bathory.endings.v1")).unanswered === true && !localStorage.getItem("moe.bathory.save.v1")), "ending recorded, save cleared");
  ok(await ev(page, () => /What the sources can establish/.test(document.querySelector(".adv-end").textContent) && /blood baths no witness mentioned/.test(document.querySelector(".adv-end").textContent)), "the ending separates your conclusion from what the sources establish, and lists your contradictions");

  /* ---------- replay: sign the Palatine's version (for real, in the inn) ---------- */
  await replay(page);
  await use(page, "secretary", [10.5, -1.2], ["Sign the report", "Sign it"]);
  await endingScreen(page, "The Palatine’s Version");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("bathory-palatine")), "The Sealed Report is in the Archive");

  /* ---------- replay: the Monster (from a patched Act III) ---------- */
  await replay(page);
  const ACC = { act: 3, area: "inside", items: { commission: true, storekey: true }, flags: { paid_marta: true, eliza_leave: true, passage_open: true, draught: true, summoned: false },
    clues: Object.fromEntries(["ev_king", "ev_walled", "ev_rumour", "ev_marta", "ev_burials", "ev_zuzana", "ev_testimonies", "ev_servants", "ev_verdict", "ev_register", "ev_freely"].map(k => [k, true])),
    links: { l_anka: true, l_wash: true }, seen: { start: 1, secretary_1: 1, marta_1: 1, marta_anka: 1, sexton_1: 1, zuzana_1: 1, castellan_1: 1, hall_chest: 1, library_lectern: 1, library_shelf: 1, library_desk: 1, eliza_1: 1 } };
  await nightAndReport(page, ACC, ["The register", "Did you do what they say", "I have heard enough"], "substantially proven", "The Monster");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("bathory-monster")), "The Witness Roll is in the Archive");

  /* ---------- replay: the Conspiracy (from a patched Act III) ---------- */
  await replay(page);
  const POL = { ...ACC, flags: { ...ACC.flags, eliza_respect: true }, clues: { ...ACC.clues, ev_debt: true, ev_family: true, ev_will: true }, links: { l_motive: true, l_lands: true } };
  await nightAndReport(page, POL, ["Your family made sure", "I have heard enough"], "Political and financial", "The Conspiracy");
  ok(await ev(page, () => MOE3D.archive.isUnlocked("bathory-conspiracy") && MOE3D.archive.legendStatus("bathory").state === "mastered"), "The Crown’s Debt is in the Archive, and every ending has been found");
  await ev(page, () => setTimeout(() => document.querySelector('.adv-end button[data-k="exit"]').click(), 0)); await sleep(1500);
  ok(await until(page, () => !document.body.classList.contains("adv-open"), 300000), "exit returns to the site");
  ok(await ev(page, () => /4\/4 endings/.test(document.querySelector('.card[data-legend="bathory"]').textContent)), "the legend card shows 4/4 endings");
  ok(await ev(page, () => !document.querySelector("#adv canvas")), "the adventure’s canvas is gone (resources released)");
  ok(requests.length === 0, "nothing loaded from the network");
  const real = errors.filter(e => !/GPU stall|WebGL/i.test(e)); ok(real.length === 0, "no page errors" + (real.length ? ": " + real.join(" | ") : ""));
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL BATHORY E2E TESTS PASSED"); process.exit(fails ? 1 : 0);
