// THE ARCHIVIST'S VOLUMES: one antique book dialog that holds
//   - THE TRAVELLER'S JOURNAL: written automatically from what the visitor did (legends visited, countries explored on the
//     map, endings discovered, the last legend entered, bookmarks), read from the existing progress (Archive + adventure
//     endings) and from the Traveller's record (shared/traveller.js). Nothing is typed by hand; nothing is invented.
//   - A EUROPEAN BESTIARY: the creatures of European folklore (shared/lore.js), with links to the legends of the site.
// Two pages per spread on wide screens, one on phones; ← / → or the corner buttons turn the page; Esc closes.
import * as Archive from "../shared/archive.js";
import * as Traveller from "../shared/traveller.js";
import { BESTIARY, BEAST, BASIS, noteFor, ARCHIVIST, beastsOf } from "../shared/lore.js";
import { esc } from "./cards.js";
import { sceneSVG } from "./art.js";
import { beastArt } from "./bestiary-art.js";
import { waxSeal, inkStamp, pressWhenSeen } from "./seals.js";
import { markButton } from "./bookmarks.js";
import { candle, dust } from "./atmos.js";

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const day = t => { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
const short = t => { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch (e) { return ""; } };
let opts = { openLegend: () => {}, go: () => {} };
export function configure(o) { opts = { ...opts, ...o }; }

/** a marginal note in the Archivist's hand */
export const margNote = (text, { tilt = -1.2 } = {}) => text ? `<aside class="marg" style="--tilt:${tilt}deg"><span class="marg-t">${esc(text)}</span><span class="marg-s">— ${ARCHIVIST}</span></aside>` : "";

/* ======================================================================= the journal's facts */
function facts() {
  const visits = Traveller.visits(), countries = Traveller.countries(), O = Archive.LEGEND_ORDER;
  let found = 0, total = 0, completed = 0, mastered = 0;
  const per = {};
  for (const k of O) { const st = Archive.legendStatus(k), set = Archive.endingsFoundFor(k); per[k] = { st, set }; found += st.found; total += st.total; if (st.found > 0) completed++; if (st.state === "mastered") mastered++; }
  const p = Archive.progress(), first = Math.min(...Object.values(visits).map(v => v.first), Infinity);
  return { visits, countries, per, found, total, completed, mastered, p, first: isFinite(first) ? first : 0, last: Traveller.lastVisited(), marks: Traveller.marks(), nVisited: Object.keys(visits).length, nCountries: Object.keys(countries).length };
}
const MILESTONES = [
  { id: "first-steps", text: "First steps", glyph: "✦", tone: "red", hint: "Enter any legend.", ok: f => f.nVisited > 0 },
  { id: "first-ending", text: "An ending found", glyph: "❦", tone: "red", hint: "Reach the end of a legend.", ok: f => f.found > 0 },
  { id: "five-lands", text: "Five lands", glyph: "✧", tone: "blue", hint: "Explore five countries on the map.", ok: f => f.nCountries >= 5 },
  { id: "all-legends", text: "Every legend", glyph: "☩", tone: "blue", hint: "Visit all six legends.", ok: f => f.nVisited >= Archive.LEGEND_ORDER.length },
  { id: "mastered", text: "Every ending", glyph: "✠", tone: "red", hint: "Find every ending of one legend.", ok: f => f.mastered > 0 },
  { id: "archive", text: "Archive complete", glyph: "♛", tone: "gold", hint: "Recover every relic.", ok: f => f.p.complete },
];
const stampSlot = (m, f) => m.ok(f) ? `<span class="ms" data-seal="ms:${m.id}">${inkStamp(m.text, m.glyph, { tone: m.tone })}</span>`
  : `<span class="ms ms-off" title="${esc(m.hint)}"><span class="ms-ring" aria-hidden="true"></span><small>${esc(m.hint)}</small></span>`;

function journalPages() {
  const f = facts(), L = Archive.LEGENDS, O = Archive.LEGEND_ORDER, pages = [];
  const toc = [];
  pages.push({ id: "front", cls: "tp-front", html: `<p class="tp-orn" aria-hidden="true">❧</p><h2 class="tp-title">The Traveller’s Journal</h2>
    <p class="tp-lede">Kept by the Archive for whoever walks its legends. It writes itself: every legend you enter, every land you look at on the map, every ending you find.</p>
    <p class="tp-begun">${f.first ? `Begun on ${esc(day(f.first))}` : "Not yet begun. Enter a legend and the first line will be written."}</p>
    <h4 class="tp-sub">Milestones</h4><div class="ms-grid">${MILESTONES.map(m => stampSlot(m, f)).join("")}</div>` });
  const lastK = f.last && L[f.last] ? f.last : "";
  pages.push({ id: "brief", html: `<h3 class="tp-h">In brief</h3>
    <dl class="tp-stats"><div><dt>Legends visited</dt><dd>${f.nVisited} <i>/ ${O.length}</i></dd></div><div><dt>Countries explored</dt><dd>${f.nCountries}</dd></div>
      <div><dt>Endings discovered</dt><dd>${f.found} <i>/ ${f.total}</i></dd></div><div><dt>Relics recovered</dt><dd>${f.p.relicsUnlocked} <i>/ ${f.p.relics}</i></dd></div><div><dt>Bookmarks</dt><dd>${f.marks.length}</dd></div></dl>
    <h4 class="tp-sub">Last visited</h4>${lastK ? `<div class="tp-last"><span class="tp-plate sm">${sceneSVG(lastK)}</span><div><b>${esc(L[lastK].title)}</b><small>${esc(L[lastK].place)}${f.visits[lastK] ? ` · ${esc(day(f.visits[lastK].last))}` : ""}</small>
      <button type="button" class="tp-btn" data-open="${lastK}">Return to this legend ›</button></div></div>` : `<p class="tp-empty">No legend yet. The cards in Chapter II are waiting.</p>`}
    <h4 class="tp-sub">Contents</h4><ol class="tp-toc" data-toc></ol>` });
  for (const k of O) {
    const l = L[k], v = f.visits[k], { st, set } = f.per[k], ids = Archive.endingIds(k);
    const relics = Archive.CARDS.filter(c => c.legend === k && (c.type === "relic" || c.type === "seal")), gotR = relics.filter(c => Archive.isUnlocked(c.id)).length;
    const ends = ids.map(id => set.has(id) ? `<li class="on"><span aria-hidden="true">✓</span> ${esc(Archive.endingTitle(k, id))}</li>` : `<li><span aria-hidden="true">·</span> <em>an ending not yet found</em></li>`).join("");
    const seal = st.found > 0 ? `<span class="tp-seal" data-seal="journal:${k}:${st.state}">${waxSeal(k, { mastered: st.state === "mastered", label: st.state === "mastered" ? "Sealed: every ending found" : "Sealed: legend completed" })}</span>` : "";
    toc.push([k, l.title, pages.length]);
    pages.push({ id: "legend:" + k, cls: "tp-legend", style: `--cc:${l.color}`, html: `${seal}<p class="tp-k">${esc(l.place)}</p><h3 class="tp-h">${esc(l.title)}</h3><p class="tp-era">${esc(l.era)}</p>
      <span class="tp-plate">${sceneSVG(k)}</span>
      <p class="tp-visit">${v ? `First visited ${esc(day(v.first))}${v.n > 1 ? ` · ${v.n} visits` : ""}${v.n > 1 ? ` · last ${esc(short(v.last))}` : ""}` : "Not yet visited."}</p>
      <h4 class="tp-sub">Endings <span>${st.found} / ${st.total}</span></h4><ol class="tp-ends">${ends}</ol>
      <p class="tp-rel">Relics recovered: ${gotR} of ${relics.length}${beastsOf(k).length ? ` · In the Bestiary: ${beastsOf(k).map(b => `<button type="button" class="tp-link" data-beast="${b.id}">${esc(b.name)}</button>`).join(", ")}` : ""}</p>
      ${margNote(noteFor("legend-" + k), { tilt: (O.indexOf(k) % 2 ? 1.4 : -1.6) })}
      <div class="tp-act">${markButton(k)}<button type="button" class="tp-btn" data-open="${k}">${v ? "Return to this legend ›" : "Enter this legend ›"}</button></div>` });
  }
  const cs = Object.values(f.countries).sort((a, b) => a.first - b.first);
  toc.push(["countries", "Countries explored", pages.length]);
  pages.push({ id: "countries", html: `<h3 class="tp-h">Countries explored</h3><p class="tp-note">Lands you looked at on the map; a legend’s own land is written down when you enter it.</p>
    ${cs.length ? `<ol class="tp-lands">${cs.map(c => `<li><b>${esc(c.name)}</b><small>${esc(short(c.first))}${c.via && L[c.via] ? ` · through ${esc(L[c.via].title)}` : ""}</small></li>`).join("")}</ol>` : `<p class="tp-empty">No country yet. Click one on the map in Chapter I and it will be written here.</p>`}` });
  toc.push(["marks", "Bookmarks", pages.length]);
  pages.push({ id: "marks", html: `<h3 class="tp-h">Marked pages</h3><p class="tp-note">The legends you bookmarked, with the ribbon on their card, in the story or in this journal.</p>
    ${f.marks.length ? `<ul class="tp-marks">${f.marks.map(k => `<li style="--cc:${L[k].color}"><span class="tp-plate xs">${sceneSVG(k)}</span><div><b>${esc(L[k].title)}</b><small>${esc(L[k].place)}</small></div><span class="tp-mact"><button type="button" class="tp-btn" data-open="${k}">Open ›</button>${markButton(k, { compact: true })}</span></li>`).join("")}</ul>`
      : `<p class="tp-empty">No bookmarks yet. Touch the ribbon on a legend card (or press B on it) to keep a legend here.</p>`}` });
  pages[1].html = pages[1].html.replace("<ol class=\"tp-toc\" data-toc></ol>", `<ol class="tp-toc">${toc.map(([k, t, i]) => `<li><button type="button" class="tp-link" data-goto="${i}">${esc(t)}</button><i>${i + 1}</i></li>`).join("")}</ol>`);
  return pages;
}

function bestiaryPages() {
  const L = Archive.LEGENDS, pages = [];
  pages.push({ id: "front", cls: "tp-front", html: `<p class="tp-orn" aria-hidden="true">❦</p><h2 class="tp-title">A European Bestiary</h2>
    <p class="tp-lede">Creatures and presences of European folklore, gathered beside the Archive’s legends. Each entry tells what people believed and where; none of it is offered as proof.</p>
    <h4 class="tp-sub">Contents</h4><ol class="tp-toc">${BESTIARY.map((b, i) => `<li><button type="button" class="tp-link" data-goto="${i + 1}">${esc(b.name)}</button><i>${esc(b.origin.split(" · ")[0])}</i></li>`).join("")}</ol>` });
  BESTIARY.forEach((b, i) => {
    const links = b.links.map(l => l.legend && L[l.legend] ? `<li><button type="button" class="tp-link" data-open="${l.legend}">${esc(L[l.legend].title)}</button><small>${esc(l.rel)}</small></li>`
      : l.href ? `<li><button type="button" class="tp-link" data-href="${esc(l.href)}">${l.href === "#intro" ? "The Archive’s valley" : "The Will-o’-the-Wisp (secret card)"}</button><small>${esc(l.rel)}</small></li>` : "").join("");
    pages.push({ id: "beast:" + b.id, cls: "tp-beast", html: `<p class="tp-k">No. ${String(i + 1).padStart(2, "0")} · ${esc(b.origin)}</p><h3 class="tp-h">${esc(b.name)}</h3><p class="tp-era">${esc(b.also)}</p>
      <figure class="tp-beastart">${beastArt(b.id)}</figure>
      <p class="tp-body">${esc(b.text)}</p><p class="tp-basis">${esc(BASIS[b.basis])}</p>
      <h4 class="tp-sub">Associated legends</h4>${links ? `<ul class="tp-assoc">${links}</ul>` : `<p class="tp-empty">None in this Archive yet.</p>`}
      ${margNote(noteFor("beast:" + b.id), { tilt: i % 2 ? 1.6 : -1.3 })}` });
  });
  return pages;
}

/* ======================================================================= the book dialog */
let dlg = null, kind = "journal", pages = [], at = 0;
const perSpread = () => (matchMedia("(min-width: 860px)").matches ? 2 : 1);
const VOL = { journal: { title: "The Traveller’s Journal", build: journalPages }, bestiary: { title: "A European Bestiary", build: bestiaryPages } };

function ensure() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog"); dlg.className = "tome"; document.body.append(dlg);
  dlg.innerHTML = `<div class="tome-book"><button type="button" class="tome-x" data-t="x" aria-label="Close the book">✕</button>
    <div class="tome-spread" aria-live="polite"></div>
    <nav class="tome-nav" aria-label="Pages"><button type="button" class="tome-turn" data-t="prev" aria-label="Previous page">‹</button><span class="tome-at"></span><button type="button" class="tome-turn" data-t="next" aria-label="Next page">›</button></nav></div>`;
  const book = dlg.querySelector(".tome-book"); book.append(candle({ size: "sm" })); dust(book, 10);
  dlg.addEventListener("click", e => {
    if (e.target === dlg) { dlg.close(); return; }
    const t = e.target.closest("[data-t],[data-goto],[data-open],[data-beast],[data-href]"); if (!t) return;
    if (t.dataset.t === "x") dlg.close(); else if (t.dataset.t === "prev") turn(-1); else if (t.dataset.t === "next") turn(1);
    else if (t.dataset.goto != null) show(+t.dataset.goto, 1);
    else if (t.dataset.open) { const k = t.dataset.open; dlg.close(); setTimeout(() => opts.openLegend(k), 30); }
    else if (t.dataset.beast) open("bestiary", "beast:" + t.dataset.beast);
    else if (t.dataset.href) { const h = t.dataset.href; dlg.close(); setTimeout(() => opts.go(h), 30); }
  });
  dlg.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); turn(1); } else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); turn(-1); } });
  // the book follows the record while it is open (a bookmark removed on its page, an ending found in another tab…)
  const refresh = () => { if (dlg.open) { const id = pages[at] && pages[at].id; pages = VOL[kind].build(); const i = pages.findIndex(p => p.id === id); show(i < 0 ? at : i, 0); } };
  Traveller.onChange(w => { if (w !== "stamp") refresh(); }); Archive.onChange(refresh);
  addEventListener("resize", () => { if (dlg.open) show(at, 0); });
  return dlg;
}
function show(i, dir) {
  const n = perSpread(); i = Math.max(0, Math.min(pages.length - 1, i)); if (n === 2) i -= i % 2; at = i;
  const sp = dlg.querySelector(".tome-spread"), vis = pages.slice(i, i + n);
  sp.innerHTML = vis.map((p, j) => `<section class="tome-page ${j ? "right" : "left"} ${p.cls || ""}" style="${p.style || ""}" aria-label="Page ${i + j + 1}"><div class="tome-in">${p.html}</div><span class="tome-folio" aria-hidden="true">${i + j + 1}</span></section>`).join("")
    + (vis.length < n ? `<section class="tome-page right tp-blank"><div class="tome-in"><p class="tp-orn" aria-hidden="true">❧</p><p class="tp-empty">The rest of this book is still blank.</p></div></section>` : "");
  sp.dataset.n = n;
  if (dir && !reduce()) { sp.classList.remove("turn-next", "turn-prev"); void sp.offsetWidth; sp.classList.add(dir > 0 ? "turn-next" : "turn-prev"); }
  sp.querySelectorAll("[data-seal]").forEach(pressWhenSeen);
  const last = Math.min(pages.length, i + n);
  dlg.querySelector(".tome-at").textContent = n === 2 && last > i + 1 ? `Pages ${i + 1}–${last} of ${pages.length}` : `Page ${i + 1} of ${pages.length}`;
  dlg.querySelector('[data-t="prev"]').disabled = i <= 0; dlg.querySelector('[data-t="next"]').disabled = i + n >= pages.length;
  sp.querySelectorAll(".tome-in").forEach(e => { e.scrollTop = 0; });
}
const turn = d => { const n = perSpread(), j = at + d * n; if (j < 0 || j >= pages.length) return; show(j, d); };

/** open a volume ("journal" | "bestiary" | "marks"), optionally at a page id (e.g. "legend:skye", "beast:leshy") */
export function open(which = "journal", pageId = "") {
  if (which === "marks") { which = "journal"; pageId = pageId || "marks"; }
  const v = VOL[which] || VOL.journal; kind = VOL[which] ? which : "journal"; ensure();
  pages = v.build(); dlg.setAttribute("aria-label", v.title); dlg.dataset.vol = kind;
  const i = pageId ? Math.max(0, pages.findIndex(p => p.id === pageId)) : 0;
  if (!dlg.open) dlg.showModal();
  show(i, 0); const nx = dlg.querySelector('[data-t="next"]'); (nx.disabled ? dlg.querySelector(".tome-x") : nx).focus({ preventScroll: true });
}
export const isOpen = () => !!(dlg && dlg.open);
