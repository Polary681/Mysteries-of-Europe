// Node tests for the Skye narrative and the piano logic.  Run: node tests/skye-story.test.mjs
import { Dialogue, validateGraph } from "../src/narrative/core.js";
import * as S from "../src/adventures/skye/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

const { errors } = validateGraph(S.NODES, Object.keys(S.NODES)); ok(errors.length === 0, "graph valid" + (errors.length ? ": " + errors.join("; ") : ""));
Object.keys(S.NODES).forEach(id => { if (!S.WHO[S.NODES[id].who]) { fails++; console.error("FAIL: unknown speaker in", id); } });
Object.values(S.CODEX).forEach(c => ok(["historical", "invented", "uncertain"].includes(c.kind), "codex " + c.title + " labelled " + c.kind));
ok(S.PHRASES.length === 6 && S.PHRASES.every(p => p.length === 4 && p.every(k => k >= 1 && k <= 8)), "6 phrases of 4 valid notes");
ok(S.KEYS.length === 8 && S.FREQ.length === 8, "8 playable keys");

// piano
{ const all = {}; for (let i = 1; i <= 6; i++) all[i] = true;
  let r = new S.PianoRun(all), res; for (let p = 0; p < 6; p++) for (let i = 0; i < 4; i++) res = r.press(S.PHRASES[p][i]);
  ok(res.finished && !res.alt, "correct run finishes with the lament as written");
  r = new S.PianoRun(all); for (let p = 0; p < 5; p++) for (let i = 0; i < 4; i++) r.press(S.PHRASES[p][i]); r.press(7); r.press(5); r.press(3); res = r.press(8); ok(res.finished && res.alt, "high final note gives the 'other note' variant");
  r = new S.PianoRun(all); r.press(5); r.press(4); res = r.press(1); ok(!res.ok && r.i === 0 && r.mistakes === 1, "a wrong note restarts the phrase only");
  r = new S.PianoRun({ 1: true }); for (let i = 0; i < 4; i++) res = r.press(S.PHRASES[0][i]); ok(res.phraseDone === 0 && r.expected() === null, "unknown phrases cannot be played");
  ok(r.press(3).blocked === true, "blocked on unknown phrase"); }

// simulated playthroughs: explore in random order, then either leave or play and choose
function play(seed) {
  let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const s = S.initState(), d = new Dialogue(S.NODES, s);
  const run = id => { let v = d.start(id), g = 0; while (v && g++ < 100) { if (s.ending) return; v = v.choices.length ? d.choose(Math.floor(rnd() * v.choices.length)) : d.advance(); } };
  const ids = ["board", "f1", "f2", "f3", "f4", "f5", "f6", "piano", "leave"];
  for (let i = 0, n = 6 + Math.floor(rnd() * 30); i < n && !s.ending; i++) {
    const id = ids[Math.floor(rnd() * ids.length)]; if (!S.objectAvailable(id, s)) continue;
    if (id === "leave" && rnd() < 0.8) continue; // leaving is rare in the middle of exploring
    if (id === "f6" && !s.tide) { if (S.tideDue(s)) run("tide_close"); else continue; }
    if (S.tideDue(s) && rnd() < 0.5) run("tide_close");
    if (id === "piano" && S.hasAll(s)) { // play the lament
      const r = new S.PianoRun(s.frag); let res;
      for (let p = 0; p < 6 && !s.ending; p++) { for (let i2 = 0; i2 < 4; i2++) { if (rnd() < 0.05) r.press(1); const k = S.PHRASES[p][i2]; res = r.press(p === 5 && i2 === 3 && rnd() < 0.5 ? 8 : k); }
        if (p === 4) { run("fin_before_last"); if (s.ending) break; } }
      if (!s.ending && res && res.finished) run(res.alt ? "fin_other" : "fin_peace"); continue; }
    run(S.objectNode(id, s));
  }
  if (!s.ending) run("leave_ask"), s.ending || (s.ending = null);
  return s;
}
const counts = {}; for (let i = 1; i <= 4000; i++) { const s = play(i); const e = s.ending || "none"; counts[e] = (counts[e] || 0) + 1; }
console.log("endings over 4000 random runs:", counts);
S.ENDING_ORDER.forEach(id => ok((counts[id] || 0) > 0, `ending "${id}" reachable (${counts[id] || 0})`));
S.ENDING_ORDER.forEach(id => { const e = S.ENDINGS[id]; const st = S.initState(); ok(e.paragraphs(st).length >= 2 && e.notes.length === 1, `ending "${id}" text renders`); });
{ const s = S.initState(); S.OUTSIDE.forEach(i => { s.frag[i] = true; }); ok(S.tideDue(s) && S.objectNode("f6", s) === "f6", "tide due after 5 outside echoes; stand unlocks after 3"); const t = S.initState(); t.frag[1] = t.frag[2] = true; ok(S.objectNode("f6", t) === "f6_locked", "music stand locked with fewer than 3 echoes"); }
console.log(fails ? `\n${fails} FAILED` : "\nALL SKYE STORY TESTS PASSED"); process.exit(fails ? 1 : 0);
