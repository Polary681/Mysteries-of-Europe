// Node tests for Elizabeth Báthory — The Blood Countess (pure logic).  Run: node tests/bathory-story.test.mjs
// Every ending is reached by playing the real dialogue graph (choices picked by their label) under the real world rules
// (which people and objects are available where), and the evidence board is exercised through the real connect().
import { Dialogue, validateGraph } from "../src/narrative/core.js";
import * as S from "../src/adventures/bathory/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

/* ---------- data integrity ---------- */
{ const { errors, reachable } = validateGraph(S.NODES, S.ENTRIES); ok(errors.length === 0, "graph valid" + (errors.length ? ": " + errors.join("; ") : ""));
  const orphans = Object.keys(S.NODES).filter(id => !reachable.has(id)); ok(orphans.length === 0, "every node is reachable from an entry point" + (orphans.length ? ": " + orphans.join(",") : "")); }
ok(Object.values(S.NODES).every(n => S.WHO[n.who]), "every speaker is known");
ok(Object.values(S.CODEX).every(c => ["historical", "disputed", "legend", "invented"].includes(c.kind) && c.title && c.text.length > 60), "every codex entry is labelled historical / disputed / legend / invented");
ok(S.EVIDENCE_ORDER.length === 19 && S.EVIDENCE_ORDER.every(id => { const e = S.EVIDENCE[id]; return e.title && e.kind && e.rel && S.BASIS_TAG[e.basis] && e.where && e.date && e.text.length > 40 && Array.isArray(e.tags); }), "19 pieces of evidence, each with kind, reliability, basis, place, date and text");
ok(S.LINKS.length === 14 && S.LINKS.every(l => S.EVIDENCE[l.a] && S.EVIDENCE[l.b] && S.LINK_TYPE[l.type] && ["acc", "pol", "doubt", "ctx"].includes(l.tag) && l.text.length > 40), "14 connections between real evidence, each typed and explained");
ok(new Set(S.LINKS.map(l => [l.a, l.b].sort().join("+"))).size === S.LINKS.length, "no pair of evidence is connected twice");
ok(S.LINKS.filter(l => l.type === "contradicts").length >= 4, "at least four contradictions can be found");
// the board never presents legend as fact
ok(S.CODEX.n_blood.kind === "legend" && /1729/.test(S.CODEX.n_blood.text), "the blood baths are labelled legend (first printed 1729)");
ok(S.CODEX.n_650.kind === "disputed" && /650/.test(S.CODEX.n_650.text), "the 650 victims are labelled disputed");
ok(S.EVIDENCE.ev_rumour.basis === "legend" && S.EVIDENCE.ev_650.basis === "disputed", "the blood-bath rumour and the 650 are not presented as records");
ok(S.CODEX.n_conspiracy.kind === "disputed" && /Nagy/.test(S.CODEX.n_conspiracy.text), "the conspiracy theory is labelled disputed and attributed");
ok(/7 August 1560/.test(S.CODEX.n_eb.text) && /Nyírbátor/.test(S.CODEX.n_eb.text), "birth: 7 August 1560, Nyírbátor");
ok(/never/.test(S.CODEX.n_arrest.text) && /December 1610/.test(S.CODEX.n_arrest.text), "arrested at the end of December 1610, never tried");
ok(/January 1611/.test(S.CODEX.n_trial.text) && /torture/.test(S.CODEX.n_trial.text), "the servants' trial of January 1611, confessions under torture");
ok(/1614/.test(S.CODEX.n_confinement.text), "the July 1614 visitation against the 'walled room'");
ok(S.CODEX.n_frame.kind === "invented" && S.CODEX.n_house.kind === "invented", "the clerk's frame and the castle rooms are declared invented");
ok(/Slovakia/.test(S.CODEX.n_cachtice.text) && /Kingdom of Hungary/.test(S.CODEX.n_cachtice.text), "Čachtice: then the Kingdom of Hungary, today Slovakia");
ok(!/vampir|fang|undead/i.test(JSON.stringify(Object.values(S.NODES).map(n => typeof n.text === "string" ? n.text : ""))), "no vampire features in the dialogue");
ok(S.ENDING_ORDER.length === 4 && S.ENDING_ORDER.every(id => S.ENDINGS[id] && S.ENDINGS[id].id === id && S.ENDINGS[id].notes.some(n => /What the sources can establish/.test(n))), "four endings, each separating conclusion from what the sources establish");
ok(S.REPORT_ENDINGS.join() === "monster,conspiracy,unanswered", "three endings are earned conclusions in the report");

/* ---------- a tiny player: walks the graph choosing options by label ---------- */
function play(s, id, picks = []) {
  const D = new Dialogue(S.NODES, s); let v = D.start(id), q = [...picks], guard = 0; const events = [];
  while (v && guard++ < 200) {
    if (v.choices.length) {
      let k = q.length ? v.choices.findIndex(c => c.label.includes(q[0])) : -1;
      if (q.length && k < 0) throw new Error(`choice "${q[0]}" not offered at ${v.id}: ${v.choices.map(c => c.label).join(" | ")}`);
      if (k >= 0) q.shift(); else k = v.choices.length - 1;
      v = D.choose(k);
    } else v = D.advance();
    events.push(...D.drainEvents());
  }
  events.push(...D.drainEvents());
  if (q.length) throw new Error(`unused picks at ${id}: ${q.join(" | ")}`);
  return events;
}
const talk = (s, who, picks) => { const n = S.talkNode(who, s); if (!n) throw new Error(`${who} cannot be talked to (act ${s.act}, ${s.area})`); return play(s, n, picks); };
const use = (s, obj, picks) => { if (!S.objectAvailable(obj, s)) throw new Error(`${obj} not available (act ${s.act}, ${s.area})`); return play(s, S.objectNode(obj, s), picks); };
const link = (s, a, b) => { const r = S.connect(s, a, b); if (!r) throw new Error(`no link ${a}+${b}`); return r; };

/** act I to the first meeting: the village, the climb, the castle records */
function toCastle(s, opts = {}) {
  play(s, "start");
  talk(s, "secretary", ["Leave"]);
  talk(s, "marta", ["What do people say", "Did you know anyone", ...(opts.promise ? ["I will ask about Anka"] : []), "Leave"]);
  talk(s, "gergely", ["What was she like", "And the accusations", "Leave"]);
  talk(s, "sexton", ["Show me the burials", "Leave"]);
  talk(s, "zuzana", ["I am not here to accuse"]);
  ok(S.canClimb(s) && S.objectNode("road", s) === "road_go", "the road opens after the secretary and two villagers");
  const ev = use(s, "road", ["Climb to the castle"]);
  ok(s.act === 2 && s.area === "castle" && ev.some(e => e.t === "event" && e.id === "act2"), "climbing starts Act II with the courtyard cinematic");
  talk(s, "castellan", ["May I have the key", "Leave"]);
  ok(!!s.items.storekey, "the King's letter earns the storeroom key");
  s.area = "inside";
  use(s, "hall_chest"); use(s, "library_lectern"); use(s, "library_shelf");
  ok(!S.chambersOpen(s) || S.evidenceCount(s) >= 4, "chambers stay shut below four pieces of evidence");
}
function meet(s, picks, leave = true) {
  ok(S.chambersOpen(s) && S.talkNode("elizabeth", s) === "eliza_1", "with four pieces of evidence the countess receives you");
  play(s, "eliza_1", picks);
  ok(s.act === 3 && s.clues.ev_freely, "the first meeting opens Act III and adds what you saw yourself");
  ok(!!s.flags.eliza_leave === leave, leave ? "she gives you leave to open her chests" : "a cold answer without rapport: no leave to open her chests");
}

/* ---------- gating ---------- */
{ const s = S.initState(); play(s, "start"); ok(S.objectNode("road", s) === "road_wait", "the road waits before you have listened");
  const v = new Dialogue(S.NODES, s).start("road_wait"); ok(/0 \/ 2/.test(v.text), "…and says how many villagers are still to hear");
  ok(S.talkNode("zuzana", s) === "zuzana_1", "Zuzana is in the village");
  play(s, "zuzana_1", ["You worked at the castle"]); ok(!s.flags.zuzana_open, "Zuzana refuses a stranger");
  ok(!new Dialogue(S.NODES, s).start("zuzana_1").choices.some(c => /not here to accuse/.test(c.label)), "she only opens up after the burial register or the promise to Marta");
  ok(S.talkNode("elizabeth", s) === null && !S.objectAvailable("report", s), "no countess and no report in the village"); }
{ const s = S.initState(); toCastle(s); const v = new Dialogue(S.NODES, s).start("report");
  ok(v.choices.map(c => c.label).join("|") === "Sign the Palatine’s report as it was written for you.|Not yet.", "before the final night only the Palatine's version can be signed");
  ok(S.objective(s).length > 10 && S.labelFor("library_case", s) === "Look at the bookcase", "objective and prompts are defined");
  use(s, "library_desk"); ok(s.flags.draught && S.labelFor("library_case", s) === "Search the bookcase", "the draught behind the bookcase is noticed");
  const ev = use(s, "library_case"); ok(s.flags.passage_open && ev.some(e => e.t === "event" && e.id === "passage"), "the bookcase opens the walled passage");
  ok(S.objectAvailable("store_chest", s) && /locked chest/.test(new Dialogue(S.NODES, s).start("store_chest").text) && !s.clues.ev_family, "the family chest needs the countess's leave");
  ok(S.connect(s, "ev_testimonies", "ev_rumour") === null || s.clues.ev_rumour, "connect() refuses evidence you don't have");
  ok(S.connect(s, "ev_king", "ev_burials") === null, "unrelated evidence does not connect");
  const r = link(s, "ev_servants", "ev_testimonies"); ok(r.isNew && r.link.id === "l_hearsay" && s.links.l_hearsay, "related evidence connects, in either order");
  ok(!link(s, "ev_testimonies", "ev_servants").isNew, "a connection is only counted once");
  ok(!S.finalReady(s), "the final night needs Act III"); }

/* ---------- ending 1: the Monster ---------- */
{ const s = S.initState(); toCastle(s, { promise: true }); use(s, "library_desk");
  meet(s, ["I have come to hear", "Four of your servants", "A girl called Anka", "That is enough", "About you"], false);
  ok(S.objectAvailable("chamber_chest", s) && /not yours to open/.test(new Dialogue(S.NODES, s).start("chamber_chest").text), "…her chest stays closed to you");
  talk(s, "ilka", ["What do the other servants say", "Leave"]);
  for (const [a, b] of [["ev_testimonies", "ev_servants"], ["ev_marta", "ev_burials"], ["ev_zuzana", "ev_burials"], ["ev_marta", "ev_register"]]) link(s, a, b);
  ok(S.monsterReady(s), "five accusation records and two corroborations make the case for the accusations");
  ok(S.finalReady(s) && S.evidenceCount(s) >= 10, "ten pieces of evidence and three connections: the countess sends for you");
  play(s, "summons"); ok(s.act === 4, "the summons opens Act IV");
  ok(S.talkNode("elizabeth", s) === "eliza_final", "at night she waits in her apartments");
  play(s, "eliza_final", ["The register", "Did you do what they say", "I have heard enough"]);
  ok(s.flags.final_done && S.talkNode("elizabeth", s) === null, "the final conversation ends");
  play(s, "report", ["substantially proven"]); ok(s.ending === "monster" && S.defaultEnding(s) === "monster", "ENDING Monster");
  ok(S.ENDINGS.monster.paragraphs(s).join(" ").includes("Anka"), "the Monster report names what you connected");
  ok(S.objective(s) === "" && S.talkNode("marta", s) === null, "after the ending nothing else is offered"); }

/* ---------- ending 2: the Conspiracy ---------- */
{ const s = S.initState(); toCastle(s); use(s, "store_accounts");
  meet(s, ["The Crown owes", "That is enough", "About whoever wrote"]);
  ok(s.flags.eliza_respect, "answering her question well earns her respect");
  use(s, "store_chest"); use(s, "chamber_chest");
  ok(s.clues.ev_family && s.clues.ev_will && s.clues.ev_debt, "the debt, the family's letters and the will are found");
  for (const [a, b] of [["ev_king", "ev_debt"], ["ev_will", "ev_family"], ["ev_family", "ev_verdict"]]) link(s, a, b);
  ok(S.conspiracyReady(s) && !S.monsterReady(s), "three political records and two motives make the conspiracy case (and not the other)");
  use(s, "hall_fire"); use(s, "gallery_portrait"); use(s, "library_desk"); talk(s, "ilka", ["What do the other servants say", "Leave"]);
  ok(S.finalReady(s), "ready for the night");
  play(s, "summons"); play(s, "eliza_final", ["Your family made sure", "I have heard enough"]);
  const v = new Dialogue(S.NODES, s).start("report"), labels = v.choices.map(c => c.label);
  ok(labels.some(l => /Political/.test(l)) && !labels.some(l => /substantially/.test(l)), "the report offers only what the evidence supports");
  play(s, "report", ["Political and financial"]); ok(s.ending === "conspiracy", "ENDING Conspiracy");
  ok(/single line/.test(S.ENDINGS.conspiracy.paragraphs(s).join(" ")), "her respect changes the Conspiracy ending"); }

/* ---------- ending 3: the Unanswered History ---------- */
{ const s = S.initState(); toCastle(s); use(s, "library_desk"); use(s, "library_case"); use(s, "passage_niche");
  meet(s, ["In the village they say", "That is enough", "I don’t know yet"]);
  talk(s, "ilka", ["What do the other servants say", "Is she ever allowed", "Leave"]);
  const ev = use(s, "chamber_desk"); ok(s.clues.ev_letter && ev.some(e => e.t === "event" && e.id === "letter"), "her letter is found (the Archive's find)");
  const k0 = s.know;
  for (const [a, b] of [["ev_rumour", "ev_testimonies"], ["ev_650", "ev_register"], ["ev_walled", "ev_freely"], ["ev_comb", "ev_servants"], ["ev_650", "ev_ilka"], ["ev_letter", "ev_gergely"]]) link(s, a, b);
  ok(s.know === k0 + 5, "every doubt found sharpens your knowledge");
  ok(S.unansweredReady(s), "contradictions make the unanswered conclusion defensible");
  play(s, "summons"); play(s, "eliza_final", ["Dorottya Szentes", "Thurzó wrote that you are walled in", "I have heard enough"]);
  play(s, "report", ["cannot be established"]); ok(s.ending === "unanswered", "ENDING Unanswered");
  const p = S.ENDINGS.unanswered.paragraphs(s).join(" "); ok(/blood baths no witness mentioned/.test(p) && /six hundred and fifty/.test(p), "the report lists the contradictions you found"); }

/* ---------- ending 4: the Palatine's Version (early and late) ---------- */
{ const s = S.initState(); play(s, "start"); talk(s, "secretary", ["Sign the report", "Sign it"]); ok(s.ending === "palatine", "ENDING Palatine, signed in the inn before climbing");
  ok(/before you ever climbed the hill/.test(S.ENDINGS.palatine.paragraphs(s)[0]), "…and the ending knows you never climbed"); }
{ const s = S.initState(); toCastle(s); play(s, "report", ["Sign the Palatine"]); ok(s.ending === "palatine" && /begun to read for yourself/.test(S.ENDINGS.palatine.paragraphs(s)[0]), "ENDING Palatine, signed at the castle desk after reading"); }

/* ---------- every report ending needs the final night ---------- */
{ const s = S.initState(); toCastle(s, { promise: true }); use(s, "library_desk");
  meet(s, ["That is enough", "About you"], false); for (const [a, b] of [["ev_testimonies", "ev_servants"], ["ev_marta", "ev_burials"], ["ev_zuzana", "ev_burials"]]) link(s, a, b);
  ok(S.monsterReady(s), "evidence enough for a conclusion…");
  ok(!new Dialogue(S.NODES, s).start("report").choices.some(c => /substantially/.test(c.label)), "…but no conclusion before she has been heard at night"); }

console.log(fails ? `\n${fails} FAILED` : "\nALL BATHORY STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
