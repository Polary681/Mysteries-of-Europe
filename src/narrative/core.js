// Reusable narrative core (no DOM, no WebGL): story state, effects and a branching dialogue runner.
// Used by the Woolpit adventure and fully testable from Node (tests/*.mjs).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const arr = x => (x == null ? [] : Array.isArray(x) ? x : [x]);
const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);

/** A saved story state laid over a fresh one (Continue). Fields the save lacks (added by a later version, or lost from a
 *  damaged save) get their defaults, nested records (flags, seen, clues, items...) are merged one level deep, and a value
 *  of the wrong kind keeps the default. Without this an incomplete save crashed Continue on its first frame. */
export function restoreState(fresh, saved) {
  if (!isObj(saved)) return fresh;
  const out = { ...fresh };
  for (const k of Object.keys(saved)) {
    const f = fresh[k], v = saved[k];
    if (isObj(f)) out[k] = isObj(v) ? { ...f, ...v } : f;
    else if (Array.isArray(f)) out[k] = Array.isArray(v) ? v : f;
    else if (f === undefined || f === null || typeof v === typeof f) out[k] = v;   // new/nullable fields keep the saved value
  }
  return out;
}
/** a saved player position: [x, z, yaw?] made of finite numbers */
export const validPos = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && (p[2] == null || Number.isFinite(p[2]));

/* ---------- effects ----------
   fx = { trust, susp, know, skin, rel:{id:n}, flag, unflag, item, drop, word, clue, note, set:{...}, toast, event }
   or a function (state, events) => void.  Every change is also pushed to `events` so the UI can react (toasts, 3D scene updates). */
export function applyFx(s, fx, events = []) {
  if (!fx) return events;
  if (typeof fx === "function") { fx(s, events); return events; }
  if (fx.trust) { const o = s.trust; s.trust = clamp(s.trust + fx.trust, -3, 10); if (s.trust !== o) events.push({ t: "meter", k: "trust", d: s.trust - o }); }
  if (fx.susp) { const o = s.susp; s.susp = clamp(s.susp + fx.susp, 0, 10); if (s.susp !== o) events.push({ t: "meter", k: "susp", d: s.susp - o }); }
  if (fx.know) { const o = s.know; s.know = clamp(s.know + fx.know, 0, 20); if (s.know !== o) events.push({ t: "meter", k: "know", d: s.know - o }); }
  if (fx.skin) s.skin = clamp(s.skin + fx.skin, 0, 1);
  if (fx.rel) for (const id in fx.rel) { const o = s.rel[id] || 0; s.rel[id] = clamp(o + fx.rel[id], -3, 5); if (s.rel[id] !== o) events.push({ t: "rel", id, d: s.rel[id] - o }); }
  arr(fx.flag).forEach(f => { s.flags[f] = true; });
  arr(fx.unflag).forEach(f => { delete s.flags[f]; });
  arr(fx.item).forEach(i => { if (!s.items[i]) { s.items[i] = true; events.push({ t: "item", id: i }); } });
  arr(fx.drop).forEach(i => { delete s.items[i]; });
  arr(fx.word).forEach(w => { if (!s.words[w]) { s.words[w] = true; events.push({ t: "word", id: w }); } });
  arr(fx.clue).forEach(c => { if (!s.clues[c]) { s.clues[c] = true; events.push({ t: "clue", id: c }); } });
  arr(fx.note).forEach(n => { if (!s.notes[n]) { s.notes[n] = true; events.push({ t: "note", id: n }); } });
  if (fx.set) { Object.assign(s, fx.set); events.push({ t: "set", keys: Object.keys(fx.set) }); }
  if (fx.toast) events.push({ t: "toast", text: fx.toast });
  arr(fx.event).forEach(e => events.push({ t: "event", id: e }));
  return events;
}

/* ---------- "alien" text: deterministic gibberish for lines the player cannot understand ---------- */
const SYL = ["ysa", "el", "vo", "nu", "ha", "ri", "ke", "ma", "thu", "ol", "ei", "za", "sen", "mar", "ahl", "oru"];
export function alien(text) {
  let h = 7; for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  const rnd = () => { h = (Math.imul(h, 1103515245) + 12345) | 0; return ((h >>> 8) & 0xffff) / 0x10000; };
  const out = text.replace(/[*_]/g, "").split(/\s+/).filter(Boolean).map(w => {
    const n = 1 + ((rnd() * 2) | 0) + (w.length > 6 ? 1 : 0); let o = "";
    for (let i = 0; i < n; i++) o += SYL[(rnd() * SYL.length) | 0];
    return o + (w.match(/[.,!?…]+$/)?.[0] || "");
  }).join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* ---------- dialogue runner ----------
   node = { id, who, text|fn(s), kid?, req?, hint?, fx?, go?: id|fn(s), choices?: [{ t|fn(s), if?, once?, fx?, go: id|fn(s)|null }], end? }
   A node without `choices` and without `go` ends the conversation. */
export class Dialogue {
  constructor(nodes, state) { this.nodes = nodes; this.s = state; this.cur = null; this.events = []; this.lastId = null; }
  get active() { return !!this.cur; }
  start(id) { this.events = []; return this.goto(id); }
  goto(id) {
    if (id == null) { this.lastId = this.cur ? this.cur.id : this.lastId; this.cur = null; return null; }
    const n = this.nodes[id]; if (!n) throw new Error("Unknown dialogue node: " + id);
    this.cur = n; this.s.seen[id] = (this.s.seen[id] || 0) + 1; applyFx(this.s, n.fx, this.events); return this.view();
  }
  view() {
    const n = this.cur, s = this.s; if (!n) return null;
    let text = typeof n.text === "function" ? n.text(s) : n.text, garbled = false, hint = null;
    if (n.kid && !s.fluent) {
      const u = Object.keys(s.words).length, req = n.req ?? 3;
      if (u < req) { garbled = true; text = alien(text); if (u >= 1 && n.hint) hint = n.hint; }
    }
    const choices = (n.choices || []).map(c => ({ c })).filter(({ c }) => (!c.if || c.if(s)) && (!c.once || !s.once[c.once]))
      .map(({ c }, i) => ({ i, c, label: typeof c.t === "function" ? c.t(s) : c.t }));
    return { id: n.id, who: n.who, text, garbled, hint, choices, hasNext: !!n.go, end: !choices.length && !n.go, node: n };
  }
  choose(i) {
    const v = this.view(), ch = v && v.choices[i]; if (!ch) return v;
    const c = ch.c; if (c.once) this.s.once[c.once] = true; applyFx(this.s, c.fx, this.events);
    return this.goto(typeof c.go === "function" ? c.go(this.s) : c.go);
  }
  advance() {
    const n = this.cur; if (!n) return null; if (n.choices && this.view().choices.length) return this.view(); // must choose
    return this.goto(n.go ? (typeof n.go === "function" ? n.go(this.s) : n.go) : null);
  }
  drainEvents() { const e = this.events; this.events = []; return e; }
}

/* ---------- static validation of a node graph (used by tests) ---------- */
export function validateGraph(nodes, entries = []) {
  const errors = [], reach = new Set();
  const targets = n => { const t = []; if (typeof n.go === "string") t.push(n.go); (n.choices || []).forEach(c => { if (typeof c.go === "string") t.push(c.go); }); return t; };
  for (const [id, n] of Object.entries(nodes)) {
    if (n.id !== id) errors.push(`node key ${id} != id ${n.id}`);
    targets(n).forEach(t => { if (!nodes[t]) errors.push(`${id} -> missing ${t}`); });
    if (!n.who) errors.push(`${id}: no speaker`); if (n.text == null) errors.push(`${id}: no text`);
  }
  const q = [...entries]; while (q.length) { const id = q.pop(); if (reach.has(id) || !nodes[id]) continue; reach.add(id); targets(nodes[id]).forEach(t => q.push(t)); }
  return { errors, reachable: reach };
}
