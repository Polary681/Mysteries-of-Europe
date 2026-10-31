// ANIMATED ARCHIVE SEALS: wax seals for completed legends and ink stamps for the Traveller's milestones.
// Each seal is "pressed" (a short stamp-and-settle animation) only the first time it is shown on screen; after that it is
// simply there (the pressed ids are remembered in the Traveller's record, shared/traveller.js). Reduced motion: no press.
import * as Archive from "../shared/archive.js";
import * as Traveller from "../shared/traveller.js";
import { emblem } from "./art.js";

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EMB = { woolpit: "bell", hoia: "trees", skye: "notes4", babayaga: "skull", sibilla: "crown", bathory: "teeth" };
let uid = 0;
/** an irregular wax blob around (50,50): deterministic for a seed, so a seal never changes shape between renders */
function blob(seed, r = 43, j = 3.2, n = 16) {
  let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, rr = r + (rnd() - .5) * 2 * j; return [50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]; });
  let d = ""; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i ? "" : `M${m[0].toFixed(1)} ${m[1].toFixed(1)}`) + `Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${((q[0] + pts[(i + 2) % n][0]) / 2).toFixed(1)} ${((q[1] + pts[(i + 2) % n][1]) / 2).toFixed(1)}`; }
  return d + "Z";
}
/** wax seal markup. legend = a legend key (its emblem in the wax), mastered = gilt ring */
export function waxSeal(legend, { mastered = false, label = "" } = {}) {
  const e = emblem(EMB[legend] || "seal");
  return `<span class="wax${mastered ? " gilt" : ""}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><svg viewBox="0 0 100 100" focusable="false">
    <path class="wx-body" d="${blob(legend + (mastered ? "*" : ""))}"/><circle class="wx-ring" cx="50" cy="50" r="31"/><circle class="wx-ring2" cx="50" cy="50" r="27"/>
    <g transform="translate(29.5 29.5) scale(.41)" class="wx-emb-hi" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${e}</g>
    <g transform="translate(28.6 28.6) scale(.41)" class="wx-emb" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${e}</g>
    <ellipse class="wx-shine" cx="38" cy="30" rx="15" ry="7" transform="rotate(-28 38 30)"/></svg></span>`;
}
/** a round ink stamp with its words around the rim (for milestones in the Traveller's journal) */
export function inkStamp(text, glyph = "✦", { tone = "red" } = {}) {
  const id = "stp" + (++uid), t = String(text).toUpperCase();
  return `<span class="stamp t-${tone}" role="img" aria-label="Stamp: ${text}"><svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
    <defs><path id="${id}" d="M50 50m-34 0a34 34 0 1 1 68 0a34 34 0 1 1-68 0"/></defs>
    <circle cx="50" cy="50" r="45" class="st-o"/><circle cx="50" cy="50" r="26" class="st-i"/>
    <text class="st-t"><textPath href="#${id}" startOffset="50%" text-anchor="middle">· ${t} ·</textPath></text>
    <text x="50" y="58" text-anchor="middle" class="st-g">${glyph}</text></svg></span>`;
}

/* ---- pressing: the first time a seal is really on screen it is stamped (then remembered) ---- */
let io = null;
const press = el => { el.classList.remove("unpressed"); if (!reduce()) { el.classList.add("press"); setTimeout(() => el.classList.remove("press"), 1400); } Traveller.stamp(el.dataset.seal); };
/** el carries data-seal="<id>". Already pressed → shown at once; otherwise it waits (hidden) until it is in view, then presses. */
export function pressWhenSeen(el) {
  const id = el.dataset.seal; if (!id) return;
  if (Traveller.stamped(id)) return;
  el.classList.add("unpressed");
  if (!("IntersectionObserver" in window)) { press(el); return; }
  io = io || new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && e.intersectionRatio > .6) { io.unobserve(e.target); if (document.contains(e.target)) setTimeout(() => press(e.target), 250); } }, { threshold: [0, .6, 1] });
  io.observe(el);
}

/* ---- the seal on a legend card: appears when the legend is completed, gilt when every ending is found ---- */
export function sealLegendCard(card) {
  const k = card.dataset.legend; if (!k || !Archive.LEGENDS[k]) return;
  const st = Archive.legendStatus(k), body = card.querySelector(".cf-body"); if (!body) return;
  let s = body.querySelector(":scope > .card-seal");
  if (st.found <= 0) { if (s) s.remove(); return; }
  const mastered = st.state === "mastered", id = `legend:${k}:${mastered ? "mastered" : "completed"}`;
  if (s && s.dataset.seal === id) return;
  if (s) s.remove();
  s = document.createElement("span"); s.className = "card-seal"; s.dataset.seal = id;
  s.innerHTML = waxSeal(k, { mastered }); s.title = mastered ? "Sealed: every ending found" : "Sealed: legend completed";
  body.prepend(s); pressWhenSeen(s);
}
