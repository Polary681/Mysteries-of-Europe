// THE TRAVELLER'S RECORD: what the visitor has done in the site, kept for the Traveller's journal, the bookmarks and the
// archival stamps. It never owns adventure progress: endings and relics stay in their own saves (read through archive.js);
// this store only adds what nothing else recorded: every visit to a legend (not just the first), the countries looked at
// on the map, the bookmarked legends and which stamps have already been pressed (so each stamp animates only once).
// Storage: moe.traveller.v1 (localStorage through shared/save.js, in-memory fallback, works offline).
import { load, save } from "./save.js";
import * as Archive from "./archive.js";

export const KEY = "moe.traveller.v1";
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const read = () => { const s = obj(load(KEY, null)); return { v: 1, visits: obj(s.visits), countries: obj(s.countries), marks: obj(s.marks), stamps: obj(s.stamps), last: typeof s.last === "string" ? s.last : "" }; };
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const write = (st, what) => { save(KEY, st); listeners.forEach(f => { try { f(what); } catch (e) { console.error(e); } }); try { dispatchEvent(new CustomEvent("moe:traveller", { detail: { what } })); } catch (e) { /* not in a browser */ } };

/** a legend was entered (adventure or short story) */
export function visit(legend, now = Date.now()) {
  if (!Archive.LEGENDS[legend]) return;
  const st = read(), v = obj(st.visits[legend]);
  st.visits[legend] = { first: v.first || now, last: now, n: (+v.n || 0) + 1 }; st.last = legend; write(st, "visit");
}
/** a country was looked at on the map (code + display name, as the map shows it) */
export function explore(code, name, now = Date.now()) {
  if (!code || typeof code !== "string") return;
  const st = read(); if (st.countries[code]) return;
  st.countries[code] = { first: now, name: String(name || code) }; write(st, "country");
}
/** visits: this store, plus the first-open times the Archive already kept (older saves) */
export function visits() {
  const st = read(), out = {};
  const opened = obj((obj(load(Archive.KEY, null))).opened);
  for (const k of Archive.LEGEND_ORDER) {
    const v = st.visits[k];
    if (v) out[k] = v; else if (opened[k]) out[k] = { first: opened[k], last: opened[k], n: 1 };
  }
  return out;
}
export function lastVisited() {
  const st = read(); if (st.last && Archive.LEGENDS[st.last]) return st.last;
  const v = visits(); let best = "", t = 0; for (const k in v) if (v[k].last > t) { t = v[k].last; best = k; } return best;
}
/** the map's own country for a legend (the site's data: js/data.js COUNTRIES / EXTRA_LEGENDS), so a legend's land and the same
    land clicked on the map are one entry (Woolpit and Skye both lie in the map's United Kingdom) */
function landOf(k) {
  try {
    if (typeof COUNTRIES !== "undefined") for (const c of COUNTRIES) if (c[6] && String(c[6]).split(",").includes(k)) return { code: c[0], name: c[1] };
    if (typeof EXTRA_LEGENDS !== "undefined") for (const code in EXTRA_LEGENDS) if (String(EXTRA_LEGENDS[code].legends || "").split(",").includes(k)) {
      const x = typeof GEO !== "undefined" && GEO.extra && GEO.extra.find(e => e.c === code); return { code, name: x ? x.n : Archive.LEGENDS[k].country };
    }
  } catch (e) { /* not in the page */ }
  return { code: "legend:" + Archive.LEGENDS[k].country, name: Archive.LEGENDS[k].country };
}
/** countries explored on the map, plus the lands of the legends visited (a legend's own country counts as explored) */
export function countries() {
  const st = read(), out = { ...st.countries };
  const v = visits(); for (const k in v) { const l = landOf(k); if (!out[l.code]) out[l.code] = { first: v[k].first, name: l.name, via: k }; }
  return out;
}

/* ---- bookmarks ---- */
export const isMarked = legend => !!read().marks[legend];
export function toggleMark(legend, now = Date.now()) {
  if (!Archive.LEGENDS[legend]) return false;
  const st = read(); if (st.marks[legend]) delete st.marks[legend]; else st.marks[legend] = now; write(st, "mark");
  return !!st.marks[legend];
}
export const marks = () => { const m = read().marks; return Object.keys(m).filter(k => Archive.LEGENDS[k]).sort((a, b) => m[a] - m[b]); };

/* ---- stamps: each one is pressed (animated) once, then simply shown ---- */
export const stamped = id => !!read().stamps[id];
export function stamp(id, now = Date.now()) { const st = read(); if (st.stamps[id]) return false; st.stamps[id] = now; save(KEY, st); return true; }

export const _reset = () => write({ v: 1, visits: {}, countries: {}, marks: {}, stamps: {}, last: "" }, "reset");
