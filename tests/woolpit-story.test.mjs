// Node tests for the Woolpit narrative: graph validity + thousands of simulated playthroughs.
// Run: node tests/woolpit-story.test.mjs
import { Dialogue, validateGraph, applyFx } from "../src/narrative/core.js";
import * as S from "../src/adventures/woolpit/story.js";

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

// 1. graph
const { errors, reachable } = validateGraph(S.NODES, Object.keys(S.NODES));
ok(errors.length === 0, "graph has no dangling links / missing speakers / missing text" + (errors.length ? " -> " + errors.join("; ") : ""));
// nodes reached through function-valued `go` (invisible to static analysis) are covered by the simulation below
const entries = ["a3_boy", "finale", "mob_open", "hollow_arrive", "g_tale_full", "g_tale_part", "end_manor", "end_both", "end_bells", "end_font", "end_ink", "end_omen", "a1_arrive", "rest", "dusk_gate", "kids_hub", "boy_a2", "girl_hub", "boy_a3", ...Object.values(S.OBJECTS)];
["edith", "hugh", "aldwin", "maud", "richard", "walter"].forEach(n => entries.push(n + "_first", n + "_hub"));
const fromEntries = validateGraph(S.NODES, entries).reachable;
const orphan = Object.keys(S.NODES).filter(id => !fromEntries.has(id));
ok(orphan.length === 0, "every node is reachable from a game entry point" + (orphan.length ? " -> orphans: " + orphan.join(", ") : ""));
Object.keys(S.NODES).forEach(id => { const w = S.NODES[id].who; if (!S.WHO[w]) { fails++; console.error("FAIL: unknown speaker", w, "in", id); } });
Object.values(S.CODEX).forEach(c => ok(["historical", "invented", "uncertain"].includes(c.kind), "codex " + c.title + " is labelled " + c.kind));

// 2. simulated playthroughs
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(seed, kindness) {
  const r = mulberry(seed), s = S.initState(), d = new Dialogue(S.NODES, s);
  const pick = v => {
    // "kindness" biases toward earlier/other options so strategies differ
    const c = v.choices; const leave = c.findIndex(x => x.c.go === null);
    if (leave >= 0 && r() < 0.18) return leave;
    return Math.floor((kindness ? r() ** kindness : r()) * c.length);
  };
  const run = id => { let v = d.start(id), g = 0; while (v && g++ < 300) { if (s.ending) return; v = v.choices.length ? d.choose(pick(v)) : d.advance(); } if (g >= 300) throw new Error("dialogue loop at " + id); };
  const people = ["girl", "boy", "edith", "hugh", "aldwin", "maud", "richard", "walter"], objs = ["pits", "cloth", "well", "beans", "bell", "grave", "bed", "bench"];
  const act = () => {
    const opts = [...people.map(p => ["t", p]), ...objs.filter(o => S.objectAvailable(o, s) && o !== "bed" && o !== "bench").map(o => ["o", o])];
    const [k, id] = opts[Math.floor(r() * opts.length)]; const n = k === "t" ? S.talkNode(id, s) : S.objectNode(id, s); if (n) run(n);
  };
  run("a1_arrive");
  if (s.act !== 2 && s.act !== 1) throw new Error("bad act after act1: " + s.act);
  for (let i = 0, n = 4 + Math.floor(r() * 30); i < n; i++) act();
  d.start("rest"); d.choose(0); let g = 0; let v = d.view(); while (v && g++ < 50) { if (v.choices.length) v = d.choose(pick(v)); else v = d.advance(); }
  if (s.act !== 3) throw new Error("rest did not start act 3");
  for (let i = 0, n = 3 + Math.floor(r() * 30); i < n; i++) act();
  run("dusk_gate"); // choice 0 is not forced; if "Not yet" was chosen, force dusk
  if (!s.ending) { d.start("dusk_gate"); let vv = d.choose(0); g = 0; while (vv && g++ < 100 && !s.ending) vv = vv.choices.length ? d.choose(pick(vv)) : d.advance(); }
  if (!s.ending) throw new Error("no ending reached (seed " + seed + ")");
  JSON.parse(JSON.stringify(s)); // must serialise
  return s;
}
const counts = {}; let N = 0; const ranges = { trust: [99, -99], susp: [99, -99], know: [99, -99] };
for (let seed = 1; seed <= 6000; seed++) {
  const s = play(seed, [0, 1, 1.6, 2.6][seed % 4]); N++; counts[s.ending] = (counts[s.ending] || 0) + 1;
  for (const k in ranges) { ranges[k][0] = Math.min(ranges[k][0], s[k]); ranges[k][1] = Math.max(ranges[k][1], s[k]); }
  const e = S.ENDINGS[s.ending]; if (!e) throw new Error("unknown ending " + s.ending);
  const p = e.paragraphs(s); if (!p.length || p.some(x => typeof x !== "string")) throw new Error("bad ending text");
}
console.log("endings over", N, "random playthroughs:", counts, "meter ranges:", ranges);
S.ENDING_ORDER.forEach(id => ok((counts[id] || 0) > 0, `ending "${id}" is reachable in simulation (${counts[id] || 0} times)`));
ok(Object.keys(counts).length === 6, "exactly six distinct endings reached");

// 3. targeted checks of the chronicle-faithful rules
{
  const s = S.initState(); s.flags.fed = true; s.flags.fed_by_you = true; s.flags.tonic_given = true; s.trust = 3; S.restOutcome(s);
  ok(s.boy === "lives", "careful help (beans + tonic + trust, no rushed baptism) can save the boy (invented divergence)");
  const t = S.initState(); S.restOutcome(t);
  ok(t.boy === "weak" && t.flags.fed === "self", "if the children are never fed the girl finds the beans herself and the boy stays weak (no soft-lock)");
  const u = S.initState(); u.susp = 6; ok(S.duskOutcome(u) === "mob_open", "high suspicion triggers the mob"); u.calmed = true; ok(S.duskOutcome(u) === "finale", "calmed village skips the mob");
}
{ // garbled speech is gated by learned words
  const s = S.initState(); const d = new Dialogue(S.NODES, s); d.start("k_sun"); const v = d.view();
  ok(v.garbled === true || Object.keys(s.words).length >= 2, "child's speech is unintelligible until words are learned");
}
console.log(fails ? `\n${fails} FAILED` : "\nALL WOOLPIT STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
