// Unit tests for the collectible-card logic (no browser needed).   node tests/archive.test.mjs
// localStorage is replaced by a tiny in-memory stub so we can also test "reload" and "old save" scenarios.
import vm from "node:vm"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const A = await import("../src/shared/archive.js");
const { clear } = await import("../src/shared/save.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };
// save.js also keeps an in-memory copy (fallback when localStorage is blocked), so a "wipe" must clear both
const wipe = () => { store.clear(); for (const k of ["moe.archive.v1", "moe.woolpit.endings.v1", "moe.skye.endings.v1", "moe.woolpit.save.v1", "moe.skye.save.v1", "moe.hoia.endings.v1", "moe.hoia.save.v1", "moe.babayaga.endings.v1", "moe.babayaga.save.v1", "moe.sibilla.endings.v1", "moe.sibilla.save.v1", "moe.sibilla.finds.v1", "moe.bathory.endings.v1", "moe.bathory.save.v1", "moe.bathory.finds.v1"]) clear(k); };
const ids = () => A.unlockedIds().sort();

// ---- data integrity
ok(A.CARDS.length === 38, "38 cards defined (6 case files, 28 relics, 3 seals, 1 secret)");
ok(new Set(A.CARDS.map(c => c.id)).size === A.CARDS.length, "card ids are unique");
ok(A.CARDS.every(c => c.name && c.blurb && c.basis && c.basis.text && c.symbol), "every card has name, blurb, basis and symbol");
ok(A.CARDS.filter(c => c.type === "relic").every(c => c.hint && c.cond.k !== "start"), "every relic has a hint and a real condition");
const WOOLPIT_ENDINGS = ["servant", "both", "bells", "font", "omen", "ink"], SKYE_ENDINGS = ["peace", "other", "stay", "leave"];
ok(WOOLPIT_ENDINGS.every(e => A.CARD["woolpit-" + e]) && SKYE_ENDINGS.every(e => A.CARD["skye-" + e]), "one relic per ending of both 3D adventures (6 + 4)");
const HOIA_ENDINGS = ["time", "lights", "shepherd", "leave"];
ok(HOIA_ENDINGS.every(e => A.cardForEnding("hoia", e)), "one relic per ending of the Hoia 3D adventure (4)");
ok(["lantern", "flight", "stay", "leave"].every(e => A.cardForEnding("babayaga", e)) && A.LEGENDS.babayaga.endings === 4, "Baba Yaga: one relic per ending (4)");
ok(["dance", "return", "knowledge", "kingdom"].every(e => A.cardForEnding("sibilla", e)) && A.LEGEND_ORDER.length === 6 && A.LEGENDS.sibilla.endings === 4 && A.CARDS.filter(c => c.legend === "sibilla").length === 7, "the Sibyl: a fifth legend (of six), a case file, a relic per ending (4), the notebook and her seal");
ok(A.CARD["hoia-time"].cond.alt.node === "d" && A.CARD["hoia-watching"].cond.alt.node === "e", "the two original Hoia relics still accept the two terminal nodes of the text story");
ok(A.cardForText("hoia", "d").id === "hoia-time" && A.cardForText("hoia", "e").id === "hoia-watching" && !A.cardForText("hoia", "c"), "cardForText maps the text endings to the same relics");

// ---- legends in data.js stay in sync with the archive
const sandbox = {}; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8") + "\nthis.LEGENDS=LEGENDS;", sandbox);
for (const k of Object.keys(A.LEGENDS)) ok(sandbox.LEGENDS[k] && sandbox.LEGENDS[k].title === A.LEGENDS[k].title, `legend "${k}" title matches js/data.js`);
// terminal nodes of the Hoia story really are "d" and "e"
const hoia = sandbox.LEGENDS.hoia.nodes; ok(Object.entries(hoia).filter(([, n]) => !n.c.length).map(([k]) => k).sort().join() === "d,e", "Hoia terminal nodes are exactly d and e");

// ---- fresh visitor
wipe(); let n = A.sync();
ok(n.length === 6 && ids().join() === "legend-babayaga,legend-bathory,legend-hoia,legend-sibilla,legend-skye,legend-woolpit", "a new visitor owns only the 6 case files");
ok(A.sync().length === 0, "sync is idempotent");
ok(A.progress().relicsUnlocked === 0, "no relic is unlocked without playing");
ok(A.legendStatus("woolpit").state === "available" && A.legendStatus("hoia").state === "available" && A.legendStatus("hoia").total === 4, "legends start as 'available' (Hoia now has 4 endings)");

// ---- an adventure ending unlocks exactly its relic
store.set("moe.woolpit.endings.v1", JSON.stringify({ bells: true }));
n = A.recordEnding("woolpit", "bells");
ok(n.length === 1 && n[0].id === "woolpit-bells", "finishing 'bells' unlocks exactly woolpit-bells");
ok(A.isUnlocked("woolpit-bells") && !A.isUnlocked("woolpit-servant") && !A.isUnlocked("skye-peace"), "other relics stay sealed");
ok(A.recordEnding("woolpit", "bells").length === 0 && ids().filter(i => i === "woolpit-bells").length === 1, "finishing the same ending again does not duplicate the card");
ok(A.legendStatus("woolpit").state === "completed" && A.legendStatus("woolpit").found === 1, "legend status becomes 'completed' (1/6)");

// ---- a card is NOT unlocked if the real record says otherwise
wipe(); A.sync(); n = A.recordEnding("skye", "peace");
ok(n.length === 0 && !A.isUnlocked("skye-peace"), "recordEnding without a real saved ending unlocks nothing (no fake rewards)");

// ---- reload persistence
wipe(); store.set("moe.skye.endings.v1", JSON.stringify({ stay: true })); A.recordEnding("skye", "stay");
const snapshot = store.get("moe.archive.v1"); const again = JSON.parse(snapshot);
ok(!!again.cards["skye-stay"] && again.v === 1, "the unlock is written to localStorage (moe.archive.v1)");
ok(A.isUnlocked("skye-stay"), "the unlock survives a reload (state is re-read from storage)");

// ---- backwards compatibility: a save made BEFORE the archive existed
wipe(); store.set("moe.woolpit.endings.v1", JSON.stringify({ servant: true, ink: true })); store.set("moe.skye.endings.v1", JSON.stringify({ leave: true }));
n = A.sync("legacy");
ok(["woolpit-servant", "woolpit-ink", "skye-leave"].every(i => A.isUnlocked(i)), "old endings unlock their relics on first load");
ok(A.isNew("woolpit-servant") && !A.isRevealed("woolpit-servant"), "retroactive relics are flagged 'new' (no fake animation)");
A.markRevealed("woolpit-servant"); ok(!A.isNew("woolpit-servant"), "markRevealed clears the 'new' flag");
ok(JSON.parse(store.get("moe.woolpit.endings.v1")).servant === true, "the archive never rewrites the adventure saves");

// ---- Hoia text story
wipe(); A.sync(); n = A.recordTextEnding("hoia", "d");
ok(n.length === 1 && n[0].id === "hoia-time", "reaching the 'time bends' ending unlocks The Watch That Lost Its Hour");
ok(A.recordTextEnding("hoia", "d").length === 0, "repeating a text ending does not duplicate");
ok(A.recordTextEnding("hoia", "zzz").length === 0, "an unknown node unlocks nothing");
ok(A.recordTextEnding("nope", "d").length === 0, "an unknown legend is ignored");
n = A.recordTextEnding("hoia", "e"); ok(n.length === 1 && n[0].id === "hoia-watching" && A.legendStatus("hoia").state === "completed" && A.legendStatus("hoia").found === 2, "second Hoia text ending unlocks the other relic (2 / 4 endings)");
// ---- Hoia 3D adventure: same relics for the same endings, two new ones, the union counts once
store.set("moe.hoia.endings.v1", JSON.stringify({ leave: true, lights: true })); n = A.recordEnding("hoia", "lights");
ok(n.length === 1 && n[0].id === "hoia-negative", "the 'lights' ending unlocks The 1968 Negative");
ok(A.recordEnding("hoia", "leave").length === 0 && A.legendStatus("hoia").found === 3, "the adventure's 'leave' and the text story's 'e' count as one ending (3 / 4)");
store.set("moe.hoia.endings.v1", JSON.stringify({ leave: true, lights: true, shepherd: true })); n = A.recordEnding("hoia", "shepherd");
ok(n.length === 1 && n[0].id === "hoia-tally" && A.legendStatus("hoia").state === "mastered", "the 'shepherd' ending unlocks the tally stick and masters the legend");
wipe(); A.sync(); store.set("moe.hoia.endings.v1", JSON.stringify({ time: true })); n = A.recordEnding("hoia", "time");
ok(n.length === 1 && n[0].id === "hoia-time" && A.legendStatus("hoia").found === 1, "the adventure's 'time' ending unlocks the same relic as the text story's 'd'");
store.set("moe.hoia.save.v1", JSON.stringify({ v: 1, s: { ending: null } })); ok(A.legendStatus("hoia").hasSave, "a Hoia save in progress is detected");

// ---- the seal needs one relic from each legend
wipe(); A.sync(); store.set("moe.woolpit.endings.v1", JSON.stringify({ ink: true })); A.recordEnding("woolpit", "ink");
store.set("moe.skye.endings.v1", JSON.stringify({ peace: true })); A.recordEnding("skye", "peace");
ok(!A.isUnlocked("seal-archivist"), "seal stays sealed with relics from only two legends");
n = A.recordTextEnding("hoia", "e"); ok(!A.isUnlocked("seal-archivist"), "…or from three of the four");
store.set("moe.babayaga.endings.v1", JSON.stringify({ leave: true })); n = A.recordEnding("babayaga", "leave");
ok(n.some(c => c.id === "babayaga-leave") && n.some(c => c.id === "seal-archivist") && A.isUnlocked("seal-archivist"), "seal unlocks with a relic from every legend (Baba Yaga included)");
ok(A.progress().relicsUnlocked === 5 && A.progress().unlocked === 5 + 6, "progress counter is correct (5 relics incl. seal, 11 cards)");
ok(A.legendStatus("babayaga").found === 1 && A.legendStatus("babayaga").total === 4, "Baba Yaga's legend status counts its endings (1 / 4)");
store.set("moe.babayaga.save.v1", JSON.stringify({ v: 1, s: { ending: null } })); store.set("moe.babayaga.endings.v1", JSON.stringify({})); ok(A.legendStatus("babayaga").hasSave, "a Baba Yaga save in progress is detected");

// ---- the Sibyl of the Apennines (v8): a find recorded during play, endings, her own seal; the Archivist's Seal rule is unchanged
wipe(); A.sync();
ok(A.recordEnding("sibilla", "dance").length === 0, "no Sibilla relic without a real saved ending");
store.set("moe.sibilla.finds.v1", JSON.stringify({ notebook: Date.now() })); n = A.sync("find:sibilla:notebook");
ok(n.length === 1 && n[0].id === "sibilla-notebook" && /notebook/.test(A.whyText(n[0])), "La Sale's notebook unlocks the moment the adventure records it (with its reason)");
store.set("moe.sibilla.endings.v1", JSON.stringify({ dance: true })); n = A.recordEnding("sibilla", "dance");
ok(n.length === 1 && n[0].id === "sibilla-dance" && !A.isUnlocked("sibilla-seal"), "the meadow ending gives the Fairy's Ribbon, not the Sibyl's Seal (you never met her)");
store.set("moe.sibilla.endings.v1", JSON.stringify({ dance: true, knowledge: true })); n = A.recordEnding("sibilla", "knowledge");
ok(n.some(c => c.id === "sibilla-knowledge") && n.some(c => c.id === "sibilla-seal") && n.length === 2, "an ending before the queen gives its relic and the Sibyl's Seal");
ok(A.cardForEnding("sibilla", "knowledge").id === "sibilla-knowledge" && A.legendStatus("sibilla").found === 2 && A.legendStatus("sibilla").total === 4, "legend status counts the Sibyl's endings (2 / 4)");
ok(A.recordEnding("sibilla", "knowledge").length === 0, "…and repeating it unlocks nothing");
ok(!A.isUnlocked("seal-archivist"), "the Sibyl's relics alone do not award the Archivist's Seal (its v7 rule is unchanged)");
store.set("moe.sibilla.save.v1", JSON.stringify({ v: 1, s: { ending: null } })); ok(A.legendStatus("sibilla").hasSave, "a Sibilla save in progress is detected");

// ---- Elizabeth Báthory (v9): the letter found during play, four report endings, the family seal for an earned conclusion
ok(["monster", "conspiracy", "unanswered", "palatine"].every(e => A.cardForEnding("bathory", e)) && A.LEGENDS.bathory.endings === 4 && A.CARDS.filter(c => c.legend === "bathory").length === 7, "Báthory: a case file, a relic per ending (4), the letter and the family seal");
ok(A.CARD["legend-bathory"].basis.kind === "historical" && /never tried/.test(A.CARD["legend-bathory"].basis.text) && /legend/.test(A.CARD["legend-bathory"].basis.text), "the case file is historical and says what is legend");
ok(/Slovakia/.test(A.LEGENDS.bathory.place) && /Kingdom of Hungary/.test(A.LEGENDS.bathory.place), "the place names modern Slovakia and the Kingdom of Hungary");
ok(A.recordEnding("bathory", "monster").length === 0, "no Báthory relic without a real saved ending");
store.set("moe.bathory.finds.v1", JSON.stringify({ letter: Date.now() })); n = A.sync("find:bathory:letter");
ok(n.length === 1 && n[0].id === "bathory-letter" && /letter/.test(A.whyText(n[0])), "her letter unlocks the moment the adventure records it (with its reason)");
store.set("moe.bathory.endings.v1", JSON.stringify({ palatine: true })); n = A.recordEnding("bathory", "palatine");
ok(n.length === 1 && n[0].id === "bathory-palatine" && !A.isUnlocked("bathory-seal"), "signing the Palatine's version gives the Sealed Report, not the family seal");
store.set("moe.bathory.endings.v1", JSON.stringify({ palatine: true, unanswered: true })); n = A.recordEnding("bathory", "unanswered");
ok(n.some(c => c.id === "bathory-unanswered") && n.some(c => c.id === "bathory-seal") && n.length === 2, "a report of your own gives its relic and the Báthory family seal");
ok(A.legendStatus("bathory").found === 2 && A.legendStatus("bathory").total === 4 && A.recordEnding("bathory", "unanswered").length === 0, "legend status counts her endings (2 / 4); repeating unlocks nothing");
store.set("moe.bathory.save.v1", JSON.stringify({ v: 1, s: { ending: null } })); ok(A.legendStatus("bathory").hasSave, "a Báthory save in progress is detected");
ok(!A.isUnlocked("seal-archivist"), "…and the Archivist's Seal rule is still unchanged");

// ---- robustness
wipe(); store.set("moe.archive.v1", "{not json"); ok(A.sync().length === 6, "a corrupted archive record is ignored and rebuilt from the real saves");
wipe(); store.set("moe.woolpit.endings.v1", JSON.stringify([1, 2])); ok(A.sync().length === 6, "a malformed endings record does not unlock anything");
wipe(); store.set("moe.archive.v1", JSON.stringify({ cards: { "legend-woolpit": { at: 1 } } })); ok(A.sync().length === 5, "partial records are completed, existing unlocks kept");

// ---- the secret card of the valley (v5): earned by catching a will-o'-the-wisp on the landing page
wipe(); A.sync();
ok(!A.isUnlocked("secret-wisp"), "the secret card starts sealed");
ok(A.RELICS.every(r => r.type !== "secret") && A.progress().relics === 31, "the secret card is not a relic (31 relics and seals, Seal rule unchanged)");
let got = A.recordSecret("wisp"); ok(got.length === 1 && got[0].id === "secret-wisp", "catching a wisp unlocks the secret card");
ok(A.recordSecret("wisp").length === 0, "catching another wisp never unlocks it twice");
ok(A.recordSecret("nonsense").length === 0, "unknown secrets are ignored");
ok(JSON.parse(store.get("moe.archive.v1")).secrets.wisp > 0, "the secret is persisted in moe.archive.v1");
ok(!A.isUnlocked("seal-archivist") && !A.progress().complete, "the secret alone does not award the Seal or complete the Archive");
// the castle windows follow the Archive (src/world/castle-progress.js reads only the real progress)
const CP = await import("../src/world/castle-progress.js");
wipe(); A.sync(); ok(CP.litRoles().size === 0, "a new visitor's castle has no Archive window lit");
store.set("moe.woolpit.endings.v1", JSON.stringify({ bells: 1 })); A.sync();
const lit = CP.litRoles(); ok(lit.has("woolpit-bells") && lit.has("legend:woolpit") && lit.size === 2, "a relic lights its window, a completed legend lights another");
ok(CP.ROLES.length === 38 && new Set(CP.ROLES).size === 38 && A.CARDS.filter(c => c.type !== "legend").every(c => CP.ROLES.includes(c.id)) && A.LEGEND_ORDER.every(k => CP.ROLES.includes("legend:" + k)), "38 distinct castle windows (28 relics, 3 seals, 6 legends, the secret), one for every card");
store.set("moe.woolpit.endings.v1", JSON.stringify({ servant: 1, both: 1, bells: 1, font: 1, omen: 1, ink: 1 })); store.set("moe.skye.endings.v1", JSON.stringify({ peace: 1, other: 1, stay: 1, leave: 1 }));
A.recordTextEnding("hoia", "d"); A.recordTextEnding("hoia", "e"); A.sync();
ok(!A.progress().complete, "the two text endings alone no longer complete the Archive (the new Hoia relics need the 3D adventure)");
store.set("moe.hoia.endings.v1", JSON.stringify({ lights: 1, shepherd: 1 })); A.sync();
ok(!A.progress().complete, "…nor do three legends out of four");
store.set("moe.babayaga.endings.v1", JSON.stringify({ lantern: 1, flight: 1, stay: 1, leave: 1 })); A.sync();
ok(!A.progress().complete && A.isUnlocked("seal-archivist"), "…four legends out of six earn the Archivist's Seal but do not complete the Archive");
store.set("moe.sibilla.endings.v1", JSON.stringify({ dance: 1, return: 1, knowledge: 1, kingdom: 1 })); A.sync();
ok(!A.progress().complete && !A.isUnlocked("sibilla-notebook"), "…the Sibyl's notebook must still be found");
store.set("moe.sibilla.finds.v1", JSON.stringify({ notebook: 1 })); A.sync();
ok(!A.progress().complete, "…five legends out of six still leave the Archive incomplete");
store.set("moe.bathory.endings.v1", JSON.stringify({ monster: 1, conspiracy: 1, unanswered: 1, palatine: 1 })); A.sync();
ok(!A.progress().complete && A.isUnlocked("bathory-seal") && !A.isUnlocked("bathory-letter"), "…every Báthory ending, but her letter must still be found");
store.set("moe.bathory.finds.v1", JSON.stringify({ letter: 1 })); A.sync();
ok(A.progress().complete && CP.litRoles().size === 37, "all relics: the Archive is complete and every relic window is lit (the secret one waits for its wisp)");

console.log(fails ? `\n${fails} FAILED` : "\nALL ARCHIVE TESTS PASSED"); process.exit(fails ? 1 : 0);
