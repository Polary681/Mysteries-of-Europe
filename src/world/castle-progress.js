// THE CASTLE LIGHTS UP WITH YOUR DISCOVERIES. Every relic recovered (and every legend completed, and the valley's
// secret) has its own window in the castle: Woolpit's six relics in the keep's middle floors, Skye's four at the top
// of the keep, Hoia's four on the lowest floors, Baba Yaga's four in the lodging house, the Sibyl's six in the new slender
// tower between the great hall and the keep, the Countess's six in the dark watchtower on the west side, the Archivist's Seal in the chapel belfry, the completed legends in the great
// hall, the wisp in a tower slit. A window that lights for the first time flares briefly; after that it simply glows.
// When every relic is recovered, the whole castle lights, the chapel brightens and a pillar of light rises to the sky.
//
// The Archive stays the only source of truth (src/shared/archive.js). This module only remembers which windows have
// already PLAYED their first-light animation and whether the finale was shown (key moe.castle.v1), so nothing repeats.
import * as Archive from "../shared/archive.js";
import { load, save } from "../shared/save.js";

export const KEY = "moe.castle.v1";
/** role of each archive window -> what lights it. Order = the order in which pending windows flare. */
export const ROLES = [
  "legend:woolpit", "legend:hoia", "legend:skye", "legend:babayaga", "legend:sibilla", "legend:bathory",
  "woolpit-servant", "woolpit-both", "woolpit-bells", "woolpit-font", "woolpit-omen", "woolpit-ink",
  "hoia-time", "hoia-watching", "hoia-negative", "hoia-tally",
  "skye-peace", "skye-other", "skye-stay", "skye-leave",
  "babayaga-lantern", "babayaga-flight", "babayaga-stay", "babayaga-leave",
  "sibilla-notebook", "sibilla-dance", "sibilla-return", "sibilla-knowledge", "sibilla-kingdom", "sibilla-seal",
  "bathory-letter", "bathory-monster", "bathory-conspiracy", "bathory-unanswered", "bathory-palatine", "bathory-seal",
  "seal-archivist", "secret-wisp",
];
/** the set of roles that should be lit right now, from the real progress */
export function litRoles() {
  const s = new Set();
  for (const id of Archive.unlockedIds()) { const c = Archive.CARD[id]; if (c && c.type !== "legend") s.add(id); }
  for (const k of Archive.LEGEND_ORDER) if (Archive.legendStatus(k).found > 0) s.add("legend:" + k);
  return s;
}
const readState = () => { const v = load(KEY, null); return v && typeof v === "object" ? { shown: v.shown && typeof v.shown === "object" ? v.shown : {}, finale: +v.finale || 0 } : { shown: {}, finale: 0 }; };

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
/** first-light curve: dark -> bright flare -> steady (1) */
const flareCurve = t => t < 0 ? 0 : t < 0.22 ? ease(t / 0.22) * 4.2 : t < 1.4 ? 4.2 - (4.2 - 1) * ease((t - 0.22) / 1.18) : 1;

/**
 * @param api { setWindow(role, level, flare), setChapel(k), setBeam(intensity, height), onFinale(), isVisible(), reduce }
 */
export function createCastleProgress(api) {
  let st = readState(), lit = litRoles(), queue = [], anim = [], finale = null, t = 0;
  const level = Object.fromEntries(ROLES.map(r => [r, 0]));
  const relicK = () => { const p = Archive.progress(); return p.relics ? p.relicsUnlocked / p.relics : 0; };
  // steady state at load: windows already shown are lit, new ones wait (they will flare when the castle is on screen)
  for (const r of ROLES) level[r] = lit.has(r) && st.shown[r] ? 1 : 0;
  const apply = () => { for (const r of ROLES) api.setWindow(r, level[r], 0); };
  apply();
  const steadyChapel = () => (st.finale ? 1 : 0.1 + 0.45 * relicK());
  api.setChapel(steadyChapel()); api.setBeam(st.finale ? 0.5 : 0, st.finale ? 1 : 0);

  function refresh() {
    lit = litRoles();
    for (const r of ROLES) {
      if (lit.has(r) && !st.shown[r] && !queue.includes(r) && !anim.some(a => a.role === r)) queue.push(r);
      if (!lit.has(r) && level[r] > 0) { level[r] = 0; api.setWindow(r, 0, 0); }   // (only after an Archive reset)
    }
  }
  refresh();
  Archive.onChange(refresh);

  function markShown(role) { st = readState(); st.shown[role] = Date.now(); save(KEY, st); }
  function startFinale() {
    finale = { t: 0 }; st = readState(); st.finale = Date.now(); save(KEY, st);
    api.onFinale && api.onFinale();
  }
  return {
    update() {
      // real time (not the renderer's capped frame step): the castle's ceremony keeps its pace on slow machines
      const now = performance.now(), dt = Math.min(0.25, (now - (this._last || now)) / 1000); this._last = now;
      t += dt;
      if (!api.isVisible()) return;
      // pending first lights: one after another, 0.75 s apart
      if (queue.length && (!anim.length || anim[anim.length - 1].t > (queue.length > 4 ? 0.32 : 0.75))) { const role = queue.shift(); anim.push({ role, t: api.reduce ? 2 : 0 }); }
      for (let i = anim.length - 1; i >= 0; i--) {
        const a = anim[i]; a.t += dt; const L = flareCurve(a.t);
        level[a.role] = L; api.setWindow(a.role, L, Math.max(0, L - 1) / 3.2);
        if (a.t >= 1.4) { level[a.role] = 1; api.setWindow(a.role, 1, 0); markShown(a.role); anim.splice(i, 1); }
      }
      if (!finale && !queue.length && !anim.length) {
        if (Archive.progress().complete && !st.finale) startFinale();
        else api.setChapel(steadyChapel());
      }
      if (finale) {
        // the finale: a wave of light through every window, the chapel brightening, then the pillar of light
        const f = finale; f.t += api.reduce ? 20 : dt; const T = f.t;
        ROLES.forEach((r, i) => { const w = T - 0.12 * i; const pulse = w > 0 && w < 1.6 ? Math.sin(w / 1.6 * Math.PI) * 1.4 : 0; const on = lit.has(r) || (f.preview && T > 0.12 * i) ? 1 : 0; api.setWindow(r, on * (f.preview && !lit.has(r) ? Math.max(0, 1 - Math.max(0, T - 8.5) / 1.5) : 1) + pulse, pulse * 0.25); });
        api.setChapel(steadyChapel() + ease(T / 4) * (1 - steadyChapel()) + Math.max(0, Math.sin(Math.min(1, (T - 2) / 5) * Math.PI)) * 1.6);
        const grow = ease((T - 2.6) / 3.2), settle = ease((T - 6.5) / 3);
        api.setBeam(grow * (1.8 - 1.3 * settle), grow);
        if (T > 10) { const pv = f.preview; finale = null; apply(); if (pv) { api.setChapel(steadyChapel()); api.setBeam(st.finale ? 0.5 : 0, st.finale ? 1 : 0); } else { api.setChapel(1); api.setBeam(0.5, 1); } }
      }
    },
    /** a PREVIEW of the finale (the guided tour): every window and the pillar of light, then back to the real state. Nothing is saved. */
    preview() { if (finale || queue.length || anim.length) return false; finale = { t: 0, preview: true }; return true; },
    /** dev/test helpers: forget which windows already played (they replay), or replay the finale */
    replay() { save(KEY, { shown: {}, finale: 0 }); st = readState(); for (const r of ROLES) { level[r] = 0; } apply(); api.setBeam(0, 0); queue = []; anim = []; finale = null; refresh(); },
    state: () => ({ lit: [...lit], shown: Object.keys(readState().shown), finale: !!readState().finale, pending: queue.length + anim.length, animating: !!finale || anim.length > 0 }),
  };
}
