// THE SKY CHART: opened from the valley's caption. The same real sky as the landing scene, drawn as a chart of the sky
// overhead (zenith in the middle, north up, east to the left, as when you lie on your back and look up), with the names of
// the bright stars that are above the horizon and the times the Sun and the Moon rise and set around the scene night.
// Pure astronomy (src/world/astro.js), nothing invented. Planets are not computed, so they are not shown.
import { riseSet, NAMED_STARS, eqVector, compass, REF } from "../world/astro.js";
import { catalogue } from "../world/celestial.js";
import { tonight, localParts } from "../world/sky.js";
import { esc } from "./cards.js";

const D2R = Math.PI / 180, R = 100, CX = 210, CY = 210;
let stars = null, dlg = null;
const enu = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** stereographic projection around the zenith: alt/az in radians -> chart x, y */
const proj = (alt, az) => { const r = 2 * R * Math.tan((Math.PI / 2 - alt) / 2); return [CX - r * Math.sin(az), CY - r * Math.cos(az)]; };
const altAz = (m, v) => { const [e, n, u] = enu(m, v); return [Math.asin(Math.max(-1, Math.min(1, u))), Math.atan2(e, n)]; };
const hhmm = (d, tz) => localParts(d, tz).hhmm;

/** the data of the chart (also used by the tests): named stars above the horizon, Sun/Moon events, Moon position */
export function chartData(sky = tonight()) {
  const a = sky.astro, m = a.eqToEnu, ref = sky.ref || REF, at = a.date || sky.date || new Date();
  const named = NAMED_STARS.map(([name, ra, dec, mag]) => { const [alt, az] = altAz(m, eqVector(ra, dec)); return { name, mag, alt: alt / D2R, az: (az / D2R + 360) % 360 }; }).filter(s => s.alt > 2).sort((x, y) => x.mag - y.mag);
  const from = new Date(at.getTime() - 14 * 3600000), to = new Date(at.getTime() + 14 * 3600000);
  const ev = body => riseSet(body, from, to, ref).map(e => ({ ...e, body, at: hhmm(e.date, ref.tz), before: e.date < at }));
  const sun = ev("sun"), moon = ev("moon");
  const pick = (list, type, before) => { const l = list.filter(e => e.type === type && e.before === before); return before ? l[l.length - 1] || null : l[0] || null; };
  return {
    named, at, ref, local: localParts(at, ref.tz),
    sunset: pick(sun, "set", true), sunrise: pick(sun, "rise", false),
    moonEvents: moon.filter(e => Math.abs(e.date - at) < 13 * 3600000),
    moon: { alt: a.moon.alt, az: a.moon.az, fraction: a.moon.fraction, name: a.moon.name },
  };
}

function svgChart(sky, d) {
  if (!stars) stars = catalogue(4.8);
  const m = sky.astro.eqToEnu; let dots = "", labels = "";
  for (const s of stars) {
    const [alt, az] = altAz(m, s.v); if (alt < 0.01) continue;
    const [x, y] = proj(alt, az), r = Math.max(0.5, 2.6 - s.mag * 0.42);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="rgb(${s.col.map(c => Math.round(c * 255)).join(",")})" opacity="${Math.min(1, 0.45 + (5 - s.mag) * 0.12).toFixed(2)}"/>`;
  }
  for (const s of d.named) {
    const [x, y] = proj(s.alt * D2R, s.az * D2R);
    labels += `<text x="${(x + 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" class="sc-name">${esc(s.name)}</text>`;
  }
  let moonSvg = "";
  if (d.moon.alt > 0) { const [x, y] = proj(d.moon.alt * D2R, d.moon.az * D2R); moonSvg = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" class="sc-moon" opacity="${(0.45 + 0.55 * d.moon.fraction).toFixed(2)}"/><text x="${(x + 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="sc-name sc-mn">Moon</text>`; }
  const ring = a => { const [x, y] = proj(a * D2R, 0); return `<circle cx="${CX}" cy="${CY}" r="${(CY - y).toFixed(1)}" class="sc-alt"/>`; };
  const card = [["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, az]) => { const [x, y] = proj(-0.09, az * D2R); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="sc-card${l === "N" ? " n" : ""}">${l}</text>`; }).join("");
  return `<svg viewBox="0 0 420 420" role="img" aria-label="Chart of the sky overhead: zenith in the centre, north at the top, east on the left"><circle cx="${CX}" cy="${CY}" r="${2 * R}" class="sc-sky"/>${ring(30)}${ring(60)}<circle cx="${CX}" cy="${CY}" r="1.4" class="sc-zen"/>${dots}${moonSvg}${labels}${card}</svg>`;
}

export function openSkyChart(sky) {
  try { sky = sky && sky.astro ? sky : tonight(); } catch (e) { return; }
  const d = chartData(sky), ref = d.ref, lp = d.local;
  if (dlg) dlg.remove();
  dlg = document.createElement("dialog"); dlg.className = "skychart"; dlg.setAttribute("aria-labelledby", "sc-title");
  const mev = d.moonEvents.map(e => `<li><b>Moon${e.type === "rise" ? "rise" : "set"}</b> ${e.at}${e.before ? "" : localParts(e.date, ref.tz).d !== lp.d ? " <small>(next day)</small>" : ""}</li>`).join("") || "<li><b>Moon</b> no rise or set in these hours</li>";
  const stl = d.named.slice(0, 10).map(s => `<li>${esc(s.name)} <small>${Math.round(s.alt)}° high in the ${compass(s.az)}</small></li>`).join("");
  dlg.innerHTML = `<div class="sc-box"><button class="sc-x" aria-label="Close the sky chart">✕</button>
    <div class="sc-chart">${svgChart(sky, d)}<p class="sc-legend">The sky overhead: zenith in the centre, north at the top, east on the left, as when you lie on your back and look up. Rings at 30° and 60° above the horizon.</p></div>
    <div class="sc-info"><p class="kicker">The sky of the valley</p><h3 id="sc-title">Over the ${esc(ref.name)}</h3>
      <p class="sc-when">${String(lp.d).padStart(2, "0")}/${String(lp.m).padStart(2, "0")}/${lp.y} · ${lp.hhmm} (${esc(ref.tz.replace("_", " "))})${sky.tonight ? " · the coming night" : ""}</p>
      <p class="sc-moonp">${esc(d.moon.name)} · ${Math.round(d.moon.fraction * 100)}% lit · ${d.moon.alt > 0 ? `${Math.round(d.moon.alt)}° high in the ${compass(d.moon.az)}` : "below the horizon"}</p>
      <ul class="sc-times">${d.sunset ? `<li><b>Sunset</b> ${d.sunset.at}</li>` : ""}${d.sunrise ? `<li><b>Sunrise</b> ${d.sunrise.at}</li>` : ""}${mev}</ul>
      <h4>Bright stars above the horizon</h4><ul class="sc-stars">${stl || "<li>None of the named bright stars is up right now.</li>"}</ul>
      <p class="sc-note">Computed in your browser from the date and time (Meeus, low precision: about a minute for rise and set). Planets are not computed, so a bright “star” missing from the chart may be one. The valley itself is imaginary; its sky is the real one over the ${esc(ref.name)}.</p></div></div>`;
  document.body.append(dlg);
  const close = () => { try { dlg.close(); } catch (e) { /* ignore */ } };
  dlg.addEventListener("close", () => { const x = dlg; setTimeout(() => x && x.remove(), 50); if (dlg === x) dlg = null; });
  dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest(".sc-x")) close(); });
  try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
  dlg.querySelector(".sc-x").focus();
  return dlg;
}
