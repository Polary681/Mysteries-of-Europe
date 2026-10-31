// THE SKY OF TONIGHT: turns the real date into the sky the landing valley shows, and separates two things clearly:
//   1. astronomy (astro.js): where the Moon, the Sun and the stars really are, the Moon's phase  -> `astro` below
//   2. art and folklore: which "special night" it is and how that changes the mood                -> `night` below
// Nothing here touches three.js or the DOM.
//
// Overrides (for curious visitors and for the tests):  ?sky=2026-10-31T22:00Z   ?night=samhain|solstice|stjohn|none   ?season=winter|spring|summer|autumn
import { skyAt, sun, REF, compass, norm360 } from "./astro.js";

const R2D = 180 / Math.PI;
const param = k => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };

/** The scene is always a night. In daylight (Sun above -6 deg) the valley shows the coming night instead (1 h after dark). */
export function sceneTime(now = new Date()) {
  const forced = param("sky"); let d = now, live = true;
  if (forced) { const t = new Date(forced); if (!isNaN(t)) { d = t; live = false; } }
  const sunAlt = t => skyAt(t).sun.alt;
  if (sunAlt(d) > -6) {
    let t = new Date(d.getTime());
    for (let i = 0; i < 24 * 6 && sunAlt(t) > -15; i++) t = new Date(t.getTime() + 600000);
    return { date: new Date(t.getTime() + 3600000), live: false, tonight: true, real: d };
  }
  return { date: d, live: live && !forced, tonight: false, real: d };
}

/** local civil date/time parts at the reference place */
export function localParts(date, tz = REF.tz) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, hhmm: `${p.hour}:${p.minute}` };
  } catch (e) { return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), h: date.getUTCHours(), min: date.getUTCMinutes(), hhmm: date.toISOString().slice(11, 16) }; }
}

/* ------------------------------------------------------------------ special nights (ART + FOLKLORE, not astronomy) */
export const NIGHTS = {
  samhain: {
    id: "samhain", name: "Samhain", label: "Samhain night",
    note: "Gaelic folklore: on the night of 31 October bonfires were lit on the hills and the border between the worlds was thought to grow thin.",
    moonTint: [1.0, 0.56, 0.34], moonTintK: 0.55, mist: 1.5, fires: 6, fireTint: [1.6, 0.55, 0.18], halo: 0, frost: 0, presences: 1.8, wisps: 1.4, grade: [1.04, 0.97, 0.92],
  },
  solstice: {
    id: "solstice", name: "Winter solstice", label: "The longest night",
    note: "The winter solstice: the longest night of the year. Many European midwinter customs (Yule fires, the Wild Hunt) gather around it.",
    moonTint: [0.86, 0.93, 1.12], moonTintK: 0.5, mist: 0.65, fires: 2, fireTint: [1.4, 0.62, 0.22], halo: 1, frost: 1, presences: 1.2, wisps: 0.8, grade: [0.93, 0.98, 1.08],
  },
  stjohn: {
    id: "stjohn", name: "St John's Eve", label: "St John's Eve",
    note: "Midsummer folklore: bonfires on the eve of St John (23 June), and the belief that wandering lights show where treasure lies.",
    moonTint: [1.04, 0.92, 0.72], moonTintK: 0.35, mist: 0.8, fires: 8, fireTint: [1.7, 0.7, 0.24], halo: 0, frost: 0, presences: 1.0, wisps: 2.2, grade: [1.03, 1.0, 0.95],
  },
};

/** Which special night (if any) the scene night is. The "evening date" decides (before noon counts as the night before). */
export function specialNight(date) {
  const forced = param("night");
  if (forced) return forced === "none" ? null : (NIGHTS[forced] || null);
  const p = localParts(date);
  let ev = new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
  if (p.h < 12) ev = new Date(ev.getTime() - 86400000);
  const M = ev.getUTCMonth() + 1, D = ev.getUTCDate();
  if (M === 10 && D === 31) return NIGHTS.samhain;
  if (M === 6 && D === 23) return NIGHTS.stjohn;
  // the solstice night: the Sun's longitude crosses 270 deg between this evening's noon and the next noon (astronomical fact)
  if (M === 12 && D >= 19 && D <= 23) {
    const a = sun(ev).lon, b = sun(new Date(ev.getTime() + 86400000)).lon;
    if (a <= 270 && b > 270 || (a > 269 && a <= 270)) return NIGHTS.solstice;
  }
  return null;
}

/* ------------------------------------------------------------------ the seasons (ART, not astronomy)
   The valley's look follows the season of the scene date at the reference place (meteorological seasons of the northern
   hemisphere: Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn). Only colours, snow and mist change: the
   stars, the Moon and the length of the night stay purely astronomical (a summer night really is short and light there). */
export const SEASONS = {
  winter: { id: "winter", label: "Winter", snow: 1, green: 0, brown: 0, mist: 1.0, grade: [0.93, 0.98, 1.08], note: "Snow on the roofs and the meadows, and a colder light." },
  spring: { id: "spring", label: "Spring", snow: 0, green: 1, brown: 0, mist: 1.1, grade: [0.98, 1.03, 0.98], note: "Greener meadows, and the mist of thawing ground." },
  summer: { id: "summer", label: "Summer", snow: 0, green: 0.45, brown: 0.15, mist: 0.75, grade: [1.04, 1.0, 0.93], note: "Short, light nights and a warmer light." },
  autumn: { id: "autumn", label: "Autumn", snow: 0, green: 0, brown: 1, mist: 1.35, grade: [1.03, 0.99, 0.94], note: "Brown bracken and dry grass, and denser mist." },
};
export function seasonOf(date) {
  const forced = param("season"); if (forced && SEASONS[forced]) return SEASONS[forced];
  const m = localParts(date).m;
  return m === 12 || m <= 2 ? SEASONS.winter : m <= 5 ? SEASONS.spring : m <= 8 ? SEASONS.summer : SEASONS.autumn;
}

/** The full state of tonight's sky (astronomy + the special-night profile), with a human caption. */
export function tonight(now = new Date()) {
  const t = sceneTime(now), astro = skyAt(t.date), night = specialNight(t.date), lp = localParts(t.date);
  const m = astro.moon, s = astro.sun;
  // how much light the Moon gives: phase (with the opposition surge), height above the horizon (extinction)
  const altK = Math.max(0, Math.min(1, (m.alt + 1.5) / 9));
  const moonLight = altK * (0.08 + 0.92 * Math.pow(m.fraction, 1.6));
  // twilight glow: Sun between -18 and -4 deg
  const twilight = Math.max(0, Math.min(1, (s.alt + 18) / 14));
  const moonWhere = m.alt > 0 ? `${Math.round(m.alt)}° high in the ${compass(m.az)}` : "below the horizon";
  const caption = `${REF.name} · ${t.tonight ? "tonight, " : ""}${lp.hhmm} · ${m.name} (${Math.round(m.fraction * 100)}%) · Moon ${moonWhere}`;
  return { ...t, astro, night, season: seasonOf(t.date), local: lp, moonLight, twilight, caption, ref: REF };
}

/** Azimuth the valley camera looks towards. The valley is fictional, so its compass orientation is free: it is chosen once
 *  per visit so that the real Moon stands just right of the castle when it is up (sky and Moon stay true to each other). */
export function valleyAzimuth(state) {
  const m = state.astro.moon;
  if (m.alt > -1) return norm360(m.az - 27);
  return 180;   // no Moon: face south, where the planets and the Milky Way of the season cross
}

/** Map an ENU vector (east, north, up) to the valley's world frame (-z = viewing azimuth Av, +x = Av + 90 deg, +y = up). */
export function enuToWorld(enu, Av, out = [0, 0, 0]) {
  const a = Av / R2D, fx = Math.sin(a), fy = Math.cos(a), rx = Math.cos(a), ry = -Math.sin(a);
  out[0] = enu[0] * rx + enu[1] * ry; out[1] = enu[2]; out[2] = -(enu[0] * fx + enu[1] * fy);
  return out;
}
