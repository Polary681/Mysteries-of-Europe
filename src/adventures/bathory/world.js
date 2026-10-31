// ELIZABETH BÁTHORY — the procedural world (no model or texture files; canvas-drawn tapestries and portraits only).
//  SURFACE: the village of Čachtice/Csejte (whitewashed houses with steep shingle roofs, stone houses, the church and its spire,
//  the inn, the market square with its stalls, the well, the wash-place by the stream, vineyards on the slopes), the road that
//  climbs the limestone hill, and the castle in three terraces: lower and middle walls, the upper castle with its gate tower,
//  the horseshoe-shaped keep, an arcaded Renaissance loggia, the palace; oak woods and the Little Carpathians around.
//  INSIDE (built far away at I and reached through the palace door): the great hall, the corridor, the dining room with its
//  tiled stove, the library, the walled passage, the portrait gallery, the storeroom and the countess's apartments.
// Merged per material, instanced where repeated; masonry is drawn by the shared shader patch; no shadow maps.
import {
  Group, Mesh, InstancedMesh, Object3D, Color, Vector3, BufferGeometry, Float32BufferAttribute, PlaneGeometry, BoxGeometry, CylinderGeometry,
  ConeGeometry, IcosahedronGeometry, DodecahedronGeometry, TorusGeometry,
  MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, DoubleSide, AdditiveBlending, Points, PointsMaterial, CanvasTexture, SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, fbm, noise2, smooth as sm, lerp, glowSprite } from "../../shared/world.js";
import { paint, put, VC, masonry, bake, gable } from "../../shared/build.js";

/* ===================================================================== layout */
export const I = new Vector3(0, 0, 1600);                       // the interiors' origin
export const C = [0, -120];                                     // the castle hill
export const ROAD = [[0, -27], [7, -40], [-6, -53], [9, -66], [-5, -79], [3, -90], [0, -99]];
export const L = {
  start: [4.6, 27.5], square: [0, 3], church: [-17, -12], inn: [12, -7], well: [-7, 11], wash: [24, 14], road: [0, -26],
  npc: { secretary: [10.5, -2.6], marta: [4.2, 6.2], gergely: [-7.8, 13.6], sexton: [-12.2, -3.4], zuzana: [22.6, 12.4] },
  gate: [0, -99], court: [0, -116], doorIn: [0, -127.2], castellan: [3.2, -112], palaceZ: -129,
  // interior (local, add I)
  doorOut: [0, -0.9], chambers: [24, -13], eliza: [27.6, -16.4], elizaWindow: [29.8, -16.4], ilka: [-18, -12.5],
  obj: { hall_chest: [0, -10.4], hall_fire: [0, -11.2], library_lectern: [-19, 3.4], library_shelf: [-24.2, -1.5], library_desk: [-15, 2.6], library_case: [-24.2, 1.1],
    passage_niche: [-32.6, 1], store_accounts: [27.2, 1.6], store_chest: [20.4, 2.6], chamber_desk: [19.6, -17.2], chamber_chest: [24, -11.2], gallery_portrait: [16, -7.1], report: [-15, 2.6],
    chambers_door: [24, -6.8], store_door: [24, -5.2] },
};
export const ix = p => [p[0] + I.x, p[1] + I.z];
// rooms (local): x0, x1, z0, z1, height, kind
export const ROOMS = {
  hall: [-9, 9, -12, 0, 7.5, "hall"], corrW: [-24, -9, -7.6, -4.4, 4.6, "stone"], dining: [-25, -13, -18, -7.6, 5.2, "plaster"], library: [-25, -13, -4.4, 6, 5.6, "wood"],
  passage: [-31, -25, -0.1, 2.1, 2.8, "rough"], niche: [-34, -31, -1.5, 3.5, 2.6, "rough"],
  gallery: [9, 30, -7.6, -4.4, 4.6, "plaster"], chambers: [17, 31, -19, -7.6, 5.4, "chamber"], storage: [18, 30, -4.4, 5, 4.2, "rough"],
};
// doors: on the wall line z = const ("x" walls) or x = const ("z" walls); lock = which rule must allow it
export const DOORS = [
  { id: "out", axis: "x", at: 0, c: 0, w: 2.2 }, { id: "hw", axis: "z", at: -9, c: -6, w: 1.9 }, { id: "he", axis: "z", at: 9, c: -6, w: 1.9 },
  { id: "dn", axis: "x", at: -7.6, c: -19, w: 1.8 }, { id: "ls", axis: "x", at: -4.4, c: -19, w: 1.8 }, { id: "secret", axis: "z", at: -25, c: 1, w: 1.4, lock: "passage" },
  { id: "pn", axis: "z", at: -31, c: 1, w: 1.4 }, { id: "cn", axis: "x", at: -7.6, c: 24, w: 1.8, lock: "chambers" }, { id: "ss", axis: "x", at: -4.4, c: 24, w: 1.8, lock: "store" },
];
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export function roadDist(x, z) { let d = 1e9; for (let i = 0; i < ROAD.length - 1; i++) d = Math.min(d, segD(x, z, ROAD[i][0], ROAD[i][1], ROAD[i + 1][0], ROAD[i + 1][1])); return d; }
const inside = (x, z) => z > 1000;

/* ===================================================================== ground */
function surfaceH(x, z) {
  const d = Math.hypot(x / 1.15, z - C[1]);
  let h = 42 * (1 - sm(19, 82, d)) + 6 * (1 - sm(60, 120, d));            // the castle hill and its shoulders
  h += (fbm(x * 0.03 + 7, z * 0.03 + 2, 4) - 0.5) * 8 * sm(26, 40, d) * sm(30, 60, Math.hypot(x, z));   // rough hillsides, calm village
  h += Math.max(0, Math.abs(x) - 55) * 0.25 + Math.max(0, z - 50) * -0.12;
  const vill = sm(40, 30, Math.hypot(x, z - 2)); h = lerp(h, (noise2(x * 0.1, z * 0.1) - 0.5) * 0.5, vill);
  if (d < 21) h = 42; else if (d < 25) h = lerp(42, h, (d - 21) / 4);   // the upper castle's plateau
  const rd = roadDist(x, z); if (rd < 5 && z < -26) { const base = 42 * sm(-27, -99, z) ** 0.9; h = lerp(h, Math.min(h, base + 0.0) * 0.5 + base * 0.5, sm(5, 1.5, rd)); }
  return h;
}
export function roadH(z) { return 42 * Math.pow(sm(-27, -99, z), 0.9); }
export const groundH = (x, z) => inside(x, z) ? 0 : surfaceH(x, z);

/** which interior room contains a local point (with a margin), or null */
export function roomAt(lx, lz, m = 0) { for (const k in ROOMS) { const r = ROOMS[k]; if (lx > r[0] + m && lx < r[1] - m && lz > r[2] + m && lz < r[3] - m) return k; } return null; }
/** o: { chambers, store, passage } — which locked doors are open */
export function walkable(x, z, o = {}) {
  if (inside(x, z)) {
    const lx = x - I.x, lz = z - I.z;
    if (roomAt(lx, lz, 0.62)) return true;
    for (const d of DOORS) {
      if (d.lock && !o[d.lock]) continue;
      if (d.axis === "x" && Math.abs(lz - d.at) < 0.75 && Math.abs(lx - d.c) < d.w / 2 - 0.3) return d.id !== "out" || lz < 0.2;
      if (d.axis === "z" && Math.abs(lx - d.at) < 0.75 && Math.abs(lz - d.c) < d.w / 2 - 0.3) return true;
    }
    return false;
  }
  if (z > -27.5) return z < 33 && Math.abs(x) < 33;
  if (z > -99.5) return roadDist(x, z) < 2.3;
  const dc = Math.hypot(x - C[0], z - (C[1] + 4));
  if (z > -101.5) return Math.abs(x) < 1.8;
  return dc < 17.5 && z < -101 && z > -127.6 && !(Math.abs(x - 12.5) < 3.2 && z < -108 && z > -126) && Math.hypot(x + 13, z + 121) > 5.6;
}

/* ===================================================================== canvas art: tapestry, portraits */
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }
const tapestryTex = () => canvasTex(256, 384, (g, w, h) => {
  g.fillStyle = "#4a1018"; g.fillRect(0, 0, w, h); g.strokeStyle = "#b8963e"; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48);
  for (let y = 60; y < h - 40; y += 70) for (let x = 64; x < w - 30; x += 64) {   // pomegranates: a Renaissance textile motif
    const ox = ((y / 70) | 0) % 2 ? 32 : 0; g.fillStyle = "#7a1f2b"; g.beginPath(); g.ellipse(x + ox - 32, y, 18, 22, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#c9a95a"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#c9a95a"; g.beginPath(); g.moveTo(x + ox - 40, y - 22); g.lineTo(x + ox - 32, y - 32); g.lineTo(x + ox - 24, y - 22); g.fill();
  }
  g.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
});
const bannerTex = () => canvasTex(128, 256, (g, w, h) => {   // the Báthory teeth on red, in a gold ring
  g.fillStyle = "#5a1420"; g.fillRect(0, 0, w, h); g.fillStyle = "#b8963e"; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 26, w, 6);
  g.fillStyle = "#e8e0d0"; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(24, 70 + k * 36); g.lineTo(104, 62 + k * 36); g.lineTo(104, 82 + k * 36); g.closePath(); g.fill(); }
  g.strokeStyle = "#b8963e"; g.lineWidth = 4; g.beginPath(); g.arc(64, 106, 54, 0, Math.PI * 2); g.stroke();
});
function portraitTex(kind) {
  return canvasTex(192, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#1a1410"); bg.addColorStop(1, "#2a2018"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (kind === "countess") {
      g.fillStyle = "#0c0a0a"; g.beginPath(); g.moveTo(40, h); g.quadraticCurveTo(50, 150, 96, 140); g.quadraticCurveTo(142, 150, 152, h); g.fill();
      g.fillStyle = "#6a1a24"; g.fillRect(84, 170, 24, 86); g.strokeStyle = "#c9a95a"; g.lineWidth = 2; for (let y = 160; y < h; y += 14) { g.beginPath(); g.moveTo(70, y); g.lineTo(122, y); g.stroke(); }
      g.fillStyle = "#efe8dc"; g.beginPath(); g.ellipse(96, 132, 34, 12, 0, 0, Math.PI * 2); g.fill();   // the lace collar
      g.fillStyle = "#e6d3c0"; g.beginPath(); g.ellipse(96, 98, 20, 26, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1a120c"; g.beginPath(); g.ellipse(96, 82, 22, 16, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = "#f4f0e8"; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(78 + k * 4.5, 70 - Math.sin(k / 8 * Math.PI) * 6, 2, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#2a1810"; g.fillRect(88, 96, 5, 2); g.fillRect(100, 96, 5, 2); g.fillRect(93, 110, 7, 2);
    } else {
      g.fillStyle = "#3a3a40"; g.beginPath(); g.moveTo(36, h); g.quadraticCurveTo(46, 150, 96, 142); g.quadraticCurveTo(146, 150, 156, h); g.fill();
      g.strokeStyle = "#8a8a90"; g.lineWidth = 2; for (let y = 160; y < h; y += 12) { g.beginPath(); g.moveTo(50, y); g.lineTo(142, y); g.stroke(); }
      g.fillStyle = "#d8c0a8"; g.beginPath(); g.ellipse(96, 104, 20, 26, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2a1a10"; g.fillRect(80, 112, 32, 16); g.fillRect(76, 78, 40, 10);
    }
    g.strokeStyle = "rgba(255,230,180,.08)"; for (let i = 0; i < 60; i++) { g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + 4); g.stroke(); }
  });
}

/* ===================================================================== build */
export function buildWorld(scene, colliders, onProgress = () => {}, tier = 1) {
  const r = rng(1614), W = { surface: new Group(), inside: new Group(), glows: [], flames: [], candles: [], mist: [], windowsLit: [], winPanes: [] };
  scene.add(W.surface, W.inside); W.inside.visible = false;
  const S = W.surface, In = W.inside, ONE = new Object3D(), col = new Color();
  const white = [], stone = [], roofs = [], wood = [], dark = [], cloth = [], rock = [], plaster = [];
  const SH = surfaceH;

  /* ---------------- terrain ---------------- */
  onProgress(0.04, "Raising the hill of Csejte…");
  {
    const g = new PlaneGeometry(230, 290, 140, 176); g.rotateX(-Math.PI / 2); g.translate(0, 0, -60);
    const p = g.attributes.position, cl = new Float32Array(p.count * 3), c = new Color(), c2 = new Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = SH(x, z); p.setY(i, y);
      const sl = Math.hypot(SH(x + 1, z) - y, SH(x, z + 1) - y), n = fbm(x * 0.07, z * 0.07, 3), d = Math.hypot(x / 1.15, z - C[1]);
      c.set(0x6a7438).lerp(c2.set(0x8a8a48), n * 0.6);
      if (Math.hypot(x, z - 2) < 34) { c.set(0x76703e).lerp(c2.set(0x8a7a58), sm(4, 1.5, Math.min(Math.abs(x) < 33 ? Math.abs(z - 3) : 9, Math.abs(x) < 3 ? 0 : 9))); if (Math.hypot(x, z - 3) < 10) c.set(0x8c8270).lerp(c2.set(0x7a7060), n); }
      if (sl > 0.8) c.lerp(c2.set(0xa8a49a), sm(0.8, 1.7, sl));                      // white limestone of the castle hill
      if (d < 26) c.set(0x9a948a).lerp(c2.set(0x847e72), n);
      if (roadDist(x, z) < 2.2 && z < -26) c.set(0x8a7a5c);
      cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(cl, 3)); g.computeVertexNormals();
    const m = new Mesh(g, VC()); m.matrixAutoUpdate = false; S.add(m);
    // the Little Carpathians and the Váh valley's far hills, hazy silhouettes
    const parts = [];
    [[-260, -160, 150, 70], [-180, -320, 170, 85], [40, -380, 190, 60], [240, -260, 150, 50], [330, 0, 160, 40], [-330, 40, 170, 60], [-220, 220, 160, 35], [200, 240, 170, 30]].forEach(([x, z, R, H], k) => {
      const rr = rng(80 + k), gg = new ConeGeometry(R, H, 12, 3, true), pp = gg.attributes.position, cc = new Float32Array(pp.count * 3), a = new Color(0x8a96a0), b = new Color(0x3a4638);
      for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i) + H / 2, kk = yy / H; if (kk > 0.05 && kk < 0.98) { pp.setX(i, pp.getX(i) * (0.8 + rr() * 0.4)); pp.setZ(i, pp.getZ(i) * (0.8 + rr() * 0.4)); } col.copy(b).lerp(a, kk); cc[i * 3] = col.r; cc[i * 3 + 1] = col.g; cc[i * 3 + 2] = col.b; }
      gg.setAttribute("color", new Float32BufferAttribute(cc, 3)); gg.computeVertexNormals(); parts.push(put(gg, x, H / 2 - 20, z));
    });
    W.ranges = new Mesh(mergeGeometries(parts), new MeshBasicMaterial({ vertexColors: true, fog: false })); S.add(W.ranges);
  }

  /* ---------------- the village ---------------- */
  onProgress(0.14, "Whitewashing the village…");
  const HOUSES = [  // x, z, w, d, h, rot (quarter turns), stone?
    [-9, -6, 6, 5, 4.2, 0, 0], [-1, -10, 5, 5, 4, 0, 0], [7, -14, 6, 5, 4.2, 0, 1], [-24, -2, 5, 6, 4, 1, 0], [-25, 9, 6, 5, 3.8, 1, 0], [-20, 19, 6, 5, 4, 0, 1], [-11, 22, 5, 5, 3.8, 0, 0],
    [-2, 25, 6, 5, 4, 0, 0], [12, 24, 6, 5, 4.2, 0, 0], [21, 22, 5, 5, 3.8, 0, 1], [25, 3, 5, 6, 4, 3, 0], [24, -9, 6, 5, 4.2, 3, 0], [18, -18, 5, 5, 3.8, 0, 0], [-15, 8, 5, 5, 4, 1, 1], [16, 9, 5, 5, 4, 3, 0],
    [-30, 20, 5, 5, 3.6, 0, 0], [30, 14, 5, 5, 3.6, 3, 0], [-6, -19, 5, 5, 3.8, 0, 1],
  ];
  const winL = [], winD = [];
  HOUSES.forEach(([x, z, w, d, h, rot, isStone], i) => {
    const ry = rot * Math.PI / 2, gy = Math.min(SH(x - w / 2, z - d / 2), SH(x + w / 2, z + d / 2), SH(x, z)) - 0.5, loc = [];
    loc.push([isStone ? "s" : "w", paint(put(new BoxGeometry(w, h + 0.5, d), 0, (h + 0.5) / 2, 0), isStone ? [0xb0aa9c, 0xa49e90][i % 2] : [0xe6e0d2, 0xdcd6c6, 0xe8dcc8][i % 3], 0.06, r)]);
    loc.push(["s", paint(put(new BoxGeometry(w + 0.1, 0.6, d + 0.1), 0, 0.3, 0), 0x8a8478)]);
    const rise = w * 0.62; loc.push(["r", paint(put(gable(w, d, rise, 0.45), 0, h + 0.5, 0), [0x5a4632, 0x4e3c2a, 0x64503a][i % 3], 0.12, r)]);   // steep shingle roofs
    loc.push(["k", paint(put(new BoxGeometry(1.0, 1.9, 0.1), w * 0.2 * (i % 2 ? 1 : -1), 1.45, d / 2 + 0.03), 0x3e2a1a)]);
    for (const fx of [-w * 0.3, w * 0.3]) if (Math.abs(fx - w * 0.2 * (i % 2 ? 1 : -1)) > 0.8) loc.push([(i + fx) % 3 < 1.2 ? "L" : "D", put(new PlaneGeometry(0.6, 0.7), fx, 2.6, d / 2 + 0.03)]);
    loc.push(["D", put(new PlaneGeometry(0.5, 0.6), 0, h + 0.5 + rise * 0.4, d / 2 + 0.02)]);
    if (i % 3 === 0) loc.push(["s", paint(put(new BoxGeometry(0.6, 1.6, 0.6), w * 0.25, h + rise * 0.7, -d * 0.1), 0x8a8478)]);
    if (i % 4 === 1) for (let k = 0; k < 7; k++) loc.push(["k", paint(put(new BoxGeometry(0.08, 1.0, 0.08), -w / 2 - 0.6 + k * 0.6 - 2, 0.5, d / 2 + 1.6), 0x6a5236)]);   // a picket fence
    for (const [kind, g] of loc) { put(g, x, gy, z, ry); ({ s: stone, w: white, r: roofs, k: wood, L: winL, D: winD })[kind].push(g); }
    const hw = (rot % 2 ? d : w) / 2 + 0.1, hd = (rot % 2 ? w : d) / 2 + 0.1; colliders.box(x - hw, z - hd, x + hw, z + hd, "house");
  });
  // the church: white nave, stone tower with a tall spire
  {
    const [cx, cz] = L.church, gy = SH(cx, cz) - 0.4;
    white.push(paint(put(new BoxGeometry(8, 7, 15), cx, gy + 3.5, cz), 0xe4ddcc)); roofs.push(paint(put(gable(15, 8, 4.5, 0.4), cx, gy + 7, cz, Math.PI / 2), 0x5a4a3a));
    stone.push(paint(put(new BoxGeometry(4.2, 15, 4.2), cx, gy + 7.5, cz + 9), 0xb4ae9e)); roofs.push(paint(put(new ConeGeometry(3, 12, 8), cx, gy + 21, cz + 9, Math.PI / 8), 0x3e3a36));
    for (const [ox, oz, ry] of [[0, 2.12, 0], [2.12, 0, Math.PI / 2], [-2.12, 0, Math.PI / 2]]) dark.push(paint(put(new BoxGeometry(0.9, 1.8, 0.1), cx + ox, gy + 12.5, cz + 9 + oz, ry), 0x141210));
    dark.push(paint(put(new BoxGeometry(1.6, 2.8, 0.12), cx, gy + 1.4, cz + 11.15), 0x2a1c12));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) winD.push(put(new PlaneGeometry(0.7, 2.2), cx + s * 4.03, gy + 3.8, cz - 4 + k * 4, s * Math.PI / 2));
    colliders.box(cx - 4.3, cz - 7.8, cx + 4.3, cz + 7.6, "church"); colliders.box(cx - 2.3, cz + 6.8, cx + 2.3, cz + 11.2, "tower");
    W.belfry = new Vector3(cx, gy + 12.5, cz + 9);
  }
  // the inn: bigger, with a sign and a bench
  {
    const [ix0, iz0] = L.inn, gy = SH(ix0, iz0) - 0.4;
    white.push(paint(put(new BoxGeometry(9, 5, 7), ix0, gy + 2.5, iz0), 0xe0d8c4)); roofs.push(paint(put(gable(9, 7, 5, 0.5), ix0, gy + 5, iz0), 0x4e3c2a));
    wood.push(paint(put(new BoxGeometry(1.4, 2.1, 0.1), ix0 - 2, gy + 1.05, iz0 + 3.55), 0x3e2a1a), paint(put(new BoxGeometry(0.1, 0.1, 1.4), ix0 + 1, gy + 3.2, iz0 + 4.2), 0x3e2a1a), paint(put(new BoxGeometry(1.1, 0.7, 0.06), ix0 + 1, gy + 2.7, iz0 + 4.85), 0x7a1f2b));
    wood.push(paint(put(new BoxGeometry(2.4, 0.12, 0.5), ix0 + 2, gy + 0.5, iz0 + 4.2), 0x5a3e24));
    for (const fx of [-3, 0.5, 3]) winL.push(put(new PlaneGeometry(0.8, 0.8), ix0 + fx, gy + 2.6, iz0 + 3.53));
    colliders.box(ix0 - 4.6, iz0 - 3.6, ix0 + 4.6, iz0 + 3.6, "inn");
  }
  // the market: stalls with muted awnings (madder, woad, weld), crates, a cart, the well, the wash-place and its stream
  {
    const stalls = [[4, 8, 0x7a2a28], [-4.5, 7, 0x3a4a6a], [7.5, 0, 0x9a7a2a], [-7, -0.5, 0x5a3a4a]];
    stalls.forEach(([x, z, c], k) => { const y = SH(x, z), ry = Math.atan2(-x, -(z - 3));
      const st = []; for (const [ox, oz] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) st.push(paint(put(new BoxGeometry(0.1, 2.2, 0.1), ox, 1.1, oz), 0x5a4028));
      st.push(paint(put(new BoxGeometry(2.5, 0.8, 1.2), 0, 0.4, 0), 0x6a4a2c)); const aw = paint(put(new BoxGeometry(2.8, 0.06, 1.6), 0, 2.25, 0, 0, 0.12), c); st.forEach(g => { put(g, x, y, z, ry); wood.push(g); }); put(aw, x, y, z, ry); cloth.push(aw);
      for (let q = 0; q < 5; q++) { const f = paint(put(new IcosahedronGeometry(0.13, 0), -0.9 + q * 0.45, 0.92, 0), [0xa83a2a, 0xd8b040, 0x6a8a2a, 0x8a5a9a, 0xe8d8a0][(q + k) % 5]); put(f, x, y, z, ry); cloth.push(f); }
      colliders.box(x - 1.4, z - 0.8, x + 1.4, z + 0.8, "stall", y + 2.5); });   // low: the camera passes over the awning
    { const [wx, wz] = L.well, y = SH(wx, wz); stone.push(paint(put(new CylinderGeometry(1.1, 1.2, 0.9, 10), wx, y + 0.45, wz), 0xa49e90)); for (const s of [-1, 1]) wood.push(paint(put(new BoxGeometry(0.15, 2.2, 0.15), wx + s * 0.9, y + 1.1, wz), 0x5a4028)); wood.push(paint(put(new CylinderGeometry(0.12, 0.12, 2, 6), wx, y + 2.1, wz, 0, 0, Math.PI / 2), 0x5a4028)); colliders.circle(wx, wz, 1.3); }
    { const [sx, sz] = L.wash; W.stream = new Mesh(put(new PlaneGeometry(4, 40), sx + 3.5, SH(sx, sz) + 0.05, sz - 4, 0, -Math.PI / 2, 0.2), new MeshStandardMaterial({ color: 0x3a5058, roughness: 0.1, metalness: 0.4 })); S.add(W.stream); stone.push(paint(put(new BoxGeometry(2.4, 0.5, 1.2), sx + 1.2, SH(sx, sz) + 0.25, sz), 0x9a9486)); }
    { const cx = -3, cz = -4, y = SH(cx, cz); wood.push(paint(put(new BoxGeometry(1.6, 0.6, 2.6), cx, y + 0.9, cz, 0.4), 0x6e4e2e)); for (const s of [-1, 1]) wood.push(paint(put(new CylinderGeometry(0.6, 0.6, 0.12, 10), cx + s * 0.85, y + 0.6, cz, 0.4, 0, Math.PI / 2), 0x4e3620)); colliders.circle(cx, cz, 1.4); }
    for (const [hx, hz] of [[-28, -14], [28, -16], [-31, 2], [30, 24]]) { const y = SH(hx, hz); roofs.push(paint(put(new ConeGeometry(1.6, 2.6, 8), hx, y + 1.3, hz), 0xb8a060)); colliders.circle(hx, hz, 1.6); }   // haystacks
    for (const [bx, bz] of [[9, -2], [13, 0.5], [-2, 9.5], [6.5, 9]]) { const y = SH(bx, bz); wood.push(paint(put(new BoxGeometry(0.7, 0.6, 0.7), bx, y + 0.3, bz, bx), 0x7a5a36)); colliders.circle(bx, bz, 0.5); }
  }
  bake(white, masonry(VC(), "rock"), S); bake(stone, masonry(VC(), "rough"), S); bake(roofs, masonry(VC(), "tile"), S); bake(wood, VC(), S); bake(dark, VC(), S); bake(cloth, VC(), S);
  W.winMat = new MeshBasicMaterial({ color: 0x3a2a18 }); bake(winL, W.winMat, S); bake(winD, new MeshBasicMaterial({ color: 0x12100e }), S);

  /* ---------------- woods, vineyards ---------------- */
  onProgress(0.3, "Planting the oak woods and the vines…");
  {
    const N = [170, 280, 380][tier] || 280, spots = [];
    for (let t = 0; spots.length < N && t < 8000; t++) {
      const x = (r() * 2 - 1) * 105, z = 40 - r() * 230, d = Math.hypot(x / 1.15, z - C[1]);
      if (Math.hypot(x, z - 2) < 38 || d < 27 || roadDist(x, z) < 4.5 || (z < -28 && z > -64 && Math.abs(x) > 14 && Math.abs(x) < 48)) continue;
      if (r() > 0.25 + fbm(x * 0.04, z * 0.04, 2) * 0.9) continue; spots.push([x, z, 0.8 + r() * 0.7]);
    }
    const tr = new InstancedMesh(new CylinderGeometry(0.2, 0.32, 1, 6).translate(0, 0.5, 0), new MeshLambertMaterial({ color: 0x4a3a2c, flatShading: true }), spots.length);
    const cr = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.length);
    spots.forEach(([x, z, s], i) => { const y = SH(x, z) - 0.2, h = 4.5 * s; ONE.position.set(x, y, z); ONE.rotation.set(0, r() * 6, 0); ONE.scale.set(s, h, s); ONE.updateMatrix(); tr.setMatrixAt(i, ONE.matrix);
      ONE.position.set(x, y + h * 0.95, z); ONE.scale.set((2.4 + r()) * s, (2.0 + r()) * s, (2.4 + r()) * s); ONE.updateMatrix(); cr.setMatrixAt(i, ONE.matrix); cr.setColorAt(i, col.set([0x3e5626, 0x4a5e2a, 0x55602c, 0x34481f][i % 4]).multiplyScalar(0.85 + r() * 0.3)); if (walkable(x, z)) colliders.circle(x, z, 0.5 * s); });
    cr.instanceColor.needsUpdate = true; S.add(tr, cr);
    const vines = []; for (const sx of [-1, 1]) for (let row = 0; row < 9; row++) for (let k = 0; k < 14; k++) { const x = sx * (16 + row * 3.6), z = -30 - k * 2.4; if (roadDist(x, z) < 4) continue; vines.push([x, z]); }
    const vm = new InstancedMesh(new BoxGeometry(0.5, 1.1, 0.9), new MeshLambertMaterial({ color: 0x4a6a2a, flatShading: true }), vines.length);
    vines.forEach(([x, z], i) => { ONE.position.set(x, SH(x, z) + 0.5, z); ONE.rotation.set(0, 0, 0); ONE.scale.set(1, 0.8 + r() * 0.4, 1); ONE.updateMatrix(); vm.setMatrixAt(i, ONE.matrix); }); S.add(vm);
    const nR = 80, rk = new InstancedMesh(new DodecahedronGeometry(1, 0), new MeshLambertMaterial({ color: 0xb4b0a4, flatShading: true }), nR);
    for (let k = 0; k < nR; k++) { const a = r() * 6.283, rr = 26 + r() * 22, x = Math.sin(a) * rr * 1.15, z = C[1] + Math.cos(a) * rr; if (roadDist(x, z) < 3) { k--; continue; } const s = 0.5 + r() * 1.8; ONE.position.set(x, SH(x, z) + s * 0.2, z); ONE.rotation.set(r() * 3, r() * 3, r()); ONE.scale.set(s, s * 0.7, s); ONE.updateMatrix(); rk.setMatrixAt(k, ONE.matrix); } S.add(rk);
    // the road: a ribbon of packed earth
    const pos = [], cl = [];
    for (let i = 0; i < ROAD.length - 1; i++) { const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 1.2), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz * 1.4, nz = ux * 1.4;
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, P = t => [ax + (bx - ax) * t, az + (bz - az) * t], v = (p, s) => [p[0] + nx * s, SH(p[0] + nx * s, p[1] + nz * s) + 0.06, p[1] + nz * s];
        const p0 = P(t0), p1 = P(t1), a = v(p0, -1), b = v(p0, 1), c = v(p1, 1), d = v(p1, -1); pos.push(...a, ...b, ...c, ...a, ...c, ...d); col.set(0x8a7a5c).multiplyScalar(0.92 + r() * 0.12); for (let q = 0; q < 6; q++) cl.push(col.r, col.g, col.b); } }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setAttribute("color", new Float32BufferAttribute(cl, 3)); g.computeVertexNormals();
    S.add(new Mesh(g, new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 })));
  }

  /* ---------------- the castle: lower and middle terraces, upper castle ---------------- */
  onProgress(0.42, "Building the castle of Csejte…");
  {
    const [cx, cz] = C, top = 42;
    const ring = (rad, h, base, seg, gapA = null) => { for (let k = 0; k < seg; k++) { const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2; if (gapA != null && Math.abs(Math.atan2(Math.sin(am - gapA), Math.cos(am - gapA))) < 0.18) continue;
      const x0 = cx + Math.sin(a0) * rad * 1.15, z0 = cz + Math.cos(a0) * rad, x1 = cx + Math.sin(a1) * rad * 1.15, z1 = cz + Math.cos(a1) * rad, L2 = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, y = Math.min(SH(x0, z0), SH(x1, z1));
      rock.push(paint(put(new BoxGeometry(L2 + 0.3, h + (base - y) + 6, 1.6), mx, y - 6 + (h + (base - y) + 6) / 2, mz, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2), 0xb2ad9f, 0.08, r));
      for (let q = 0; q < Math.floor(L2 / 1.8); q++) { const t = (q + 0.5) / Math.floor(L2 / 1.8); rock.push(paint(put(new BoxGeometry(0.9, 0.9, 1.6), x0 + (x1 - x0) * t, Math.max(base, y) + h + 0.45, z0 + (z1 - z0) * t, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2), 0xaaa597)); } } };
    ring(33, 5, 26, 30, 0); ring(27, 6, 34, 26, 0.05);                                   // lower and middle castle
    // upper castle curtain with towers
    for (let k = 0; k < 18; k++) { const a0 = k / 18 * Math.PI * 2, a1 = (k + 1) / 18 * Math.PI * 2, am = (a0 + a1) / 2; if (Math.abs(Math.atan2(Math.sin(am), Math.cos(am))) < 0.12) continue;
      const R = 20.5, x0 = cx + Math.sin(a0) * R * 1.05, z0 = cz + Math.cos(a0) * R, x1 = cx + Math.sin(a1) * R * 1.05, z1 = cz + Math.cos(a1) * R, L2 = Math.hypot(x1 - x0, z1 - z0);
      rock.push(paint(put(new BoxGeometry(L2 + 0.4, 16, 2), (x0 + x1) / 2, top - 4 + 8, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2), 0xbab4a6, 0.06, r));
      for (let q = 0; q < Math.floor(L2 / 1.6); q++) { const t = (q + 0.5) / Math.floor(L2 / 1.6); rock.push(paint(put(new BoxGeometry(0.8, 1, 2), x0 + (x1 - x0) * t, top + 12.5, z0 + (z1 - z0) * t, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2), 0xb0aa9c)); } }
    for (const a of [0.9, 2.2, 3.6, 4.6, 5.4]) { const x = cx + Math.sin(a) * 21 * 1.05, z = cz + Math.cos(a) * 21; rock.push(paint(put(new CylinderGeometry(3, 3.4, 22, 12), x, top + 5, z), 0xb8b2a4)); roofs.push(paint(put(new ConeGeometry(3.8, 7, 12), x, top + 19.5, z), 0x4a3a30)); }
    // the gate tower over the entrance (south)
    rock.push(paint(put(new BoxGeometry(8, 22, 6), cx, top + 7, cz + 21), 0xbcb6a8)); roofs.push(paint(put(new ConeGeometry(6, 7, 4), cx, top + 21.5, cz + 21, Math.PI / 4), 0x4a3a30));
    dark.push(paint(put(new BoxGeometry(3.4, 4.6, 6.2), cx, top + 2.3, cz + 21), 0x0c0a08));
    dark.push(paint(put(new BoxGeometry(0.7, 1.4, 0.1), cx - 2, top + 11, cz + 24.05), 0x141210), paint(put(new BoxGeometry(0.7, 1.4, 0.1), cx + 2, top + 11, cz + 24.05), 0x141210));
    // the horseshoe-shaped keep (the castle's oldest tower), west of the courtyard
    { const kx0 = cx - 13, kz0 = cz - 1; const g = new CylinderGeometry(5, 5.4, 28, 16, 1, false, -Math.PI * 0.15, Math.PI * 1.3); rock.push(paint(put(g, kx0, top + 10, kz0), 0xc2bcae, 0.05, r));
      rock.push(paint(put(new BoxGeometry(7.2, 28, 2), kx0 + 1.4, top + 10, kz0 + 4.3, -0.4), 0xc2bcae)); roofs.push(paint(put(new ConeGeometry(6.2, 9, 16), kx0, top + 28.5, kz0), 0x3e3430));
      for (const y of [8, 14, 20]) winD.push(put(new PlaneGeometry(0.6, 1.4), kx0 + 5.3 * Math.sin(1.2), top + y, kz0 + 5.3 * Math.cos(1.2), 1.2)); }
    // the palace on the north side: plastered, with sgraffito rustication, two storeys of windows, the door to the great hall
    { const pz = L.palaceZ - 4; plaster.push(paint(put(new BoxGeometry(30, 15, 8), cx, top + 7.5, pz), 0xd8d0be)); roofs.push(paint(put(gable(30, 8, 5, 0.5), cx, top + 15, pz), 0x5a3a2c));
      for (let k = 0; k < 8; k++) { const x = cx - 12.25 + k * 3.5; if (Math.abs(x - cx) < 1.5) continue; W.windowsLit.push(put(new PlaneGeometry(1, 1.8), x, top + 4, pz + 4.03)); W.windowsLit.push(put(new PlaneGeometry(1, 1.8), x, top + 10, pz + 4.03)); stone.push(paint(put(new BoxGeometry(1.4, 0.2, 0.25), x, top + 3, pz + 4.1), 0xb8b0a0)); }
      stone.push(paint(put(new BoxGeometry(3.2, 4.4, 0.4), cx, top + 2.2, pz + 4.1), 0xbab2a2)); dark.push(paint(put(new BoxGeometry(2.2, 3.4, 0.2), cx, top + 1.7, pz + 4.35), 0x2a1810));
      const ga = put(new TorusGeometry(1.1, 0.25, 6, 12, Math.PI), cx, top + 3.4, pz + 4.4); stone.push(paint(ga, 0xbab2a2));
      W.palaceDoor = new Vector3(cx, top + 1.7, pz + 4.5); colliders.box(cx - 15.2, pz - 4.2, cx + 15.2, pz + 4.2, "palace"); }
    // the Renaissance loggia on the east side: arcades on columns
    { const lx = cx + 12.5; for (let k = 0; k < 6; k++) { const z = cz - 6 + k * 3.2 - 6; stone.push(paint(put(new CylinderGeometry(0.28, 0.32, 4, 10), lx - 2.6, top + 2, z + 8), 0xd4ccbc)); if (k < 5) stone.push(paint(put(new TorusGeometry(1.6, 0.25, 5, 10, Math.PI), lx - 2.6, top + 4, z + 9.6, Math.PI / 2), 0xd4ccbc)); }
      plaster.push(paint(put(new BoxGeometry(5, 9, 18), lx + 0.6, top + 4.5, cz - 1), 0xdcd4c2)); roofs.push(paint(put(gable(18, 5, 2.6, 0.4), lx + 0.6, top + 9, cz - 1, Math.PI / 2), 0x5a3a2c)); stone.push(paint(put(new BoxGeometry(5.6, 0.4, 18), lx - 1.3, top + 4.4, cz - 1), 0xc8c0b0)); }
    // a well and carts in the courtyard; torches
    { const y = top; stone.push(paint(put(new CylinderGeometry(1, 1.1, 0.9, 10), cx - 4, y + 0.45, cz + 6), 0xa8a294)); colliders.circle(cx - 4, cz + 6, 1.2); wood.push(paint(put(new BoxGeometry(1.6, 0.6, 2.4), cx + 6, y + 0.8, cz + 10, 0.3), 0x5e4028)); colliders.circle(cx + 6, cz + 10, 1.4); }
    for (const [x, z] of [[-3.5, -125.4], [3.5, -125.4], [-1.5, -101.5], [1.5, -101.5]]) { const s = glowSprite("255,170,90", 2.4); s.position.set(x, top + 3, z); S.add(s); W.glows.push(s); W.flames.push(s); }
  }
  bake(rock, masonry(VC(), "rough"), S); bake(plaster, masonry(VC(), "stone"), S); bake(stone, masonry(VC(), "stone"), S); bake(roofs, masonry(VC(), "tile"), S); bake(wood, VC(), S); bake(dark, VC(), S);
  W.castleWinMat = new MeshBasicMaterial({ color: 0x3a2a18 }); bake(W.windowsLit, W.castleWinMat, S); bake(winD, new MeshBasicMaterial({ color: 0x0e0c0a }), S);
  { const n = 70, g = new BufferGeometry(), p = new Float32Array(n * 3); for (let k = 0; k < n; k++) { p[k * 3] = (r() * 2 - 1) * 90; p[k * 3 + 1] = 8 + r() * 40; p[k * 3 + 2] = -r() * 200; } g.setAttribute("position", new Float32BufferAttribute(p, 3)); W.crows = new Points(g, new PointsMaterial({ color: 0x0a0a0c, size: 0.5, transparent: true, opacity: 0.8 })); S.add(W.crows); }
  for (let k = 0; k < (tier ? 9 : 5); k++) { const s = glowSprite("200,200,210", 30 + r() * 24); const x = (r() * 2 - 1) * 80, z = -20 - r() * 160; s.position.set(x, SH(x, z) + 4 + r() * 6, z); s.material.opacity = 0.1; s.userData.ph = r() * 6; S.add(s); W.mist.push(s); }

  /* ===================================================================== the interiors ===================================================================== */
  onProgress(0.56, "Lighting the candles…");
  const iw = [], ipl = [], iwood = [], idark = [], ifloor = [], igold = [], icloth = [], itile = [], irock = [];
  const ip = (x, y, z) => [I.x + x, y, I.z + z];
  const WALL = { hall: 0x9c968a, stone: 0x928c80, plaster: 0xd4cab4, wood: 0x5a3e2a, chamber: 0xc8b8a0, rough: 0x7e786c };
  for (const [k, [x0, x1, z0, z1, h, kind]] of Object.entries(ROOMS)) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wcol = WALL[kind], list = kind === "hall" || kind === "stone" || kind === "rough" ? irock : ipl, T = 0.3;
    ifloor.push(paint(put(new BoxGeometry(x1 - x0, 0.2, z1 - z0), ...ip(cx, -0.1, cz)), kind === "wood" || kind === "chamber" ? 0x5a4030 : 0x7a7468));
    // ceiling with beams
    idark.push(paint(put(new BoxGeometry(x1 - x0, 0.2, z1 - z0), ...ip(cx, h + 0.1, cz)), kind === "rough" ? 0x3a342c : 0x3a2a1e));
    if (kind !== "rough") { const along = x1 - x0 > z1 - z0; const n = Math.floor((along ? x1 - x0 : z1 - z0) / 1.6); for (let q = 1; q < n; q++) { const t = q / n; iwood.push(paint(along ? put(new BoxGeometry(0.28, 0.32, z1 - z0), ...ip(x0 + (x1 - x0) * t, h - 0.16, cz)) : put(new BoxGeometry(x1 - x0, 0.32, 0.28), ...ip(cx, h - 0.16, z0 + (z1 - z0) * t)), 0x3a2618)); } }
    // walls with door gaps
    const walls = [["x", z0 + T / 2, x0, x1], ["x", z1 - T / 2, x0, x1], ["z", x0 + T / 2, z0, z1], ["z", x1 - T / 2, z0, z1]];
    for (const [axis, at, a0, a1] of walls) {
      const line = axis === "x" ? (Math.abs(at - z0 - T / 2) < 0.01 ? z0 : z1) : (Math.abs(at - x0 - T / 2) < 0.01 ? x0 : x1);
      const gaps = DOORS.filter(d => d.axis === axis && Math.abs(d.at - line) < 0.01 && d.c > a0 && d.c < a1).map(d => [d.c - d.w / 2, d.c + d.w / 2, d]).sort((p, q) => p[0] - q[0]);
      let s0 = a0; const seg = (u0, u1) => { if (u1 - u0 < 0.05) return; const m = (u0 + u1) / 2, len = u1 - u0; list.push(paint(axis === "x" ? put(new BoxGeometry(len, h, T), ...ip(m, h / 2, at)) : put(new BoxGeometry(T, h, len), ...ip(at, h / 2, m)), wcol, 0.04, r));
        if (kind === "plaster" || kind === "chamber" || kind === "wood") iwood.push(paint(axis === "x" ? put(new BoxGeometry(len, 1.1, 0.06), ...ip(m, 0.55, at + (at < cz ? T / 2 + 0.03 : -T / 2 - 0.03))) : put(new BoxGeometry(0.06, 1.1, len), ...ip(at + (at < cx ? T / 2 + 0.03 : -T / 2 - 0.03), 0.55, m)), 0x3e2a1c)); };
      for (const [g0, g1, d] of gaps) { seg(s0, g0); s0 = g1; const lh = d.id === "secret" ? 2.4 : Math.min(h - 0.4, 3); list.push(paint(axis === "x" ? put(new BoxGeometry(g1 - g0, h - lh, T), ...ip((g0 + g1) / 2, lh + (h - lh) / 2, at)) : put(new BoxGeometry(T, h - lh, g1 - g0), ...ip(at, lh + (h - lh) / 2, (g0 + g1) / 2)), wcol)); }
      seg(s0, a1);
    }
  }
  // locked doors (leaves), the secret bookcase, the palace door
  W.doorLeaves = {};
  for (const d of DOORS.filter(d => d.lock)) {
    const m = d.id === "secret" ? new Mesh(new BoxGeometry(0.35, 2.4, d.w), new MeshLambertMaterial({ color: 0x4a3020 })) : new Mesh(new BoxGeometry(d.axis === "x" ? d.w : 0.12, 2.9, d.axis === "x" ? 0.12 : d.w), new MeshLambertMaterial({ color: 0x3a2416 }));
    m.position.set(I.x + (d.axis === "x" ? d.c : d.at), d.id === "secret" ? 1.2 : 1.45, I.z + (d.axis === "x" ? d.at : d.c)); In.add(m); W.doorLeaves[d.lock] = m;
    if (d.id === "secret") for (let k = 0; k < 4; k++) { const b = new Mesh(new BoxGeometry(0.3, 0.05, d.w - 0.1), new MeshLambertMaterial({ color: 0x2a1a10 })); b.position.y = -1 + k * 0.6; m.add(b); }
  }
  // --- the great hall: long table, chairs, fireplace, tapestries, banners, chandelier, tall windows
  { const tap = new MeshLambertMaterial({ map: tapestryTex() }), ban = new MeshLambertMaterial({ map: bannerTex(), side: DoubleSide });
    for (const [x, z, ry] of [[-8.82, -3, Math.PI / 2], [-8.82, -9, Math.PI / 2], [8.82, -3, -Math.PI / 2], [8.82, -9, -Math.PI / 2]]) { const t = new Mesh(new PlaneGeometry(2.6, 3.9), tap); t.position.set(I.x + x, 3.6, I.z + z); t.rotation.y = ry; In.add(t); }
    for (const x of [-4, 4]) { const b = new Mesh(new PlaneGeometry(1.2, 2.4), ban); b.position.set(I.x + x, 5.2, I.z - 11.8); In.add(b); }
    iwood.push(paint(put(new BoxGeometry(2.2, 0.14, 9), ...ip(0, 0.92, -5)), 0x4a2e1c)); for (const [x, z] of [[-0.9, -1], [0.9, -1], [-0.9, -9], [0.9, -9]]) iwood.push(paint(put(new BoxGeometry(0.16, 0.85, 0.16), ...ip(x, 0.43, z)), 0x3a2416));
    for (const s of [-1, 1]) iwood.push(paint(put(new BoxGeometry(0.5, 0.45, 8.4), ...ip(s * 1.7, 0.45, -5)), 0x3e2818));
    iwood.push(paint(put(new BoxGeometry(1, 2.4, 0.2), ...ip(0, 1.2, -10.2)), 0x3a2416), paint(put(new BoxGeometry(1, 0.5, 0.9), ...ip(0, 0.5, -9.8)), 0x4a2e1c));   // the countess's high chair
    irock.push(paint(put(new BoxGeometry(6, 0.4, 2.4), ...ip(0, 0.2, -10.8)), 0x8a8478));   // the dais
    irock.push(paint(put(new BoxGeometry(3.6, 3.2, 0.9), ...ip(0, 1.6, -11.5)), 0x6e685e), paint(put(new BoxGeometry(4.4, 0.4, 1.2), ...ip(0, 3.3, -11.4)), 0x8a8478)); idark.push(paint(put(new BoxGeometry(2.4, 1.8, 0.2), ...ip(0, 0.9, -11.08)), 0x0c0806));
    iwood.push(paint(put(new BoxGeometry(1.4, 0.8, 0.8), ...ip(L.obj.hall_chest[0] + 2.4, 0.4, L.obj.hall_chest[1] + 0.3)), 0x4a3020)); igold.push(paint(put(new BoxGeometry(1.45, 0.08, 0.85), ...ip(L.obj.hall_chest[0] + 2.4, 0.62, L.obj.hall_chest[1] + 0.3)), 0x8a6a2a));
    colliders.box(I.x - 1.2, I.z - 9.6, I.x + 1.2, I.z - 0.4); colliders.box(I.x - 2.1, I.z - 9.3, I.x - 1.4, I.z - 0.7); colliders.box(I.x + 1.4, I.z - 9.3, I.x + 2.1, I.z - 0.7); colliders.box(I.x - 2.2, I.z - 12, I.x + 2.2, I.z - 10.9); colliders.box(I.x + 1.6, I.z - 10.5, I.x + 3.2, I.z - 9.7);
    const ring = new Mesh(new TorusGeometry(1.4, 0.06, 6, 24), new MeshLambertMaterial({ color: 0x2a2018 })); ring.rotation.x = Math.PI / 2; ring.position.set(I.x, 5.4, I.z - 5); In.add(ring);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = Math.cos(a) * 1.4, z = -5 + Math.sin(a) * 1.4; W.candles.push([x, 5.55, z]); }
    for (const z of [-3, -9]) for (const x of [-5.5, 5.5]) { const w = new Mesh(new PlaneGeometry(1.2, 3), new MeshBasicMaterial({ color: 0x48586e })); w.position.set(I.x + x, 3.4, I.z - 11.83); In.add(w); W.winPanes.push(w); }
    W.fire = new Vector3(I.x, 0.9, I.z - 11); const f1 = glowSprite("255,150,60", 3.2); f1.position.copy(W.fire); In.add(f1); W.flames.push(f1); const f2 = glowSprite("255,200,120", 1.6); f2.position.copy(W.fire).add(new Vector3(0.3, 0.2, 0.2)); In.add(f2); W.flames.push(f2);
    for (const [x, z] of [[-8.6, -6], [8.6, -6]]) W.candles.push([x * 0.95, 2.6, z + 2.2], [x * 0.95, 2.6, z - 2.2]); }
  // --- corridor and gallery: sconces; the gallery's portraits and windows
  { for (const x of [-21, -15, -11]) W.candles.push([x, 2.6, -7.35]);
    const pc = new MeshLambertMaterial({ map: portraitTex("countess") }), pf = new MeshLambertMaterial({ map: portraitTex("lord") });
    for (const [x, m] of [[16, pc], [12, pf], [20, pf]]) { const p = new Mesh(new PlaneGeometry(1.3, 1.75), m); p.position.set(I.x + x, 2.3, I.z - 7.28); In.add(p); igold.push(paint(put(new BoxGeometry(1.55, 2, 0.08), ...ip(x, 2.3, -7.4)), 0x8a6a2a)); }
    for (const x of [13, 18.5, 27]) { const w = new Mesh(new PlaneGeometry(1, 2.2), new MeshBasicMaterial({ color: 0x48586e })); w.position.set(I.x + x, 2.4, I.z - 4.72); w.rotation.y = Math.PI; In.add(w); W.winPanes.push(w); }
    for (const x of [11, 22, 28]) W.candles.push([x, 2.5, -4.75]); }
  // --- the dining room: table set with pewter, a cupboard, the green tiled stove (a fixture of Hungarian and Slovak houses)
  { iwood.push(paint(put(new BoxGeometry(2, 0.12, 5.5), ...ip(-19, 0.88, -13)), 0x4a2e1c)); for (const [x, z] of [[-19.8, -10.6], [-18.2, -10.6], [-19.8, -15.4], [-18.2, -15.4]]) iwood.push(paint(put(new BoxGeometry(0.14, 0.82, 0.14), ...ip(x, 0.41, z)), 0x3a2416));
    for (let k = 0; k < 6; k++) igold.push(paint(put(new CylinderGeometry(0.22, 0.2, 0.04, 10), ...ip(-19 + (k % 2 ? 0.6 : -0.6), 0.96, -11.2 - Math.floor(k / 2) * 1.6)), 0x9a9890));
    iwood.push(paint(put(new BoxGeometry(3, 2.2, 0.7), ...ip(-19, 1.1, -17.5)), 0x3e2818)); for (let k = 0; k < 4; k++) igold.push(paint(put(new CylinderGeometry(0.2, 0.2, 0.03, 10), ...ip(-20.2 + k * 0.8, 2.25, -17.55), 0, Math.PI / 2), 0xa8a8a0));
    itile.push(paint(put(new BoxGeometry(1.6, 1.6, 1.6), ...ip(-24, 0.8, -9)), 0x2e5a3e), paint(put(new BoxGeometry(1.3, 1.4, 1.3), ...ip(-24, 2.3, -9)), 0x2e5a3e), paint(put(new BoxGeometry(1.5, 0.2, 1.5), ...ip(-24, 3.1, -9)), 0x3a6a4a));
    colliders.box(I.x - 20.2, I.z - 15.9, I.x - 17.8, I.z - 10.1); colliders.box(I.x - 20.6, I.z - 18, I.x - 17.4, I.z - 17.1); colliders.box(I.x - 25, I.z - 9.9, I.x - 23.1, I.z - 8.1);
    for (const [x, z] of [[-19, -13], [-19, -11.4]]) W.candles.push([x, 1.12, z]); W.candles.push([-14, 2.6, -17.6]); }
  // --- the library: shelves of books, the lectern, the writing desk, the bookcase that hides the passage
  { const books = []; const shelf = (x, z, len, ry) => { for (let q = 0; q < 5; q++) { iwood.push(paint(put(new BoxGeometry(len, 0.06, 0.4), ...ip(x, 0.35 + q * 0.75, z), ry), 0x3a2416)); for (let b = 0; b < Math.floor(len / 0.11); b++) books.push([x, z, ry, -len / 2 + 0.06 + b * 0.11, 0.35 + q * 0.75 + 0.03, len]); } iwood.push(paint(put(new BoxGeometry(len + 0.1, 3.9, 0.08), ...ip(x + (ry ? 0.2 * Math.sign(-x) : 0), 1.95, z + (ry ? 0 : 0.2 * Math.sign(-z))), ry), 0x2e1c10)); };
    shelf(-19, 5.65, 9, 0); shelf(-24.6, -1.6, 2.6, Math.PI / 2); shelf(-24.6, 4.3, 2.6, Math.PI / 2); shelf(-13.4, -1.2, 4.6, Math.PI / 2);
    const bm = new InstancedMesh(new BoxGeometry(0.09, 1, 0.3), new MeshLambertMaterial({ color: 0xffffff }), books.length);
    books.forEach(([x, z, ry, u, y, len], i) => { const h = 0.42 + r() * 0.24; ONE.rotation.set(0, ry, (r() - 0.5) * 0.08); const lx = ry ? x : x + u, lz = ry ? z + u : z; ONE.position.set(I.x + lx, y + h / 2, I.z + lz); ONE.scale.set(1, h, 1); ONE.updateMatrix(); bm.setMatrixAt(i, ONE.matrix); bm.setColorAt(i, col.set([0x5a1a1a, 0x3a2a1a, 0x2a3a2a, 0x4a3a2a, 0x6a4a2a, 0x2a2a3a, 0x7a5a3a][i % 7]).multiplyScalar(0.7 + r() * 0.5)); });
    bm.instanceColor.needsUpdate = true; In.add(bm);
    iwood.push(paint(put(new CylinderGeometry(0.12, 0.2, 1.2, 8), ...ip(-19, 0.6, 3.4)), 0x3a2416), paint(put(new BoxGeometry(0.8, 0.08, 0.6), ...ip(-19, 1.25, 3.4), 0, -0.35), 0x3a2416), paint(put(new BoxGeometry(0.6, 0.1, 0.45), ...ip(-19, 1.32, 3.4), 0, -0.35), 0xe8dcc0));
    iwood.push(paint(put(new BoxGeometry(2, 0.1, 1), ...ip(-15, 0.86, 2.6)), 0x4a2e1c), paint(put(new BoxGeometry(1.9, 0.8, 0.9), ...ip(-15, 0.42, 2.6)), 0x3a2416), paint(put(new BoxGeometry(0.5, 0.04, 0.35), ...ip(-15.3, 0.93, 2.5)), 0xe8dcc0));
    colliders.circle(I.x - 19, I.z + 3.4, 0.45); colliders.box(I.x - 16.05, I.z + 2.05, I.x - 13.95, I.z + 3.15); colliders.box(I.x - 23.5, I.z + 5.2, I.x - 14.5, I.z + 6); colliders.box(I.x - 13.7, I.z - 3.5, I.x - 13, I.z + 1.1);
    for (const [x, z] of [[-15.6, 2.4], [-19, 3.1]]) W.candles.push([x, 1.05, z]); W.candles.push([-24.6, 2.6, -3.6]); }
  // --- the walled passage and the niche
  { for (let k = 0; k < 6; k++) irock.push(paint(put(new DodecahedronGeometry(0.3 + r() * 0.3, 0), ...ip(-30 + k * 0.9, 0.15, k % 2 ? 0.1 : 1.9)), 0x5a5448));
    irock.push(paint(put(new BoxGeometry(0.8, 0.6, 1), ...ip(-33.4, 0.9, 1)), 0x5e584c)); W.candles.push([-26, 1.6, 0.2]); }
  // --- the storeroom: barrels, crates, sacks, the accounts and the family chest
  { for (const [x, z] of [[19, -3.6], [19.9, -3.6], [19.45, -2.8], [29.2, 4.2], [28.3, 4.2]]) { iwood.push(paint(put(new CylinderGeometry(0.42, 0.38, 0.95, 10), ...ip(x, 0.47, z)), 0x5a3e24)); colliders.circle(I.x + x, I.z + z, 0.45); }
    for (const [x, z, s] of [[29, -3.4, 1], [28.9, -2.3, 0.8], [18.8, 4.3, 0.9]]) { iwood.push(paint(put(new BoxGeometry(s, s, s), ...ip(x, s / 2, z), x), 0x7a5a36)); colliders.box(I.x + x - s / 2, I.z + z - s / 2, I.x + x + s / 2, I.z + z + s / 2); }
    iwood.push(paint(put(new BoxGeometry(1.6, 1, 0.8), ...ip(27.2, 0.5, 2.2)), 0x4a3020), paint(put(new BoxGeometry(1.2, 0.8, 0.7), ...ip(20.4, 0.4, 3.2)), 0x3a2416)); igold.push(paint(put(new BoxGeometry(1.25, 0.08, 0.75), ...ip(20.4, 0.62, 3.2)), 0x8a6a2a));
    colliders.box(I.x + 26.4, I.z + 1.8, I.x + 28, I.z + 2.6); colliders.box(I.x + 19.8, I.z + 2.85, I.x + 21, I.z + 3.55); W.candles.push([24, 2.2, 4.7]); }
  // --- the countess's apartments: canopied bed, writing desk, chest, tiled stove, prie-dieu, window seat
  { iwood.push(paint(put(new BoxGeometry(2.4, 0.6, 3), ...ip(24, 0.3, -17.4)), 0x3a2416)); icloth.push(paint(put(new BoxGeometry(2.3, 0.25, 2.9), ...ip(24, 0.72, -17.4)), 0x6a1a26)); icloth.push(paint(put(new BoxGeometry(2.2, 0.12, 0.6), ...ip(24, 0.9, -18.6)), 0xe8e0d0));
    for (const [x, z] of [[22.8, -16], [25.2, -16], [22.8, -18.8], [25.2, -18.8]]) iwood.push(paint(put(new BoxGeometry(0.14, 3, 0.14), ...ip(x, 1.5, z)), 0x2a1a10));
    icloth.push(paint(put(new BoxGeometry(2.6, 0.12, 3.1), ...ip(24, 3, -17.4)), 0x5a1420), paint(put(new BoxGeometry(2.6, 2.2, 0.06), ...ip(24, 1.9, -18.95)), 0x4a1018));
    for (const s of [-1, 1]) icloth.push(paint(put(new BoxGeometry(0.06, 2.4, 0.9), ...ip(24 + s * 1.28, 1.8, -15.9)), 0x5a1420));
    iwood.push(paint(put(new BoxGeometry(1.4, 0.7, 0.7), ...ip(24, 0.35, -11.6 + 0)), 0x4a3020)); igold.push(paint(put(new BoxGeometry(1.45, 0.06, 0.75), ...ip(24, 0.7, -11.6)), 0x8a6a2a));
    iwood.push(paint(put(new BoxGeometry(1.6, 0.08, 0.8), ...ip(19.6, 0.85, -17.9)), 0x4a2e1c), paint(put(new BoxGeometry(1.5, 0.8, 0.7), ...ip(19.6, 0.42, -17.9)), 0x3a2416), paint(put(new BoxGeometry(0.4, 0.5, 0.04), ...ip(19.6, 1.15, -18.2)), 0x9ab0c0));
    itile.push(paint(put(new BoxGeometry(1.4, 1.5, 1.4), ...ip(17.9, 0.75, -9)), 0x7a2a22), paint(put(new BoxGeometry(1.1, 1.3, 1.1), ...ip(17.9, 2.15, -9)), 0x7a2a22), paint(put(new BoxGeometry(1.3, 0.18, 1.3), ...ip(17.9, 2.9, -9)), 0x8a3a2a));
    iwood.push(paint(put(new BoxGeometry(0.7, 0.9, 0.5), ...ip(29.8, 0.45, -10.5)), 0x3a2416));
    iwood.push(paint(put(new BoxGeometry(0.9, 0.45, 2.2), ...ip(30.4, 0.45, -16.4)), 0x4a2e1c)); icloth.push(paint(put(new BoxGeometry(0.85, 0.1, 2.1), ...ip(30.4, 0.72, -16.4)), 0x6a1a26));
    const w = new Mesh(new PlaneGeometry(1.4, 2.4), new MeshBasicMaterial({ color: 0x48586e })); w.position.set(I.x + 30.82, 2.2, I.z - 16.4); w.rotation.y = -Math.PI / 2; In.add(w); W.winPanes.push(w);
    const w2 = new Mesh(new PlaneGeometry(1.4, 2.4), new MeshBasicMaterial({ color: 0x48586e })); w2.position.set(I.x + 30.82, 2.2, I.z - 11.6); w2.rotation.y = -Math.PI / 2; In.add(w2); W.winPanes.push(w2);
    colliders.box(I.x + 22.6, I.z - 19, I.x + 25.4, I.z - 15.8); colliders.box(I.x + 23.2, I.z - 12, I.x + 24.8, I.z - 11.2); colliders.box(I.x + 18.8, I.z - 18.3, I.x + 20.4, I.z - 17.5); colliders.box(I.x + 17.1, I.z - 9.8, I.x + 18.7, I.z - 8.2); colliders.box(I.x + 29.9, I.z - 17.6, I.x + 31, I.z - 15.2);
    for (const [x, z] of [[19.2, -17.8], [20.1, -17.8], [29.6, -10.5]]) W.candles.push([x, x > 29 ? 1.0 : 1.02, z]); W.candles.push([23, 2.6, -8]); W.candles.push([25, 2.6, -8]); }
  bake(irock, masonry(VC(), "rough"), In); bake(ipl, masonry(VC(), "rock"), In); bake(ifloor, masonry(VC(), "floor"), In); bake(iwood, VC(), In); bake(idark, VC(), In);
  bake(igold, new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1a1004 }), In); bake(icloth, VC(), In); bake(itile, masonry(new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x0a0806 }), "tile"), In);
  // candles: a small instanced stick + a glow sprite each
  { const n = W.candles.length, cm = new InstancedMesh(new CylinderGeometry(0.035, 0.04, 0.22, 6), new MeshBasicMaterial({ color: 0xf0e8d0 }), n);
    W.candles.forEach(([x, y, z], i) => { ONE.position.set(I.x + x, y, I.z + z); ONE.rotation.set(0, 0, 0); ONE.scale.setScalar(1); ONE.updateMatrix(); cm.setMatrixAt(i, ONE.matrix); const g = glowSprite("255,190,110", 0.9); g.position.set(I.x + x, y + 0.2, I.z + z); g.userData.ph = r() * 6; In.add(g); W.flames.push(g); }); In.add(cm); }
  { const n = 140, g = new BufferGeometry(), p = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const ks = Object.values(ROOMS)[k % 9]; p[k * 3] = I.x + ks[0] + r() * (ks[1] - ks[0]); p[k * 3 + 1] = 0.5 + r() * (ks[4] - 1); p[k * 3 + 2] = I.z + ks[2] + r() * (ks[3] - ks[2]); }
    g.setAttribute("position", new Float32BufferAttribute(p, 3)); W.dust = new Points(g, new PointsMaterial({ color: 0xffe0b0, size: 0.04, transparent: true, opacity: 0.5, depthWrite: false, blending: AdditiveBlending })); In.add(W.dust); }
  // the "letter" moment: a sheet that glows on her desk
  onProgress(0.86, "The castle is ready.");

  W.setZone = z => { S.visible = z !== "inside"; In.visible = z === "inside"; };
  W.setLock = (k, open) => { const m = W.doorLeaves[k]; if (m) m.visible = !open; };
  W.update = (dt, t, look) => {
    for (const f of W.flames) if (f.parent && f.parent.visible) { const ph = f.userData.ph || 0; f.material.opacity = (look.flames ?? 1) * (0.62 + Math.sin(t * 11 + ph) * 0.08 + Math.sin(t * 23 + ph * 2) * 0.05); }
    if (S.visible) { for (const m of W.mist) { m.position.x += Math.sin(t * 0.07 + m.userData.ph) * dt * 0.5; m.material.opacity = 0.08 * (look.mist || 1); } W.crows.rotation.y += dt * 0.02; W.crows.position.y = Math.sin(t * 0.3) * 2; }
    if (In.visible) W.dust.rotation.y = Math.sin(t * 0.03) * 0.002;
  };
  return W;
}
