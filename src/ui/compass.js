// THE ARCHIVIST'S COMPASS: a small brass compass whose needle turns toward the selected legend, as seen from the Archive
// (the valley's reference place, the Brocken in the Harz: REF in world/astro.js). The bearing is the real initial
// great-circle bearing computed from the coordinates the site already uses for its pins (GEO.globe.leg, [lat, lon]).
// No legend selected, or no coordinates for it: the needle wanders gently (only while on screen, never with reduced motion).
// A click points it at the next legend. Every compass on the page shows the same selection.
import * as Archive from "../shared/archive.js";
import * as Traveller from "../shared/traveller.js";
import { REF, compass as dir } from "../world/astro.js";

const rad = Math.PI / 180;
const coords = k => { try { const c = window.GEO && window.GEO.globe && window.GEO.globe.leg && window.GEO.globe.leg[k]; return Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]) ? c : null; } catch (e) { return null; } };
/** initial great-circle bearing (degrees from north) and distance (km) from the Archive to [lat, lon] */
export function bearingTo([lat, lon], from = REF) {
  const p1 = from.lat * rad, p2 = lat * rad, dl = (lon - from.lon) * rad;
  const b = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / rad;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return { deg: (b + 360) % 360, km: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
}

let target = null, note = "";
const all = new Set();
const short = k => ({ woolpit: "Woolpit", hoia: "Hoia Baciu", skye: "Isle of Skye", babayaga: "Baba Yaga’s forest", sibilla: "Monte Sibilla", bathory: "Čachtice" }[k] || (Archive.LEGENDS[k] || {}).title || k);

function rose() {
  let t = ""; for (let i = 0; i < 72; i++) { const a = i * 5 * rad, r1 = 45, r2 = i % 18 === 0 ? 39 : i % 2 === 0 ? 41.5 : 43; t += `M${(50 + Math.sin(a) * r1).toFixed(2)} ${(50 - Math.cos(a) * r1).toFixed(2)}L${(50 + Math.sin(a) * r2).toFixed(2)} ${(50 - Math.cos(a) * r2).toFixed(2)}`; }
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle class="cp-case" cx="50" cy="50" r="49"/><circle class="cp-face" cx="50" cy="50" r="46"/><path class="cp-ticks" d="${t}"/>
    <path class="cp-star" d="M50 16L54 46 84 50 54 54 50 84 46 54 16 50 46 46z"/><path class="cp-star2" d="M50 28l3 19 19 3-19 3-3 19-3-19-19-3 19-3z" transform="rotate(45 50 50)"/>
    <text x="50" y="13.5" class="cp-n">N</text><text x="88.5" y="53" class="cp-l">E</text><text x="50" y="92" class="cp-l">S</text><text x="11.5" y="53" class="cp-l">W</text>
    <g class="cp-swing"><g class="cp-needle"><path class="cp-nn" d="M50 18l5.2 32h-10.4z"/><path class="cp-ns" d="M50 82l5.2-32h-10.4z"/><circle class="cp-pin" cx="50" cy="50" r="3.4"/></g></g>
    <circle class="cp-glass" cx="50" cy="50" r="45"/></svg>`;
}

function render(c) {
  const k = target, xy = k ? coords(k) : null;
  c.el.classList.toggle("idle", !xy);
  if (xy) {
    const { deg, km } = bearingTo(xy), delta = ((deg - c.angle) % 360 + 540) % 360 - 180; c.angle += delta;
    c.needle.style.setProperty("--a", c.angle.toFixed(1) + "deg");
    c.cap.innerHTML = `<b>${short(k)}</b><span>${Math.round(deg)}° ${dir(deg)} · ${Math.round(km).toLocaleString("en")} km from the Archive</span>`;
    c.btn.setAttribute("aria-label", `The Archivist’s compass points ${dir(deg)}, ${Math.round(deg)} degrees, toward ${Archive.LEGENDS[k].title}, ${Math.round(km)} km from the Archive in the Harz. Press to point to the next legend.`);
  } else {
    const rest = ((c.angle % 360) + 540) % 360 - 180; c.angle -= rest; c.needle.style.setProperty("--a", c.angle.toFixed(1) + "deg");
    c.cap.innerHTML = `<b>${note ? note : "The needle wanders"}</b><span>${note ? "No legend to point at" : "Choose a legend and it will find its bearing"}</span>`;
    c.btn.setAttribute("aria-label", "The Archivist’s compass, waiting for a legend. Press to point to a legend.");
  }
}
/** point every compass at a legend (null = idle; `why` is shown under an idle compass, e.g. a country without a legend) */
export function setTarget(k, why = "") {
  const nk = k && Archive.LEGENDS[k] ? k : null;
  if (nk === target && why === note) return; target = nk; note = nk ? "" : why; all.forEach(render);
}
export const currentTarget = () => target;

/** build a compass in host. variant: "" | "sm" */
export function createCompass(host, { variant = "", label = "The Archivist’s compass" } = {}) {
  if (!host) return null;
  const el = document.createElement("div"); el.className = "acompass" + (variant ? " " + variant : "");
  el.innerHTML = `<button type="button" class="cp-btn">${rose()}</button><p class="cp-cap" aria-hidden="true"></p><p class="cp-k">${label}</p>`;
  const c = { el, angle: 0, btn: el.querySelector(".cp-btn"), needle: el.querySelector(".cp-needle"), cap: el.querySelector(".cp-cap") };
  c.btn.addEventListener("click", () => { const o = Archive.LEGEND_ORDER, i = o.indexOf(target); setTarget(o[(i + 1) % o.length]); });
  host.append(el); all.add(c); render(c);
  // the idle sway only runs while the compass is visible
  if ("IntersectionObserver" in window) new IntersectionObserver(es => el.classList.toggle("atmos-on", es[0].isIntersecting)).observe(el); else el.classList.add("atmos-on");
  return c;
}
/** start pointing at the last legend the visitor entered, if any */
export function initialTarget() { const k = Traveller.lastVisited(); if (k) setTarget(k); }
