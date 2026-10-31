// BABA YAGA - the procedural models: the hut on chicken legs (posable, it stands, crouches, steps and turns), Baba Yaga in
// her mortar with pestle and broom, the three riders and their horses, the three pairs of hands, the cat, the skull lantern.
// Everything is built from primitives at run time (no model files). Each model exposes small pose/animation helpers.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, CapsuleGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Color, Float32BufferAttribute, PointLight, DoubleSide, Shape, ExtrudeGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, glowSprite } from "../../shared/world.js";

const mats = new Map();
export const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...o })); return mats.get(k); };
const mesh = (g, m, x = 0, y = 0, z = 0, p = null) => { const o = new Mesh(g, m); o.position.set(x, y, z); if (p) p.add(o); return o; };
/** paint a geometry with one vertex colour (so that many parts can be merged into one mesh with one material) */
const paint = (g, c, jitter = 0, r = null) => { g = g.index ? g.toNonIndexed() : g; const col = new Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { const k = 1 + (jitter && r ? (r() - 0.5) * jitter : 0); a[i] = col.r * k; a[i + 1] = col.g * k; a[i + 2] = col.b * k; } g.setAttribute("color", new Float32BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute("uv"); return g; };
/** a flat triangle (gable, window pediment): width w, height h, thickness d, base centred on the origin */
const tri = (w, h, d) => { const sh = new Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0); const g = new ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; };
const VC = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });

/* ======================================================================================  THE HUT ON CHICKEN LEGS */
const L1 = 2.5, L2 = 3.1;                                   // thigh and shank lengths (m)
export const HUT = { w: 5.2, d: 4.4, wall: 3.2 };
export function makeHut() {
  const r = rng(1855), root = new Group(), body = new Group(); root.add(body);
  const parts = [];
  // log walls: horizontal logs, alternating so the corners interlock
  const rows = 9, lr = 0.19, W = HUT.w, D = HUT.d;
  for (let i = 0; i < rows; i++) {
    const y = 0.2 + i * lr * 1.85;
    for (const s of [-1, 1]) {
      const a = new CylinderGeometry(lr, lr, W + 0.7, 7); a.rotateZ(Math.PI / 2); a.translate(0, y + (i % 2) * lr * 0.9, s * D / 2); parts.push(paint(a, 0x6b4a2e, 0.35, r));
      const b = new CylinderGeometry(lr, lr, D + 0.7, 7); b.rotateX(Math.PI / 2); b.translate(s * W / 2, y + ((i + 1) % 2) * lr * 0.9, 0); parts.push(paint(b, 0x6b4a2e, 0.35, r));
    }
  }
  // floor beam frame, gables and roof
  { const f = new BoxGeometry(W + 0.5, 0.35, D + 0.5); f.translate(0, 0, 0); parts.push(paint(f, 0x4a3320)); }
  const top = 0.2 + rows * lr * 1.85;
  for (const s of [-1, 1]) { const g = tri(W + 0.5, 2.0, 0.16); g.translate(0, top - 0.05, s * (D / 2 + 0.05)); parts.push(paint(g, 0x7a5434, 0.2, r)); }   // gables
  for (const s of [-1, 1]) for (const e of [-1, 1]) {   // carved bargeboards (prichelina) along the gable edges, front and back
    const b = new BoxGeometry(0.16, 3.3, 0.1); b.rotateZ(e * 0.96); b.translate(e * (W / 4 + 0.15), top + 0.95, s * (D / 2 + 0.62)); parts.push(paint(b, 0xd8c39a));
  }
  { const sun = new CylinderGeometry(0.42, 0.42, 0.08, 12); sun.rotateX(Math.PI / 2); sun.translate(0, top + 0.95, D / 2 + 0.16); parts.push(paint(sun, 0xb2443a)); }   // a carved sun on the front gable
  for (const s of [-1, 1]) { // roof planes (shingles: many slightly offset slats)
    for (let k = 0; k < 7; k++) {
      const sl = new BoxGeometry(0.12, 0.62, D + 1.2);
      sl.rotateZ(s * 0.96);   // along the slope of the roof const t = (k + 0.5) / 7; sl.translate(s * (W / 2 + 0.45) * (1 - t) , top - 0.1 + 2.1 * t, 0);
      parts.push(paint(sl, k % 2 ? 0x3d3a2c : 0x45402e, 0.25, r));
    }
  }
  { const rb = new CylinderGeometry(0.16, 0.16, D + 1.5, 6); rb.rotateX(Math.PI / 2); rb.translate(0, top + 2.05, 0); parts.push(paint(rb, 0x3a2a1a)); }
  // carved horse-head on the ridge (front), chimney
  { const n = new BoxGeometry(0.22, 0.9, 0.35); n.rotateX(-0.5); n.translate(0, top + 2.5, D / 2 + 0.85); parts.push(paint(n, 0x3a2a1a)); const h = new BoxGeometry(0.24, 0.34, 0.62); h.translate(0, top + 2.95, D / 2 + 1.12); parts.push(paint(h, 0x3a2a1a)); }
  { const c = new BoxGeometry(0.6, 1.6, 0.6); c.translate(-1.1, top + 1.6, -0.9); parts.push(paint(c, 0x6b5f55, 0.3, r)); }
  // front: door with a carved frame, two windows with painted frames (nalichniki)
  const fz = D / 2 + 0.2;
  { const d = new BoxGeometry(1.15, 1.9, 0.12); d.translate(0, 1.15, fz); parts.push(paint(d, 0x2e2015)); }
  for (const [x, y, w, h] of [[-0.68, 1.15, 0.14, 2.2], [0.68, 1.15, 0.14, 2.2], [0, 2.3, 1.5, 0.2]]) { const b = new BoxGeometry(w, h, 0.14); b.translate(x, y, fz + 0.06); parts.push(paint(b, 0xc9b28a)); }
  for (const sx of [-1.75, 1.75]) {
    for (const [x, y, w, h] of [[sx, 1.95, 1.0, 0.14], [sx, 1.05, 1.0, 0.14], [sx - 0.45, 1.5, 0.12, 1.0], [sx + 0.45, 1.5, 0.12, 1.0], [sx, 2.15, 1.25, 0.18]]) { const b = new BoxGeometry(w, h, 0.12); b.translate(x, y, fz + 0.05); parts.push(paint(b, 0xd8c39a)); }
    const t = tri(1.3, 0.42, 0.12); t.translate(sx, 2.22, fz + 0.07); parts.push(paint(t, 0xb2443a));   // carved pediment
  }
  body.add(new Mesh(mergeGeometries(parts), VC));
  const glowMat = new MeshBasicMaterial({ color: 0xffb35c });
  const winGlow = []; for (const sx of [-1.75, 1.75]) { const w = mesh(new BoxGeometry(0.78, 0.78, 0.05), glowMat, sx, 1.5, fz - 0.02, body); winGlow.push(w); }
  // the back has a small dark window only
  mesh(new BoxGeometry(0.6, 0.5, 0.05), M(0x0c0907), 1.2, 1.7, -D / 2 - 0.2, body);
  const doorGlow = mesh(new BoxGeometry(0.9, 1.65, 0.04), new MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0 }), 0, 1.1, fz + 0.075, body);
  // chimney smoke
  const smoke = []; for (let i = 0; i < 9; i++) { const s = glowSprite("150,150,160", 1.2); s.material.blending = 1; s.material.opacity = 0; s.position.set(-1.1, top + 2.5, -0.9); s.userData.t = i / 9; body.add(s); smoke.push(s); }

  // ---- the legs
  const skin = M(0xc9a64e, { roughness: 0.7 }), claw = M(0x2a241c), feather = M(0x5a3a26), feather2 = M(0x7a5232);
  function leg(side) {
    const hip = new Group(); hip.position.set(side * 1.35, -0.1, 0.25); body.add(hip);
    const thighG = new CylinderGeometry(0.85, 0.32, L1, 10); thighG.translate(0, -L1 / 2, 0); mesh(thighG, feather, 0, 0, 0, hip);
    for (let i = 0; i < 16; i++) { // feather tufts round the drumstick
      const a = i / 16 * Math.PI * 2 + r() * 0.3, y = -0.2 - r() * (L1 - 0.6), rad = 0.85 - 0.5 * (-y / L1);
      const f = mesh(new ConeGeometry(0.2 + r() * 0.12, 0.9 + r() * 0.5, 4), i % 3 ? feather : feather2, Math.cos(a) * rad, y - 0.3, Math.sin(a) * rad, hip); f.rotation.set(Math.sin(a) * 0.5 + Math.PI, 0, -Math.cos(a) * 0.5);
    }
    const knee = new Group(); knee.position.y = -L1; hip.add(knee);
    mesh(new SphereGeometry(0.34, 8, 6), skin, 0, 0, 0, knee);
    const shankG = new CylinderGeometry(0.26, 0.19, L2, 8); shankG.translate(0, -L2 / 2, 0); mesh(shankG, skin, 0, 0, 0, knee);
    for (let i = 1; i < 9; i++) { const ring = mesh(new TorusGeometry(0.25 - i * 0.007, 0.03, 4, 10), M(0x9c7d36), 0, -i * L2 / 9.3, 0, knee); ring.rotation.x = Math.PI / 2; }
    const ankle = new Group(); ankle.position.y = -L2; knee.add(ankle);
    mesh(new SphereGeometry(0.24, 8, 6), skin, 0, 0, 0, ankle);
    const toes = [];
    for (const [a, len] of [[-0.55, 1.45], [0, 1.7], [0.55, 1.45], [Math.PI, 0.9]]) {
      const tg = new Group(); tg.rotation.y = a; tg.position.y = -0.1; ankle.add(tg);
      const tc = mesh(new CylinderGeometry(0.12, 0.07, len, 6), skin, 0, -0.05, len / 2, tg); tc.rotation.x = Math.PI / 2 + 0.06;
      const cl = mesh(new ConeGeometry(0.075, 0.42, 5), claw, 0, -0.12, len + 0.12, tg); cl.rotation.x = Math.PI / 2 + 0.5;
      toes.push(tg);
    }
    return { hip, knee, ankle, toes, a1: 0.5, a2: -0.9, lift: 0 };
  }
  const legs = [leg(-1), leg(1)];
  const STAND = [0.5, -0.92], CROUCH = [1.5, -2.95];
  const state = { crouch: 0, walk: 0, phase: 0, scratch: 0, scratchLeg: 0, t: 0 };
  function pose() {
    legs.forEach((L, i) => {
      const c = state.crouch, a1b = STAND[0] + (CROUCH[0] - STAND[0]) * c, a2b = STAND[1] + (CROUCH[1] - STAND[1]) * c;
      // walking: legs alternate; a lifted leg bends more (the foot comes up)
      const ph = state.phase + i * Math.PI, lift = state.walk * Math.max(0, Math.sin(ph)) + (state.scratchLeg === i ? state.scratch : 0);
      const sway = Math.sin(state.t * 1.3 + i * 2) * 0.025 * (1 - c);
      L.a1 = a1b + lift * 0.45 + sway; L.a2 = a2b - lift * 0.9;
      L.hip.rotation.x = -L.a1; L.knee.rotation.x = -L.a2; L.ankle.rotation.x = L.a1 + L.a2 - lift * 0.4;
      L.toes.forEach((t, k) => { t.rotation.x = k < 3 ? -lift * 0.5 : 0; });
    });
    // the body rests on the planted leg(s)
    const planted = legs.map((L, i) => ({ h: L1 * Math.cos(L.a1) + L2 * Math.cos(L.a1 + L.a2) + 0.2, lift: state.walk * Math.max(0, Math.sin(state.phase + i * Math.PI)) + (state.scratchLeg === i ? state.scratch : 0) }));
    const low = planted.filter(p => p.lift < 0.05); body.position.y = (low.length ? Math.max(...low.map(p => p.h)) : Math.max(...planted.map(p => p.h))) + 0.1;
    body.rotation.z = Math.sin(state.phase) * 0.035 * state.walk + Math.sin(state.t * 0.9) * 0.008 * (1 - state.crouch);
    body.rotation.x = Math.sin(state.t * 0.7) * 0.01 * (1 - state.crouch);
  }
  pose();
  return {
    root, body, legs, winGlow, doorGlow, glowMat, state, smoke,
    /** world-space y of the door sill (for the camera when entering) */
    sill: () => body.position.y + 0.25,
    update(dt) {
      state.t += dt;
      // a hen in the cold: now and then one foot scratches the ground (only when standing and idle)
      if (state.walk < 0.01 && state.crouch < 0.1) { state.scratchT = (state.scratchT || 4) - dt; if (state.scratchT < 0) { state.scratchT = 6 + Math.random() * 7; state.scratchLeg = Math.random() < 0.5 ? 0 : 1; state.scratchGo = 1.4; } }
      if (state.scratchGo > 0) { state.scratchGo -= dt; state.scratch = Math.max(0, Math.sin((1.4 - state.scratchGo) / 1.4 * Math.PI)) * 0.55; } else state.scratch = 0;
      pose();
      smoke.forEach(s => { s.userData.t = (s.userData.t + dt * 0.12) % 1; const k = s.userData.t; s.position.set(-1.1 + Math.sin(k * 6 + state.t * 0.3) * 0.4 * k, top + 2.5 + k * 6, -0.9 - k * 1.5); s.scale.setScalar(0.8 + k * 3.2); s.material.opacity = Math.sin(k * Math.PI) * 0.22; });
    },
  };
}

/* ======================================================================================  BABA YAGA IN HER MORTAR */
export function makeYaga() {
  const g = new Group(), crone = new Group(); g.add(crone);
  const wood = M(0x5b4128), band = M(0x2b241e, { metalness: 0.4, roughness: 0.6 });
  mesh(new CylinderGeometry(0.72, 0.5, 1.15, 12, 1, true), M(0x5b4128, { side: DoubleSide }), 0, 0.58, 0, g);
  mesh(new CylinderGeometry(0.5, 0.5, 0.06, 12), M(0x1c140d), 0, 0.03, 0, g);
  for (const y of [0.25, 0.95]) { const t = mesh(new TorusGeometry(y > 0.5 ? 0.69 : 0.56, 0.04, 5, 16), band, 0, y, 0, g); t.rotation.x = Math.PI / 2; }
  mesh(new CylinderGeometry(0.62, 0.62, 0.12, 12), M(0x15100b), 0, 1.06, 0, g);
  // the crone: hunched, in a dark sarafan and a red headscarf, long nose, iron-grey hair, bony arms
  const robe = M(0x2c2a24), scarf = M(0x9a2a22), skinM = M(0x9fa08a, { roughness: 0.8 }), hair = M(0x9a968a);
  const torso = mesh(new CylinderGeometry(0.28, 0.46, 1.1, 8), robe, 0, 1.3, -0.05, crone); torso.rotation.x = 0.35;
  const head = new Group(); head.position.set(0, 1.95, 0.22); crone.add(head);
  mesh(new SphereGeometry(0.24, 10, 8), skinM, 0, 0, 0, head);
  const nose = mesh(new ConeGeometry(0.06, 0.42, 5), skinM, 0, -0.04, 0.33, head); nose.rotation.x = Math.PI / 2 + 0.35;
  mesh(new SphereGeometry(0.09, 6, 5), skinM, 0, -0.19, 0.16, head);   // chin
  for (const s of [-1, 1]) { mesh(new SphereGeometry(0.035, 6, 5), new MeshBasicMaterial({ color: 0xffc34a }), s * 0.085, 0.04, 0.2, head); }
  const sc = mesh(new SphereGeometry(0.29, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), scarf, 0, 0.04, -0.03, head); sc.rotation.x = -0.25;
  mesh(new ConeGeometry(0.14, 0.4, 5), scarf, 0, -0.18, -0.25, head).rotation.x = -2.6;
  for (let i = 0; i < 7; i++) { const h = mesh(new ConeGeometry(0.04, 0.55, 4), hair, (i - 3) * 0.07, -0.25, 0.05 - Math.abs(i - 3) * 0.02, head); h.rotation.set(Math.PI + 0.2, 0, (i - 3) * 0.12); }
  for (const s of [-1, 1]) { const tooth = mesh(new BoxGeometry(0.025, 0.05, 0.02), M(0x8a8f96, { metalness: 0.8, roughness: 0.3 }), s * 0.04, -0.13, 0.21, head); tooth.visible = true; }   // iron teeth
  // arms holding the pestle (oar-like); the broom is tied behind the mortar
  const arm = new Group(); arm.position.set(0.2, 1.62, 0.1); crone.add(arm);
  mesh(new CylinderGeometry(0.06, 0.05, 0.7, 6), robe, 0.12, -0.3, 0.12, arm).rotation.z = -0.4;
  const pestle = new Group(); pestle.position.set(0.32, -0.55, 0.25); arm.add(pestle);
  mesh(new CylinderGeometry(0.05, 0.05, 2.6, 6), wood, 0, -0.3, 0, pestle);
  mesh(new SphereGeometry(0.16, 8, 6), wood, 0, -1.6, 0, pestle);
  mesh(new SphereGeometry(0.06, 6, 5), skinM, 0, 0, 0, pestle);
  const broom = new Group(); broom.position.set(0, 0.55, -0.62); g.add(broom);
  mesh(new CylinderGeometry(0.035, 0.035, 2.2, 5), wood, 0, -0.4, -0.5, broom).rotation.x = 0.9;
  const bristles = mesh(new ConeGeometry(0.32, 1.0, 7, 1, true), M(0x8a7448, { side: DoubleSide }), 0, -1.15, -1.25, broom); bristles.rotation.x = 0.9 + Math.PI;
  const glow = glowSprite("255,200,120", 1.0); glow.position.set(0, 1.95, 0.5); glow.material.opacity = 0.0; crone.add(glow);
  let t = 0;
  return {
    group: g, head, arm, pestle, broom, glow,
    /** row: 0 = still, 1 = rowing hard with the pestle; talk: 0..1 (nods) */
    update(dt, { row = 0, talk = 0, look = null } = {}) {
      t += dt;
      arm.rotation.x = Math.sin(t * 3.2) * 0.6 * row - 0.2; pestle.rotation.x = Math.sin(t * 3.2 + 0.6) * 0.5 * row + 0.2;
      broom.rotation.y = Math.sin(t * 5) * 0.35 * Math.max(0.2, row);
      head.rotation.x = Math.sin(t * 9) * 0.06 * talk + Math.sin(t * 0.8) * 0.04; head.rotation.y = Math.sin(t * 0.6) * 0.15;
      crone.position.y = Math.sin(t * 2) * 0.03;
    },
  };
}

/* ======================================================================================  THE THREE RIDERS */
const RIDERS = {
  white: { horse: 0xe8e8ec, rider: 0xf2f2f4, glow: "235,240,255", emi: 0x8a8f9a },
  red: { horse: 0x9a1e14, rider: 0xc22a1a, glow: "255,120,60", emi: 0x5a1004 },
  black: { horse: 0x0b0b0d, rider: 0x0e0e10, glow: "255,60,30", emi: 0x000000 },
};
export function makeRider(kind) {
  const C = RIDERS[kind], g = new Group(), hm = M(C.horse, { emissive: C.emi, roughness: 0.6 }), rm = M(C.rider, { emissive: C.emi, roughness: 0.7 });
  const horse = new Group(); g.add(horse);
  const bodyG = new CapsuleGeometry(0.48, 1.4, 4, 10); bodyG.rotateX(Math.PI / 2); mesh(bodyG, hm, 0, 1.55, 0, horse);
  const neck = mesh(new CylinderGeometry(0.22, 0.36, 1.1, 8), hm, 0, 2.1, 0.95, horse); neck.rotation.x = 0.75;
  const headG = new BoxGeometry(0.3, 0.32, 0.75); const hd = mesh(headG, hm, 0, 2.5, 1.45, horse); hd.rotation.x = 0.55;
  for (const s of [-1, 1]) mesh(new ConeGeometry(0.06, 0.2, 4), hm, s * 0.1, 2.78, 1.25, horse);
  const mane = mesh(new BoxGeometry(0.08, 0.9, 0.18), rm, 0, 2.3, 0.82, horse); mane.rotation.x = 0.75;
  const tail = new Group(); tail.position.set(0, 1.75, -1.05); horse.add(tail); mesh(new ConeGeometry(0.16, 1.1, 5), rm, 0, -0.5, -0.1, tail).rotation.x = Math.PI - 0.3;
  const legs = [];
  for (const [x, z] of [[-0.28, 0.75], [0.28, 0.75], [-0.28, -0.7], [0.28, -0.7]]) {
    const p = new Group(); p.position.set(x, 1.35, z); horse.add(p);
    mesh(new CylinderGeometry(0.11, 0.08, 1.3, 6), hm, 0, -0.65, 0, p); mesh(new CylinderGeometry(0.1, 0.12, 0.1, 6), M(0x111111), 0, -1.3, 0, p);
    legs.push(p);
  }
  // the rider, wrapped in a cloak of his colour
  const rider = new Group(); rider.position.set(0, 2.1, -0.05); horse.add(rider);
  mesh(new CylinderGeometry(0.2, 0.5, 1.15, 8), rm, 0, 0.45, 0, rider);
  mesh(new SphereGeometry(0.19, 8, 6), rm, 0, 1.2, 0.05, rider);
  mesh(new ConeGeometry(0.24, 0.42, 8), rm, 0, 1.45, 0, rider);
  const cloak = mesh(new ConeGeometry(0.62, 1.4, 8, 1, true), M(C.rider, { emissive: C.emi, side: DoubleSide }), 0, 0.5, -0.2, rider); cloak.rotation.x = -0.25;
  if (kind === "black") for (const s of [-1, 1]) mesh(new SphereGeometry(0.035, 5, 4), new MeshBasicMaterial({ color: 0xff3a1a }), s * 0.07, 1.22, 0.22, rider);
  const aura = glowSprite(C.glow, kind === "black" ? 3 : 6); aura.position.y = 1.9; aura.material.opacity = kind === "black" ? 0.15 : 0.35; g.add(aura);
  let t = 0;
  return {
    group: g, kind,
    update(dt, speed = 1) {
      t += dt * 9 * speed;
      const k = speed;   // gallop: diagonal pairs, the body pitches
      legs.forEach((p, i) => { p.rotation.x = Math.sin(t + (i === 0 || i === 3 ? 0 : Math.PI) + (i > 1 ? 0.6 : 0)) * 0.75 * k; });
      horse.position.y = Math.abs(Math.sin(t)) * 0.18 * k; horse.rotation.x = Math.sin(t) * 0.07 * k; tail.rotation.x = 0.4 * k + Math.sin(t * 0.5) * 0.2;
      cloak.rotation.x = -0.25 - 0.45 * k + Math.sin(t * 1.3) * 0.08;
      aura.material.opacity = (kind === "black" ? 0.15 : 0.32) * (0.8 + 0.2 * Math.sin(t * 0.7));
    },
  };
}

/* ======================================================================================  THE THREE PAIRS OF HANDS */
export function makeHands() {
  const mat = new MeshStandardMaterial({ color: 0xe6dccd, emissive: 0x6a5f50, roughness: 0.5, transparent: true, opacity: 0 });
  const hands = [];
  for (let i = 0; i < 6; i++) {
    const h = new Group(), side = i % 2 ? 1 : -1;
    mesh(new BoxGeometry(0.2, 0.06, 0.24), mat, 0, 0, 0, h);
    for (let f = 0; f < 4; f++) { const fg = mesh(new CylinderGeometry(0.025, 0.02, 0.2, 5), mat, -0.075 + f * 0.05, 0, 0.21, h); fg.rotation.x = Math.PI / 2 + 0.35; }
    const th = mesh(new CylinderGeometry(0.027, 0.022, 0.16, 5), mat, side * 0.12, 0, 0.08, h); th.rotation.set(Math.PI / 2, 0, side * 0.8);
    mesh(new CylinderGeometry(0.07, 0.05, 0.28, 6), mat, 0, 0, -0.24, h).rotation.x = Math.PI / 2;   // wrist, fading into nothing
    const trail = glowSprite("255,240,220", 0.9); trail.material.opacity = 0; h.add(trail);
    h.visible = false; hands.push({ g: h, trail, side });
  }
  return { hands, mat };
}

/* ======================================================================================  THE CAT ON THE STOVE */
export function makeCat() {
  const g = new Group(), fur = M(0x141416, { roughness: 1 });
  const bodyG = new SphereGeometry(0.22, 9, 7); bodyG.scale(1, 0.9, 1.5); mesh(bodyG, fur, 0, 0.2, 0, g);
  const head = new Group(); head.position.set(0, 0.42, 0.26); g.add(head);
  mesh(new SphereGeometry(0.14, 9, 7), fur, 0, 0, 0, head);
  for (const s of [-1, 1]) { mesh(new ConeGeometry(0.06, 0.12, 4), fur, s * 0.08, 0.13, -0.01, head); }
  const eyeM = new MeshBasicMaterial({ color: 0xe8c23a }), eyes = [];
  for (const s of [-1, 1]) { const e = mesh(new SphereGeometry(0.026, 6, 5), eyeM, s * 0.055, 0.02, 0.12, head); e.scale.set(1, 1, 0.5); eyes.push(e); }
  const tc = new CatmullRomCurve3([new Vector3(0, 0.12, -0.3), new Vector3(0.15, 0.1, -0.5), new Vector3(0.3, 0.2, -0.45), new Vector3(0.35, 0.35, -0.3)]);
  const tail = mesh(new TubeGeometry(tc, 10, 0.035, 5), fur, 0, 0, 0, g);
  let t = 0, blink = 3;
  return {
    group: g, head,
    update(dt, { purr = 0 } = {}) {
      t += dt; tail.rotation.y = Math.sin(t * 1.3) * 0.35; head.rotation.y = Math.sin(t * 0.4) * 0.4; head.rotation.x = Math.sin(t * 0.6) * 0.08 - purr * 0.15;
      blink -= dt; const closed = blink < 0.12; eyes.forEach(e => { e.scale.y = closed ? 0.1 : 1; }); if (blink < 0) blink = 2 + Math.random() * 4;
    },
  };
}

/* ======================================================================================  THE SKULL LANTERN (held) */
export function makeSkull(scale = 1) {
  const g = new Group(), bone = M(0xd9cdb0, { roughness: 0.6 });
  const cr = new SphereGeometry(0.26 * scale, 12, 9); cr.scale(1, 1.05, 1.15); mesh(cr, bone, 0, 0, 0, g);
  const jaw = new BoxGeometry(0.3 * scale, 0.14 * scale, 0.26 * scale); mesh(jaw, bone, 0, -0.22 * scale, 0.07 * scale, g);
  const sock = M(0x080604), eyes = [];
  for (const s of [-1, 1]) { mesh(new SphereGeometry(0.075 * scale, 7, 6), sock, s * 0.095 * scale, 0.0, 0.22 * scale, g); const e = mesh(new SphereGeometry(0.05 * scale, 7, 6), new MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0 }), s * 0.095 * scale, 0, 0.255 * scale, g); eyes.push(e); }
  mesh(new ConeGeometry(0.04 * scale, 0.09 * scale, 3), sock, 0, -0.1 * scale, 0.27 * scale, g).rotation.x = Math.PI;
  return { group: g, eyes };
}
export function makeSkullLantern() {
  const g = new Group(), sk = makeSkull(0.42);
  mesh(new CylinderGeometry(0.018, 0.022, 0.9, 5), M(0x4a3420), 0, -0.45, 0, g);
  sk.group.position.y = 0.08; g.add(sk.group); sk.eyes.forEach(e => { e.material.opacity = 1; });
  const glows = [-1, 1].map(s => { const gl = glowSprite("255,170,60", 0.18); gl.position.set(s * 0.04, 0.08, 0.13); g.add(gl); return gl; });
  const light = new PointLight(0xffa040, 0, 30, 1.3); light.position.set(-0.1, 0.35, -0.9); g.add(light);   // in front of the skull, so that it lights the path and not its own face
  return { group: g, light, glows };
}
