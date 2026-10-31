// Node tests for the Baba Yaga narrative.  Run: node tests/babayaga-story.test.mjs
import { Dialogue, validateGraph } from "../src/narrative/core.js";
import * as S from "../src/adventures/babayaga/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

const { errors } = validateGraph(S.NODES, Object.keys(S.NODES)); ok(errors.length === 0, "graph valid" + (errors.length ? ": " + errors.join("; ") : ""));
Object.keys(S.NODES).forEach(id => { if (!S.WHO[S.NODES[id].who]) { fails++; console.error("FAIL: unknown speaker in", id); } });
Object.values(S.CODEX).forEach(c => ok(["historical", "invented", "uncertain", "folklore"].includes(c.kind), "codex " + c.title + " labelled " + c.kind));
ok(S.ENDING_ORDER.length === 4 && S.ENDING_ORDER.every(id => S.ENDINGS[id] && S.ENDINGS[id].id === id && S.NODES["end_" + id]), "4 endings, each with its node");
ok(S.ENDINGS.stay.notes[0].startsWith("INVENTED") && S.ENDINGS.leave.notes[0].startsWith("INVENTED"), "the endings that are not in the tales say so");

// rules by phase
{ const s = S.initState();
  ok(S.objectAvailable("edge", s) && !S.objectAvailable("hut", s) && !S.objectAvailable("well", s), "on the road you can only walk on, or go home");
  s.phase = "gate"; ok(S.objectAvailable("hut", s) && S.objectNode("hut", s) === "hut_back", "at night the hut can be spoken to");
  s.phase = "tasks"; ok(S.objectAvailable("well", s) && S.objectAvailable("door", s) && !S.objectAvailable("stove", s), "during the day the yard is open; the stove is inside");
  s.inside = true; ok(S.objectAvailable("stove", s) && S.objectAvailable("poppy", s) && S.objectAvailable("exit", s) && !S.objectAvailable("well", s), "inside: stove, poppy seed, the way out");
  ok(S.objectNode("barrel", { ...s, items: { bucket: true } }) === "barrel_pour" && S.objectNode("barrel", { ...s, items: {} }) === "barrel_empty", "the barrel needs the bucket"); }

// the stove needs water; the cat wants soup; the honest answer needs work done by hand
{ const s = Object.assign(S.initState(), { phase: "tasks", inside: true });
  let v = new Dialogue(S.NODES, s).start("stove"); ok(v.choices.length === 1, "no water, no supper");
  s.tasks.water = true; v = new Dialogue(S.NODES, s).start("stove"); ok(v.choices.length === 2, "with water the stove can be lit");
  v = new Dialogue(S.NODES, s).start("cat"); ok(v.choices.length === 1, "the cat gets nothing before the supper is cooked");
  s.tasks.supper = true; v = new Dialogue(S.NODES, s).start("cat"); ok(v.choices.length === 2, "…and something after");
  ok(!S.objectAvailable("stove", s) && S.objectAvailable("cat", s), "once the supper is cooked, the cat on the stove is the one to talk to");
  v = new Dialogue(S.NODES, s).start("yaga_how"); ok(v.choices.length === 1, "only the blessing answer if the doll did the poppy seed");
  s.flags.poppy_self = true; v = new Dialogue(S.NODES, s).start("yaga_how"); ok(v.choices.length === 2, "“with my own two hands” once you sorted it yourself"); }

// the barrel node fills the barrel only once the bucket is poured, and reports the task as an event
{ const s = Object.assign(S.initState(), { phase: "tasks", items: { doll: true, bucket: true } }), d = new Dialogue(S.NODES, s); d.start("barrel_pour"); const ev = d.drainEvents();
  ok(s.tasks.water && !s.items.bucket && ev.some(e => e.t === "event" && e.id === "task" && e.n === "water"), "pouring the bucket completes the water task"); }

// simulated playthroughs (dialogue only): every ending reachable through the real nodes
function play(seed) {
  let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const s = S.initState(), d = new Dialogue(S.NODES, s);
  const run = id => { let v = d.start(id), g = 0; while (v && g++ < 60) { if (s.ending) return; v = v.choices.length ? d.choose(Math.floor(rnd() * v.choices.length)) : d.advance(); } d.drainEvents(); };
  if (rnd() < 0.15) { run("edge"); return s; }                                   // go home early (may also say "not yet")
  run("rider_white"); run("rider_red"); run("rider_black");
  run("hut_back"); if (rnd() < 0.1) run("edge"); if (s.ending) return s;
  run("yaga_meet"); s.phase = "tasks";
  for (const t of S.TASKS) { if (t === "poppy") { if (rnd() < 0.5) s.flags.poppy_self = true; s.tasks.poppy = true; } else s.tasks[t] = true; }
  if (rnd() < 0.5) s.flags.cat_fed = true;
  run("yaga_back"); run("yaga_ask");
  if (s.phase === "lantern") run("home_lantern"); else if (s.phase === "flight") { run(s.flags.cat_fed ? "flight_cat" : "flight_doll"); run("home_flight"); }
  return s;
}
const counts = {}; for (let i = 1; i <= 3000; i++) { const s = play(i); const e = s.ending || "none"; counts[e] = (counts[e] || 0) + 1; }
console.log("endings over 3000 random runs:", counts);
S.ENDING_ORDER.forEach(id => ok((counts[id] || 0) > 0, `ending "${id}" reachable (${counts[id] || 0})`));
S.ENDING_ORDER.forEach(id => { const st = S.initState(); const p = S.ENDINGS[id].paragraphs(st); ok(p.length >= 3 && p.every(x => x && x.length > 30), `ending "${id}" text renders`); });
console.log(fails ? `\n${fails} FAILED` : "\nALL BABA YAGA STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
