// DOM builders for the collectible cards. ONE card frame is used everywhere (Legends section, Archive grid, reveal, inspector),
// so the whole site shares the same visual identity.
import * as Archive from "../shared/archive.js";
import { cardArt, sealedArt, emblem } from "./art.js";

export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const icon = key => `<svg class="cf-ico" viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${emblem(key)}</svg>`;
const CATEGORY = { woolpit: ["Chronicle", "bell"], hoia: ["Forest folklore", "trees"], skye: ["Original tale", "notes4"], babayaga: ["Fairy tale", "skull"], sibilla: ["Medieval legend", "crown"], bathory: ["Historical case", "teeth"] };

/** the inner markup of a card. mode: "legend" | "relic" | "locked" */
export function faceHTML(card, mode, o = {}) {
  const total = Archive.CARDS.length, L = Archive.LEGENDS[card.legend];
  const no = `<span class="cf-no">No. ${pad(card.no)}<i>/${total}</i></span>`;
  if (mode === "locked") {
    return `<span class="cf-frame">${no}<span class="cf-cat">${card.type === "seal" ? "Seal" : card.type === "secret" ? "Secret" : "Relic"} · sealed</span>
      <span class="cf-art">${sealedArt(card.legend)}<span class="cf-lock" aria-hidden="true">Sealed</span></span>
      <span class="cf-body"><small class="cf-place">${esc(L ? L.title : "The Archive")}</small><h3>Sealed document</h3>
      <p class="cf-hint">${esc(card.hint)}</p></span></span>`;
  }
  const cat = mode === "legend" ? CATEGORY[card.legend] : null;
  const kindLabel = Archive.KIND_LABEL[card.basis.kind];
  const tag = mode === "legend" ? `${icon(cat[1])}<span>${esc(cat[0])}</span>` : `${icon(card.symbol)}<span>${esc(card.tag)}</span>`;
  const foot = o.foot || "";
  return `<span class="cf-frame">${no}<span class="cf-cat">${tag}</span>
    <span class="cf-art">${cardArt(card)}<span class="cf-shine" aria-hidden="true"></span>${o.badge || ""}${o.invite ? `<span class="cf-invite" aria-hidden="true">${esc(o.invite)}</span>` : ""}</span>
    <span class="cf-body"><small class="cf-place"><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 1a3.6 3.6 0 0 0-3.6 3.6C2.4 7.4 6 11 6 11s3.6-3.6 3.6-6.4A3.6 3.6 0 0 0 6 1z" fill="currentColor"/></svg> ${esc(card.place)}</small>
      <h3>${esc(card.name)}</h3><p>${esc(o.text || card.blurb)}</p>
      <span class="cf-foot">${foot || `<span class="cf-basis k-${card.basis.kind}">${esc(kindLabel)}</span>`}</span></span></span>`;
}

/* ---------------------------------------------------------------- the card in the Legends section (keeps .card + data-legend) */
export function legendCard(k, data, { hasAdv = false } = {}) {
  const card = Archive.CARD["legend-" + k], st = Archive.legendStatus(k), L = Archive.LEGENDS[k];
  const b = document.createElement("button"); b.type = "button"; b.className = "card cf legend-card"; b.dataset.legend = k; b.style.setProperty("--c", (data && data.color) || L.color);
  b.style.setProperty("--cc", L.color);
  b.innerHTML = faceHTML(card, "legend", { text: (data && data.desc) || card.blurb, invite: hasAdv ? "Enter the legend" : "Read the legend", foot: "" });
  const foot = b.querySelector(".cf-foot");
  foot.innerHTML = `${hasAdv ? '<span class="play">▶ Play the 3D adventure</span>' : '<span class="read">Read the short story</span>'}<span class="cf-state s-${st.state}">${esc(Archive.stateLabel(k, st.state))}</span>`
    + `<span class="cf-prog" aria-label="Endings found: ${st.found} of ${st.total}">${Array.from({ length: st.total }, (_, i) => `<i class="${i < st.found ? "on" : ""}"></i>`).join("")}<em>${st.found}/${st.total} endings</em></span>`;
  b.setAttribute("aria-label", `${card.name}, ${card.place}. ${Archive.stateLabel(k, st.state)}, ${st.found} of ${st.total} endings found.`);
  b.classList.add("is-" + st.state);
  tilt(b); return b;
}
/** re-reads the real progress and updates an existing legend card in place (no rebuild, no lost focus) */
export function refreshLegendCard(b) {
  const k = b.dataset.legend, st = Archive.legendStatus(k), card = Archive.CARD["legend-" + k];
  const s = b.querySelector(".cf-state"); if (s) { s.className = "cf-state s-" + st.state; s.textContent = Archive.stateLabel(k, st.state); }
  const p = b.querySelector(".cf-prog"); if (p) { p.innerHTML = Array.from({ length: st.total }, (_, i) => `<i class="${i < st.found ? "on" : ""}"></i>`).join("") + `<em>${st.found}/${st.total} endings</em>`; p.setAttribute("aria-label", `Endings found: ${st.found} of ${st.total}`); }
  b.className = b.className.replace(/\bis-\w+/g, "").trim() + " is-" + st.state;
  b.setAttribute("aria-label", `${card.name}, ${card.place}. ${Archive.stateLabel(k, st.state)}, ${st.found} of ${st.total} endings found.`);
}

/* ---------------------------------------------------------------- the card in the Archive grid */
export function archiveCard(card) {
  const got = Archive.isUnlocked(card.id), fresh = got && Archive.isNew(card.id);
  const b = document.createElement("button"); b.type = "button"; b.dataset.card = card.id;
  b.className = "acard cf " + (got ? "is-got" : "is-locked") + (fresh ? " is-new" : "") + " t-" + card.type; b.style.setProperty("--cc", (Archive.LEGENDS[card.legend] || { color: "#8e74b5" }).color);
  if (got) {
    b.innerHTML = faceHTML(card, card.type === "legend" ? "legend" : "relic", { badge: fresh ? '<span class="cf-new">New</span>' : "", invite: "Examine" });
    b.setAttribute("aria-label", `${card.name}${fresh ? " (new)" : ""}. ${card.place}. Click to examine.`);
  } else {
    b.innerHTML = faceHTML(card, "locked");
    b.setAttribute("aria-label", `Sealed ${card.type === "seal" ? "seal" : card.type === "secret" ? "secret card" : "relic"} number ${card.no}. Hint: ${card.hint}`);
  }
  tilt(b); return b;
}

/* ---------------------------------------------------------------- hover tilt (mouse only; off with reduced motion) */
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function tilt(el, max = 5) {
  let raf = 0, lx = 0, ly = 0;
  const apply = () => { raf = 0; el.style.setProperty("--rx", (-ly * max).toFixed(2) + "deg"); el.style.setProperty("--ry", (lx * max).toFixed(2) + "deg"); el.style.setProperty("--mx", ((lx + 1) * 50).toFixed(1) + "%"); el.style.setProperty("--my", ((ly + 1) * 50).toFixed(1) + "%"); };
  el.addEventListener("pointermove", e => { if (e.pointerType !== "mouse" || reduce()) return; const r = el.getBoundingClientRect(); lx = (e.clientX - r.left) / r.width * 2 - 1; ly = (e.clientY - r.top) / r.height * 2 - 1; if (!raf) raf = requestAnimationFrame(apply); });
  el.addEventListener("pointerleave", () => { lx = ly = 0; if (!raf) raf = requestAnimationFrame(apply); });
}
