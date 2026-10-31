// Woolpit village: procedural low-poly terrain, buildings, fields, forest, wolf pits and the misty hollow. No external assets.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, PlaneGeometry, CircleGeometry,
  BufferGeometry, Float32BufferAttribute, InstancedMesh, Object3D, Color, DoubleSide,
} from "three";
import { rng, fbm, smooth, glowSprite } from "../../shared/world.js";

export const L = {
  green: [0, 0], well: [3, -2.5], bench: [-4.5, 3], pits: [28, 20], hollow: [44, 34], cloth: [31.4, 17.6],
  church: { x0: -29, x1: -18, z0: -9, z1: 1 }, altar: [-27, -4], grave: [-23, 5.5],
  barn: { x0: 11, x1: 21, z0: -20, z1: -14 }, beans: [25, -12], bed: [19.2, -17.6],
  pen: { x0: 8, x1: 16, z0: 13, z1: 21 }, maud: [-14, 18], manor: { x0: -41, x1: -25, z0: -37, z1: -30 },
  bounds: { cx: 8, cz: 4, r: 54 },
};
export const PATHS = [
  [[0, 0], [12, 8], [28, 20], [36, 28], [44, 34]], [[0, 0], [-18, -4]], [[0, 0], [8, -10], [16, -14]],
  [[0, 0], [8, 10], [12, 14]], [[0, 0], [-8, 10], [-14, 16]], [[0, 0], [-14, -14], [-30, -26]],
];
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export const pathDist = (x, z) => { let m = 99; for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) m = Math.min(m, segD(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1])); return m; };
export const groundH = (x, z) => { const d = Math.hypot(x, z); return (fbm(x * 0.022 + 7, z * 0.022 + 3, 3) - 0.45) * 2.2 * smooth(3, 14, d); };

const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, ...o })); return mats.get(k); };
const box = (p, w, h, d, c, x, y, z, mat) => { const m = new Mesh(new BoxGeometry(w, h, d), mat || M(c)); m.position.set(x, y, z); p.add(m); return m; };
function prism(w, d, h, over = 0.5) { // gable roof, ridge along z
  const a = w / 2 + over, b = d / 2 + over, v = [-a, 0, -b, a, 0, -b, 0, h, -b, -a, 0, b, a, 0, b, 0, h, b];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(idx.flatMap(i => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]), 3)); g.computeVertexNormals(); return g;
}

export function buildVillage(scene, col, onProgress = () => {}) {
  const R = rng(1154), world = { winMat: new MeshBasicMaterial({ color: 0x2a2418 }), churchMats: [], hidden: {}, flames: [], lights: [] };
  const root = new Group(); scene.add(root);
  const step = (f, m) => { onProgress(f, m); };

  /* ---------- terrain with vertex colours: grass, fields, dirt paths, village green ---------- */
  step(0.1, "Shaping the land…");
  const SZ = 210, SEG = 150, g = new PlaneGeometry(SZ, SZ, SEG, SEG); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, colArr = new Float32Array(pos.count * 3), c = new Color();
  const inRect = (x, z, x0, z0, x1, z1) => x > x0 && x < x1 && z > z0 && z < z1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, groundH(x, z));
    const n = fbm(x * 0.09, z * 0.09, 3), n2 = fbm(x * 0.4 + 9, z * 0.4, 2);
    c.setHex(0x587a38).lerp(new Color(0x7a8a3c), n * 0.8).multiplyScalar(0.85 + n2 * 0.3);
    if (inRect(x, z, 14, 6, 44, 34) || inRect(x, z, 20, -26, 40, -6)) c.setHex(0xa98f45).lerp(new Color(0xc2a552), n).multiplyScalar(0.9 + n2 * 0.2); // stubble / wheat
    if (inRect(x, z, -12, -48, 14, -32)) c.setHex(0xc9a64a).lerp(new Color(0xe0c060), n2).multiplyScalar(0.95);
    const gd = Math.hypot(x, z); if (gd < 9) c.lerp(new Color(0x6f9a46), smooth(9, 5, gd) * 0.8);
    if (Math.hypot(x - L.hollow[0], z - L.hollow[1]) < 9) c.setHex(0x243a30).lerp(new Color(0x34503f), n2);
    const pd = pathDist(x, z); if (pd < 2.4) c.lerp(new Color(0x8c7350), smooth(2.4, 0.9, pd) * 0.95);
    if (Math.hypot(x - L.pits[0], z - L.pits[1]) < 5) c.lerp(new Color(0x5a4630), 0.6);
    const far = Math.hypot(x - L.bounds.cx, z - L.bounds.cz); if (far > 50) c.multiplyScalar(0.72);
    colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(colArr, 3)); g.computeVertexNormals();
  const ground = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); root.add(ground);

  /* ---------- buildings ---------- */
  step(0.3, "Raising the houses…");
  const winGeo = new PlaneGeometry(0.55, 0.65);
  const house = (x, z, w, d, h, ry = 0, wall = 0xb9a88a, roof = 0x7a5a30) => {
    const gh = groundH(x, z), gr = new Group(); gr.position.set(x, gh, z); gr.rotation.y = ry; root.add(gr);
    box(gr, w, h + 1, d, wall, 0, h / 2 - 0.5, 0); const rf = new Mesh(prism(w, d, h * 0.62), M(roof)); rf.position.y = h; gr.add(rf);
    box(gr, 0.4, 1.4, 0.4, 0x6a5a4a, w * 0.25, h + 1.1, 0); box(gr, 1.0, 1.9, 0.12, 0x4a3320, 0, 0.95, d / 2 + 0.02);
    for (const s of [-1, 1]) { const wn = new Mesh(winGeo, world.winMat); wn.position.set(s * w * 0.3, h * 0.55, d / 2 + 0.03); gr.add(wn); }
    // rotated footprint -> AABB collider (approximate for ry multiples of 90 deg)
    const sw = Math.abs(Math.cos(ry)) * w + Math.abs(Math.sin(ry)) * d, sd = Math.abs(Math.cos(ry)) * d + Math.abs(Math.sin(ry)) * w;
    col.box(x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2, "house"); return gr;
  };
  house(-8, -22, 6, 5, 3.2, 0.3); house(26, -1, 6, 5, 3.2, -0.5); house(-6, 27, 6.5, 5, 3.4, 3.1); house(-20, 30, 5, 4.5, 3, 0.2, 0xa89880, 0x6f5530);
  house(-34, 14, 5.5, 5, 3.2, 1.5); house(44, 4, 5, 4.5, 3, -1.2, 0xa89a82);
  // Maud's hut + herb garden
  { const h = house(L.maud[0], L.maud[1], 5, 4.2, 2.8, 0.2, 0x9a8a70, 0x5a4a28); for (let i = 0; i < 9; i++) box(h, 0.9, 0.35, 0.9, 0x4f7a3a + (i % 3) * 0x080800, -5 + (i % 3) * 1.1, 0.18, -1.5 + ((i / 3) | 0) * 1.1); }

  // church (walls fade when the player is inside)
  { const C = L.church, cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2, w = C.x1 - C.x0, d = C.z1 - C.z0, gh = groundH(cx, cz), gr = new Group(); gr.position.y = gh; root.add(gr);
    const wallM = new MeshStandardMaterial({ color: 0xb4ac9c, roughness: 1, flatShading: true, transparent: true }), roofM = new MeshStandardMaterial({ color: 0x5c4a3c, roughness: 1, flatShading: true, transparent: true, side: DoubleSide });
    world.churchMats.push(wallM, roofM);
    const T = 0.5, H = 4.4, W = (x0, z0, x1, z1) => { const m = new Mesh(new BoxGeometry(x1 - x0, H + 1, z1 - z0), wallM); m.position.set((x0 + x1) / 2, H / 2 - 0.5, (z0 + z1) / 2); gr.add(m); col.box(x0, z0, x1, z1, "church"); };
    W(C.x0, C.z0, C.x1, C.z0 + T); W(C.x0, C.z1 - T, C.x1, C.z1); W(C.x0, C.z0, C.x0 + T, C.z1); W(C.x1 - T, C.z0, C.x1, -5.2); W(C.x1 - T, -2.8, C.x1, C.z1);
    const rf = new Mesh(prism(d + 0.2, w, 3.2, 0.6), roofM); rf.rotation.y = Math.PI / 2; rf.position.set(cx, H, cz); gr.add(rf);
    const fl = box(gr, w - 1, 0.1, d - 1, 0x6b665e, cx, 0.05, cz); fl.material = M(0x6b665e);
    const tw = new Mesh(new BoxGeometry(3.2, 9, 3.2), wallM); tw.position.set(C.x0 + 1.6, 4, C.z0 + 1.6); gr.add(tw); col.box(C.x0, C.z0, C.x0 + 3.2, C.z0 + 3.2, "tower");
    const tr = new Mesh(new ConeGeometry(2.6, 3.4, 4), roofM); tr.rotation.y = Math.PI / 4; tr.position.set(C.x0 + 1.6, 10.2, C.z0 + 1.6); gr.add(tr);
    const al = box(gr, 1.2, 1.0, 3.2, 0x7a6a58, L.altar[0] - 0.2, 0.5, L.altar[1]); const cr = box(gr, 0.12, 1.1, 0.12, 0xd8c070, L.altar[0] - 0.4, 1.5, L.altar[1]); box(gr, 0.5, 0.12, 0.12, 0xd8c070, L.altar[0] - 0.4, 1.7, L.altar[1]);
    world.altarBell = new Mesh(new ConeGeometry(0.16, 0.26, 10), M(0xb88a3a, { metalness: 0.6, roughness: 0.4 })); world.altarBell.position.set(L.altar[0] + 0.1, 1.12, L.altar[1] + 0.9); gr.add(world.altarBell);
    for (let i = 0; i < 3; i++) { box(gr, 3.4, 0.5, 0.5, 0x5a4636, C.x0 + 6 + i * 0, 0.25 + 0, C.z0 + 2.4 + i * 2.2); }
    world.churchBox = { x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1 };
    const win = new Mesh(new PlaneGeometry(0.8, 1.6), world.winMat); win.position.set(C.x0 + T + 0.02, 2.4, cz); win.rotation.y = Math.PI / 2; gr.add(win);
  }
  // Edith's barn (open front, faces +z) and bean rows
  { const B = L.barn, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, w = B.x1 - B.x0, d = B.z1 - B.z0, gr = new Group(); gr.position.set(0, groundH(cx, cz), 0); root.add(gr);
    box(gr, w, 3.4, 0.4, 0x7a5a38, cx, 1.2, B.z0); box(gr, 0.4, 3.4, d, 0x7a5a38, B.x0, 1.2, cz); box(gr, 0.4, 3.4, d, 0x7a5a38, B.x1, 1.2, cz);
    const rf = new Mesh(prism(w, d, 2.2, 0.8), M(0x8a7040)); rf.position.set(cx, 2.9, cz); gr.add(rf);
    col.box(B.x0 - 0.2, B.z0 - 0.2, B.x1 + 0.2, B.z0 + 0.2, "barn"); col.box(B.x0 - 0.2, B.z0, B.x0 + 0.2, B.z1, "barn"); col.box(B.x1 - 0.2, B.z0, B.x1 + 0.2, B.z1, "barn");
    for (let i = 0; i < 6; i++) box(gr, 1.2, 0.5, 0.8, 0xc9aa55, B.x0 + 1.6 + (i % 3) * 1.4, 0.25 + ((i / 3) | 0) * 0.5, B.z0 + 1.2);
    box(gr, 2.6, 0.35, 1.2, 0xd2b865, L.bed[0], 0.18, L.bed[1]); // straw pallet
    for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) { const m = new Mesh(new BoxGeometry(0.1, 0.9 + R() * 0.3, 0.1), M(0x3f8a3a)); m.position.set(L.beans[0] - 4 + k * 0.6, 0.45, L.beans[1] - 3 + r * 1.2); m.position.y += groundH(m.position.x, m.position.z); root.add(m); }
  }
  // Hugh's storehouse yard (children can be locked inside)
  { const P = L.pen, w = P.x1 - P.x0, d = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, gh = groundH(cx, cz), gr = new Group(); gr.position.y = gh; root.add(gr);
    const side = (x0, z0, x1, z1) => { const l = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); for (const y of [0.55, 1.1]) { const r = box(gr, l, 0.1, 0.1, 0x6a4a2a, (x0 + x1) / 2, y, (z0 + z1) / 2); r.rotation.y = -a; } for (let i = 0; i <= l; i += 1.6) box(gr, 0.18, 1.5, 0.18, 0x5a3c22, x0 + (x1 - x0) * i / l, 0.75, z0 + (z1 - z0) * i / l); };
    side(P.x0, P.z0, P.x1, P.z0); side(P.x0, P.z1, P.x1, P.z1); side(P.x0, P.z0, P.x0, P.z1); side(P.x1, P.z0, P.x1, P.z1);
    col.box(P.x0 - 0.2, P.z0 - 0.2, P.x1 + 0.2, P.z0 + 0.2, "pen"); col.box(P.x0 - 0.2, P.z1 - 0.2, P.x1 + 0.2, P.z1 + 0.2, "pen"); col.box(P.x0 - 0.2, P.z0, P.x0 + 0.2, P.z1, "pen"); col.box(P.x1 - 0.2, P.z0, P.x1 + 0.2, P.z1, "pen");
    box(gr, 3.2, 2.2, 2.4, 0x8a7a62, P.x1 - 2.4, 1.1, P.z1 - 2); const rf = new Mesh(prism(3.2, 2.4, 1.2, 0.3), M(0x6a4a28)); rf.position.set(P.x1 - 2.4, 2.2, P.z1 - 2); gr.add(rf); col.box(P.x1 - 4, P.z1 - 3.2, P.x1 - 0.8, P.z1 - 0.8, "shed");
  }
  // Wykes manor hall
  { const Mn = L.manor, cx = (Mn.x0 + Mn.x1) / 2, cz = (Mn.z0 + Mn.z1) / 2, w = Mn.x1 - Mn.x0, d = Mn.z1 - Mn.z0, gh = groundH(cx, cz), gr = new Group(); gr.position.set(cx, gh, cz); root.add(gr);
    box(gr, w, 6.4, d, 0xa49a88, 0, 2.2, 0); const rf = new Mesh(prism(d, w, 3.2, 0.8), M(0x5a4636)); rf.rotation.y = Math.PI / 2; rf.position.y = 5.4; gr.add(rf);
    box(gr, 2.2, 3.2, 0.3, 0x3d2a1a, 0, 1.6, d / 2 + 0.02); for (let i = -3; i <= 3; i += 2) { const wn = new Mesh(new PlaneGeometry(0.8, 1.2), world.winMat); wn.position.set(i * 2, 3.8, d / 2 + 0.03); gr.add(wn); }
    for (const s of [-1, 1]) { box(gr, 3, 8, 3, 0x9a9080, s * (w / 2 + 0.2), 3.2, -d / 2 + 0.5); }
    col.box(Mn.x0, Mn.z0, Mn.x1, Mn.z1, "manor");
  }

  /* ---------- well, bench, green ---------- */
  { const [wx, wz] = L.well, gh = groundH(wx, wz); const r = new Mesh(new CylinderGeometry(1.0, 1.1, 0.9, 10, 1, true), M(0x8a8a82, { side: DoubleSide })); r.position.set(wx, gh + 0.45, wz); root.add(r);
    const w = new Mesh(new CircleGeometry(0.95, 10), new MeshBasicMaterial({ color: 0x1a2a3a })); w.rotation.x = -Math.PI / 2; w.position.set(wx, gh + 0.5, wz); root.add(w); col.circle(wx, wz, 1.15, "well");
    box(root, 0.15, 2.0, 0.15, 0x5a3c22, wx - 0.9, gh + 1.5, wz); box(root, 0.15, 2.0, 0.15, 0x5a3c22, wx + 0.9, gh + 1.5, wz); box(root, 2.0, 0.15, 0.15, 0x5a3c22, wx, gh + 2.5, wz);
    const [bx, bz] = L.bench; box(root, 1.8, 0.12, 0.5, 0x6a4a2a, bx, groundH(bx, bz) + 0.5, bz); box(root, 0.12, 0.5, 0.4, 0x5a3c22, bx - 0.7, groundH(bx, bz) + 0.25, bz); box(root, 0.12, 0.5, 0.4, 0x5a3c22, bx + 0.7, groundH(bx, bz) + 0.25, bz); }
  { const cart = new Group(); cart.position.set(-8.5, groundH(-8.5, -8), -8); cart.rotation.y = 0.6; root.add(cart); box(cart, 2.4, 0.3, 1.3, 0x6a4a2a, 0, 0.7, 0); for (const s of [-1, 1]) { const wh = new Mesh(new CylinderGeometry(0.55, 0.55, 0.12, 10), M(0x4a3220)); wh.rotation.x = Math.PI / 2; wh.position.set(0, 0.55, s * 0.7); cart.add(wh); } box(cart, 2.2, 0.5, 1.2, 0xc9a85a, 0, 1.1, 0); col.circle(-8.5, -8, 1.5, "cart"); }

  /* ---------- wolf pits ---------- */
  step(0.5, "Digging the wolf pits…");
  { const pit = (x, z, r) => { const m = new Mesh(new CircleGeometry(r, 14), new MeshBasicMaterial({ color: 0x0c0906 })); m.rotation.x = -Math.PI / 2; m.position.set(x, groundH(x, z) + 0.05, z); root.add(m); const rim = new Mesh(new CylinderGeometry(r + 0.45, r + 0.9, 0.3, 14, 1, true), M(0x4a3a28, { side: DoubleSide })); rim.position.set(x, groundH(x, z) + 0.1, z); root.add(rim); col.circle(x, z, r + 0.3, "pit"); };
    pit(L.pits[0], L.pits[1], 2.0); pit(23.5, 25, 1.2); pit(34, 15, 1.3);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + R() * 0.3, rr = 4.2 + R() * 1.6, x = L.pits[0] + Math.cos(a) * rr, z = L.pits[1] + Math.sin(a) * rr; if (pathDist(x, z) < 2) continue; const t = new Mesh(new IcosahedronGeometry(0.5 + R() * 0.3, 0), M(0x243a22)); t.position.set(x, groundH(x, z) + 0.35, z); root.add(t); }
    const cl = new Mesh(new PlaneGeometry(0.5, 0.35), M(0x7e9684, { side: DoubleSide })); cl.position.set(L.cloth[0], groundH(L.cloth[0], L.cloth[1]) + 0.9, L.cloth[1]); cl.rotation.set(0.2, 0.6, 0.3); root.add(cl); world.clothMesh = cl; world.hidden.cloth = cl; }

  /* ---------- the hollow (where the bells ring) ---------- */
  { const [hx, hz] = L.hollow, gh = groundH(hx, hz); const ring = new InstancedMesh(new BoxGeometry(0.7, 1.8, 0.6), M(0x6e7a76), 12), o = new Object3D();
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; o.position.set(hx + Math.cos(a) * 6.2, gh + 0.8, hz + Math.sin(a) * 6.2); o.rotation.set((R() - 0.5) * 0.3, -a, (R() - 0.5) * 0.3); o.scale.set(1, 0.7 + R() * 0.8, 1); o.updateMatrix(); ring.setMatrixAt(i, o.matrix); } root.add(ring);
    world.hollowGlow = glowSprite("140,220,200", 9); world.hollowGlow.position.set(hx, gh + 1.6, hz); world.hollowGlow.material.opacity = 0.0; root.add(world.hollowGlow);
    world.mist = []; for (let i = 0; i < 9; i++) { const s = glowSprite("150,185,205", 11 + R() * 6); s.material.opacity = 0.18; s.position.set(hx + (R() - 0.5) * 16, gh + 0.9 + R() * 1.3, hz + (R() - 0.5) * 16); s.userData.ph = R() * 6; root.add(s); world.mist.push(s); } }

  /* ---------- trees, sheaves, hay ---------- */
  step(0.7, "Planting the forest…");
  const blocked = (x, z) => {
    if (pathDist(x, z) < 3.4) return true;
    if (Math.hypot(x - L.hollow[0], z - L.hollow[1]) < 9.5 || Math.hypot(x - L.pits[0], z - L.pits[1]) < 8 || Math.hypot(x, z) < 11) return true;
    const near = [[L.church.x0 - 2, L.church.z0 - 2, L.church.x1 + 4, L.church.z1 + 4], [L.barn.x0 - 3, L.barn.z0 - 3, L.barn.x1 + 3, L.barn.z1 + 8], [L.pen.x0 - 3, L.pen.z0 - 3, L.pen.x1 + 3, L.pen.z1 + 3], [L.manor.x0 - 4, L.manor.z0 - 4, L.manor.x1 + 4, L.manor.z1 + 9], [-18, 8, -9, 28], [-12, -50, 14, -30], [14, 6, 42, 32], [20, -28, 42, -4]];
    for (const r of near) if (inRect(x, z, ...r)) return true;
    for (const h of [[-8, -22], [26, -1], [-6, 27], [-20, 30], [-34, 14], [44, 4]]) if (Math.hypot(x - h[0], z - h[1]) < 6) return true;
    return false;
  };
  const spots = []; for (let i = 0; i < 2600 && spots.length < 420; i++) {
    const a = R() * 6.283, rr = 14 + Math.sqrt(R()) * 58, x = L.bounds.cx + Math.cos(a) * rr, z = L.bounds.cz + Math.sin(a) * rr, d = Math.hypot(x - L.bounds.cx, z - L.bounds.cz);
    if (d < 41 && R() < 0.8) continue; if (blocked(x, z)) continue; if (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 2.4)) continue; spots.push([x, z, 0.8 + R() * 0.9, R()]);
  }
  const nT = spots.length, trunks = new InstancedMesh(new CylinderGeometry(0.2, 0.3, 1.6, 5), M(0x4a3524), nT), cA = new InstancedMesh(new ConeGeometry(1.5, 3.4, 7), M(0xffffff), nT), cB = new InstancedMesh(new ConeGeometry(1.1, 2.6, 7), M(0xffffff), nT), o = new Object3D(), cc = new Color();
  spots.forEach(([x, z, s, k], i) => {
    const y = groundH(x, z); o.rotation.set(0, R() * 6, 0); o.scale.setScalar(s); o.position.set(x, y + 0.8 * s, z); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    o.position.set(x, y + 2.8 * s, z); o.updateMatrix(); cA.setMatrixAt(i, o.matrix); o.position.set(x, y + 4.5 * s, z); o.updateMatrix(); cB.setMatrixAt(i, o.matrix);
    cc.setHex(k < 0.35 ? 0x2f4a2a : k < 0.7 ? 0x3a5a2c : k < 0.88 ? 0x6a6a2a : 0x8a5a24).multiplyScalar(0.8 + R() * 0.3); cA.setColorAt(i, cc); cB.setColorAt(i, cc);
    if (d2(x, z) < 60) col.circle(x, z, 0.55 * s, "tree");
  });
  function d2(x, z) { return Math.hypot(x - L.bounds.cx, z - L.bounds.cz); }
  root.add(trunks, cA, cB);
  { const n = 70, sh = new InstancedMesh(new ConeGeometry(0.4, 1.1, 6), M(0xd1b255), n); for (let i = 0; i < n; i++) { let x, z, t = 0; do { x = 16 + R() * 26; z = 8 + R() * 24; t++; } while ((pathDist(x, z) < 2.5 || Math.hypot(x - L.pits[0], z - L.pits[1]) < 3.4) && t < 30); o.position.set(x, groundH(x, z) + 0.5, z); o.rotation.set(0, R() * 6, 0); o.scale.setScalar(0.8 + R() * 0.5); o.updateMatrix(); sh.setMatrixAt(i, o.matrix); } root.add(sh); }
  { const n = 60, gr = new InstancedMesh(new IcosahedronGeometry(0.45, 0), M(0x4a6a30), n); for (let i = 0; i < n; i++) { const a = R() * 6.28, rr = 12 + R() * 40, x = L.bounds.cx + Math.cos(a) * rr, z = L.bounds.cz + Math.sin(a) * rr; o.position.set(x, groundH(x, z) + 0.2, z); o.scale.set(1 + R(), 0.6 + R() * 0.6, 1 + R()); o.rotation.set(0, R() * 6, 0); o.updateMatrix(); gr.setMatrixAt(i, o.matrix); } root.add(gr); }

  /* ---------- grave (appears when the boy dies) ---------- */
  { const gr = new Group(); const [x, z] = L.grave; gr.position.set(x, groundH(x, z), z); box(gr, 1.0, 0.25, 1.8, 0x5a4330, 0, 0.12, 0); box(gr, 0.1, 1.0, 0.1, 0x7a5a38, 0, 0.7, -0.8); box(gr, 0.5, 0.1, 0.1, 0x7a5a38, 0, 0.95, -0.8); for (let i = 0; i < 5; i++) box(gr, 0.1, 0.05, 0.14, 0x6aa040, -0.25 + i * 0.12, 0.27, 0.2); gr.visible = false; root.add(gr); world.grave = gr; col.circle(x, z, 0.8, "grave"); }

  step(1, "Ready.");
  world.root = root; world.groundH = groundH;
  world.torch = (parent, x, y, z) => { const t = new Group(); t.position.set(x, y, z); const st = new Mesh(new CylinderGeometry(0.04, 0.05, 1.1, 5), M(0x4a3220)); st.position.y = 0.2; const gl = glowSprite("255,170,70", 1.8); gl.position.y = 0.85; t.add(st, gl); t.userData.glow = gl; parent.add(t); world.flames.push(gl); return t; };
  return world;
}
