// Mobile / touch / hi-dpi layout check for the site and the adventures.  node tests/e2e-mobile.mjs [screenshot-dir]
import { launch, URL0, sleep } from "./e2e-lib.mjs"; import fs from "node:fs";
const SH = process.argv[2] || null; if (SH) fs.mkdirSync(SH, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
for (const cfg of [{ name: "phone", width: 390, height: 780, dpr: 2, touch: true }, { name: "tablet-landscape", width: 900, height: 520, dpr: 2, touch: true }]) {
  const { browser, page, errors, requests } = await launch(cfg);
  await page.goto(URL0); await page.waitForSelector("#cards .card");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${cfg.name}: no horizontal page scroll on the site`);
  for (const k of ["woolpit", "skye", "babayaga", "sibilla", "bathory"]) {
    await page.evaluate(() => scrollTo(0, 2300)); await sleep(200); await page.click(`.card[data-legend="${k}"]`); await page.waitForSelector(".adv-title", { timeout: 120000 });
    await sleep(600); if (SH) await page.screenshot({ path: `${SH}/m_${cfg.name}_${k}_title.png` });
    const fit = await page.evaluate(() => { const c = document.querySelector(".adv-title .adv-card"), r = c.getBoundingClientRect(), b = document.querySelector(".adv-title button.primary").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, scroll: c.scrollHeight > c.clientHeight, btn: b.bottom <= innerHeight + 2 || c.scrollHeight > c.clientHeight }; });
    ok(fit.btn, `${cfg.name}/${k}: start button reachable (card scrollable or fully visible)`);
    await page.click(".adv-title button.primary"); await page.waitForFunction(() => advCur && advCur._t && (advCur._t.running || advCur._t.talking), null, { timeout: 180000 }); await sleep(1500);
    if (k === "woolpit") { await page.waitForFunction(() => advCur._t.talking || (advCur._t.S && advCur._t.S.seen && advCur._t.S.seen.a1_arrive), null, { timeout: 30000 }).catch(() => {}); await page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); for (let n = 0; n < 600 && t.talking; n++) { for (let i = 0; i < 100 && t.busy; i++) await w(50); t.skip(); await w(30); const v = t.view(); if (!v) { await w(80); continue; } if (v.choices.length) t.pick(0); else t.press(); await w(60); } }); await sleep(800); }
    if (k === "babayaga") {   // read through the opening lines (the doll speaks), then check the doll button
      await page.waitForFunction(() => advCur._t.talking, null, { timeout: 30000 }).catch(() => {});
      await page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 60; i++) { if (!t.talking) { await w(400); if (!t.talking) break; } t.skip(); await w(30); const v = t.view(); if (v && v.choices.length) t.pick(0); else t.press(); await w(250); } });
      ok(await page.evaluate(() => !!document.querySelector('.tbtns .listen, button.listen, [class*="listen"]')), `${cfg.name}/${k}: the doll (hint) button is shown on touch screens`);
    }
    if (k === "sibilla") {   // read through the opening lines, then check the interact button and the HUD
      await page.waitForFunction(() => advCur._t.talking, null, { timeout: 30000 }).catch(() => {});
      await page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 40; i++) { if (!t.talking) { await w(400); if (!t.talking) break; } t.skip(); await w(30); t.press(); await w(250); } });
      ok(await page.evaluate(() => !!document.querySelector('.tbtns .tbtn[data-id="interact"]') && !!document.querySelector(".adv-hud .meters")), `${cfg.name}/${k}: the interact button and the Lore meter are shown`);
    }
    if (k === "bathory") {   // read through the opening, then the evidence HUD, the journal board and the document reader on a small screen
      await page.waitForFunction(() => advCur._t.talking, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 40; i++) { if (!t.talking) { await w(400); if (!t.talking) break; } t.skip(); await w(30); t.press(); await w(250); } });
      ok(await page.evaluate(() => !!document.querySelector('.tbtns .tbtn[data-id="interact"]') && !!document.querySelector(".adv-hud .bt-case")), `${cfg.name}/${k}: the interact button and the evidence counters are shown`);
      await page.evaluate(() => { const t = advCur._t; t.tp(10.5, -1.2); t.interact(); }); await sleep(500);
      await page.evaluate(async () => { const t = advCur._t, w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 60; i++) { if (t.docOpen && !t.talking) return; if (!t.talking && !t.busy) { await w(400); continue; } t.skip(); await w(30); const v = t.view(); if (v && v.choices.length) t.pick(v.choices.length - 1); else t.press(); await w(250); } });
      await page.waitForFunction(() => advCur._t.docOpen, null, { timeout: 20000 }).catch(() => {});
      const doc = await page.evaluate(() => { const p = document.querySelector(".bt-paper"); if (!p) return null; const r = p.getBoundingClientRect(), b = p.querySelector("button.primary").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, btn: b.bottom <= innerHeight + 2 || p.scrollHeight > p.clientHeight }; });
      ok(doc && doc.l >= 0 && doc.r <= doc.w + 1 && doc.btn, `${cfg.name}/${k}: the document reader fits the screen and its button is reachable`);
      if (SH) await page.screenshot({ path: `${SH}/m_${cfg.name}_${k}_doc.png` });
      await page.evaluate(() => advCur._t.closeDoc()); await sleep(400); await page.evaluate(() => { while (advCur._t.docOpen) advCur._t.closeDoc(); });
      await page.tap('.abtn[data-a="journal"]').catch(async () => page.evaluate(() => advCur._t.toggleJournal())); await sleep(600);
      const jr = await page.evaluate(() => { const g = document.querySelector(".journal .bt-grid"), c = document.querySelectorAll(".journal .bt-card"); if (!g || !c.length) return null; const r = c[0].getBoundingClientRect(); return { n: c.length, w: r.width, h: r.height, right: Math.max(...[...c].map(e => e.getBoundingClientRect().right)), iw: innerWidth }; });
      ok(jr && jr.n === 2 && jr.w >= 100 && jr.h >= 44 && jr.right <= jr.iw + 1, `${cfg.name}/${k}: the investigation board shows tappable evidence cards (${JSON.stringify(jr)})`);
      if (jr) { await page.tap('.journal .bt-card[data-ev="ev_king"]'); await sleep(300); ok(await page.evaluate(() => document.querySelector('.journal .bt-card[data-ev="ev_king"]').classList.contains("sel")), `${cfg.name}/${k}: tapping a card selects it`); }
      if (SH) await page.screenshot({ path: `${SH}/m_${cfg.name}_${k}_board.png` });
      await page.evaluate(() => advCur._t.journalOpen() && advCur._t.toggleJournal()); await sleep(300);
    }
    if (SH) await page.screenshot({ path: `${SH}/m_${cfg.name}_${k}_play.png` });
    ok(await page.evaluate(() => !!document.querySelector(".tctl, .joy-base")), `${cfg.name}/${k}: touch controls are shown`);
    const cv = await page.evaluate(() => { const c = document.querySelector("#adv canvas.gl"), r = c.getBoundingClientRect(); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, bw: c.width, bh: c.height }; });
    ok(Math.abs(cv.w - cv.iw) < 2 && Math.abs(cv.h - cv.ih) < 2, `${cfg.name}/${k}: canvas fills the viewport without overflow (${cv.w}x${cv.h}, buffer ${cv.bw}x${cv.bh})`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${cfg.name}/${k}: no horizontal scroll while playing`);
    // joystick drag moves the player
    if (await page.evaluate(() => !!document.querySelector(".joy-base"))) {
      const before = await page.evaluate(() => advCur._t.pos());
      const b = await page.evaluate(() => { const r = document.querySelector(".joy-base").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b[0], y: b[1], id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: b[0], y: b[1] - 40, id: 1 }] }); await sleep(4000);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const after = await page.evaluate(() => advCur._t.pos()); ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.3, `${cfg.name}/${k}: touch joystick moves the player`);
    }
    await page.evaluate(() => document.querySelector('.abtn[data-a="pause"]').click()); await sleep(400);
    await page.evaluate(() => setTimeout(() => document.querySelector('.adv-pause button[data-k="exit"]').click(), 0));   // (closing a big scene blocks software rendering for a while)
    await page.waitForFunction(() => !document.body.classList.contains("adv-open"), null, { timeout: 120000 }).catch(() => {}); await sleep(700);
    ok(await page.evaluate(() => !document.body.classList.contains("adv-open")), `${cfg.name}/${k}: exit returns to the site`);
  }
  ok(requests.length === 0, `${cfg.name}: no external requests`); ok(errors.length === 0, `${cfg.name}: no JS errors ${JSON.stringify(errors.slice(0, 3))}`);
  await browser.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
