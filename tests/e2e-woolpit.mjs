// End-to-end test of the Woolpit adventure (headless Chromium + SwiftShader, file:// launch, real input where practical).
//   node tests/e2e-woolpit.mjs [screenshot-dir]
import { launch, URL0, sleep, closeReveal, navIdle } from "./e2e-lib.mjs";
import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
const shot = async (page, n) => { if (SH) await page.screenshot({ path: `${SH}/${n}.png` }); };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const { browser, page, errors, requests } = await launch();
const T = "advCur._t";
const ev = (f, a) => page.evaluate(f, a);
// drive a conversation: queue = list of label substrings to pick in order; anything else -> "Leave"/first choice / press
const drive = (queue, max = 120, stops = []) => page.evaluate(async ([q, max, stops]) => {
  const t = advCur._t, wait = ms => new Promise(r => setTimeout(r, ms)); q = [...q]; let n = 0;
  while (n++ < max) {
    for (let i = 0; i < 400 && t.busy; i++) await wait(50);
    if (!t.talking) return "done:" + n;
    t.skip(); await wait(30); const v = t.view(); if (!v) { await wait(80); continue; }
    if (stops.includes(v.id)) return "stop:" + v.id;
    if (v.choices.length) { let k = -1; if (q.length) { k = v.choices.findIndex(c => c.label.includes(q[0])); if (k >= 0) q.shift(); }
      if (k < 0) k = v.choices.findIndex(c => /^(Leave|Not yet|Never mind)/.test(c.label)); if (k < 0) k = 0; t.pick(k); }
    else t.press();
    await wait(60);
  }
  return "max";
}, [queue, max, stops]);
const go = async (x, z) => { await ev(([x, z]) => advCur._t.tp(x, z), [x, z]); await sleep(150); };
const talkTo = async (id, x, z, queue) => { await go(x, z); const near = await ev(() => advCur._t.near()); ok(near.includes("talk:" + id), `near ${id} -> ${near.join(",")}`); await ev(() => advCur._t.interact()); return drive(queue); };
const useObj = async (id, x, z, queue = []) => { await go(x, z); const near = await ev(() => advCur._t.near()); ok(near.includes("obj:" + id), `can use ${id} -> ${near.join(",")}`); await ev(() => advCur._t.interact()); return drive(queue); };

/* ---------- site integration ---------- */
await page.goto(URL0); await page.waitForSelector("#cards .card");
const cards = await ev(() => [...document.querySelectorAll("#cards .card")].map(c => [c.dataset.legend, !!c.querySelector(".play")]));
ok(cards.some(([k, p]) => k === "woolpit" && p), "Woolpit card is marked as a 3D adventure");
ok(cards.some(([k, p]) => k === "hoia" && p), "v6: Hoia is a 3D adventure too (its short text story stays on its title screen)");
await page.evaluate(() => scrollTo(0, 2300)); await sleep(300); const yClick = await ev(() => scrollY);
await page.click('.card[data-legend="woolpit"]'); await page.waitForSelector(".adv-title", { timeout: 120000 }); await navIdle(page); const y0 = await ev(() => advScroll);
ok(await ev(() => document.body.classList.contains("adv-open") && !document.querySelector("#adv").hidden), "card opens the adventure overlay (page scroll locked)");
await sleep(900); await shot(page, "w01_title");
ok((await ev(() => document.querySelector(".adv-title h2").textContent)).includes("Woolpit"), "title screen shows the right adventure");

/* ---------- start, act 1 ---------- */
await page.click(".adv-title button.primary");
await page.waitForFunction(() => advCur && advCur._t.talking, null, { timeout: 120000 });
await sleep(1500); await ev(() => advCur._t.skip()); await shot(page, "w02_act1_intro");
ok(await ev(() => advCur._t.dlgVisible()), "dialogue box appears over the live 3D scene");
/* v9.1: Space and Enter read the dialogue on; they never take a choice by accident (the first choice has the focus) */
for (let i = 0; i < 10 && !(await ev(() => advCur._t.view().choices.length)); i++) { await page.keyboard.press("Space"); await sleep(500); }
await page.keyboard.press("Space"); await sleep(400);
const vc = await ev(() => advCur._t.view().id);
for (const k of ["Space", "Enter", "Space", "Enter", "NumpadEnter"]) { await page.keyboard.press(k); await sleep(300); }
ok(await ev(id => !!advCur._t.view() && advCur._t.view().id === id && advCur._t.view().choices.length > 0 && document.querySelectorAll(".dlg-c").length > 0, vc), "Space and Enter never pick a dialogue choice by accident (" + vc + ")");
ok(await ev(() => !!document.querySelector("#adv canvas.gl")), "3D canvas is present while talking");
ok((await drive(["Kneel slowly", "Hide them in Edith"])).startsWith("done"), "act 1 (arrival + decision where the children go) completes");
await sleep(600);
ok(await ev(() => advCur._t.S.act === 2 && advCur._t.S.where === "barn" && advCur._t.S.flags.gentle), "act 2 begins; choices are remembered (gentle, barn)");
ok(await ev(() => !advCur._t.talking && advCur._t.running), "player is free to explore after the intro");
await shot(page, "w03_act2_free");
const objective = await ev(() => document.querySelector(".adv-obj span").textContent); ok(/children will eat/.test(objective), "objective updates: " + objective);

/* ---------- real keyboard movement + collisions + bounds ---------- */
await go(2, 6); const p0 = await ev(() => advCur._t.pos());
await page.keyboard.down("KeyW"); await sleep(1500); await page.keyboard.up("KeyW"); const p1 = await ev(() => advCur._t.pos());
ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.4, `W key moves the player (${p0.map(n => n.toFixed(1))} -> ${p1.map(n => n.toFixed(1))})`);
await go(-17.0, -4.0); // church doorway; walk west into the wall line from outside the door side: try to cross the north wall
await go(-23, -11); await page.keyboard.down("KeyW"); await sleep(1200); await page.keyboard.up("KeyW");
await page.keyboard.down("KeyS"); await sleep(1200); await page.keyboard.up("KeyS");
const pc = await ev(() => advCur._t.pos());
ok(!(pc[0] > -28.5 && pc[0] < -18.5 && pc[1] > -8.5 && pc[1] < 0.5), "church walls block the player from walking through them");
await go(60, 4); await page.keyboard.down("KeyD"); await sleep(1200); await page.keyboard.up("KeyD");
const pb = await ev(() => advCur._t.pos()); ok(Math.hypot(pb[0] - 8, pb[1] - 4) <= 54.6, "world boundary keeps the player inside the map");

/* ---------- act 2: investigate, help, consequences ---------- */
ok((await talkTo("maud", -11.5, 14.6, ["What do you know", "remedy", "Give her your bread"])).startsWith("done"), "Mother Maud: hint + tonic trade");
ok(await ev(() => advCur._t.S.items.tonic && !advCur._t.S.items.bread), "tonic obtained; bread spent (state changed)");
await useObj("beans", 25, -12); ok(await ev(() => advCur._t.S.items.bean), "picked broad beans");
await useObj("well", 3, -0.2); ok(await ev(() => advCur._t.S.items.water), "drew water");
await useObj("pits", 26, 22); ok(await ev(() => advCur._t.S.clues.no_tracks), "examining the pits gives an (invented) clue");
await useObj("cloth", 30.5, 18.5); ok(await ev(() => advCur._t.S.items.cloth), "found the cloth scrap");
ok((await talkTo("aldwin", -14.4, -4.2, ["borrow the little handbell", "Explain that"])).startsWith("done"), "Father Aldwin lends the handbell");
ok(await ev(() => advCur._t.S.items.bell && advCur._t.S.rel.aldwin >= 1), "handbell obtained honestly -> Aldwin relation up");
const trust0 = await ev(() => advCur._t.S.trust);
ok((await talkTo("girl", 15.2, -13.2, ["fresh well water", "raw broad beans", "handbell", "herb tonic", "Point to the sun", "strange clothes", "Sit quietly", "Leave them"])).startsWith("done"), "children hub: water, beans, bell, tonic, sun, clothes, sit");
const st2 = await ev(() => ({ ...advCur._t.S }));
ok(st2.flags.fed && st2.flags.tonic_given && Object.keys(st2.words).length >= 4, `children fed, learned ${Object.keys(st2.words).length} words, trust ${trust0} -> ${st2.trust}`);
await shot(page, "w04_after_feeding");
await ev(() => advCur._t.toggleJournal()); await sleep(300); await page.click('.journal [data-t="codex"]'); await sleep(200);
ok((await ev(() => document.querySelectorAll(".journal .cx").length)) >= 3, "journal shows codex entries labelled historical/invented"); await shot(page, "w05_codex");
await page.click('.journal [data-t="x"]'); await sleep(200);
ok(!(await ev(() => document.querySelector(".journal"))), "journal closes");

/* ---------- pause menu ---------- */
await page.keyboard.press("Escape"); await page.waitForSelector(".adv-pause"); ok(true, "Esc opens the pause menu"); await shot(page, "w06_pause");
await page.click('.adv-pause [data-k="res"]'); await sleep(300); ok(!(await ev(() => document.querySelector(".adv-pause"))), "pause menu resumes");

/* ---------- rest -> act 3 ---------- */
await useObj("bed", 19.2, -15.5, ["Rest until dawn"]);
await sleep(500); const st3 = await ev(() => ({ act: advCur._t.S.act, boy: advCur._t.S.boy, fluent: advCur._t.S.fluent, skin: advCur._t.S.skin }));
ok(st3.act === 3 && st3.fluent && st3.boy === "lives", `after resting: act 3, girl speaks English, boy ${st3.boy} (careful help changes history)`);
await shot(page, "w07_act3");
ok(await ev(() => { const p = advCur._t.npcPos("girl"); return Math.abs(p[0] - 5.2) < 1; }), "consequence: the girl now walks the village green");
await ev(() => advCur._t.persist()); ok(await ev(() => !!localStorage.getItem("moe.woolpit.save.v1")), "progress saved to localStorage");
ok((await talkTo("girl", 4.3, -3.2, ["Where do you come from", "bells", "Would you go back"])).startsWith("done"), "talk to the girl in English: tale of St Martin’s Land");
ok(await ev(() => advCur._t.S.flags.heard_tale && advCur._t.S.flags.heard_bells_detail), "learned about the bells and the hollow " + JSON.stringify(await ev(() => ({ trust: advCur._t.S.trust, f: advCur._t.S.flags, once: advCur._t.S.once }))));
await talkTo("edith", 21, -11.2, ["standing by us", "would you speak for her"]);
await talkTo("walter", -6, -5.2, ["What are you writing"]);

/* ---------- dusk, finale, the hollow, ending ---------- */
await ev(() => { window.__ph = new Set(); setInterval(() => { if (advCur) window.__ph.add(advCur._t.phase); }, 100); });
await go(-3.5, 1.6); await ev(() => advCur._t.interact());
ok((await drive(["Wait for dusk"], 30, ["finale"])) === "stop:finale", "waiting for dusk (calm village) leads to the finale scene"); await sleep(1800);
ok(await ev(() => advCur._t.phase === "dusk"), "dusk look is applied (lighting changed)"); await shot(page, "w08_finale_dusk");
const fin = await ev(() => advCur._t.view().choices.map(c => c.label)); ok(fin.some(l => /hollow/.test(l)) && fin.length >= 3, "finale offers several different ways out: " + fin.join(" | "));
ok((await drive(["Walk with her to the hollow"], 30, ["hollow_arrive"])) === "stop:hollow_arrive", "walking to the hollow starts the hollow scene"); await sleep(2200);
ok(await ev(() => advCur._t.phase === "hollow"), "hollow look (mist, stars) is applied"); await shot(page, "w09_hollow");
await drive(["Ask her to stay"], 60);
await page.waitForSelector(".adv-end", { timeout: 60000 }); await sleep(800); await shot(page, "w10_ending");
const end = await ev(() => ({ id: advCur._t.S.ending, title: document.querySelector(".adv-end h2").textContent, found: document.querySelector(".adv-end .found").textContent }));
ok(end.id === "both", `good run ends with "${end.title}" (${end.found})`);
ok(await ev(() => !localStorage.getItem("moe.woolpit.save.v1")), "save is cleared after an ending (found endings are kept)");
ok(await ev(() => window.__ph.has("dusk") && window.__ph.has("hollow") && window.__ph.has("day2")), "lighting went through the planned phases: " + (await ev(() => [...window.__ph].join(">"))));

/* ---------- the other five endings through their final nodes ---------- */
const seen = new Set(["both"]);
for (const id of ["servant", "bells", "font", "omen", "ink"]) {
  await closeReveal(page); await page.click('.adv-end [data-k="again"]'); await page.waitForFunction(() => advCur && advCur._t.S && advCur._t.S.seen.a1_arrive && !advCur._t.S.ending && advCur._t.talking, null, { timeout: 120000 }); await sleep(300);
  await ev(() => { advCur._t.patch({ act: 3, boy: "dead", skin: 1, fluent: true, where: "manor" }); });
  await ev(id => advCur._t.jump("end_" + (id === "servant" ? "manor" : id)), id);
  try { await page.waitForSelector(".adv-end", { timeout: 30000 }); } catch (e) { /* retry below */ }
  const r = await ev(() => document.querySelector(".adv-end h2")?.textContent || null); ok(!!r, `ending screen for "${id}" renders: ${r}`); if (r) seen.add(id);
}
const total = await ev(() => Object.keys(advCur._t.endingsFound()).length); ok(total >= 4, `endings recorded between visits: ${total}`);
await shot(page, "w10_last_ending");

/* ---------- exit ---------- */
await closeReveal(page); await page.click('.adv-end [data-k="exit"]'); await sleep(400); await navIdle(page);
ok(await ev(() => document.querySelector("#adv").hidden && !document.body.classList.contains("adv-open")), "exit returns to the legend selection");
// v5: the navigation restores the scroll position of the moment the legend was opened (the history entry it left)
const y1 = await ev(() => scrollY); ok(Math.abs(y1 - yClick) < 60 || Math.abs(y1 - y0) < 60, `page scroll position restored (${yClick} -> ${y1})`);
ok(await ev(() => document.querySelector("main").style.display !== "none"), "page content is visible again");
ok(requests.length === 0, "no external network requests (offline-safe): " + requests.join(","));
ok(errors.length === 0, "no JS errors: " + errors.join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nALL WOOLPIT E2E CHECKS PASSED"); await browser.close(); process.exit(fails ? 1 : 0);
