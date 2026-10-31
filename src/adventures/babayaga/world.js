// Baba Yaga's forest: golden birches and dark spruces, a forest path, the clearing with the fence of bones and skulls, the
// yard (well, barrel, broom, heaps of leaves) and the inside of the hut. Procedural, no asset files.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, PlaneGeometry,
  TorusGeometry, Float32BufferAttribute, InstancedMesh, Object3D, Color, PointLight, DoubleSide, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, fbm, smooth as sm, lerp, glowSprite } from "../../shared/world.js";
import { M, makeSkull } from "./models.js";

export const SITES = {
  edge: [0, 90], gate: [0, 13.2], hut: [0, 0], well: [-7.5, 5.5], barrel: [3.6, 4.4], broom: [4.7, 4.1], door: [0, 4.4],
  pile1: [-5, 9.5], pile2: [7.2, 8.6], pile3: [-9.2, -3], land: [6.5, -5],
};
export const FENCE_R = 13, CLEAR_R = 21, LANES = [70, 42, 20];
export const INT = new Vector3(300, 0, 0);                  // the inside of the hut is built far away and reached by a fade
export const ROOM = { x0: -2.9, x1: 2.9, z0: -2.4, z1: 2.4 };
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export const pathDist = (x, z) => segD(x, z, 0, 120, 0, 10);
const laneDist = (x, z) => Math.min(...LANES.map(l => Math.abs(z - l)));

export function H(x, z) {
  if (Math.abs(x - INT.x) < 20 && Math.abs(z - INT.z) < 20) return 0;
  let h = 2.2 * fbm(x * 0.02 + 5, z * 0.02 + 9, 3) + 0.6 * fbm(x * 0.09, z * 0.09, 2) - 1.4;
  const cd = Math.hypot(x, z); h = lerp(h, 0.02 * fbm(x * 0.3, z * 0.3, 2), sm(CLEAR_R + 8, CLEAR_R - 4, cd));
  h = lerp(h, h * 0.4, sm(4, 1, pathDist(x, z)));
  return h;
}

const VC = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const colorize = (g, c) => { g = g.index ? g.toNonIndexed() : g; const col = new Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; } g.setAttribute("color", new Float32BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute("uv"); return g; };

export function buildForest(scene, col, onProgress = () => {}) {
  const W = { root: new Group(), piles: {}, detail: [] }, r = rng(1855), o = new Object3D();
  scene.add(W.root);
  onProgress(0.05, "Growing the birches…");
  /* ---- terrain ---- */
  const S = 260, N = 170, g = new PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2); g.translate(0, 0, 20);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); p.setY(i, H(x, z));
    const n = fbm(x * 0.12, z * 0.12, 2), cd = Math.hypot(x, z), pd = pathDist(x, z);
    c.setRGB(0.16 + n * 0.12, 0.11 + n * 0.06, 0.04);                                                  // leaf litter, gold and brown
    c.lerp(new Color(0.07, 0.1, 0.05), sm(0.45, 0.75, fbm(x * 0.05 + 3, z * 0.05, 2)) * 0.6);        // mossy patches
    if (pd < 2.4 && z > 10) c.lerp(new Color(0.18, 0.13, 0.08), sm(2.4, 0.9, pd) * 0.85);
    if (laneDist(x, z) < 1.6 && Math.abs(x) < 80) c.lerp(new Color(0.15, 0.11, 0.07), 0.6);
    if (cd < FENCE_R + 1) c.lerp(new Color(0.12, 0.09, 0.06).multiplyScalar(0.8 + n * 0.5), sm(FENCE_R + 1, FENCE_R - 2, cd) * 0.9);   // the trampled yard
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  W.ground = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: DoubleSide })); W.root.add(W.ground);
  onProgress(0.2, "Growing the birches…");

  /* ---- trees: golden birches near the clearing, dark spruces deeper in ---- */
  const free = (x, z) => Math.hypot(x, z) > CLEAR_R + 1 && pathDist(x, z) > 3.2 && (laneDist(x, z) > 2.4 || Math.abs(x) > 80) && Math.hypot(x, z - 20) < 125;
  const birch = [], spruce = [];
  for (let i = 0; i < 4000 && birch.length + spruce.length < 900; i++) {
    const x = (r() - 0.5) * 240, z = (r() - 0.5) * 240 + 20; if (!free(x, z)) continue;
    const d = Math.hypot(x, z), b = r() < lerp(0.75, 0.3, sm(30, 90, d)); (b ? birch : spruce).push([x, z, 0.8 + r() * 0.5, r() * 6.28]);
  }
  // a ring of birches round the clearing, like a wall
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.28 + r() * 0.05, d = CLEAR_R + 1.5 + r() * 3, x = Math.sin(a) * d, z = Math.cos(a) * d; if (pathDist(x, z) > 3.2 && laneDist(x, z) > 2.4) birch.push([x, z, 0.9 + r() * 0.4, r() * 6.28]); }
  { // birch trunks: white bark with black marks (vertex colours along the height)
    const tg = new CylinderGeometry(0.13, 0.2, 10, 7, 12).translate(0, 5, 0), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), a = Math.atan2(tp.getZ(i), tp.getX(i)), mark = Math.sin(y * 3.1 + Math.sin(a * 3) * 1.4) > 0.72 || (y < 1.2 && Math.sin(a * 5 + y * 4) > 0.2); const v = mark ? 0.12 : 0.86 + 0.08 * Math.sin(y * 7); tc[i * 3] = v; tc[i * 3 + 1] = v * 0.98; tc[i * 3 + 2] = v * 0.94; }
    tg.setAttribute("color", new Float32BufferAttribute(tc, 3));
    const im = new InstancedMesh(tg, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), birch.length);
    birch.forEach(([x, z, s, rot], i) => { o.position.set(x, H(x, z) - 0.2, z); o.rotation.set((r() - 0.5) * 0.08, rot, (r() - 0.5) * 0.08); o.scale.set(s, s * (0.85 + r() * 0.35), s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); col.circle(x, z, 0.3 * s); });
    W.root.add(im);
    // crowns: clusters of golden leaves (autumn), a little green left in some
    const lg = new IcosahedronGeometry(1, 1), cn = birch.length * 4, lm = new InstancedMesh(lg, new MeshStandardMaterial({ roughness: 0.85, flatShading: true }), cn);
    let k = 0; const gold = [new Color(0xd9a021), new Color(0xc9861a), new Color(0xe8c04a), new Color(0x8a9a2a)];
    for (const [x, z, s] of birch) for (let j = 0; j < 4; j++) { const hh = H(x, z) + (6 + j * 1.4 + r() * 1.2) * s; o.position.set(x + (r() - 0.5) * 2.4 * s, hh, z + (r() - 0.5) * 2.4 * s); o.rotation.set(r(), r(), r()); o.scale.setScalar((1.1 + r() * 0.9) * s * (1 - j * 0.12)); o.updateMatrix(); lm.setMatrixAt(k, o.matrix); lm.setColorAt(k, gold[(r() * 4) | 0].clone().multiplyScalar(0.75 + r() * 0.35)); k++; }
    W.root.add(lm);
  }
  { // spruces: stacked cones
    const parts = []; for (let i = 0; i < 5; i++) { const cg = new ConeGeometry(2.4 - i * 0.42, 3.2, 8); cg.translate(0, 2.4 + i * 2.1, 0); parts.push(cg); }
    const trunk = new CylinderGeometry(0.15, 0.25, 3, 6).translate(0, 1.2, 0); parts.push(trunk);
    parts.forEach((pg, i) => colorize(pg, i < 5 ? 0x1c3324 : 0x3a2a1c));
    const sg = mergeGeometries(parts.map(pg => pg.index ? pg.toNonIndexed() : pg));
    const im = new InstancedMesh(sg, VC, spruce.length);
    spruce.forEach(([x, z, s, rot], i) => { o.position.set(x, H(x, z) - 0.2, z); o.rotation.set(0, rot, 0); o.scale.set(s, s * (1 + r() * 0.5), s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); col.circle(x, z, 0.5 * s); });
    W.root.add(im);
  }
  { // tufts of dry grass and bracken on the forest floor
    const tg = new ConeGeometry(0.22, 0.55, 4, 1, true), tm = new InstancedMesh(tg, new MeshStandardMaterial({ roughness: 1, flatShading: true, side: DoubleSide }), 1400), tints = [new Color(0x8a7a2a), new Color(0x6a6a26), new Color(0xa0782a), new Color(0x4a5a22)];
    let k = 0; for (let i = 0; i < 6000 && k < 1400; i++) { const x = (r() - 0.5) * 220, z = (r() - 0.5) * 220 + 20; if (Math.hypot(x, z) < FENCE_R + 0.5 || pathDist(x, z) < 1.3) continue; o.position.set(x, H(x, z) + 0.2, z); o.rotation.set((r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4); o.scale.set(1 + r(), 0.6 + r() * 0.9, 1 + r()); o.updateMatrix(); tm.setMatrixAt(k, o.matrix); tm.setColorAt(k, tints[(r() * 4) | 0].clone().multiplyScalar(0.7 + r() * 0.5)); k++; }
    tm.count = k; W.root.add(tm); W.detail.push(tm);
  }
  { // fly agarics and stones
    const caps = new InstancedMesh(new SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb5231a, { roughness: 0.6 }), 40), stems = new InstancedMesh(new CylinderGeometry(0.04, 0.05, 0.2, 5), M(0xe8e0cc), 40);
    for (let i = 0; i < 40; i++) { let x, z; do { const a = r() * 6.28, d = FENCE_R + 2 + r() * 14; x = Math.sin(a) * d; z = Math.cos(a) * d; } while (pathDist(x, z) < 2.5); const y = H(x, z); o.position.set(x, y + 0.18, z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + r() * 0.8); o.updateMatrix(); caps.setMatrixAt(i, o.matrix); o.position.y = y + 0.08; o.updateMatrix(); stems.setMatrixAt(i, o.matrix); }
    W.root.add(caps, stems); W.detail.push(caps, stems);
  }
  onProgress(0.5, "Setting up the fence…");

  /* ---- the fence of bones, the skulls and their eyes ---- */
  const bones = [], skullPos = [];
  const gateA = 0.13, isGate = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < gateA;   // the gate faces +z (angle 0)
  const nPost = 44;
  for (let i = 0; i < nPost; i++) {
    const a = i / nPost * Math.PI * 2; if (isGate(a)) continue;
    const x = Math.sin(a) * FENCE_R, z = Math.cos(a) * FENCE_R, h = 2.3 + (i % 3) * 0.15;
    const post = new CylinderGeometry(0.09, 0.12, h, 6); post.translate(x, h / 2, z); bones.push(colorize(post, 0xd8ccb0));
    for (const b of [-1, 1]) { const knob = new SphereGeometry(0.14, 6, 5); knob.translate(x, b < 0 ? 0.15 : h - 0.05, z); bones.push(colorize(knob, 0xcfc2a4)); }
    skullPos.push([x, h + 0.25, z, a]);
    col.circle(x, z, 0.25);
    // rails of long bones to the next post
    const a2 = (i + 1) / nPost * Math.PI * 2; if (isGate(a2)) continue;
    const x2 = Math.sin(a2) * FENCE_R, z2 = Math.cos(a2) * FENCE_R, len = Math.hypot(x2 - x, z2 - z);
    for (const y of [0.7, 1.5]) { const rl = new CylinderGeometry(0.05, 0.05, len, 5); rl.rotateZ(Math.PI / 2); rl.rotateY(-Math.atan2(z2 - z, x2 - x)); rl.translate((x + x2) / 2, y + (r() - 0.5) * 0.1, (z + z2) / 2); bones.push(colorize(rl, 0xc9bc9c)); }
    for (let k = 1; k < 4; k++) { const t = k / 4; col.circle(lerp(x, x2, t), lerp(z, z2, t), 0.25); }
  }
  // the gate: two taller posts and a lintel of bones
  for (const s of [-1, 1]) { const a = s * gateA, x = Math.sin(a) * FENCE_R, z = Math.cos(a) * FENCE_R, gp = new CylinderGeometry(0.14, 0.18, 3.4, 6); gp.translate(x, 1.7, z); bones.push(colorize(gp, 0xd8ccb0)); skullPos.push([x, 3.65, z, a]); col.circle(x, z, 0.3); }
  { const lt = new CylinderGeometry(0.08, 0.08, 3.6, 5); lt.rotateZ(Math.PI / 2); lt.translate(0, 3.15, FENCE_R); bones.push(colorize(lt, 0xc9bc9c)); }
  W.root.add(new Mesh(mergeGeometries(bones), VC));
  // skulls: one instanced mesh for the bone, sprites for the glowing eyes
  const sk = makeSkull(1), skGeo = mergeGeometries(sk.group.children.filter(m => m.material.color && m.material.color.getHex() === 0xd9cdb0).map(m => { const gg = m.geometry.clone(); gg.translate(m.position.x, m.position.y, m.position.z); return gg.index ? gg.toNonIndexed() : gg; }));
  const skIM = new InstancedMesh(skGeo, M(0xd9cdb0, { roughness: 0.6 }), skullPos.length), sockIM = new InstancedMesh(new SphereGeometry(0.075, 7, 6), new MeshStandardMaterial({ color: 0x080604, emissive: 0xffa030, emissiveIntensity: 0 }), skullPos.length * 2);
  W.eyes = []; W.eyeSockets = sockIM;
  skullPos.forEach(([x, y, z, a], i) => {
    const face = Math.atan2(-x, -z) + (r() - 0.5) * 0.5 + (i % 4 === 0 ? Math.PI : 0) * 0.2;   // they look into the yard, more or less
    o.position.set(x, y, z); o.rotation.set((r() - 0.5) * 0.3, face, (r() - 0.5) * 0.2); o.scale.setScalar(1); o.updateMatrix(); skIM.setMatrixAt(i, o.matrix);
    for (const s of [-1, 1]) {
      const v = new Vector3(s * 0.095, 0, 0.22).applyEuler(o.rotation).add(o.position);
      const so = new Object3D(); so.position.copy(v); so.updateMatrix(); sockIM.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), so.matrix);
      const e = glowSprite("255,175,60", 0.55); e.position.copy(new Vector3(s * 0.095, 0, 0.3).applyEuler(o.rotation).add(o.position)); e.material.opacity = 0; W.root.add(e); W.eyes.push(e);
    }
  });
  W.root.add(skIM, sockIM);
  W.fenceLight = new PointLight(0xffa040, 0, 34, 1.4); W.fenceLight.position.set(0, 4, 2); W.root.add(W.fenceLight);
  onProgress(0.65, "Drawing the well…");

  /* ---- the yard ---- */
  const at = (k, dy = 0) => { const [x, z] = SITES[k]; return new Vector3(x, H(x, z) + dy, z); };
  { // the well
    const w = at("well"), grp = new Group(); grp.position.copy(w); W.root.add(grp);
    const ring = new Mesh(new CylinderGeometry(0.95, 1.05, 0.9, 12, 1, true), M(0x6d665e, { side: DoubleSide })); ring.position.y = 0.45; grp.add(ring);
    const water = new Mesh(new CylinderGeometry(0.88, 0.88, 0.05, 12), M(0x0a1418, { metalness: 0.4, roughness: 0.2 })); water.position.y = 0.3; grp.add(water);
    for (const s of [-1, 1]) { const pst = new Mesh(new BoxGeometry(0.14, 2.1, 0.14), M(0x4a3320)); pst.position.set(s * 1.0, 1.05, 0); grp.add(pst); }
    const roof = new Mesh(new ConeGeometry(1.4, 0.9, 4), M(0x3d3a2c)); roof.position.y = 2.45; roof.rotation.y = Math.PI / 4; grp.add(roof);
    const axle = new Mesh(new CylinderGeometry(0.08, 0.08, 2.0, 6), M(0x4a3320)); axle.rotation.z = Math.PI / 2; axle.position.y = 1.7; grp.add(axle);
    const bucket = new Mesh(new CylinderGeometry(0.17, 0.13, 0.3, 8), M(0x6b4a2e)); bucket.position.set(0.3, 1.0, 0); grp.add(bucket); W.wellBucket = bucket;
    col.circle(w.x, w.z, 1.15);
  }
  { // the barrel by the porch
    const b = at("barrel"), grp = new Group(); grp.position.copy(b); W.root.add(grp);
    grp.add(new Mesh(new CylinderGeometry(0.45, 0.4, 1.0, 10), M(0x5b4128))); grp.children[0].position.y = 0.5;
    for (const y of [0.2, 0.8]) { const t = new Mesh(new TorusGeometry(0.44, 0.03, 4, 14), M(0x2b241e)); t.rotation.x = Math.PI / 2; t.position.y = y; grp.add(t); }
    W.barrelWater = new Mesh(new CylinderGeometry(0.4, 0.4, 0.02, 10), M(0x0f1d22, { metalness: 0.5, roughness: 0.15 })); W.barrelWater.position.y = 0.95; W.barrelWater.visible = false; grp.add(W.barrelWater);
    col.circle(b.x, b.z, 0.55);
  }
  { // the broom
    const b = at("broom"), grp = new Group(); grp.position.copy(b); grp.rotation.z = 0.25; W.root.add(grp);
    const st = new Mesh(new CylinderGeometry(0.03, 0.03, 1.6, 5), M(0x5b4128)); st.position.y = 1.0; grp.add(st);
    const br = new Mesh(new ConeGeometry(0.22, 0.7, 7), M(0x8a7448)); br.position.y = 0.3; br.rotation.x = Math.PI; grp.add(br);
    W.broom = grp;
  }
  for (const k of ["pile1", "pile2", "pile3"]) { // heaps of leaves, feathers and little bones
    const v = at(k), grp = new Group(); grp.position.copy(v); W.root.add(grp);
    for (let i = 0; i < 9; i++) { const l = new Mesh(new IcosahedronGeometry(0.35 + r() * 0.25, 0), M([0xb07a22, 0x8a5a1c, 0x6a4a1a][i % 3])); l.position.set((r() - 0.5) * 1.1, 0.12 + r() * 0.15, (r() - 0.5) * 1.1); l.scale.y = 0.4; grp.add(l); }
    for (let i = 0; i < 3; i++) { const b = new Mesh(new CylinderGeometry(0.02, 0.02, 0.4, 4), M(0xd8ccb0)); b.position.set((r() - 0.5) * 0.8, 0.3, (r() - 0.5) * 0.8); b.rotation.set(1.3, r() * 3, 0); grp.add(b); }
    W.piles[k] = grp;
  }
  // the village far behind the forest edge (the warm windows you came from)
  for (let i = 0; i < 6; i++) { const s = glowSprite("255,180,110", 5 + r() * 4); s.position.set(-40 + i * 16 + r() * 6, 3 + r() * 2, 150); s.material.opacity = 0.25; W.root.add(s); }
  onProgress(0.8, "Lighting the stove…");

  /* ---- inside the hut ---- */
  {
    const I = new Group(); I.position.copy(INT); W.root.add(I); W.interior = I;
    const logs = [], lr = 0.17;
    for (let i = 0; i < 11; i++) {   // up to the ceiling: no gap for the sky to show through
      const y = 0.17 + i * lr * 1.9;
      for (const s of [-1, 1]) { const a = new CylinderGeometry(lr, lr, 6.4, 7); a.rotateZ(Math.PI / 2); a.translate(0, y, s * 2.6); logs.push(colorize(a, i % 2 ? 0x6b4a2e : 0x5e3f25)); const b = new CylinderGeometry(lr, lr, 5.6, 7); b.rotateX(Math.PI / 2); b.translate(s * 3.1, y, 0); logs.push(colorize(b, i % 2 ? 0x5e3f25 : 0x6b4a2e)); }
    }
    for (let i = -2; i <= 2; i++) { const bm = new BoxGeometry(6.4, 0.2, 0.22); bm.translate(0, 3.32, i * 1.1); logs.push(colorize(bm, 0x3a2a1a)); }
    { const fl = new BoxGeometry(6.4, 0.1, 5.4); fl.translate(0, -0.05, 0); logs.push(colorize(fl, 0x4a3420)); const cl = new BoxGeometry(6.6, 0.16, 5.6); cl.translate(0, 3.5, 0); logs.push(colorize(cl, 0x2e2015)); }
    // the stove: big, white, with a dark arched mouth and a bench on top
    { const st = new BoxGeometry(1.9, 1.9, 1.7); st.translate(-2.0, 0.95, -1.5); logs.push(colorize(st, 0xd8d0c0)); const tp = new BoxGeometry(2.0, 0.15, 1.8); tp.translate(-2.0, 1.95, -1.5); logs.push(colorize(tp, 0xc8c0b0)); const ch = new BoxGeometry(0.7, 1.2, 0.7); ch.translate(-2.4, 2.6, -1.9); logs.push(colorize(ch, 0xd8d0c0)); }
    { const t = new BoxGeometry(1.6, 0.1, 1.0); t.translate(1.3, 0.85, -0.7); logs.push(colorize(t, 0x6b4a2e)); for (const [x, z] of [[0.6, -1.1], [2.0, -1.1], [0.6, -0.3], [2.0, -0.3]]) { const l = new BoxGeometry(0.1, 0.85, 0.1); l.translate(x, 0.42, z); logs.push(colorize(l, 0x4a3320)); } const b = new BoxGeometry(2.4, 0.1, 0.4); b.translate(1.3, 0.45, -1.9); logs.push(colorize(b, 0x5e3f25)); }
    { const sh = new BoxGeometry(1.8, 0.06, 0.35); sh.translate(1.6, 2.1, -2.3); logs.push(colorize(sh, 0x4a3320)); }
    { const dr = new BoxGeometry(1.1, 1.9, 0.1); dr.translate(0, 0.95, 2.55); logs.push(colorize(dr, 0x2e2015)); }
    I.add(new Mesh(mergeGeometries(logs), VC));
    // jars on the shelf, herbs from the beams, a spinning wheel, sacks
    for (let i = 0; i < 6; i++) { const j = new Mesh(new CylinderGeometry(0.08 + r() * 0.05, 0.09, 0.18 + r() * 0.15, 7), M([0x3a5a4a, 0x6a4a2a, 0x8a8a6a][i % 3], { roughness: 0.3 })); j.position.set(0.9 + i * 0.26, 2.25, -2.3); I.add(j); }
    for (let i = 0; i < 9; i++) { const h = new Mesh(new ConeGeometry(0.12, 0.5, 5), M([0x4a5a2a, 0x6a5a2a, 0x3a4a2a][i % 3])); h.position.set(-1 + (i % 5) * 0.8, 2.85, -1.6 + Math.floor(i / 5) * 2.2); h.rotation.x = Math.PI; I.add(h); }
    for (let i = 0; i < 3; i++) { const sa = new Mesh(new SphereGeometry(0.35, 7, 6), M(0x8a7a5a)); sa.scale.set(1, 1.3, 1); sa.position.set(2.6, 0.4, 0.4 + i * 0.6); I.add(sa); }
    const skull = makeSkull(0.7); skull.group.position.set(2.5, 2.38, -2.3); I.add(skull.group);
    // the bowl of poppy seed on the table
    const bowl = new Mesh(new SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0x7a5232, { side: DoubleSide })); bowl.position.set(1.3, 1.2, -0.7); I.add(bowl); W.bowl = bowl;
    W.bowlFill = new Mesh(new CylinderGeometry(0.27, 0.27, 0.02, 12), M(0x2a2622)); W.bowlFill.position.set(1.3, 1.12, -0.7); I.add(W.bowlFill);
    // the stove's fire, a candle, the window
    W.fire = glowSprite("255,140,40", 1.4); W.fire.position.set(-2.0, 0.6, -0.6); W.fire.material.opacity = 0; I.add(W.fire);
    const mouth = new Mesh(new PlaneGeometry(0.8, 0.7), new MeshBasicMaterial({ color: 0x0a0604 })); mouth.position.set(-2.0, 0.6, -0.64); I.add(mouth); W.mouth = mouth;
    W.stoveLight = new PointLight(0xff8a30, 0, 8, 1.5); W.stoveLight.position.set(-2.0, 0.8, -0.2); I.add(W.stoveLight);
    W.candle = new PointLight(0xffc070, 2.2, 9, 1.4); W.candle.position.set(1.0, 1.4, -0.9); I.add(W.candle);
    const cflame = glowSprite("255,200,120", 0.35); cflame.position.set(1.0, 1.15, -0.9); I.add(cflame);
    const cnd = new Mesh(new CylinderGeometry(0.04, 0.04, 0.2, 6), M(0xe8e0c8)); cnd.position.set(1.0, 1.0, -0.9); I.add(cnd);
    W.windowMat = new MeshBasicMaterial({ color: 0x223040 }); const win = new Mesh(new PlaneGeometry(0.8, 0.7), W.windowMat); win.position.set(3.05, 1.7, 0.2); win.rotation.y = -Math.PI / 2; I.add(win);
    W.catSpot = new Vector3(INT.x - 1.6, 2.02, INT.z - 1.3);
    // the room's colliders (relative to the room)
    col.box(INT.x - 3.0, INT.z - 2.45, INT.x - 1.0, INT.z - 0.6);       // stove
    col.box(INT.x + 0.45, INT.z - 1.25, INT.x + 2.15, INT.z - 0.15);    // table
    col.box(INT.x + 2.2, INT.z + 0.0, INT.x + 3.0, INT.z + 1.9);        // sacks
  }
  onProgress(1, "Done");
  return W;
}
