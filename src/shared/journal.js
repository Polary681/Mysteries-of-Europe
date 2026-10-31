// THE ARCHIVIST'S JOURNAL: a notebook that writes itself. Every rare thing the landing valley shows (src/world/presences.js,
// the wisps, the special nights) is announced as a "sighting" on the window event "moe:valley" (see hero3d.js onEvent);
// the first time each one is seen it is written down here, with the date and how often it has been seen since.
//
// The journal is separate from the Archive on purpose: sightings are luck, not progress, so they never count as cards or
// relics and never light the castle. Storage: moe.journal.v1 (localStorage through shared/save.js, works offline).
import { load, save } from "./save.js";

export const KEY = "moe.journal.v1";
/** kind: what the sighting stands on (same labels as the Archive): folklore = a real belief, invented = made for this valley */
export const ENTRIES = [
  { id: "wisp", title: "A will-o’-the-wisp", kind: "folklore", hint: "A cold light between the spruces.",
    text: "A pale light drifted between the trees and went out when I came closer. Across Europe these lights were said to lead travellers astray." },
  { id: "eyes", title: "Eyes at the forest edge", kind: "invented", hint: "When a cloud covers the Moon, look at the trees.",
    text: "A cloud covered the Moon, and two small lights opened at the edge of the forest. They blinked. Then the Moon came back." },
  { id: "ridge", title: "The figure on the ridge", kind: "invented", hint: "Someone stands where the hill meets the sky.",
    text: "For a few seconds someone stood on the skyline, perfectly still. When I pointed the lantern at them, there was nobody." },
  { id: "ruin", title: "The ruin in the water", kind: "invented", hint: "The lake does not always tell the truth.",
    text: "In the lake the castle was a ruin: roofless towers, broken walls. Above the water it stood whole." },
  { id: "figure", title: "A figure at a reflected window", kind: "invented", hint: "Watch the castle’s windows in the lake.",
    text: "In the reflection, someone stood at one of the castle’s windows. The real window was empty." },
  { id: "redmoon", title: "The red Moon in the lake", kind: "invented", hint: "A Moon in the water that is not in the sky.",
    text: "The Moon in the lake was red, and it was not where the Moon in the sky was." },
  { id: "night:samhain", title: "Samhain night", kind: "folklore", hint: "A night at the end of October.",
    text: "Fires on the hills. In Gaelic folklore, on this night the border between the worlds grew thin." },
  { id: "night:solstice", title: "The longest night", kind: "folklore", hint: "The darkest night of the year.",
    text: "The winter solstice: frost, a halo round the Moon, and the longest dark of the year." },
  { id: "night:stjohn", title: "St John’s Eve", kind: "folklore", hint: "A short night in June.",
    text: "Bonfires for St John’s Eve, and more wandering lights than usual. Folklore says they show where treasure lies." },
];
export const ENTRY = Object.fromEntries(ENTRIES.map(e => [e.id, e]));

const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const read = () => { const s = load(KEY, null); return { v: 1, seen: obj(s && s.seen) }; };
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

/** Write a sighting down. Returns true the first time an entry is seen (unknown ids are ignored). */
export function record(id, now = Date.now()) {
  if (!ENTRY[id]) return false;
  const st = read(), e = obj(st.seen[id]), first = !e.first;
  st.seen[id] = { first: e.first || now, last: now, n: (+e.n || 0) + 1 };
  save(KEY, st);
  listeners.forEach(f => { try { f(id, first); } catch (err) { /* ignore */ } });
  try { if (first) dispatchEvent(new CustomEvent("moe:journal", { detail: { id, entry: ENTRY[id] } })); } catch (err) { /* optional */ }
  return first;
}
export const seen = id => obj(read().seen[id]);
export const progress = () => { const s = read().seen; return { seen: ENTRIES.filter(e => s[e.id]).length, total: ENTRIES.length }; };
export const _reset = () => { save(KEY, { v: 1, seen: {} }); listeners.forEach(f => { try { f(null, false); } catch (err) { /* ignore */ } }); };

// the journal listens to the valley by itself, so it fills in whether or not its page is open
try { addEventListener("moe:valley", e => { const d = e.detail || {}; if (d.type === "sighting" && d.id) record(d.id); }); } catch (err) { /* not in a browser */ }
