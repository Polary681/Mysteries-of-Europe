// The Point: a procedural Highland headland (terrain, sea, ruins, chapel, cave, pier, house with piano). No external assets.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, PlaneGeometry, SphereGeometry,
  Float32BufferAttribute, InstancedMesh, Object3D, Color, AdditiveBlending, DoubleSide, PointLight,
} from "three";
import { rng, fbm, smooth as sm, lerp, glowSprite } from "../../shared/world.js";

export const SITES = {
  car: [9, 98], board: [6.6, 90.4], pier: [-13.6, 108], village: [-22, 52], hill: [38, 8], cave: [-53.4, -8], chapel: [-8, -24],
  causeway: [0, -56], house: [0, -84], stand: [-4.5, -87.2], piano: [-5.4, -84], bench: [-3.7, -83.6], ghostSeat: [-3.9, -85.4],
};
export const HOUSE = { x0: -6.3, x1: 6.3, z0: -88.8, z1: -79.2 };
const PATHS = [
  [[9, 98], [0, 80], [-14, 62], [-22, 52], [-18, 30], [-12, 5], [-8, -24], [0, -44]],
  [[0, -68], [0, -79]], [[-12, 5], [14, 6], [38, 8]], [[-18, 30], [-40, 10], [-53, -8]], [[9, 98], [-13.6, 98], [-13.6, 111]],
];
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const pathDist = (x, z) => { let m = 99; for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) m = Math.min(m, segD(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1])); return m; };
const bump = (v, a, b, f) => sm(a, a + f, v) * (1 - sm(b - f, b, v));
const gauss = (dx, dz, s) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));
const flat = (h, x, z, cx, cz, r, ht, soft = 6) => lerp(h, ht, sm(r + soft, r, Math.hypot(x - cx, z - cz)));

export function H(x, z) {
  const nx = x / 64, nz = (z - 5) / 108, warp = (fbm(x * 0.018 + 11, z * 0.018 + 5, 3) - 0.5) * 0.34, d = Math.hypot(nx, nz) + warp, m = Math.max(0, Math.min(1, (1 - d) / 0.3));
  const cliff = sm(14, 40, x) * sm(-70, 10, z), prof = lerp(sm(0, 0.6, m), sm(0.22, 0.34, m), cliff);
  let h = -3.2 + prof * (3.4 + 3.5 * fbm(x * 0.04, z * 0.04, 3)) + m * m * 6 * (fbm(x * 0.025 + 20, z * 0.025, 3) - 0.35);
  h += 20 * gauss(x - 38, z - 8, 15) + 5 * gauss(x + 8, z + 24, 9);
  h = flat(h, x, z, 38, 8, 4, 19.5, 5); h = flat(h, x, z, 9, 98, 9, 2.5); h = flat(h, x, z, -22, 52, 13, 3.0); h = flat(h, x, z, -53, -8, 6, 2.0, 5); h = flat(h, x, z, -8, -24, 9, 5.8, 5); h = flat(h, x, z, 0, -84, 15, 3.5, 6);
  const pd = pathDist(x, z); if (pd < 5 && !(z < -44 && z > -68)) h = Math.max(h, lerp(h, 1.5 + 0.25 * fbm(x * 0.3, z * 0.3, 2), sm(5, 1.8, pd)));
  h = lerp(h, -3.0, bump(z, -66, -44, 4)); // channel across the whole neck of the Point
  const ridge = sm(2.6, 1.3, Math.abs(x)) * bump(z, -68, -42, 2.5); h = Math.max(h, ridge * 0.95);
  const pier = sm(1.4, 0.6, Math.abs(x + 13.6)) * bump(z, 93, 112, 1.5); h = Math.max(h, pier * 0.75);
  return h;
}

const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, ...o })); return mats.get(k); };
const box = (p, w, h, d, c, x, y, z, mat) => { const m = new Mesh(new BoxGeometry(w, h, d), mat || M(c)); m.position.set(x, y, z); p.add(m); return m; };

export function buildHeadland(scene, col, onProgress = () => {}) {
  const R = rng(1703), W = { seaLevel: 0, flames: [], motes: {}, keys: [], holes: [] };
  const root = new Group(); scene.add(root); W.root = root;
  onProgress(0.1, "Raising the land from the sea…");
  /* ---------- terrain ---------- */
  const SZ = 300, SEG = 150, geo = new PlaneGeometry(SZ, SZ, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = H(x, z); pos.setY(i, h);
    const sl = Math.max(Math.abs(H(x + 2, z) - h), Math.abs(H(x, z + 2) - h)) / 2, n = fbm(x * 0.1, z * 0.1, 3), n2 = fbm(x * 0.5 + 3, z * 0.5, 2);
    if (h < 0.45) c.setHex(0x9a8e72).lerp(new Color(0x6a6454), sm(0.2, -1, h)); else { c.setHex(0x5f7238).lerp(new Color(0x7e7a40), n); const hv = sm(2.2, 9, h) * sm(0.25, 0.7, fbm(x * 0.04 + 7, z * 0.04, 2)); c.lerp(new Color(0x86607a), hv * 0.85).multiplyScalar(0.85 + n2 * 0.3); }
    if (sl > 0.85) c.lerp(new Color(0x5a5a5e), Math.min(1, (sl - 0.85) * 1.6)); if (h > 14) c.lerp(new Color(0x6a6a66), sm(14, 20, h) * 0.7);
    const pd = pathDist(x, z); if (pd < 1.6 && h > 0.5 && !(z < -44 && z > -68)) c.lerp(new Color(0x7a6a50), sm(1.6, 0.6, pd) * 0.9);
    if (Math.hypot(x - 9, z - 98) < 8) c.lerp(new Color(0x6e6a64), 0.85); if (Math.abs(z + 56) < 10 && Math.abs(x) < 2.4 && h > 0.2) c.setHex(0x6c665c);
    c.multiplyScalar(1.25); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  root.add(new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));

  /* ---------- sea: animated patch around the player + flat outer plane ---------- */
  const sg = new PlaneGeometry(240, 240, 70, 70); sg.rotateX(-Math.PI / 2); const seaMat = new MeshStandardMaterial({ color: 0x15303d, roughness: 0.28, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.93 });
  W.sea = new Mesh(sg, seaMat); root.add(W.sea); W.seaBase = Float32Array.from(sg.attributes.position.array);
  W.seaFar = new Mesh(new PlaneGeometry(2000, 2000), new MeshBasicMaterial({ color: 0x15303d })); W.seaFar.rotation.x = -Math.PI / 2; W.seaFar.position.y = -0.4; root.add(W.seaFar);
  W.seaMat = seaMat;
  W.updateSea = (t, px, pz, level, amp) => {
    const gx = Math.round(px / 3.43) * 3.43, gz = Math.round(pz / 3.43) * 3.43; W.sea.position.set(gx, level, gz); W.seaFar.position.y = level - 0.5;
    const a = sg.attributes.position, b = W.seaBase; for (let i = 0; i < a.count; i++) { const wx = b[i * 3] + gx, wz = b[i * 3 + 2] + gz; a.setY(i, (Math.sin(wx * 0.11 + t * 0.9) + Math.sin(wz * 0.14 - t * 0.7) * 0.8 + Math.sin((wx + wz) * 0.07 + t * 0.5)) * amp); }
    a.needsUpdate = true; sg.computeVertexNormals();
  };

  onProgress(0.35, "Scattering stones and heather…");
  const o = new Object3D();
  { const n = 220, inst = new InstancedMesh(new IcosahedronGeometry(1, 0), M(0x6c6c70), n); let k = 0;
    for (let t = 0; t < 1800 && k < n; t++) { const x = (R() - 0.5) * 130, z = (R() - 0.5) * 220 + 5, h = H(x, z); if (h < 0.6 || pathDist(x, z) < 3.5 || Math.hypot(x - 0, z + 84) < 17 || Math.hypot(x + 8, z + 24) < 10 || Math.hypot(x + 22, z - 52) < 14) continue;
      const s = 0.4 + R() * 1.2; o.position.set(x, h + s * 0.25, z); o.scale.set(s * (1 + R() * 0.6), s * 0.7, s * (1 + R() * 0.6)); o.rotation.set(R() * 3, R() * 3, R() * 3); o.updateMatrix(); inst.setMatrixAt(k++, o.matrix); if (s > 0.9) col.circle(x, z, s * 0.8, "rock"); }
    inst.count = k; root.add(inst); }
  { const n = 700, inst = new InstancedMesh(new ConeGeometry(0.22, 0.5, 5), M(0xffffff), n); const cc = new Color(); let k = 0;
    for (let t = 0; t < 4000 && k < n; t++) { const x = (R() - 0.5) * 130, z = (R() - 0.5) * 220 + 5, h = H(x, z); if (h < 0.9 || h > 17 || pathDist(x, z) < 1.8) continue; o.position.set(x, h + 0.2, z); o.scale.setScalar(0.7 + R() * 1.1); o.rotation.set(0, R() * 6, 0); o.updateMatrix(); inst.setMatrixAt(k, o.matrix);
      cc.setHex(R() < 0.55 ? 0x6a4a62 : R() < 0.5 ? 0x4a5a2c : 0x7a7a44).multiplyScalar(0.8 + R() * 0.4); inst.setColorAt(k++, cc); }
    inst.count = k; root.add(inst); }

  /* ---------- car park, car, board, pier ---------- */
  onProgress(0.5, "Building the ruins…");
  { const [cx, cz] = SITES.car, gh = H(cx, cz); const car = new Group(); car.position.set(cx, gh, cz); car.rotation.y = 0.5; root.add(car);
    box(car, 1.8, 0.7, 4.0, 0x2a3a52, 0, 0.6, 0); box(car, 1.6, 0.6, 2.0, 0x1c2638, 0, 1.2, -0.2); for (const [x, z] of [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]]) { const w = new Mesh(new CylinderGeometry(0.32, 0.32, 0.22, 10), M(0x101010)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); car.add(w); }
    col.circle(cx, cz, 2.3, "car"); col.circle(cx + 0.8, cz + 1.4, 1.2, "car");
    const [bx, bz] = SITES.board; box(root, 0.12, 1.6, 0.12, 0x4a3320, bx - 0.8, H(bx, bz) + 0.8, bz); box(root, 0.12, 1.6, 0.12, 0x4a3320, bx + 0.8, H(bx, bz) + 0.8, bz); box(root, 1.9, 1.0, 0.1, 0x6a5a3a, bx, H(bx, bz) + 1.3, bz); col.circle(bx, bz, 1.1, "board");
    for (let z = 96; z < 112; z += 0.9) box(root, 2.0, 0.08, 0.7, 0x5a4a36, -13.6, 0.78, z); for (const z of [96, 100, 104, 108, 112]) for (const s of [-1, 1]) box(root, 0.14, 0.9, 0.14, 0x3a2c1e, -13.6 + s * 1.0, 0.3, z); }

  /* ---------- ruined township ---------- */
  { const wall = (x0, z0, x1, z1, h = 0.9, th = 0.7) => { const l = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), n = Math.max(2, Math.round(l / 1.3));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), hh = h * (0.45 + R() * 0.8), m = box(root, l / n + 0.12, hh, th, 0x6a665e + ((R() * 10) | 0) * 0x010101, x, H(x, z) + hh / 2 - 0.1, z); m.rotation.y = -a + (R() - 0.5) * 0.1; }
      if (h > 0.5) { const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2, hx = Math.abs(x1 - x0) / 2 + th / 2, hz = Math.abs(z1 - z0) / 2 + th / 2; col.box(cxm - hx, czm - hz, cxm + hx, czm + hz, "ruin"); } };
    const cottage = (cx, cz, w, d, gap = 0) => { const h = H(cx, cz); wall(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2); wall(cx - w / 2, cz + d / 2, cx - gap / 2, cz + d / 2); wall(cx + gap / 2, cz + d / 2, cx + w / 2, cz + d / 2); wall(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2); wall(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2); };
    cottage(-22, 52, 6, 4.6, 1.6); cottage(-33, 58, 5.6, 4.2, 1.4); cottage(-12, 60, 5, 4, 1.3); cottage(-31, 44, 5.4, 4.2, 1.4); cottage(-14, 46, 5.2, 4.4, 1.5); cottage(-24, 66, 5, 4, 1.3);
    const [hx, hz] = SITES.village; const hs = box(root, 1.5, 0.12, 1.0, 0x58544c, hx - 1.8, H(hx, hz) + 0.08, hz - 0.4); W.hearth = hs; const g = glowSprite("255,150,70", 1.4); g.position.set(hx - 1.8, H(hx, hz) + 0.5, hz - 0.4); g.material.opacity = 0.18; root.add(g); W.hearthGlow = g; }

  /* ---------- standing stone ---------- */
  { const [sx, sz] = SITES.hill, h = H(sx, sz); const st = new Mesh(new BoxGeometry(1.3, 4.2, 0.8), M(0x707470)); st.position.set(sx, h + 1.9, sz); st.rotation.set(0.05, 0.4, -0.08); root.add(st); col.circle(sx, sz, 1.0, "stone");
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, s = new Mesh(new BoxGeometry(0.8, 1.2 + R() * 0.8, 0.6), M(0x6a6e6a)); const x = sx + Math.cos(a) * 5, z = sz + Math.sin(a) * 5; s.position.set(x, H(x, z) + 0.6, z); s.rotation.set(0, R() * 3, (R() - 0.5) * 0.3); root.add(s); col.circle(x, z, 0.6, "stone"); } }

  /* ---------- sea cave ---------- */
  { const [cx, cz] = SITES.cave, g = new Group(), gh = H(cx, cz); g.position.set(cx, gh, cz); root.add(g); // entrance faces west (-x); inside is a 3.2 x 7 chamber
    const rock = c2 => M(c2); const L = 7, Wd = 3.2;
    box(g, L, 3.4, 0.9, 0x4a4a50, 3.5, 1.7, -Wd / 2 - 0.45); box(g, L, 3.4, 0.9, 0x4a4a50, 3.5, 1.7, Wd / 2 + 0.45); box(g, 0.9, 3.4, Wd + 1.8, 0x3e3e44, L + 0.45, 1.7, 0); box(g, L + 1, 0.9, Wd + 2.2, 0x3c3c42, 3.7, 3.6, 0);
    col.box(cx - 0.2, cz - Wd / 2 - 0.9, cx + L, cz - Wd / 2, "cave"); col.box(cx - 0.2, cz + Wd / 2, cx + L, cz + Wd / 2 + 0.9, "cave"); col.box(cx + L, cz - Wd / 2 - 0.9, cx + L + 0.9, cz + Wd / 2 + 0.9, "cave");
    for (let i = 0; i < 9; i++) { const r = new Mesh(new IcosahedronGeometry(1.2 + R() * 1.6, 0), rock(0x45454c)); r.position.set(R() * 8 - 0.5, 3.6 + R() * 1.6, R() * 5 - 2.5); r.scale.y = 0.8; g.add(r); }
    const bt = new Mesh(new CylinderGeometry(0.1, 0.12, 0.34, 8), new MeshStandardMaterial({ color: 0x3f8a5a, roughness: 0.2, transparent: true, opacity: 0.8 })); bt.position.set(L - 0.6, 0.9, Wd / 2 - 0.2); g.add(bt); W.bottle = bt; }

  /* ---------- chapel ruin + graves ---------- */
  { const [cx, cz] = SITES.chapel, g = new Group(), gh = H(cx, cz); g.position.set(cx, gh, cz); root.add(g);
    const seg = (x0, z0, x1, z1, h) => { const l = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), m = box(g, l, h, 0.8, 0x77736a, (x0 + x1) / 2, h / 2 - 0.1, (z0 + z1) / 2); m.rotation.y = -a; col.box(cx + Math.min(x0, x1) - 0.4, cz + Math.min(z0, z1) - 0.4, cx + Math.max(x0, x1) + 0.4, cz + Math.max(z0, z1) + 0.4, "chapel"); };
    seg(-3, -5, 3, -5, 3.6); seg(-3, -5, -3, 0.2, 2.8); seg(3, -5, 3, 0.2, 2.2); seg(-3, 3, -1.2, 3, 2.4); seg(1.2, 3, 3, 3, 1.6); seg(3, 0.2, 3, 3, 1.4);
    box(g, 1.2, 0.9, 1.2, 0x6a665e, 0, 0.45, -3.4); const fo = new Mesh(new CylinderGeometry(0.5, 0.4, 0.3, 8), M(0x58544c)); fo.position.set(0, 1.0, -3.4); g.add(fo);
    box(g, 0.5, 0.35, 0.4, 0x4a4036, 0.4, 1.4, -4.8); W.candle = new Mesh(new CylinderGeometry(0.05, 0.06, 0.26, 6), M(0xe8e0c0)); W.candle.position.set(0.4, 1.7, -4.8); g.add(W.candle); const fl = glowSprite("255,190,90", 0.7); fl.position.set(0.4, 1.95, -4.8); fl.visible = false; g.add(fl); W.candleFlame = fl;
    const n = 16, gv = new InstancedMesh(new BoxGeometry(0.55, 1.1, 0.14), M(0xa4a49e), n); for (let i = 0; i < n; i++) { const x = -8 + (i % 4) * 2.6 + (R() - 0.5) * 0.6, z = 4.6 + ((i / 4) | 0) * 2.6 + (R() - 0.5) * 0.6, wx = cx + x, wz = cz + z; o.position.set(x, H(wx, wz) - gh + 0.45, z); o.rotation.set((R() - 0.5) * 0.2, (R() - 0.5) * 0.6, (R() - 0.5) * 0.25); o.scale.set(1, 0.7 + R() * 0.6, 1); o.updateMatrix(); gv.setMatrixAt(i, o.matrix); col.circle(wx, wz, 0.45, "grave"); } g.add(gv); }

  /* ---------- the house on the tidal islet ---------- */
  onProgress(0.7, "Raising the house…");
  { const hb = HOUSE, gy = H(0, -84) + 0.05, g = new Group(); g.position.y = gy; root.add(g); W.house = g;
    const wl = (x0, z0, x1, z1, y0, y1, c2) => { const m = box(g, x1 - x0, y1 - y0, z1 - z0, c2 || 0x8a8478 + ((R() * 8) | 0) * 0x010101, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return m; };
    const T = 0.7; // south wall with door gap
    wl(hb.x0 - T, hb.z1, -1.1, hb.z1 + T, -0.4, 4.4); wl(1.1, hb.z1, hb.x1 + T, hb.z1 + T, -0.4, 4.9); wl(-1.1, hb.z1, 1.1, hb.z1 + T, 2.6, 4.2);
    col.box(hb.x0 - T, hb.z1, -1.1, hb.z1 + T, "house"); col.box(1.1, hb.z1, hb.x1 + T, hb.z1 + T, "house");
    // north wall with a great window
    wl(hb.x0 - T, hb.z0 - T, hb.x1 + T, hb.z0, -0.4, 1.0); wl(hb.x0 - T, hb.z0 - T, -2.4, hb.z0, 1.0, 5.4); wl(2.4, hb.z0 - T, hb.x1 + T, hb.z0, 1.0, 4.2); wl(-2.4, hb.z0 - T, 2.4, hb.z0, 2.8, 4.6); col.box(hb.x0 - T, hb.z0 - T, hb.x1 + T, hb.z0, "house");
    // west and east walls (east partly collapsed)
    wl(hb.x0 - T, hb.z0, hb.x0, hb.z1, -0.4, 5.6); col.box(hb.x0 - T, hb.z0, hb.x0, hb.z1, "house"); wl(hb.x1, hb.z0, hb.x1 + T, hb.z1, -0.4, 2.2); wl(hb.x1, hb.z0, hb.x1 + T, hb.z0 + 3, 2.2, 4.6); col.box(hb.x1, hb.z0, hb.x1 + T, hb.z1, "house");
    const wmat = new MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85 }); W.winMat = wmat;
    for (const x of [-3.8, 3.8]) { const w2 = new Mesh(new PlaneGeometry(1.0, 1.35), wmat); w2.position.set(x, 1.9, hb.z1 + T + 0.02); g.add(w2); box(g, 1.2, 0.1, 0.12, 0x2a2018, x, 2.62, hb.z1 + T + 0.05); box(g, 1.2, 0.1, 0.12, 0x2a2018, x, 1.2, hb.z1 + T + 0.05); box(g, 0.1, 1.5, 0.12, 0x2a2018, x - 0.55, 1.9, hb.z1 + T + 0.05); box(g, 0.1, 1.5, 0.12, 0x2a2018, x + 0.55, 1.9, hb.z1 + T + 0.05); }
    for (let i = 0; i < 14; i++) { const sx = hb.x0 + 0.4 + i * 0.9; box(g, 0.5 + R() * 0.4, 0.4 + R() * 0.9, 0.9, 0x7a766c, sx, 5.0 + R() * 0.5, hb.z1 + 0.35); }
    box(g, 0.9, 2.6, 0.9, 0x7a766c, 3.2, 5.6, hb.z1 + 0.3); // chimney stack
    const fl = box(g, hb.x1 - hb.x0, 0.2, hb.z1 - hb.z0, 0x6a5440, 0, -0.1, (hb.z0 + hb.z1) / 2); fl.material = M(0x6a5440);
    // roof over the west half only (the rest has fallen in)
    const roofM = M(0x2a2e36, { side: DoubleSide }); const rf = new Mesh(new BoxGeometry(7.6, 0.25, hb.z1 - hb.z0 + 1.4), roofM); rf.position.set(-3.2, 4.6, (hb.z0 + hb.z1) / 2); rf.rotation.z = 0.06; g.add(rf);
    for (let i = 0; i < 5; i++) { const r = box(g, 0.2, 0.28, hb.z1 - hb.z0 + 1.2, 0x3a2c1e, -0.3 + i * 1.7, 4.2, (hb.z0 + hb.z1) / 2); r.rotation.z = 0.5 + R() * 0.6; r.position.x = 1.6 + i * 1.0; r.position.y = 3.6 + R() * 0.8; }
    for (let i = 0; i < 7; i++) box(g, 0.5 + R() * 0.8, 0.3 + R() * 0.3, 0.5 + R() * 0.8, 0x5a5650, 2.5 + R() * 3, 0.1, hb.z0 + 1 + R() * 7).rotation.y = R() * 3;
    const wglass = new Mesh(new PlaneGeometry(4.8, 1.8), new MeshBasicMaterial({ color: 0x0a1626, transparent: true, opacity: 0.55 })); wglass.position.set(0, 1.9, hb.z0 - 0.35); g.add(wglass); W.window = wglass;
    // furniture: fireplace, table, rug
    box(g, 1.2, 1.6, 2.2, 0x5a564e, 5.4, 0.8, -84); box(g, 1.7, 0.08, 1.0, 0x5a3a2a, 2.2, 0.8, -83.2); for (const [x, z] of [[1.5, -83.6], [2.9, -83.6], [1.5, -82.8], [2.9, -82.8]]) box(g, 0.1, 0.8, 0.1, 0x3a281a, x, 0.4, z); box(g, 3.2, 0.03, 2.4, 0x6a2a2a, -1.2, 0.03, -84.4);
    // piano (upright, against the west wall, keys facing east)
    const pn = new Group(); pn.position.set(SITES.piano[0], 0, SITES.piano[1]); g.add(pn);
    box(pn, 0.75, 1.15, 1.95, 0x241a14, -0.1, 0.62, 0); box(pn, 0.9, 0.08, 2.05, 0x2e2118, -0.05, 1.22, 0); box(pn, 0.5, 0.1, 1.9, 0x2e2118, 0.45, 0.78, 0); box(pn, 0.14, 0.72, 0.14, 0x1a120e, 0.55, 0.36, -0.85); box(pn, 0.14, 0.72, 0.14, 0x1a120e, 0.55, 0.36, 0.85);
    for (let i = 0; i < 8; i++) { const k = new Mesh(new BoxGeometry(0.3, 0.05, 0.2), M(0xe8e2d0, { roughness: 0.5 })); k.position.set(0.5, 0.86, -0.78 + i * 0.222); pn.add(k); W.keys.push(k); }
    for (const i of [0, 1, 3, 4, 5]) { const k = box(pn, 0.18, 0.06, 0.12, 0x101010, 0.46, 0.91, -0.67 + i * 0.222); }
    col.box(SITES.piano[0] - 0.8, SITES.piano[1] - 1.0, SITES.piano[0] + 0.85, SITES.piano[1] + 1.0, "piano");
    box(g, 0.5, 0.5, 0.9, 0x3a2a1e, SITES.bench[0] - 0.1, 0.25, SITES.bench[1] - 0.2); // duet bench
    box(g, 0.5, 0.5, 0.5, 0x3a2a1e, SITES.ghostSeat[0], 0.25, SITES.ghostSeat[1]); // the pianist's stool
    // music stand + page
    box(g, 0.08, 1.3, 0.08, 0x2a2018, SITES.stand[0], 0.65, SITES.stand[1]); const tilt = box(g, 0.5, 0.04, 0.7, 0x2a2018, SITES.stand[0], 1.3, SITES.stand[1]); tilt.rotation.z = -0.5; const pg = box(g, 0.34, 0.02, 0.48, 0xe0d4a8, SITES.stand[0], 1.34, SITES.stand[1]); pg.rotation.z = -0.5; pg.visible = false; W.page = pg;
    // the ghost (additive, see-through)
    const gm = new MeshBasicMaterial({ color: 0xaed8ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }); W.ghostMat = gm; const gh2 = new Group(); gh2.position.set(SITES.ghostSeat[0], 0, SITES.ghostSeat[1]); g.add(gh2);
    const body = new Mesh(new ConeGeometry(0.34, 1.0, 8), gm); body.position.y = 0.95; const head = new Mesh(new SphereGeometry(0.15, 10, 8), gm); head.position.y = 1.62; const hair = new Mesh(new CylinderGeometry(0.05, 0.22, 0.7, 6), gm); hair.position.set(0.14, 1.35, 0);
    const arms = [-1, 1].map(s => { const a = new Mesh(new CylinderGeometry(0.05, 0.04, 0.8, 5), gm); a.position.set(-0.4, 1.05, s * 0.22); a.rotation.z = 1.1; return a; }); gh2.add(body, head, hair, ...arms); gh2.rotation.y = -Math.PI / 2; W.ghost = gh2; W.ghostArms = arms; gh2.visible = false;
    W.houseLight = new PointLight(0xffc880, 0, 14, 1.6); W.houseLight.position.set(-2.5, 2.2, -84.3); scene.add(W.houseLight);
    const wlg = glowSprite("255,200,120", 4.0); wlg.position.set(0, 2.0, hb.z0 - 0.9); wlg.material.opacity = 0.0; g.add(wlg); W.windowGlow = wlg; }

  /* ---------- listening motes (visible while you hold L) ---------- */
  const moteAt = (id, x, z, y = 1.2) => { const s = glowSprite("170,225,255", 2.4); s.position.set(x, H(x, z) + y, z); s.material.opacity = 0; s.userData.base = s.position.y; root.add(s); W.motes[id] = s; };
  moteAt(1, -13.6, 108.5, 0.9); moteAt(2, SITES.village[0] - 1.8, SITES.village[1] - 0.4, 0.9); moteAt(3, SITES.hill[0] + 1.2, SITES.hill[1] + 0.8, 2.2); moteAt(4, SITES.cave[0] + 6.4, SITES.cave[1] + 1.2, 0.9); moteAt(5, SITES.chapel[0], SITES.chapel[1] - 3.4, 1.4);
  W.motes[6] = glowSprite("170,225,255", 2.2); W.motes[6].position.set(SITES.stand[0], 1.5 + H(0, -84), SITES.stand[1]); W.motes[6].material.opacity = 0; root.add(W.motes[6]);
  W.sources = { 1: [-13.6, 108.5], 2: [SITES.village[0] - 1.8, SITES.village[1] - 0.4], 3: [SITES.hill[0], SITES.hill[1]], 4: [SITES.cave[0] + 6.4, SITES.cave[1]], 5: [SITES.chapel[0], SITES.chapel[1] - 3.4], 6: [SITES.stand[0], SITES.stand[1]] };
  onProgress(1, "Ready.");
  return W;
}
