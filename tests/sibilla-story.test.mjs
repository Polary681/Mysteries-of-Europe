// Node tests for the Sibyl of the Apennines narrative (pure logic).  Run: node tests/sibilla-story.test.mjs
// Every ending is reached by playing the real dialogue graph (choices picked by their label), with the real rules.
import { Dialogue, validateGraph } from "../src/narrative/core.js";
import * as S from "../src/adventures/sibilla/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

/* ---------- data integrity ---------- */
{ const { errors, reachable } = validateGraph(S.NODES, S.ENTRIES); ok(errors.length === 0, "graph valid" + (errors.length ? ": " + errors.join("; ") : ""));
  const orphans = Object.keys(S.NODES).filter(id => !reachable.has(id)); ok(orphans.length === 0, "every node is reachable from an entry point" + (orphans.length ? ": " + orphans.join(",") : "")); }
ok(Object.values(S.NODES).every(n => S.WHO[n.who]), "every speaker is known");
ok(Object.values(S.CODEX).every(c => ["historical", "literary", "folklore", "invented"].includes(c.kind) && c.title && c.text.length > 60), "every codex entry is labelled historical / literary / folklore / invented");
ok(S.CODEX.n_lasale.kind === "historical" && /invented/i.test(S.CODEX.n_lasale.text), "La Sale is historical, and his lines are declared invented");
ok(S.CODEX.n_guerrin.kind === "literary" && /1410/.test(S.CODEX.n_guerrin.text) && /1473/.test(S.CODEX.n_guerrin.text), "Guerrin Meschino: Barberino, c. 1410, printed 1473");
ok(/18 May 1420/.test(S.CODEX.n_lasale.text) && /Paradis de la reine Sibylle/.test(S.CODEX.n_lasale.text), "La Sale's visit of 18 May 1420 and his book are cited");
ok(/330/.test(S.CODEX.n_days.text) && /differ/i.test(S.CODEX.n_days.text), "the 330-day rule is cited with its uncertainty");
ok(S.CODEX.n_lucia.kind === "invented" && S.CODEX.n_thread.kind === "invented", "Lucia and the thread are declared invented");
ok(S.ENDING_ORDER.length === 4 && S.ENDING_ORDER.every(id => S.ENDINGS[id] && S.ENDINGS[id].id === id), "four endings");
ok(S.QUEEN_ENDINGS.join() === "return,knowledge,kingdom", "three endings are reached in the queen's hall");

/* ---------- a tiny player: walks the graph choosing options by label ---------- */
function play(s, id, picks = []) {
  const D = new Dialogue(S.NODES, s); let v = D.start(id), q = [...picks], guard = 0, path = [id];
  while (v && guard++ < 200) {
    if (v.choices.length) {
      let k = q.length ? v.choices.findIndex(c => c.label.includes(q[0])) : -1;
      if (q.length && k < 0) throw new Error(`choice "${q[0]}" not offered at ${v.id}: ${v.choices.map(c => c.label).join(" | ")}`);
      if (k >= 0) q.shift(); else k = v.choices.length - 1;   // default: the last option (usually "leave")
      v = D.choose(k);
    } else v = D.advance();
    if (v) path.push(v.id);
  }
  return { s, path, events: D.drainEvents() };
}
const labels = (s, id) => new Dialogue(S.NODES, s).start(id).choices.map(c => c.label);

/* ---------- Act I ---------- */
{ const s = S.initState();
  play(s, "start");
  ok(s.clues.errand && s.notes.n_village, "the opening sets the errand and the codex");
  ok(S.objectAvailable("gate", s) && S.objectNode("gate", s) === "gate_wait", "the north gate refuses an ignorant traveller");
  ok(/0 \/ 3/.test(S.objective(s)), "objective: ask the villagers (0 / 3)");
  ok(!labels(s, "lasale_1").some(l => /inside/.test(l)), "La Sale's notebook needs a real conversation first");
  play(s, "lasale_1", ["What have they told you", "Have you been up there", "I am going up tonight", "Take the notebook"]);
  ok(s.items.notebook && s.clues.days && s.notes.n_knight, "La Sale tells the German knight's tale and gives his notebook");
  play(s, "shepherd_1", ["Why not", "anything strange", "Where do they dance", "Did you ever find anything"]);
  ok(s.clues.dawn && s.clues.feet && s.clues.meadow && s.clues.basket, "Nicola: dawn, the hooves, the meadow, the basket");
  play(s, "vittoria_1", ["How do I keep", "Did you ever go up", "Show her your half"]);
  ok(s.items.thread && s.clues.lucia && s.clues.medal_match, "Vittoria: the thread, Lucia, the medallion");
  ok(S.talksHeard(s) === 3 && S.objectNode("gate", s) === "gate_go", "three conversations open the gate");
  const r = play(s, "gate_go", ["Climb"]); ok(s.act === 2 && s.area === "mountain" && r.events.some(e => e.id === "act2"), "climbing starts Act II");
  ok(!S.objectAvailable("gate", s) && S.objectAvailable("stazzo", s) && S.objectAvailable("mouth", s), "the mountain's places become available");
}

/* ---------- Ending 1: the dance ---------- */
{ const s = Object.assign(S.initState(), { act: 2, area: "mountain" });
  play(s, "fairy_1", ["Dance.", "Dance until dawn"]);
  ok(s.ending === "dance" && S.defaultEnding(s) === "dance", "dancing until dawn ends the story on the meadow");
  ok(S.ENDINGS.dance.paragraphs(s).length === 3, "…with its own epilogue"); }

/* ---------- the fairies: tests of courtesy and knowledge ---------- */
{ const s = Object.assign(S.initState(), { act: 2, area: "mountain" });
  ok(!labels(s, "fairy_1").some(l => /feet/.test(l)), "without Nicola's tale you do not know to watch their feet");
  play(s, "fairy_1", ["Dance.", "ask the way"]);
  const s2 = Object.assign(S.initState(), { act: 2, area: "mountain" }); const opts = (() => { const D = new Dialogue(S.NODES, s2); D.start("fairy_1"); D.choose(0); return D.choose(0).choices.map(c => c.label); })();
  ok(opts.length === 1 && /Please/.test(opts[0]), "knowing nothing, you can only beg the dancers");
  const s3 = Object.assign(S.initState(), { act: 2, area: "mountain" }); play(s3, "fairy_1", ["Dance.", "ask the way", "Please", "Drink"]);
  ok(s3.susp === 3 && s3.guide === "fairy" && s3.clues.cup, "drinking from the cup: enchantment +3, a guide");
  const s4 = Object.assign(S.initState(), { act: 2, area: "mountain", clues: { dawn: true } }); play(s4, "fairy_1", ["Dance.", "ask the way", "home before dawn"]);
  ok(s4.susp === 0 && s4.guide === "fairy", "knowing the dawn rule earns a guide without enchantment"); }

/* ---------- the kingdom: days ---------- */
{ const s = Object.assign(S.initState(), { act: 3, area: "kingdom", stage: "door", day: 1 });
  ok(S.talkNode("porter", s) === "porter_1", "the porter guards the crystal door");
  play(s, "porter_1", ["traveller"]); ok(s.stage === "kingdom" && s.day === 7, "entering costs a few days (" + s.day + ")");
  ok(S.readyForQueen(s) === false, "the queen does not send for you at once");
  play(s, "knight_1", ["What should I beware", "Leave"]); ok(s.flags.k_knight && s.day > 25, "the knight's warnings (" + s.day + " days)");
  play(s, "window"); ok(s.flags.k_time && S.kingdomFound(s) === 2 && S.readyForQueen(s), "two discoveries and the queen sends for you");
  const s2 = Object.assign(S.initState(), { act: 3, area: "kingdom", stage: "kingdom", day: 10, susp: 6 });
  play(s2, "feast", ["Eat"]); ok(s2.day - 10 === Math.round(55 * (1 + 8 * 0.15)), "enchantment makes the days run faster (" + (s2.day - 10) + ")");
  ok(/Day \?/.test(S.dayText(s2)) && /Day \d+ of 330/.test(S.dayText({ ...s2, items: { thread: true } })), "only the thread counts the days");
  ok(/snow|thaw|spring|hawthorn|harvest|heat|grape|chestnut|rain/.test(S.seasonAt(200)), "the window shows the season above"); }

const queen = (o = {}) => Object.assign(S.initState(), { act: 4, area: "kingdom", stage: "queen", day: 90, know: 8 }, o);

/* ---------- Ending 2: the return ---------- */
{ const s = queen(); play(s, "sibyl_1", ["To learn who my mother", "I don’t want it"]);
  ok(s.ending === "return", "refusing her offer: the return"); ok(S.ENDINGS.return.paragraphs(s).length === 4, "…epilogue");
  const s2 = queen({ items: { medallion: true, thread: true }, clues: { medal_match: true, medal_seen: true } });
  play(s2, "sibyl_1", ["To learn who my mother", "already know", "Let her come home", "Walk out with her"]);
  ok(s2.ending === "return" && /medallion/.test(S.ENDINGS.return.paragraphs(s2)[0]), "knowing Lucia yourself: she walks you to the door (different epilogue)"); }

/* ---------- Ending 3: knowledge, at a price ---------- */
{ const s = queen(); play(s, "sibyl_1", ["To learn who my mother", "What is the price", "Take my name"]);
  ok(s.ending === "knowledge" && s.flags.paid === "name", "the answer, paid with your name");
  const s2 = queen({ items: { medallion: true, notebook: true } }); play(s2, "sibyl_1", ["Frenchman", "What is the price", "Take the notebook"]);
  ok(s2.ending === "knowledge" && s2.flags.paid === "notebook" && !s2.items.notebook && /La Sale/.test(S.ENDINGS.knowledge.paragraphs(s2)[2]), "…or with La Sale's notebook (another epilogue)"); }

/* ---------- Ending 4: the kingdom (by choice, or past the 330th day) ---------- */
{ const s = queen(); play(s, "sibyl_1", ["To learn who my mother", "Let me stay"]); ok(s.ending === "kingdom", "staying by choice");
  const s2 = queen({ day: 400 }); const l = labels(s2, "sibyl_offer");
  ok(l.length === 1 && /let me stay/.test(l[0]), "past day 330 there is no price and no way home: " + l.join(" | "));
  play(s2, "sibyl_1", ["To learn who my mother", "Then tell me"]); ok(s2.ending === "kingdom" && /400 days/.test(S.ENDINGS.kingdom.paragraphs(s2)[0]), "…the kingdom keeps you, and says how long you stayed");
  const s3 = queen({ susp: 9 }); const l3 = labels(s3, "sibyl_offer");
  ok(l3.some(x => /no longer remember/.test(x)) && !l3.some(x => x === "I don’t want it. I want to go home."), "too enchanted, without thread or blessing, you cannot remember the way home");
  ok(S.canReturn({ ...s3, items: { thread: true } }) && S.canReturn({ ...s3, flags: { blessed: true } }), "…Vittoria's thread or Don Matteo's blessing keeps the way home open"); }

/* ---------- objectives exist for every stage ---------- */
{ const st = [{ act: 1 }, { act: 2, flags: {} }, { act: 2, flags: { met_fairies: true } }, { act: 3, stage: "bridge" }, { act: 3, stage: "doors" }, { act: 3, stage: "door" }, { act: 3, stage: "kingdom" }, { act: 3, stage: "kingdom", flags: { summoned: true } }, { act: 4 }];
  ok(st.every(o => S.objective(Object.assign(S.initState(), o)).length > 10), "an objective for every stage of the story"); }
/* ---------- every ending renders ---------- */
for (const id of S.ENDING_ORDER) { const p = S.ENDINGS[id].paragraphs(queen({ ending: id })); ok(p.every(x => typeof x === "string" && x.length > 30) && S.ENDINGS[id].notes.length, `ending "${id}" text renders, with its source note`); }

console.log(fails ? `\n${fails} FAILED` : "\nALL SIBILLA STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
