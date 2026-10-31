// THE ARCHIVIST'S DESK: wires the small additions into the existing page.
//   the Archive shelf (three books that open the Traveller's Journal, the Bestiary and the bookmarks; candles; dust),
//   bookmark ribbons and wax seals on the legend cards, the Archivist's compass (Legends section + map panel),
//   the marginal note + bookmark in the short-story box, the rotating quote on the landing page.
// Everything is optional: js/main.js calls initExtras() inside its guard, and every part fails on its own.
import * as Archive from "../shared/archive.js";
import * as Traveller from "../shared/traveller.js";
import { BESTIARY, noteFor } from "../shared/lore.js";
import { initBookmarks, markButton } from "./bookmarks.js";
import { sealLegendCard, waxSeal, pressWhenSeen } from "./seals.js";
import { open as openTome, configure as configureTome, margNote } from "./tome.js";
import { candle, dust, watch } from "./atmos.js";
import { createCompass, setTarget, initialTarget } from "./compass.js";
import { initHeroQuote } from "./quotes.js";
import { emblem } from "./art.js";

const safe = f => { try { return f(); } catch (e) { console.error(e); return null; } };
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- the shelf of books */
const RIB = n => Array.from({ length: Math.min(n, 5) }, (_, i) => `<i style="--i:${i}"></i>`).join("");
function bookHTML(vol) {
  const f = { visited: Object.keys(Traveller.visits()).length, marks: Traveller.marks().length };
  if (vol === "journal") return { cls: "b-journal", t: "The Traveller’s Journal", s: `${f.visited} of ${Archive.LEGEND_ORDER.length} legends visited`, e: emblem("notebook"), aria: `Open the Traveller’s Journal: ${f.visited} of ${Archive.LEGEND_ORDER.length} legends visited` };
  if (vol === "bestiary") return { cls: "b-bestiary", t: "A European Bestiary", s: `${BESTIARY.length} creatures`, e: emblem("wisp"), aria: `Open A European Bestiary: ${BESTIARY.length} creatures of folklore` };
  return { cls: "b-marks", t: "Marked Pages", s: f.marks ? `${f.marks} bookmark${f.marks > 1 ? "s" : ""}` : "No bookmarks yet", e: emblem("ribbon"), rib: f.marks, aria: `Open your bookmarks: ${f.marks} bookmarked legend${f.marks === 1 ? "" : "s"}` };
}
function paintBook(b) {
  const d = bookHTML(b.dataset.vol);
  b.className = "book " + d.cls; b.setAttribute("aria-label", d.aria);
  b.innerHTML = `<span class="bk-cover"><span class="bk-emb" aria-hidden="true"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${d.e}</svg></span>
    <span class="bk-t">${d.t}</span><span class="bk-s">${d.s}</span><span class="bk-hl" aria-hidden="true"></span></span><span class="bk-pages" aria-hidden="true"></span>${d.rib != null ? `<span class="bk-ribs" aria-hidden="true">${RIB(d.rib)}</span>` : ""}`;
}
/** pointer tilt: a few degrees toward the pointer, a shadow that moves the other way and a sheen under the pointer */
function bookTilt(el, max = 9) {
  let raf = 0, x = 0, y = 0;
  const apply = () => { raf = 0; el.style.setProperty("--rx", (-y * max * .6).toFixed(2) + "deg"); el.style.setProperty("--ry", (x * max).toFixed(2) + "deg");
    el.style.setProperty("--sx", (-x * 10).toFixed(1) + "px"); el.style.setProperty("--sy", (14 - y * 5).toFixed(1) + "px"); el.style.setProperty("--mx", ((x + 1) * 50).toFixed(1) + "%"); el.style.setProperty("--my", ((y + 1) * 50).toFixed(1) + "%"); };
  el.addEventListener("pointermove", e => { if (e.pointerType !== "mouse" || reduce()) return; const r = el.getBoundingClientRect(); x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)); y = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1)); if (!raf) raf = requestAnimationFrame(apply); });
  el.addEventListener("pointerleave", () => { x = y = 0; if (!raf) raf = requestAnimationFrame(apply); });
}
function initShelf(archive) {
  const head = archive && archive.querySelector(".arch-head"); if (!head || archive.querySelector(".shelf")) return;
  const shelf = document.createElement("div"); shelf.className = "shelf rv"; shelf.setAttribute("role", "group"); shelf.setAttribute("aria-label", "The Archivist’s shelf");
  shelf.innerHTML = `<div class="shelf-shaft" aria-hidden="true"></div><div class="shelf-row"></div><div class="shelf-plank" aria-hidden="true"></div>
    <p class="shelf-cap">The Archivist’s shelf · your journal writes itself as you travel</p>`;
  const row = shelf.querySelector(".shelf-row");
  row.append(candle({ height: 1.15 }));
  for (const vol of ["journal", "bestiary", "marks"]) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.vol = vol; paintBook(b); bookTilt(b);
    b.addEventListener("click", () => openTome(vol)); row.append(b);
  }
  row.append(candle({ height: .8, size: "sm" }));
  head.after(shelf); dust(shelf, 14); watch(shelf);
  const repaint = () => shelf.querySelectorAll(".book").forEach(paintBook);
  Traveller.onChange(w => { if (w !== "stamp") repaint(); }); Archive.onChange(repaint);
}

/* ---------------------------------------------------------------- legend cards: ribbons + seals */
function decorateCards(cards) {
  if (!cards) return;
  initBookmarks(cards);
  const seal = () => cards.querySelectorAll(".legend-card[data-legend]").forEach(c => safe(() => sealLegendCard(c)));
  seal(); Archive.onChange(() => setTimeout(seal, 40));
  addEventListener("moe:cards-refreshed", seal);
  // the compass follows the card under the pointer or the keyboard focus
  const pick = e => { const c = e.target.closest && e.target.closest(".legend-card[data-legend]"); if (c) setTarget(c.dataset.legend); };
  cards.addEventListener("pointerover", e => { if (e.pointerType === "mouse") pick(e); });
  cards.addEventListener("focusin", pick);
}

/* ---------------------------------------------------------------- compasses */
function initCompasses({ legends, map }) {
  if (legends) {
    const sub = legends.querySelector(".sub");
    const box = document.createElement("div"); box.className = "compass-slot";
    (sub || legends.querySelector("h2")).after(box); legends.classList.add("has-compass");
    createCompass(box);
  }
  const panel = map && map.querySelector("#preview"); if (panel) { const box = document.createElement("div"); box.className = "compass-slot sm"; panel.parentElement.append(box); createCompass(box, { variant: "sm", label: "Bearing from the Archive" }); }
  initialTarget();
  // the map: pins, countries, opened legends (main.js announces them on "moe:select")
  addEventListener("moe:select", e => { const d = e.detail || {}; if (d.legend) setTarget(d.legend); else if (d.country) setTarget(d.legends && d.legends[0], d.legends && d.legends.length ? "" : `No legend in ${d.name || "this land"} yet`); });
  const svg = document.getElementById("map");
  if (svg) svg.addEventListener("pointerover", e => { const p = e.target.closest && e.target.closest(".pin[data-legend]"); if (p && e.pointerType === "mouse") setTarget(p.dataset.legend); });
}

/* ---------------------------------------------------------------- the short-story box */
export function storyExtras(k, box) {
  if (!box || !Archive.LEGENDS[k]) return;
  box.querySelectorAll(":scope > .marg, :scope > .mark-btn").forEach(e => e.remove());
  box.querySelector(".close").insertAdjacentHTML("afterend", markButton(k, { compact: true }));
  const t = box.querySelector("h3"); if (t) t.insertAdjacentHTML("afterend", margNote(noteFor("legend-" + k), { tilt: -1 }));
}

/* ---------------------------------------------------------------- the Archive's group headers get the legend's seal */
export function sealGroups(grid) {
  if (!grid) return;
  grid.querySelectorAll(".arch-group[data-legend]").forEach(g => {
    const k = g.dataset.legend, st = Archive.legendStatus(k), h = g.querySelector(".arch-gh h3"); if (!h || st.found <= 0 || h.querySelector(".gh-seal")) return;
    h.insertAdjacentHTML("beforeend", `<span class="gh-seal" data-seal="group:${k}:${st.state}" title="${st.state === "mastered" ? "Every ending found" : "Legend completed"}">${waxSeal(k, { mastered: st.state === "mastered" })}</span>`);
    pressWhenSeen(h.querySelector(".gh-seal"));
  });
}

/** main.js entry point */
export function initExtras({ hero, legends, cards, map, archive, openLegend = () => {}, go = () => {} } = {}) {
  configureTome({ openLegend, go });
  safe(() => hero && initHeroQuote(hero));
  safe(() => decorateCards(cards));
  safe(() => initShelf(archive));
  safe(() => initCompasses({ legends, map }));
  safe(() => { const grid = archive && archive.querySelector("#archive-grid"); if (!grid) return; sealGroups(grid); new MutationObserver(() => sealGroups(grid)).observe(grid, { childList: true }); });
  // the Archivist's own corner (sightings journal) gets the dust of the reading room too
  safe(() => { const j = archive && archive.querySelector("#journal"); if (j) { j.style.position = "relative"; watch(j); } });
}
export { openTome };
