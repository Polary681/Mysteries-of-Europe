// Node tests for the Hoia Baciu narrative.  Run: node tests/hoia-story.test.mjs
import { Dialogue, validateGraph } from "../src/narrative/core.js";
import * as S from "../src/adventures/hoia/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

const { errors } = validateGraph(S.NODES, Object.keys(S.NODES)); ok(errors.length === 0, "graph valid" + (errors.length ? ": " + errors.join("; ") : ""));
Object.keys(S.NODES).forEach(id => { if (!S.WHO[S.NODES[id].who]) { fails++; console.error("FAIL: unknown speaker in", id); } });
Object.values(S.CODEX).forEach(c => ok(["historical", "invented", "uncertain", "folklore"].includes(c.kind), "codex " + c.title + " labelled " + c.kind));
ok(S.ENDING_ORDER.length === 4 && S.ENDING_ORDER.every(id => S.ENDINGS[id] && S.ENDINGS[id].id === id), "4 endings, ids consistent");
ok(Object.values(S.ENDINGS).every(e => e.notes.every(n => /^INVENTED/.test(n))), "every ending is labelled as invented");

// rules
{ const s = S.initState(); ok(S.objectNode("circle", s) === "circle_early", "the clearing is closed with no traces");
  s.trace.t1 = s.trace.t2 = true; ok(S.objectNode("circle", s) === "circle_early", "…and with 2"); s.trace.t3 = true; ok(S.objectNode("circle", s) === "circle", "it opens at 3 traces");
  ok(!S.objectAvailable("t1", s) && S.objectAvailable("t4", s), "found traces are no longer interactable");
  const t = S.initState(); ok(S.watchTime(t) === "21:40", "the watch starts at 21:40"); t.trace.t1 = true; t.mins = 13; ok(S.watchTime(t) === "21:40", "each trace makes the watch fall 13 minutes behind");
  const v = new Dialogue(S.NODES, Object.assign(S.initState(), { trace: { t1: 1, t2: 1, t3: 1 } })).start("circle"); ok(v.choices.length === 2, "without camera or stick the clearing offers only wait / step back"); }
{ const s = Object.assign(S.initState(), { trace: { t1: 1, t2: 1, t3: 1 }, flags: { camera: true, tally: true } }); const v = new Dialogue(S.NODES, s).start("circle"); ok(v.choices.length === 4, "camera and stick add two choices in the clearing"); }

// simulated playthroughs: explore in random order, then use the clearing or leave
function play(seed) {
  let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const s = S.initState(), d = new Dialogue(S.NODES, s);
  const run = id => { let v = d.start(id), g = 0; while (v && g++ < 100) { if (s.ending) return; v = v.choices.length ? d.choose(Math.floor(rnd() * v.choices.length)) : d.advance(); } };
  const ids = ["sign", "t1", "t2", "t3", "t4", "t5", "circle", "leave"];
  for (let i = 0, n = 6 + Math.floor(rnd() * 30); i < n && !s.ending; i++) {
    const id = ids[Math.floor(rnd() * ids.length)]; if (!S.objectAvailable(id, s)) continue;
    if (id === "leave" && rnd() < 0.85) continue;
    run(S.objectNode(id, s));
  }
  if (!s.ending) run("leave_ask");
  return s;
}
const counts = {}; for (let i = 1; i <= 4000; i++) { const s = play(i); const e = s.ending || "none"; counts[e] = (counts[e] || 0) + 1; }
console.log("endings over 4000 random runs:", counts);
S.ENDING_ORDER.forEach(id => ok((counts[id] || 0) > 0, `ending "${id}" reachable (${counts[id] || 0})`));
S.ENDING_ORDER.forEach(id => { const e = S.ENDINGS[id]; const st = S.initState(); ok(e.paragraphs(st).length >= 2 && e.paragraphs(st).every(p => p && p.length > 20), `ending "${id}" text renders`); });
console.log(fails ? `\n${fails} FAILED` : "\nALL HOIA STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
