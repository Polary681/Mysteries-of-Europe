// Unit tests for the Archivist's journal (src/shared/journal.js).   node tests/journal.test.mjs
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const events = []; globalThis.addEventListener = (t, f) => events.push([t, f]); globalThis.dispatchEvent = e => { for (const [t, f] of events) if (t === e.type) f(e); };
globalThis.CustomEvent = class { constructor(type, o = {}) { this.type = type; this.detail = o.detail; } };
const J = await import("../src/shared/journal.js"), A = await import("../src/shared/archive.js"), { clear } = await import("../src/shared/save.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

ok(J.ENTRIES.length === 9 && new Set(J.ENTRIES.map(e => e.id)).size === 9, "9 distinct journal entries");
ok(J.ENTRIES.every(e => e.title && e.text && e.hint && ["folklore", "invented"].includes(e.kind)), "every entry has a title, a text, a hint and a basis label");
J._reset(); ok(J.progress().seen === 0, "the journal starts empty");
ok(J.record("ridge", 1000) === true && J.seen("ridge").first === 1000 && J.seen("ridge").n === 1, "a first sighting is written down with its date");
ok(J.record("ridge", 2000) === false && J.seen("ridge").first === 1000 && J.seen("ridge").n === 2 && J.seen("ridge").last === 2000, "a second sighting only counts (the first date is kept)");
ok(J.record("nonsense") === false && J.progress().seen === 1, "unknown sightings are ignored");
// the valley's events reach the journal through the window event, and announce a first sighting
let announced = null; addEventListener("moe:journal", e => { announced = e.detail.id; });
dispatchEvent(new CustomEvent("moe:valley", { detail: { type: "sighting", id: "night:samhain" } }));
ok(J.seen("night:samhain").n === 1 && announced === "night:samhain", "a 'moe:valley' sighting is recorded and announced as 'moe:journal'");
dispatchEvent(new CustomEvent("moe:valley", { detail: { type: "crow", pan: 0 } })); ok(J.progress().seen === 2, "other valley events are not sightings");
ok(JSON.parse(store.get("moe.journal.v1")).seen.ridge.n === 2, "the journal is stored in moe.journal.v1");
// sightings are luck, not progress: the Archive is untouched
A.sync(); ok(A.progress().relicsUnlocked === 0 && !store.get("moe.archive.v1").includes("ridge"), "sightings never unlock cards or relics");
clear("moe.journal.v1"); store.set("moe.journal.v1", "{broken"); ok(J.progress().seen === 0 && J.record("eyes") === true, "a corrupted journal is rebuilt");
console.log(fails ? `\n${fails} FAILED` : "\nALL JOURNAL TESTS PASSED"); process.exit(fails ? 1 : 0);
