// End-to-end test of the v4 visual layer and the collectible Archive (headless Chromium, file:// launch).
//   node tests/e2e-archive.mjs [screenshot-dir]
// Covers: landing page + skippable intro, cards open the right legend, sealed cards hide their names, real unlocking from a
// text ending (Hoia) and from a 3D adventure ending (Woolpit), no duplicates on repeat, persistence after reload,
// old saves (made before the Archive existed), keyboard use, map + globe, reduced motion and the phone layout.
import { launch, URL0, sleep, closeReveal, navIdle, overlayClosed } from "./e2e-lib.mjs"; import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const shot = (page, n) => SH ? page.screenshot({ path: `${SH}/${n}.png` }) : null;
const arch = page => page.evaluate(() => JSON.parse(localStorage.getItem("moe.archive.v1") || "{}"));
const counts = page => page.evaluate(() => ({ n: +document.getElementById("arch-n").textContent, t: +document.getElementById("arch-t").textContent, got: document.querySelectorAll("#archive-grid .acard.is-got").length, locked: document.querySelectorAll("#archive-grid .acard.is-locked").length }));
// v6: the Hoia card opens a 3D adventure; its short text story is one click away on the adventure's title screen
const openHoiaText = async (page, tap = false) => {
  await navIdle(page); if (tap) await page.tap('.card[data-legend="hoia"]'); else await page.click('.card[data-legend="hoia"]');
  await page.waitForSelector('.adv-title button[data-k="text"]', { timeout: 180000 }); await navIdle(page);
  await page.evaluate(() => document.querySelector('.adv-title button[data-k="text"]').click());
  await page.waitForSelector("#story[open] #st-choices button", { timeout: 30000 }); await navIdle(page);
};
const finishHoia = async (page) => {
  await openHoiaText(page);
  for (const lab of ["Yes, with a flashlight", "Follow the lights"]) await page.click(`#st-choices button:has-text("${lab}")`);
  await page.waitForSelector('#st-choices button:has-text("Replay the story")');
};

/* ============================================================ A. desktop, brand-new visitor */
{
  const { browser, page, errors, requests } = await launch({ width: 1366, height: 800 });
  await page.goto(URL0); await page.waitForSelector("#archive-grid .acard");
  const introAtLoad = await page.evaluate(() => ({ playing: document.getElementById("intro").classList.contains("intro"), skip: !document.querySelector(".hero-skip").hidden && getComputedStyle(document.querySelector(".hero-skip")).display !== "none" }));
  ok((await page.textContent("h1")).replace(/\s+/g, " ").trim() === "Mysteries of Europe", "landing page: title MYSTERIES OF EUROPE");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector("h1")).textTransform === "uppercase" && document.querySelector(".hero-sub").textContent.length > 10), "landing page: title is set in capitals, subtitle present");
  ok((await page.getAttribute(".hero-cta .btn-primary", "href")) === "#mappe" && /enter the archive/i.test(await page.textContent(".hero-cta .btn-primary")), "primary button 'Enter the Archive' leads to the map");
  ok(await page.waitForFunction(() => !!document.querySelector(".hero-gl.on") && !!document.querySelector(".hero-fx"), null, { timeout: 60000 }).then(() => true, () => false), "hero: the 3D landscape is rendered and the particle canvas is built");
  ok(introAtLoad.playing && introAtLoad.skip, `first visit: intro plays and offers 'Skip intro' (${JSON.stringify(introAtLoad)})`);
  await page.keyboard.press("Escape"); await sleep(150);
  ok(await page.evaluate(() => !document.getElementById("intro").classList.contains("intro") && document.getElementById("intro").classList.contains("ready")), "Esc skips the intro at once");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".hero-title")).opacity === "1"), "title is fully legible after the intro");
  /* nav */
  for (const [id, label] of [["mappe", "Maps"], ["leggende", "Legends"], ["archivio", "Archive"], ["giochi", "3D Mini-games"]]) {
    await page.click(`#menu a:has-text("${label}")`);
    // v5: every move is a cinematic journey (the flight to the map takes a while in software rendering): wait for it to end
    await page.waitForFunction(() => !(window.MOE3D && MOE3D.navigator && MOE3D.navigator.busy), null, { timeout: 120000 }).catch(() => {});
    const arrived = await page.waitForFunction(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0 && location.hash === "#" + i; }, id, { timeout: 8000 }).then(() => true, () => false);
    ok(arrived, `navigation: "${label}" scrolls to its section`); await sleep(400);
  }
  /* archive: brand-new visitor */
  let c = await counts(page); ok(c.n === 6 && c.t === 38 && c.got === 6 && c.locked === 32, `Archive starts with 6 of 38 cards (${JSON.stringify(c)})`);
  const txt = await page.textContent("#archive-grid");
  ok(!/Little Bell|Wykes Household|Watch That Lost|Last Bar|Four Falling|Inkhorn|Tide-Stained|1968 Negative|Tally Stick|Skull Lantern|Comb and the Towel|Mortar and Pestle|Little Doll|Notebook|Fairy’s Ribbon|Upward Hourglass|Sibyl’s Leaf|Unwithering Rose|Sibyl’s Seal|Letter to Ferenc|Witness Roll|Crown’s Debt|Countess’s Portrait|Sealed Report|Báthory Family Seal/.test(txt), "sealed relics do not reveal their names");
  ok(await page.evaluate(() => [...document.querySelectorAll(".acard.is-locked")].every(e => /Sealed document/.test(e.textContent) && !!e.querySelector(".cf-hint"))), "sealed cards show 'Sealed document' and a hint");
  ok(await page.evaluate(() => ["woolpit", "hoia", "skye", "babayaga", "sibilla", "bathory"].every(k => !!document.querySelector(`.card[data-legend="${k}"] .play`))), "all six legends carry the 'Play the 3D adventure' marker");
  /* inspector */
  await page.click('#archive-grid .acard.is-locked >> nth=0'); await page.waitForSelector("dialog.inspect[open]");
  ok(/Sealed document/.test(await page.textContent("dialog.inspect")), "clicking a sealed card opens an inspector with a hint, not the name");
  await page.keyboard.press("Escape"); await sleep(200); ok(await page.evaluate(() => !document.querySelector("dialog.inspect[open]")), "Esc closes the inspector");
  await page.click('#archive-grid .acard.is-got >> nth=0'); await page.waitForSelector("dialog.inspect[open]");
  ok(/Green Children/.test(await page.textContent("dialog.inspect")) && /Historical basis/.test(await page.textContent("dialog.inspect")), "an owned card shows its details and what it is based on");
  await page.keyboard.press("Escape");

  /* ---- unlocking through the Hoia text story ---- */
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView());
  await finishHoia(page);
  ok(/Hoia Baciu/.test(await page.textContent("#st-title")), "the Hoia card opens the Hoia story");
  await page.waitForSelector("dialog.reveal[open]", { timeout: 60000 }); await sleep(600); await shot(page, "a1_reveal_early"); await sleep(5200); await shot(page, "a2_reveal_done");
  ok((await page.textContent(".rv-name")) === "The Watch That Lost Its Hour", "reaching the 'time bends' ending reveals The Watch That Lost Its Hour");
  ok(/7<\/b> of 38/.test(await page.innerHTML(".rv-count")), "the reveal reports the new progress (7 of 38)");
  ok(await page.evaluate(() => document.querySelector(".reveal").classList.contains("done")), "the reveal settles by itself");
  ok(/found|reached|ending/i.test(await page.textContent(".rv-why")), "the reveal explains why the relic was obtained");
  await page.click('.reveal [data-act="next"]'); await sleep(300);
  ok(await page.evaluate(() => !document.querySelector("dialog.reveal")), "Continue closes the reveal");
  let a = await arch(page); ok(a.cards && a.cards["hoia-time"] && a.textEnds["hoia:d"], "the unlock is written to the saved progress");
  await page.evaluate(() => document.getElementById("close").click()); await overlayClosed(page); await navIdle(page);
  c = await counts(page); ok(c.n === 7 && c.got === 7, "the Archive updates immediately (7 of 38)");
  ok(/1\/4 endings/.test(await page.textContent('.card[data-legend="hoia"]')), "the Hoia card shows its progress (1/4 endings)");
  /* repeat the same ending: nothing new */
  await finishHoia(page); await sleep(1800);
  ok(await page.evaluate(() => !document.querySelector("dialog.reveal")), "finishing the same ending again shows no fake reward");
  a = await arch(page); ok(Object.keys(a.cards).length === 7, "…and the card is not duplicated"); await page.evaluate(() => document.getElementById("close").click()); await overlayClosed(page); await navIdle(page);
  /* reload */
  await page.reload(); await page.waitForSelector("#archive-grid .acard"); c = await counts(page);
  ok(c.n === 7, "the collection survives a page reload"); ok(await page.evaluate(() => !!document.querySelector('[data-card="hoia-time"].is-got')), "the right card is still owned after the reload");

  /* ---- unlocking through a real 3D adventure ending (Woolpit) ---- */
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView());
  const playWoolpitEnding = async (id) => {
    await navIdle(page); await page.click('.card[data-legend="woolpit"]'); await page.waitForSelector(".adv-title", { timeout: 120000 }); await navIdle(page);
    ok(/Green Children/.test(await page.textContent(".adv-title h2")) && !!(await page.$(".adv-title .banner svg")), "the card opens the Woolpit adventure (title screen has its own artwork)");
    await page.click(".adv-title button.primary");
    await page.waitForFunction(() => advCur && advCur._t.S && advCur._t.S.seen.a1_arrive && !advCur._t.S.ending && advCur._t.talking, null, { timeout: 180000 }); await sleep(300);
    await page.evaluate(() => advCur._t.patch({ act: 3, boy: "dead", skin: 1, fluent: true, where: "manor" }));
    await page.evaluate(i => advCur._t.jump("end_" + i), id);
    await page.waitForSelector(".adv-end", { timeout: 60000 });
  };
  await playWoolpitEnding("bells");
  ok(await page.evaluate(() => /Relic recovered/.test(document.querySelector(".relic-note").textContent) && /Little Bell/.test(document.querySelector(".relic-note").textContent)), "ending screen names the relic that was earned");
  await page.waitForSelector("dialog.reveal[open]", { timeout: 10000 });
  const skippable = await page.evaluate(() => { const s = document.querySelector('.reveal [data-act="skip"]'); const was = !s.hidden && !document.querySelector(".reveal").classList.contains("done"); s.click(); return was; });
  ok(skippable, "the reveal can be skipped with 'Skip' while it plays"); await sleep(400); await shot(page, "a3_reveal_woolpit");
  ok((await page.textContent(".rv-name")) === "The Little Bell of the Hollow", "the reveal shows The Little Bell of the Hollow after the 'bells' ending");
  ok(await page.evaluate(() => { const r = document.querySelector(".rv-name").getBoundingClientRect(), a = document.querySelector('.reveal [data-act="next"]').getBoundingClientRect(); return r.top >= 0 && a.bottom <= innerHeight; }), "reveal fits the screen (title and button visible)");
  a = await arch(page); ok(!!a.cards["woolpit-bells"], "woolpit-bells is registered before the player continues");
  ok(!a.cards["woolpit-servant"] && !a.cards["woolpit-ink"], "the other Woolpit relics stay sealed");
  await page.click('.reveal [data-act="next"]'); await sleep(300);
  await page.click('.adv-end [data-k="arch"]'); await sleep(400); await navIdle(page);
  ok(await page.evaluate(() => !document.body.classList.contains("adv-open")), "'View the Archive' leaves the adventure");
  ok(await page.evaluate(() => { const r = document.getElementById("archivio").getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > 0; }), "…and scrolls to the Archive");
  c = await counts(page); ok(c.n === 8 && c.got === 8, `Archive shows 8 of 38 at once (${c.n})`);
  ok(await page.evaluate(() => /1\/6 endings/.test(document.querySelector('.card[data-legend="woolpit"]').textContent)), "the Woolpit card shows 1/6 endings without a reload");
  ok(await page.evaluate(() => document.querySelector('#map .pin.done') !== null), "the map pin of a completed legend is marked");
  ok(await page.evaluate(() => !document.querySelector('[data-card="woolpit-bells"] .cf-new')), "a relic already revealed is not flagged 'new'");
  await shot(page, "a4_archive_5");
  /* repeat: no reward */
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView());
  await playWoolpitEnding("bells"); await sleep(2600);
  ok(await page.evaluate(() => /already in your Archive/.test(document.querySelector(".relic-note").textContent) && !document.querySelector("dialog.reveal")), "repeating an ending says 'already in your Archive' and gives no new reward");
  a = await arch(page); ok(Object.keys(a.cards).length === 8, "…and nothing is duplicated"); await page.click('.adv-end [data-k="exit"]'); await sleep(400); await navIdle(page);
  ok(await page.evaluate(() => document.querySelector("main").style.display !== "none"), "exit returns to the site");

  /* ---- keyboard ---- */
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(500);
  await navIdle(page); await page.focus('.card[data-legend="skye"]'); await page.keyboard.press("Enter"); await page.waitForSelector(".adv-title", { timeout: 120000 }); await navIdle(page);
  ok(/Pianist/.test(await page.textContent(".adv-title h2")), "a card can be opened with the keyboard (Enter)");
  await page.click('.adv-title button[data-k="exit"]'); await sleep(400); await navIdle(page);
  /* ---- map + globe ---- */
  await page.evaluate(() => document.getElementById("mappe").scrollIntoView()); await sleep(800);
  await page.click('#map path[data-c="UK"]'); await sleep(900);
  ok(await page.evaluate(() => document.querySelectorAll("#preview .mini").length === 2 && !!document.querySelector("#preview .mini .mini-art svg")), "selecting the UK shows both legends as small cards");
  ok(await page.evaluate(() => { const c = document.querySelector("#globe canvas"); return !!c && c.getBoundingClientRect().width > 100; }), "the 3D globe is rendered");
  ok(await page.evaluate(() => !document.querySelector("#globe button") || getComputedStyle(document.querySelector("#globe button")).display === "none"), "no GLB over file://: the globe falls back to the classic one (switch hidden)");
  await page.click('#preview .mini >> nth=0'); await page.waitForSelector(".adv-title", { timeout: 120000 }); await navIdle(page); await page.click('.adv-title button[data-k="exit"]'); await sleep(400); await navIdle(page);
  ok(await page.evaluate(() => !!document.querySelector('#map .pin')), "map pins present");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no horizontal scroll on desktop");
  ok(requests.length === 0, `no external requests (${requests.length})`); ok(errors.length === 0, `no JS errors in the console ${JSON.stringify(errors.slice(0, 3))}`);
  await browser.close();
}

/* ============================================================ B. a save made BEFORE the Archive existed */
{
  const { browser, ctx, page, errors } = await launch({ width: 1280, height: 800 });
  await ctx.addInitScript(() => { if (!localStorage.getItem("moe.seeded")) { localStorage.setItem("moe.seeded", "1"); localStorage.setItem("moe.skye.endings.v1", JSON.stringify({ leave: true })); localStorage.setItem("moe.woolpit.endings.v1", JSON.stringify({ servant: true, ink: true })); } });
  await page.goto(URL0); await page.waitForSelector("#archive-grid .acard");
  const c = await counts(page); ok(c.n === 9 && c.got === 9, `old endings unlock their 3 relics at first load (${c.n} of 38)`);
  ok(await page.evaluate(() => !document.querySelector("dialog.reveal") && document.querySelectorAll(".acard .cf-new").length === 3), "…without a fake animation, flagged 'New' instead");
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem("moe.skye.endings.v1")).leave === true && JSON.parse(localStorage.getItem("moe.woolpit.endings.v1")).ink === true), "the old save records are untouched");
  ok(await page.evaluate(() => /2\/6 endings/.test(document.querySelector('.card[data-legend="woolpit"]').textContent) && /Completed/i.test(document.querySelector('.card[data-legend="skye"]').textContent)), "legend cards reflect the old progress");
  await page.click('[data-card="skye-leave"]'); await page.waitForSelector("dialog.inspect[open]"); ok(/Four Falling Notes/.test(await page.textContent("dialog.inspect")), "an old save's relic can be examined");
  await page.keyboard.press("Escape"); await sleep(200);
  ok(await page.evaluate(() => !document.querySelector('[data-card="skye-leave"] .cf-new')), "examining a relic clears its 'New' flag");
  ok(errors.length === 0, `no JS errors ${JSON.stringify(errors.slice(0, 2))}`); await browser.close();
}

/* ============================================================ C. reduced motion */
{
  const { browser, ctx, page, errors } = await launch({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL0); await page.waitForSelector("#archive-grid .acard");
  ok(await page.evaluate(() => !document.getElementById("intro").classList.contains("intro") && !document.querySelector(".hero-skip:not([hidden])")), "reduced motion: no intro animation");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".mist")).animationName === "none"), "reduced motion: the mist stands still");
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(300);
  await finishHoia(page); await page.waitForSelector("dialog.reveal[open]", { timeout: 60000 }); await sleep(500);
  ok(await page.evaluate(() => document.querySelector(".reveal").classList.contains("done") && getComputedStyle(document.querySelector(".rv-flip")).transform !== "none"), "reduced motion: the reveal appears already settled, with the card face up");
  ok(await page.evaluate(() => { const r = document.querySelector(".rv-name").getBoundingClientRect(); return getComputedStyle(document.querySelector(".rv-name")).opacity === "1" && r.top >= 0; }), "reduced motion: name and explanation are readable at once");
  await page.keyboard.press("Escape"); await sleep(250); ok(await page.evaluate(() => !document.querySelector("dialog.reveal")), "Esc closes a settled reveal");
  ok(errors.length === 0, `no JS errors ${JSON.stringify(errors.slice(0, 2))}`); await browser.close();
}

/* ============================================================ D. phone */
{
  const { browser, page, errors } = await launch({ width: 390, height: 780, dpr: 2, touch: true });
  await page.goto(URL0); await page.waitForSelector("#archive-grid .acard"); await sleep(600);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "phone: no horizontal scroll on the landing page");
  ok(await page.evaluate(() => { const r = document.querySelector(".hero-title").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), "phone: the title fits the screen");
  ok(await page.evaluate(() => { const r = document.querySelector(".hero-cta .btn-primary").getBoundingClientRect(); return r.bottom < innerHeight && r.height > 36; }), "phone: the main button is visible without scrolling");
  await shot(page, "m1_hero");
  await page.tap("#burger"); await sleep(500); ok(await page.evaluate(() => document.getElementById("menu").classList.contains("open") && !!document.getElementById("snd").getBoundingClientRect().height), "phone: the menu opens and contains the sound controls");
  await shot(page, "m2_menu"); await page.tap("#burger");
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(900); await shot(page, "m3_cards");
  ok(await page.evaluate(() => { const r = document.querySelector('.card[data-legend="woolpit"]').getBoundingClientRect(); return r.width > 250 && r.right <= innerWidth; }), "phone: cards use the full width and stay readable");
  await page.evaluate(() => document.getElementById("archivio").scrollIntoView()); await sleep(900); await shot(page, "m4_archive");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "phone: no horizontal scroll in the Archive");
  await page.tap('#archive-grid .acard.is-locked >> nth=0'); await page.waitForSelector("dialog.inspect[open]");
  ok(await page.evaluate(() => { const b = document.querySelector("dialog.inspect .ins-box").getBoundingClientRect(); return b.width <= innerWidth + 1; }), "phone: the inspector fits the screen"); await shot(page, "m5_inspect");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.getElementById("leggende").scrollIntoView()); await sleep(500);
  await openHoiaText(page, true);
  for (const lab of ["Yes, with a flashlight", "Follow the lights"]) await page.tap(`#st-choices button:has-text("${lab}")`);
  await page.waitForSelector("dialog.reveal[open]", { timeout: 60000 }); await sleep(5600); await shot(page, "m6_reveal");
  ok(await page.evaluate(() => { const a = document.querySelector('.reveal [data-act="next"]').getBoundingClientRect(); return a.bottom <= innerHeight + 1 || document.querySelector(".rv-stage").scrollHeight > document.querySelector(".rv-stage").clientHeight; }), "phone: the reveal buttons are reachable (visible or scrollable)");
  ok(errors.length === 0, `no JS errors ${JSON.stringify(errors.slice(0, 2))}`); await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL ARCHIVE E2E CHECKS PASSED"); process.exit(fails ? 1 : 0);
