// THE ARCHIVE section, the card inspector and the cinematic "relic recovered" reveal.
import * as Archive from "../shared/archive.js";
import { archiveCard, faceHTML, esc } from "./cards.js";
import { sealedArt } from "./art.js";
import { sting } from "./ambient.js";
import { noteFor } from "../shared/lore.js";
import { margNote } from "./tome.js";
import { markButton } from "./bookmarks.js";

let opts = { openLegend: () => {}, openArchive: () => {} }, root = null, renderTimer = 0;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- section */
export function initArchive(rootEl, o = {}) {
  opts = { ...opts, ...o }; root = rootEl; render();
  Archive.onChange(() => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 30); });
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-card]"); if (!b) return;
    const N = window.MOE3D && window.MOE3D.navigator;
    if (N) N.go({ type: "card", id: b.dataset.card }, { origin: b }); else inspect(Archive.CARD[b.dataset.card], b);
  });
}
function render() {
  if (!root) return;
  const p = Archive.progress(), grid = root.querySelector("#archive-grid"); if (!grid) return;
  const set = (s, v) => { const e = root.querySelector(s); if (e) e.textContent = v; };
  set("#arch-n", p.unlocked); set("#arch-t", p.total); set("#arch-r", `${p.relicsUnlocked} of ${p.relics} relics recovered`);
  const bar = root.querySelector(".arch-bar i"); if (bar) bar.style.width = Math.round(p.unlocked / p.total * 100) + "%";
  const focusId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.card;
  grid.innerHTML = "";
  for (const k of Archive.LEGEND_ORDER) {
    const L = Archive.LEGENDS[k], st = Archive.legendStatus(k), cards = Archive.CARDS.filter(c => c.legend === k);
    const sec = document.createElement("section"); sec.className = "arch-group"; sec.style.setProperty("--cc", L.color); sec.dataset.legend = k;
    sec.innerHTML = `<header class="arch-gh"><h3>${esc(L.title)}</h3><span>${esc(L.place)} · ${st.found}/${st.total} endings found</span></header><div class="arch-cards"></div>`;
    const row = sec.querySelector(".arch-cards"); cards.forEach((c, i) => { const el = archiveCard(c); el.style.setProperty("--i", i); row.append(el); }); grid.append(sec);
  }
  const seal = Archive.CARD["seal-archivist"], sec = document.createElement("section"); sec.className = "arch-group arch-final"; sec.style.setProperty("--cc", "#8e74b5");
  sec.innerHTML = `<header class="arch-gh"><h3>The Archivist’s Seal</h3><span>Awarded for following every thread</span></header><div class="arch-cards"></div>`; sec.querySelector(".arch-cards").append(archiveCard(seal));
  // secrets of the valley: not relics, found on the landing page itself
  for (const c of Archive.SECRETS) { const el = archiveCard(c); el.style.setProperty("--cc", "#7fc8b8"); sec.querySelector(".arch-cards").append(el); }
  sec.querySelector(".arch-gh span").textContent = "The seal for following every thread, and the secrets of the valley";
  grid.append(sec);
  if (focusId) { const f = grid.querySelector(`[data-card="${focusId}"]`); if (f) f.focus({ preventScroll: true }); }
}

/* ---------------------------------------------------------------- inspector (a native modal dialog: Esc closes, focus is trapped) */
let insp = null;
function inspect(card, from) {
  if (!card) return;
  if (!insp) { insp = document.createElement("dialog"); insp.className = "inspect"; insp.setAttribute("aria-label", "Card details"); document.body.append(insp); insp.addEventListener("click", e => { if (e.target === insp) insp.close(); }); insp.addEventListener("close", () => {
    if (!insp._byNav && insp._rect && insp._from && document.contains(insp._from)) flyBack(insp._rect, insp._from, insp._card);
    insp._byNav = false; if (insp._from && document.contains(insp._from)) insp._from.focus({ preventScroll: true });
    dispatchEvent(new CustomEvent("moe:inspector-closed")); });
    // remember where the card sits in the dialog, for the flight back into the grid
    insp.addEventListener("cancel", () => snap()); insp.addEventListener("pointerdown", () => snap(), true); }
  insp._from = from; const got = Archive.isUnlocked(card.id), L = Archive.LEGENDS[card.legend];
  const mode = !got ? "locked" : card.type === "legend" ? "legend" : "relic";
  const info = got ? `<p class="ins-kicker">${esc(card.tag)} · No. ${card.no} of ${Archive.CARDS.length}</p><h2>${esc(card.name)}</h2><p class="ins-place">${esc(card.place)}</p><p class="ins-text">${esc(card.blurb)}</p>
      <div class="ins-basis k-${card.basis.kind}"><b>${esc(Archive.KIND_LABEL[card.basis.kind])}</b><p>${esc(card.basis.text)}</p></div>
      <p class="ins-why"><b>How it was recovered:</b> ${esc(Archive.whyText(card))}${card.type === "legend" ? "" : ` <span class="ins-date">${new Date((Archive.unlockedAt && Archive.unlockedAt(card.id)) || Date.now()).toLocaleDateString()}</span>`}</p>${margNote(noteFor(card.id), { tilt: -1.4 })}`
    : `<p class="ins-kicker">${card.type === "seal" ? "Seal" : card.type === "secret" ? "Secret" : "Relic"} · sealed · No. ${card.no} of ${Archive.CARDS.length}</p><h2>Sealed document</h2><p class="ins-place">${esc(L ? L.title : "The Archive")}</p>
      <p class="ins-text">This ${card.type === "seal" ? "seal" : card.type === "secret" ? "secret" : "relic"} has not been recovered yet. Its name stays hidden until you earn it.</p><div class="ins-basis"><b>Hint</b><p>${esc(card.hint)}</p></div>`;
  const act = card.type === "legend" ? `<button class="btn btn-primary" data-act="open">Open this legend</button>${markButton(card.legend)}` : (got || !L || card.type === "secret" ? "" : `<button class="btn btn-primary" data-act="open">Go to “${esc(L.title)}”</button>`);
  insp.innerHTML = `<div class="ins-box" style="--cc:${(L || { color: card.type === "secret" ? "#7fc8b8" : "#8e74b5" }).color}"><button class="close" aria-label="Close" data-act="x">✕</button><div class="ins-card cf ${got ? "is-got" : "is-locked"}">${faceHTML(card, mode, { invite: "" })}</div><div class="ins-info">${info}<div class="ins-actions">${act}<button class="btn btn-ghost" data-act="x">Close</button></div></div></div>`;
  insp.onclick = e => { const a = e.target.closest("[data-act]"); if (!a) { if (e.target === insp) insp.close(); return; } if (a.dataset.act === "x") insp.close(); else if (a.dataset.act === "open") { if (!(window.MOE3D && window.MOE3D.navigator)) insp.close(); opts.openLegend(card.legend); } };
  if (!insp.open) insp.showModal();
  const first = insp.querySelector(".btn-primary") || insp.querySelector(".close"); if (first) first.focus({ preventScroll: true });
  if (got && card.type !== "legend") Archive.markRevealed(card.id);
}

/* ---------------------------------------------------------------- the reveal sequence */
let rv = null;
/** Shows the newly recovered cards one by one. `cards` are card objects returned by Archive.recordEnding/recordTextEnding. */
export function reveal(cards, { onDone = () => {}, openArchive = opts.openArchive } = {}) {
  cards = (cards || []).filter(c => c && Archive.isUnlocked(c.id));
  if (!cards.length) { onDone(); return; }
  if (rv) { rv.remove(); rv = null; }
  const d = rv = document.createElement("dialog"); d.className = "reveal"; d.setAttribute("aria-label", "Relic recovered"); document.body.append(d);
  let i = 0, finished = false;
  const show = () => {
    const c = cards[i], L = Archive.LEGENDS[c.legend] || (c.type === "secret" ? { color: "#7fc8b8", title: "The valley" } : { color: "#8e74b5", title: "The Archive" }), p = Archive.progress(), mode = c.type === "legend" ? "legend" : "relic";
    d.style.setProperty("--cc", L.color); finished = false; d.classList.remove("skip", "done");
    d.innerHTML = `<div class="rv-bg"></div><div class="rv-rays"></div><div class="rv-fog"></div>
      <div class="rv-stage"><p class="rv-kicker">${c.type === "seal" ? "Seal awarded" : c.type === "secret" ? "Secret found" : "Relic recovered"}${cards.length > 1 ? ` · ${i + 1} of ${cards.length}` : ""}</p>
        <div class="rv-card"><div class="rv-flip"><div class="rv-back">${sealedArt(c.legend)}<span class="rv-wax"></span></div><div class="rv-front cf">${faceHTML(c, mode, { invite: "" })}</div></div></div>
        <div class="rv-info"><h2 class="rv-name">${esc(c.name)}</h2><p class="rv-why">${esc(Archive.whyText(c))}</p><p class="rv-basis k-${c.basis.kind}"><b>${esc(Archive.KIND_LABEL[c.basis.kind])}.</b> ${esc(c.basis.text)}</p>
          <p class="rv-count">The Archive: <b>${p.unlocked}</b> of ${p.total} cards recovered</p>
          <div class="rv-actions"><button class="btn btn-primary" data-act="next">${i < cards.length - 1 ? "Next relic" : "Continue"}</button><button class="btn btn-ghost" data-act="arch">Open the Archive</button></div></div></div>
      <button class="rv-skip" data-act="skip" type="button">Skip ›</button>`;
    Archive.markRevealed(c.id); sting();
    const total = reduce() ? 0 : 5200; clearTimeout(d._t); d._t = setTimeout(() => settle(), total);
    if (reduce()) settle();
    d.querySelector('[data-act="skip"]').focus({ preventScroll: true });
  };
  const settle = () => { if (finished) return; finished = true; clearTimeout(d._t); d.classList.add("skip", "done"); const n = d.querySelector('[data-act="next"]'); if (n) n.focus({ preventScroll: true }); const sk = d.querySelector(".rv-skip"); if (sk) sk.hidden = true; };
  const close = (goArchive) => { clearTimeout(d._t); try { d.close(); } catch (e) { /* already closed */ } d.remove(); if (rv === d) rv = null; onDone(); if (goArchive) openArchive(); };
  d.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (!a) { if (!finished) settle(); return; } const k = a.dataset.act; if (k === "skip") settle(); else if (k === "next") { if (i < cards.length - 1) { i++; show(); } else close(false); } else if (k === "arch") close(true); });
  d.addEventListener("cancel", e => { e.preventDefault(); if (!finished) settle(); else if (i < cards.length - 1) { i++; show(); } else close(false); });   // Esc: skip the animation first, then close
  d.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !finished && e.target === d) { e.preventDefault(); settle(); } });
  d.showModal(); show();
}
export const revealOpen = () => !!rv;

/* ---------------------------------------------------------------- inspector API for the cinematic navigation */
function snap() { if (!insp) return; const c = insp.querySelector(".ins-card"); if (c) { insp._rect = c.getBoundingClientRect(); insp._card = c.cloneNode(true); } }
/** open the inspector for a card id (the navigator animates the card out of the grid) */
export function inspectCard(id, from) { inspect(Archive.CARD[id], from || document.querySelector(`#archive-grid [data-card="${id}"]`)); }
/** close it without the fly-back (the navigator plays its own) */
export function closeInspector() { if (insp && insp.open) { insp._byNav = true; insp.close(); } }
/** the card flies back from the dialog into its place in the grid */
function flyBack(rect, target, cardClone) {
  if (reduce() || !cardClone || !rect || !rect.width) return;
  const a = target.getBoundingClientRect(); if (a.bottom < 0 || a.top > innerHeight) return;
  const g = cardClone; g.className = "flying-card ins-card " + g.className.replace(/\bins-card\b/, ""); g.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;--cc:${getComputedStyle(target).getPropertyValue("--cc")}`;
  document.body.append(g); target.style.visibility = "hidden";
  const an = g.animate([{ transform: "none" }, { transform: `translate(${a.left - rect.left}px,${a.top - rect.top}px) scale(${a.width / rect.width})` }], { duration: 460, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
  const done = () => { g.remove(); target.style.visibility = ""; }; an.onfinish = done; setTimeout(done, 900);
}
