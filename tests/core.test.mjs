// v9.1: restoring saved story states (Continue) and the stored-record guard. Node only: node tests/core.test.mjs
import { restoreState, validPos } from "../src/narrative/core.js";
import * as W from "../src/adventures/woolpit/story.js";
import * as S from "../src/adventures/sibilla/story.js";
import * as B from "../src/adventures/bathory/story.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok  :", m); };

// an incomplete save gets the defaults of a new game, nested records merged, saved values kept
for (const [name, ST] of [["woolpit", W], ["sibilla", S], ["bathory", B]]) {
  const fresh = ST.initState(), r = restoreState(ST.initState(), { act: 2, flags: { x: true }, seen: { start: 1 } });
  ok(Object.keys(fresh).every(k => k in r), `${name}: every field of a new game exists after restoring a partial save`);
  ok(r.act === 2 && r.flags.x === true && r.seen.start === 1, `${name}: the saved values are kept`);
  for (const k of Object.keys(fresh)) if (fresh[k] && typeof fresh[k] === "object" && !Array.isArray(fresh[k])) ok(r[k] && typeof r[k] === "object", `${name}: ${k} is a record`);
  const full = ST.initState(); full.act = 3; const same = restoreState(ST.initState(), JSON.parse(JSON.stringify(full)));
  ok(JSON.stringify(same) === JSON.stringify(full), `${name}: a complete save comes back unchanged`);
}
const r2 = restoreState({ a: 1, b: { c: 1 }, d: [1], e: null }, { a: "x", b: 5, d: "no", e: "kept", f: 7 });
ok(r2.a === 1 && r2.b.c === 1 && r2.d[0] === 1 && r2.e === "kept" && r2.f === 7, "wrong kinds keep the default; nullable and new fields keep the saved value");
ok(restoreState({ a: 1 }, null).a === 1 && restoreState({ a: 1 }, [1, 2]).a === 1 && restoreState({ a: 1 }, "x").a === 1, "a save that is not a record gives a new game");
ok(validPos([1, 2, 0]) && validPos([1, 2]) && !validPos(["x", 2]) && !validPos([1, null]) && !validPos(null) && !validPos([1, 2, NaN]), "saved positions are validated");

// loadObj: a damaged record gives a plain object
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const { loadObj, save } = await import("../src/shared/save.js");
for (const v of ['"x"', "5", "[]", "null", "{bad"]) { localStorage.setItem("k", v); const o = loadObj("k"); ok(o && typeof o === "object" && !Array.isArray(o), `loadObj("${v}") is a plain object`); }
save("k", { a: 1 }); ok(loadObj("k").a === 1, "loadObj returns a stored record");

console.log(fails ? `\n${fails} FAILED` : "\nALL CORE TESTS PASSED"); process.exit(fails ? 1 : 0);
