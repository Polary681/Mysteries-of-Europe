// PERSONAL BOOKMARKS: a ribbon on every legend card (and a real button wherever a legend is shown in full: the short
// story, the Archive inspector, the Traveller's journal). Saved in the Traveller's record (localStorage, moe.traveller.v1).
// Any element with data-mark="<legend>" is kept in step with the saved state, wherever it is in the page.
import * as Archive from "../shared/archive.js";
import * as Traveller from "../shared/traveller.js";

const RIBBON = `<svg viewBox="0 0 20 30" aria-hidden="true" focusable="false"><path class="rb-b" d="M3 0h14v28l-7-6-7 6z"/><path class="rb-l" d="M6 3v17" /></svg>`;
const title = k => (Archive.LEGENDS[k] || {}).title || k;

/** a real <button> to toggle a legend's bookmark (compact = icon only) */
export function markButton(k, { compact = false } = {}) {
  const on = Traveller.isMarked(k);
  return `<button type="button" class="mark-btn${compact ? " compact" : ""}" data-mark="${k}" aria-pressed="${on}" aria-label="${on ? "Remove the bookmark from" : "Bookmark"} ${title(k).replace(/"/g, "&quot;")}">${RIBBON}${compact ? "" : `<span>${on ? "Bookmarked" : "Bookmark"}</span>`}</button>`;
}
function paint(el) {
  const k = el.dataset.mark, on = Traveller.isMarked(k), was = el.getAttribute("aria-pressed") === "true";
  el.setAttribute("aria-pressed", on ? "true" : "false");
  if (el.classList.contains("cf-mark")) { el.setAttribute("aria-label", (on ? "Remove the bookmark from " : "Bookmark ") + title(k)); el.title = on ? "Bookmarked" : "Bookmark this legend (B)"; }
  else { el.setAttribute("aria-label", (on ? "Remove the bookmark from " : "Bookmark ") + title(k)); const t = el.querySelector("span"); if (t) t.textContent = on ? "Bookmarked" : "Bookmark"; }
  if (on !== was) { el.classList.remove("drop", "lift"); void el.offsetWidth; el.classList.add(on ? "drop" : "lift"); }
}
export const paintAll = () => document.querySelectorAll("[data-mark]").forEach(paint);

/** the ribbon tucked into each legend card (like the constellation star: a span, so the card stays one button) */
export function ribbonCards(container) {
  container.querySelectorAll(".legend-card[data-legend]").forEach(card => {
    const k = card.dataset.legend; if (card.querySelector(".cf-mark")) return;
    const r = document.createElement("span"); r.className = "cf-mark"; r.dataset.mark = k; r.setAttribute("role", "button"); r.setAttribute("tabindex", "-1");
    r.setAttribute("aria-pressed", Traveller.isMarked(k) ? "true" : "false"); r.innerHTML = RIBBON;
    r.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); Traveller.toggleMark(k); });
    r.addEventListener("pointerdown", e => e.stopPropagation());
    card.setAttribute("aria-keyshortcuts", "B");
    card.addEventListener("keydown", e => { if ((e.key === "b" || e.key === "B") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); Traveller.toggleMark(k); } });
    card.querySelector(".cf-frame").append(r); paint(r);
  });
}

let bound = false;
export function initBookmarks(container) {
  if (container) ribbonCards(container);
  if (bound) return; bound = true;
  // every real bookmark button, wherever it is (story box, inspector, journal)
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("button.mark-btn[data-mark]"); if (!b) return; e.preventDefault(); Traveller.toggleMark(b.dataset.mark); });
  Traveller.onChange(what => { if (what === "mark" || what === "reset") paintAll(); });
  paintAll();
}
