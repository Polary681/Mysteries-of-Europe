// THE SIBYL OF THE APENNINES - the procedural world (no model or texture files).
//  SURFACE: Montemonaco at dusk (limestone and travertine houses with low terracotta roofs, outside stairs, wooden balconies,
//  a church with its bell tower, walls and the north gate), the mule track up through beech woods and pasture to the crown of
//  rock on the summit of Monte Sibilla, with the shepherd's hut, the wayside cross, the fairies' meadow, a ruined shrine and
//  the mouth of the cave; the Sibillini all around, Monte Vettore with the Fairies' Road across it.
//  KINGDOM: built far away (K) and reached through the cave: the bridge over the abyss, the beating bronze doors, the crystal
//  door, then a cavern with a lake, a palace on an island under a mountain hanging upside down from the ceiling, gardens of
//  pale luminous trees, a dancing pavilion, the lower garden's dark pool, a round crystal window onto the world above.
// Everything is merged per material or instanced: a few dozen draw calls in total, no shadow maps.
import {
  Group, Mesh, InstancedMesh, Object3D, Color, Vector3, BufferGeometry, Float32BufferAttribute, PlaneGeometry, BoxGeometry, CylinderGeometry,
  ConeGeometry, SphereGeometry, IcosahedronGeometry, DodecahedronGeometry, OctahedronGeometry, TorusGeometry, CircleGeometry,
  MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, DoubleSide, BackSide, AdditiveBlending, Points, PointsMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, fbm, noise2, smooth as sm, lerp, glowSprite } from "../../shared/world.js";
import { paint, put, VC, masonry, bake, gable } from "../../shared/build.js";

/* ===================================================================== layout */
export const K = new Vector3(0, 0, 900);                 // the kingdom's origin (far beyond the surface, hidden by fog and visibility)
export const TRAIL = [[0, -28], [5, -44], [-9, -60], [-4, -76], [11, -91], [16, -106], [7, -126], [-12, -140], [1, -155], [17, -168], [8, -182], [-5, -196], [0, -209]];
export const L = {
  start: [1.5, 24], piazza: [0, 8], gate: [0, -29.5], church: [14, -6],
  npc: { lasale: [-3.6, 11.5], priest: [9.2, 3.6], shepherd: [-3.0, -21.3], singer: [3.4, 4.2], vittoria: [-16.6, 17.4] },
  trailStart: [0.5, -34], cross: [-8.6, -63.5], stazzo: [-20, -84], meadow: [25, -114], shrine: [28, -164], mouth: [0, -211.5], crown: [0, -229],
  vettore: [250, -120],
  // kingdom (local coordinates; add K)
  kEntry: [0, -1.5], bridge: [-4, -31], doors: -34, kDoor: -44.5, porter: [1.5, -43], hallC: [0, -100],
  lake: [0, -104, 23, 15], island: [0, -113, 9.5], causeway: [-88, -104],
  feast: [-19, -70], bench: [-27, -86], dancers: [24, -76], knight: [-12.5, -90.5], pool: [31, -108], window: [-45.5, -108], throne: [0, -118.5],
};
export const kx = p => [p[0] + K.x, p[1] + K.z];

/* ===================================================================== ground */
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export function trailDist(x, z) { let d = 1e9; for (let i = 0; i < TRAIL.length - 1; i++) d = Math.min(d, segD(x, z, TRAIL[i][0], TRAIL[i][1], TRAIL[i + 1][0], TRAIL[i + 1][1])); return d; }
const LANES = [[0, 34, 0, -30], [-30, 8, 30, 8], [0, 8, -22, 26], [0, 8, 24, -20]];
const laneDist = (x, z) => Math.min(...LANES.map(l => segD(x, z, l[0], l[1], l[2], l[3])));
const inKingdom = (x, z) => z > 600;

function surfaceH(x, z) {
  const t = Math.max(0, Math.min(1, (-24 - z) / 186));
  let h = 56 * Math.pow(t, 1.18);
  h += sm(-205, -222, z) * 34 + sm(-222, -245, z) * 14;                       // the crown's cliff
  h += Math.pow(Math.max(0, Math.abs(x) - 18) / 46, 2) * (14 + t * 30);        // the valley walls
  h -= sm(32, 72, z) * 38;                                                     // south of the village the spur drops into the Aso valley
  const vill = sm(-30, -22, z) * sm(40, 34, Math.abs(x)) * sm(40, 32, z);      // the village plateau is calm
  const noise = (fbm(x * 0.035 + 3, z * 0.035 - 7, 4) - 0.5) * (5 + t * 9) + (noise2(x * 0.2, z * 0.2) - 0.5) * 0.8;
  const calm = Math.max(vill, sm(4.5, 1.2, trailDist(x, z)) * 0.75);
  h += noise * (1 - calm) + (noise2(x * 0.12, z * 0.12) - 0.5) * 0.35 * vill;
  const md = Math.hypot(x - L.meadow[0], z - L.meadow[1]); h = lerp(h, 56 * Math.pow((114 - 24) / 186, 1.18) + 1.2 + (noise2(x * 0.3, z * 0.3) - 0.5) * 0.3, sm(14, 8, md));   // the meadow is a shelf
  return h;
}
const SURF = (() => { const m = new Map(); return (x, z) => surfaceH(x, z); })();
export function kGround(x, z) {   // kingdom floor (local coordinates)
  const lx = x - K.x, lz = z - K.z;
  if (lz > -46) return 0;
  const id = Math.hypot(lx - L.island[0], lz - L.island[1]);
  if (id < L.island[2]) return 0.6;
  if (Math.abs(lx) < 1.6 && lz < L.causeway[0] && lz > L.causeway[1] - 1) return 0.35;
  const pd = Math.hypot(lx - L.pool[0], lz - L.pool[1]); return -sm(13, 7, pd) * 1.6;
}
export const groundH = (x, z) => inKingdom(x, z) ? kGround(x, z) : SURF(x, z);

/** where the player may stand. o: { doorsOpen, crystalOpen } */
export function walkable(x, z, o = {}) {
  if (inKingdom(x, z)) {
    const lx = x - K.x, lz = z - K.z;
    if (lz > 0.5) return false;
    if (lz > -31.5) return Math.abs(lx) < 0.95 + (lz > -4 ? 1.2 : 0);                // tunnel mouth + the bridge
    if (lz > -44) { if (Math.abs(lx) > 3.4) return false; if (lz < -33.4 && lz > -34.8 && !o.doorsOpen) return false; return true; }
    if (lz > -46.5) return Math.abs(lx) < 1.25 && !!o.crystalOpen;                  // the crystal door
    const ex = lx / 46, ez = (lz + 100) / 54; if (ex * ex + ez * ez > 1) return false;   // the cavern
    const [cx, cz, rx, rz] = L.lake, qx = (lx - cx) / rx, qz = (lz - cz) / rz;
    if (qx * qx + qz * qz < 1) return (Math.abs(lx) < 1.5 && lz < L.causeway[0] + 1 && lz > L.causeway[1] - 2) || Math.hypot(lx - L.island[0], lz - L.island[1]) < L.island[2];
    if (Math.hypot(lx - L.pool[0], lz - L.pool[1]) < 4.6) return false;            // the dark pool
    return true;
  }
  if (z > 33 || z < -213) return false;
  if (z > -27) return Math.abs(x) < 33;
  if (z > -31.5) return Math.abs(x) < 2.2;                                          // through the north gate only
  return Math.abs(x) < 44 - (z < -190 ? 18 * sm(-190, -212, z) : 0);
}

/* ===================================================================== helpers */
const col = new Color();

/* ===================================================================== build */
export function buildWorld(scene, colliders, onProgress = () => {}, tier = 1) {
  const r = rng(1420), W = { surface: new Group(), kingdom: new Group(), anim: [], mist: [], glows: [], windowsLit: null };
  scene.add(W.surface, W.kingdom); W.kingdom.visible = false;
  const S = W.surface, Kg = W.kingdom;
  const stone = [], roofs = [], wood = [], dark = [], lime = [], green = [], metal = [];

  /* ---------------- terrain ---------------- */
  onProgress(0.04, "Raising the Sibillini…");
  {
    const g = new PlaneGeometry(170, 380, 104, 236); g.rotateX(-Math.PI / 2); g.translate(0, 0, -90);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new Color(), c2 = new Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = SURF(x, z); p.setY(i, y);
      const sl = Math.hypot(SURF(x + 1, z) - y, SURF(x, z + 1) - y), n = fbm(x * 0.08, z * 0.08, 3), lane = laneDist(x, z), td = trailDist(x, z);
      const vill = z > -30 && Math.abs(x) < 36;
      c.set(y > 38 ? 0x8f9152 : 0x6d7a3c).lerp(c2.set(0x9a9a58), n * 0.5);                   // pasture, golden higher up
      if (z < -44 && z > -152 && Math.abs(x) < 70) c.lerp(c2.set(0x4c4a2c), sm(-44, -56, z) * sm(-152, -140, z) * 0.75);   // beech-wood floor
      if (vill) { c.lerp(c2.set(0x7a6a4c), sm(3.2, 1.6, lane)); if (Math.hypot(x, z - 8) < 9.5) c.set(0x9a8f7c).lerp(c2.set(0x847a68), n); }   // lanes, the piazza's paving
      c.lerp(c2.set(0x8a7a5a), sm(2.2, 0.8, td) * (z < -30 ? 1 : 0));
      if (sl > 0.75) c.lerp(c2.set(0xa8a396), sm(0.75, 1.6, sl));                            // bare limestone
      if (y > 44 && n > 0.6) c.lerp(c2.set(0xe6eaee), sm(0.6, 0.7, n));                     // late snow under the crown
      if (z > 34) c.lerp(c2.set(0x3e4a2c), sm(34, 60, z));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new Mesh(g, VC()); m.matrixAutoUpdate = false; S.add(m); W.terrain = m;
  }
  /* distant mountains: the Sibillini all around, hazy (no fog: drawn as layered silhouettes) */
  {
    const ranges = [];
    const ridgeMesh = (cx, cz, R, H, seg, colTop, colBot, seed) => {
      const rr = rng(seed), g = new ConeGeometry(R, H, seg, 3, true); const p = g.attributes.position, cl = new Float32Array(p.count * 3), a = new Color(colTop), b = new Color(colBot), c = new Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) + H / 2, k = y / H; if (k > 0.05 && k < 0.98) { p.setX(i, p.getX(i) * (0.8 + rr() * 0.4)); p.setZ(i, p.getZ(i) * (0.8 + rr() * 0.4)); p.setY(i, p.getY(i) + (rr() - 0.5) * H * 0.12); } c.copy(b).lerp(a, k); cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
      g.setAttribute("color", new Float32BufferAttribute(cl, 3)); g.computeVertexNormals(); return put(g, cx, H / 2 - 40, cz);
    };
    const specs = [[-230, -260, 120, 140], [-120, -380, 140, 150], [60, -420, 150, 160], [200, -330, 130, 130], [L.vettore[0], L.vettore[1], 120, 175], [300, 40, 150, 110], [-300, -60, 150, 120], [-260, 160, 160, 90], [140, 260, 180, 70], [-60, 300, 190, 60]];
    specs.forEach(([x, z, R, H], i) => ranges.push(ridgeMesh(x, z, R, H, 9 + (i % 3), 0x9aa4b4, 0x394552, 50 + i)));
    const m = new Mesh(mergeGeometries(ranges), new MeshBasicMaterial({ vertexColors: true, fog: false })); S.add(m); W.ranges = m;
    // the Fairies' Road: a pale line across the face of Monte Vettore
    const fr = []; for (let k = 0; k < 18; k++) { const t = k / 17, x = L.vettore[0] - 70 + t * 110, y = 20 + t * 60, z = L.vettore[1] + 70 - t * 40; fr.push(put(new BoxGeometry(7.5, 1.2, 1.2), x, y, z, -0.35, 0, -0.5)); }
    W.fairyRoad = new Mesh(mergeGeometries(fr), new MeshBasicMaterial({ color: 0xc8c2b4, transparent: true, opacity: 0.35, fog: false })); S.add(W.fairyRoad);
  }

  /* ---------------- the village ---------------- */
  onProgress(0.18, "Building Montemonaco…");
  const STONES = [0xc9b998, 0xb8ab90, 0xa9a394, 0xc2ae88, 0xb3a07c, 0xd0c3a6], TILES = [0xa5532e, 0x9a4a2a, 0xb0603a, 0x8e4a2c, 0xa85a36];
  const winLit = [], winDark = [];
  const HOUSES = [
    [-6, -25, 5, 6, 6.5, 0], [-6.5, -17.5, 6, 6, 7.5, 0], [-6, -10, 5, 5, 6, 0], [-13, -24, 6, 7, 6, 0], [-14, -15, 6, 6, 7, 0], [-20.5, -21, 5, 6, 5.5, 0], [-21, -10, 6, 5, 6.5, 0],
    [-12.5, 3.5, 6, 6, 8, 1], [-12.5, 12.5, 5, 6, 7, 1], [-7.5, 21, 5, 6, 6, 0], [-14.5, 23, 6, 6, 6.5, 0], [-22, 15, 5, 6, 5, 1], [-22, 3.5, 5, 5, 6, 1], [-6, 29, 6, 5, 5.5, 0],
    [6, -25, 5, 6, 6.5, 0], [5.9, -17, 4.8, 5.6, 7, 0], [23, -22, 6, 6, 6, 0], [24, -6, 5, 6, 6.5, 3], [12.5, 15, 6, 5, 7, 3], [12.5, 23.5, 5, 6, 6, 0], [20.5, 16, 6, 6, 5.5, 0], [21.5, 26, 5, 5, 5, 0], [7, 30, 5, 5, 5.5, 0], [26, 8.5, 5, 6, 6, 3],
  ];
  const addWindow = (list, x, y, z, ry, w = 0.55, h = 0.8) => list.push(put(new PlaneGeometry(w, h), x, y, z, ry));
  HOUSES.forEach(([x, z, w, d, h, rot], i) => {
    const ry = rot * Math.PI / 2, sc = STONES[i % STONES.length], gy = Math.min(SURF(x - w / 2, z - d / 2), SURF(x + w / 2, z + d / 2), SURF(x, z)) - 0.6;
    const local = [];   // geometry in the house's own frame (front = +z), placed at the end
    local.push(["s", paint(put(new BoxGeometry(w, h + 0.6, d), 0, (h + 0.6) / 2, 0), sc, 0.12, r)]);
    local.push(["s", paint(put(new BoxGeometry(w + 0.12, 0.7, d + 0.12), 0, 0.35, 0), 0x7d7464)]);                                  // base course
    local.push(["s", paint(put(new BoxGeometry(w + 0.08, 0.16, d + 0.08), 0, h * 0.52 + 0.6, 0), 0xd8ccb0)]);                       // string course
    local.push(["r", paint(put(gable(w, d, 1.15 + (i % 3) * 0.2), 0, h + 0.6, 0), TILES[i % TILES.length], 0.15, r)]);
    if (i % 3 !== 1) local.push(["s", paint(put(new BoxGeometry(0.6, 1.3, 0.6), w * 0.28 * (i % 2 ? 1 : -1), h + 1.4, -d * 0.18), 0x8a7f6e)]);   // chimney
    local.push(["w", paint(put(new BoxGeometry(1.05, 2.0, 0.12), (i % 2 ? -1 : 1) * w * 0.22, 1.6, d / 2 + 0.04), 0x4a3220)]);         // door
    local.push(["s", paint(put(new BoxGeometry(1.45, 0.25, 0.2), (i % 2 ? -1 : 1) * w * 0.22, 2.7, d / 2 + 0.06), 0xd2c4a2)]);          // lintel
    const floors = h > 6.8 ? [3.6, 5.9] : [3.8];
    for (const fy of floors) for (const fx of [-w * 0.3, w * 0.3]) { if (fy < 4 && Math.abs(fx - (i % 2 ? -1 : 1) * w * 0.22) < 0.9) continue; local.push([(i * 7 + fy * 3 + fx) % 5 < 2.2 ? "L" : "D", put(new PlaneGeometry(0.62, 0.9), fx, fy + 0.6, d / 2 + 0.03)]); }
    for (const fy of floors) local.push([(i + fy) % 3 < 1 ? "L" : "D", put(new PlaneGeometry(0.62, 0.9), 0, fy + 0.6, -d / 2 - 0.03, Math.PI)]);
    if (i % 4 === 0) {   // a "profferlo": the outside stone stair to the upper door, typical of central Italy
      const sx = w / 2 + 0.7; for (let k = 0; k < 9; k++) local.push(["s", paint(put(new BoxGeometry(1.2, 0.36 * (k + 1), 0.55), sx, 0.18 * (k + 1) + 0.5, d / 2 - 0.4 - k * 0.55), 0xbcae90)]);
      local.push(["s", paint(put(new BoxGeometry(1.3, 0.25, 1.3), sx, 3.85, -d / 2 + 0.9 + 0.4), 0xbcae90)]); local.push(["w", paint(put(new BoxGeometry(0.12, 1.8, 0.95), w / 2 + 0.03, 4.9, -d / 2 + 1.3), 0x4a3220)]);
    } else if (i % 4 === 2 && h > 6) {   // a wooden balcony
      local.push(["w", paint(put(new BoxGeometry(w * 0.7, 0.14, 0.9), 0, 3.6, d / 2 + 0.45), 0x5e4028)]);
      for (let k = -2; k <= 2; k++) local.push(["w", paint(put(new BoxGeometry(0.08, 0.9, 0.08), k * w * 0.16, 4.1, d / 2 + 0.86), 0x5e4028)]);
      local.push(["w", paint(put(new BoxGeometry(w * 0.7, 0.08, 0.08), 0, 4.55, d / 2 + 0.86), 0x5e4028)]);
    }
    for (const [kind, g] of local) {
      put(g, x, gy, z, ry);
      if (kind === "s") stone.push(g); else if (kind === "r") roofs.push(g); else if (kind === "w") wood.push(g); else if (kind === "L") winLit.push(g); else winDark.push(g);
    }
    const hw = (rot % 2 ? d : w) / 2 + 0.1, hd = (rot % 2 ? w : d) / 2 + 0.1; colliders.box(x - hw, z - hd, x + hw, z + hd, "house");
    if (i % 4 === 0) { const sx = rot % 2 ? 0 : w / 2 + 0.7; if (!rot) colliders.box(x + sx - 0.6, z - d / 2, x + sx + 0.6, z + d / 2, "stair"); }
  });
  /* the church and its bell tower */
  {
    const [cx, cz] = L.church, gy = SURF(cx, cz) - 0.5, cw = 8.5, cd = 15;
    stone.push(paint(put(new BoxGeometry(cw, 8.5, cd), cx, gy + 4.25, cz - 1), 0xd6c9aa, 0.05, r));
    stone.push(paint(put(new BoxGeometry(cw + 1, 11, 0.9), cx, gy + 5.5, cz + cd / 2 - 0.6), 0xe0d4b6));                             // façade
    stone.push(paint(put(gable(cw + 1, 0.9, 2.6, 0.05), cx, gy + 11, cz + cd / 2 - 0.6), 0xe0d4b6));
    roofs.push(paint(put(gable(cd, cw, 2.2), cx, gy + 8.5, cz - 1, Math.PI / 2), 0x9c4f2e));
    wood.push(paint(put(new BoxGeometry(2, 3.4, 0.2), cx, gy + 1.7 + 0.3, cz + cd / 2 - 0.1), 0x3e2a1a));
    stone.push(paint(put(new BoxGeometry(2.9, 0.4, 0.4), cx, gy + 3.9, cz + cd / 2 - 0.05), 0xc8b894));
    const rose = put(new TorusGeometry(1.15, 0.22, 6, 16), cx, gy + 7.4, cz + cd / 2 - 0.1); stone.push(paint(rose, 0xc8b894));
    W.rose = new Mesh(put(new CircleGeometry(1.0, 16), cx, gy + 7.4, cz + cd / 2 - 0.12), new MeshBasicMaterial({ color: 0x2a2018 })); S.add(W.rose);
    const tx = cx + 6.2, tz = cz - 6; stone.push(paint(put(new BoxGeometry(3.4, 17, 3.4), tx, gy + 8.5, tz), 0xcfc1a0, 0.05, r));
    for (const [ox, oz, ry] of [[0, 1.72, 0], [1.72, 0, Math.PI / 2], [0, -1.72, 0], [-1.72, 0, Math.PI / 2]]) dark.push(paint(put(new BoxGeometry(1.1, 2.2, 0.12), tx + ox, gy + 14.6, tz + oz, ry), 0x161210));
    roofs.push(paint(put(new ConeGeometry(2.7, 3.6, 4), tx, gy + 18.8, tz, Math.PI / 4), 0x8e4a2c)); stone.push(paint(put(new BoxGeometry(3.8, 0.4, 3.8), tx, gy + 17, tz), 0xbcae90));
    metal.push(paint(put(new CylinderGeometry(0.35, 0.65, 0.9, 10), tx, gy + 14.5, tz), 0x8a6a2a));
    colliders.box(cx - cw / 2 - 0.5, cz - cd / 2 - 1, cx + cw / 2 + 0.5, cz + cd / 2, "church"); colliders.box(tx - 1.8, tz - 1.8, tx + 1.8, tz + 1.8, "tower");
    W.belfry = new Vector3(tx, gy + 14.5, tz);
  }
  /* the walls and the north gate */
  {
    const gz = -30.5;
    for (const [x0, x1] of [[-34, -2.4], [2.4, 34]]) {
      const len = x1 - x0, mx = (x0 + x1) / 2, gy = SURF(mx, gz) - 1; stone.push(paint(put(new BoxGeometry(len, 6, 1.4), mx, gy + 3, gz), 0xa9a08c, 0.08, r));
      for (let x = x0 + 0.6; x < x1 - 0.4; x += 1.6) stone.push(paint(put(new BoxGeometry(0.8, 0.8, 1.4), x, gy + 6.4, gz), 0xa29a86));
      colliders.box(x0, gz - 0.8, x1, gz + 0.8, "wall");
    }
    const gy = SURF(0, gz) - 0.5;
    for (const s of [-1, 1]) stone.push(paint(put(new BoxGeometry(1.4, 7.4, 2.2), s * 3.1, gy + 3.7, gz), 0xb3a991));
    stone.push(paint(put(new BoxGeometry(7.6, 1.6, 2.2), 0, gy + 7.2, gz), 0xb3a991));
    const arch = new TorusGeometry(2.3, 0.35, 6, 12, Math.PI); stone.push(paint(put(arch, 0, gy + 4.6, gz + 1.15), 0xc9bd9f));
    stone.push(paint(put(new TorusGeometry(2.3, 0.35, 6, 12, Math.PI), 0, gy + 4.6, gz - 1.15), 0xc9bd9f));
    colliders.box(-3.9, gz - 1.1, -2.2, gz + 1.1, "gate"); colliders.box(2.2, gz - 1.1, 3.9, gz + 1.1, "gate");
    W.gateLamp = new Vector3(2.6, gy + 3.6, gz + 1.4);
  }
  /* the piazza: fountain, benches, a cart, barrels, woodpiles, laundry, flower pots */
  {
    const [px, pz] = L.piazza, gy = SURF(px, pz);
    stone.push(paint(put(new CylinderGeometry(2.4, 2.6, 0.8, 8), px, gy + 0.4, pz), 0xcfc2a2)); stone.push(paint(put(new CylinderGeometry(0.35, 0.45, 2.2, 8), px, gy + 1.1, pz), 0xcfc2a2));
    stone.push(paint(put(new CylinderGeometry(0.9, 0.5, 0.4, 8), px, gy + 2.2, pz), 0xcfc2a2));
    W.water = new Mesh(put(new CircleGeometry(2.15, 16), px, gy + 0.72, pz, 0, -Math.PI / 2), new MeshStandardMaterial({ color: 0x2c4a5a, roughness: 0.15, metalness: 0.3 })); S.add(W.water);
    colliders.circle(px, pz, 2.7, "fountain");
    const props = [[-8, 1.5], [7.5, 13.5], [-3, 15.5]];
    props.forEach(([bx, bz], k) => { const y = SURF(bx, bz); wood.push(paint(put(new BoxGeometry(2.2, 0.12, 0.5), bx, y + 0.55, bz, k * 0.7), 0x6a4a2c)); for (const s of [-0.9, 0.9]) wood.push(paint(put(new BoxGeometry(0.12, 0.55, 0.45), bx + s * Math.cos(k * 0.7), y + 0.27, bz - s * Math.sin(k * 0.7), k * 0.7), 0x5a3e24)); });
    // a cart
    { const cx = -9.5, cz = -4, y = SURF(cx, cz); wood.push(paint(put(new BoxGeometry(1.6, 0.6, 2.6), cx, y + 0.9, cz), 0x6e4e2e)); for (const s of [-1, 1]) wood.push(paint(put(new CylinderGeometry(0.6, 0.6, 0.12, 10), cx + s * 0.9, y + 0.6, cz, 0, 0, Math.PI / 2), 0x4e3620)); wood.push(paint(put(new BoxGeometry(0.12, 0.12, 2.4), cx, y + 0.7, cz + 2.2, 0, 0.25), 0x5e4028)); colliders.box(cx - 1, cz - 1.4, cx + 1, cz + 1.4, "cart"); }
    for (const [bx, bz] of [[4.2, -12], [4.4, -11], [-3.6, -6], [16, 20.5], [9.6, 27], [-17, 9]]) { const y = SURF(bx, bz); wood.push(paint(put(new CylinderGeometry(0.42, 0.38, 0.95, 9), bx, y + 0.47, bz), 0x6a4a2a)); metal.push(paint(put(new TorusGeometry(0.42, 0.03, 4, 12), bx, y + 0.7, bz, 0, Math.PI / 2), 0x3a3a3a)); colliders.circle(bx, bz, 0.5); }
    for (const [bx, bz, ry] of [[-9.6, -27.6, 0], [16.3, 0.5, Math.PI / 2], [-25, 9, Math.PI / 2], [9, -28, 0]]) { const y = SURF(bx, bz); for (let k = 0; k < 4; k++) wood.push(paint(put(new CylinderGeometry(0.16, 0.16, 2.2, 6), bx + (k % 2) * 0.32, y + 0.2 + Math.floor(k / 2) * 0.3, bz, ry, 0, Math.PI / 2), 0x7a5a36)); colliders.circle(bx, bz, 0.9); }
    for (const [ax, az, bx, bz] of [[-9.4, 20, -9.4, 26], [10, 18.5, 10, 21.5]]) {
      const y = SURF(ax, az) + 3.3; wood.push(paint(put(new BoxGeometry(0.03, 0.03, Math.hypot(bx - ax, bz - az)), ax, y, (az + bz) / 2), 0x3a3020));
      for (let k = 0; k < 4; k++) wood.push(paint(put(new PlaneGeometry(0.7, 0.9), ax + 0.02, y - 0.48, az + 0.8 + k * 1.3, Math.PI / 2), [0xe8e0cc, 0xb04a3a, 0x6a7a9a, 0xd8c890][k]));
    }
    for (const [fx, fz] of [[-2.6, 2.5], [2.8, 2.6], [-9.5, 18], [11, 12.5], [-6.6, -14.5]]) { const y = SURF(fx, fz); roofs.push(paint(put(new CylinderGeometry(0.28, 0.2, 0.42, 8), fx, y + 0.21, fz), 0xa0522d)); green.push(paint(put(new IcosahedronGeometry(0.34, 0), fx, y + 0.6, fz), 0x5a7a34)); }
  }
  /* trees in and around the village: oaks, chestnuts, a pair of cypresses by the church */
  const treeSpots = [];
  for (let k = 0; k < 80; k++) {
    const a = r() * Math.PI * 2, rr = 36 + r() * 30, x = Math.cos(a) * rr, z = 4 + Math.sin(a) * rr * 0.9;
    if (z < -32 && Math.abs(x) < 50 || z > 60 || Math.abs(x) > 75) continue; treeSpots.push([x, z, 0.8 + r() * 0.6, k % 5 === 0 ? 1 : 0]);
  }
  for (const [x, z] of [[-27, -5], [28, 2], [-26, 25], [17, -27], [-26, -27]]) treeSpots.push([x, z, 0.9, 0]);
  treeSpots.push([20.5, 1.5, 1, 2], [20.5, -1.5, 1.05, 2]);

  /* bake the village */
  bake(stone, masonry(VC(), "stone"), S); bake(roofs, masonry(VC(), "tile"), S); bake(wood, VC(), S); bake(dark, VC(), S); bake(metal, VC(), S); bake(green, VC(), S);
  W.winLitMat = new MeshBasicMaterial({ color: 0x3a2a18 }); W.winLit = bake(winLit, W.winLitMat, S);
  bake(winDark, new MeshBasicMaterial({ color: 0x15100c }), S);

  /* ---------------- the mountain ---------------- */
  onProgress(0.34, "Planting the beech woods…");
  const ONE = new Object3D();
  {
    const N = [140, 240, 340][tier] || 240, trunks = [], crowns = [];
    for (let k = 0, tries = 0; k < N && tries < 6000; tries++) {
      const z = -40 - r() * 118, x = (r() * 2 - 1) * 68;
      if (trailDist(x, z) < 3.4 || Math.hypot(x - L.meadow[0], z - L.meadow[1]) < 15 || Math.hypot(x - L.stazzo[0], z - L.stazzo[1]) < 6 || Math.hypot(x - L.cross[0], z - L.cross[1]) < 3) continue;
      const dens = sm(-40, -52, z) * sm(-158, -138, z) * (0.55 + fbm(x * 0.05, z * 0.05, 2) * 0.8); if (r() > dens) continue;
      trunks.push([x, z, 0.8 + r() * 0.5]); k++;
    }
    for (const t of treeSpots) trunks.push([t[0], t[1], t[2], t[3] ? t[3] : 0, 1]);
    const tg = new CylinderGeometry(0.16, 0.26, 1, 6); tg.translate(0, 0.5, 0);
    const trunkM = new InstancedMesh(tg, new MeshLambertMaterial({ color: 0x9a948a, flatShading: true }), trunks.length);
    const crownG = new IcosahedronGeometry(1, 0), crownM = new InstancedMesh(crownG, new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), trunks.length);
    const cyprG = new ConeGeometry(0.9, 1, 7); cyprG.translate(0, 0.5, 0);
    trunks.forEach(([x, z, s, kind, village], i) => {
      const y = SURF(x, z) - 0.2, h = (village ? 3.2 : 6.5) * s;
      ONE.position.set(x, y, z); ONE.rotation.set(0, r() * 6, (r() - 0.5) * 0.08); ONE.scale.set(s, h, s); ONE.updateMatrix(); trunkM.setMatrixAt(i, ONE.matrix);
      if (kind === 2) { ONE.position.set(x, y + 1, z); ONE.scale.set(0.9 * s, 9 * s, 0.9 * s); ONE.rotation.set(0, 0, 0); ONE.updateMatrix(); crownM.setMatrixAt(i, ONE.matrix); crownM.setColorAt(i, col.set(0x26361e)); }
      else { ONE.position.set(x, y + h * 0.92, z); ONE.scale.set((2.1 + r()) * s, (2.3 + r()) * s, (2.1 + r()) * s); ONE.updateMatrix(); crownM.setMatrixAt(i, ONE.matrix); crownM.setColorAt(i, col.set(village ? [0x4e6a2e, 0x5f7434, 0x6a6e30][i % 3] : [0x4a6a2a, 0x557a30, 0x3f5e26, 0x60782e][i % 4]).multiplyScalar(0.85 + r() * 0.3)); }
      if (walkable(x, z)) colliders.circle(x, z, 0.45 * s, "tree");
    });
    trunkM.instanceMatrix.needsUpdate = true; crownM.instanceMatrix.needsUpdate = true; crownM.instanceColor.needsUpdate = true; S.add(trunkM, crownM); W.trees = crownM;
  }
  onProgress(0.48, "Scattering limestone…");
  {
    const N = [90, 150, 210][tier] || 150, rocks = new InstancedMesh(new DodecahedronGeometry(1, 0), new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), N);
    for (let k = 0; k < N; k++) {
      let x, z, tries = 0; do { z = -60 - Math.pow(r(), 0.7) * 150; x = (r() * 2 - 1) * 52; tries++; } while (tries < 20 && (trailDist(x, z) < 2.6 || Math.hypot(x - L.meadow[0], z - L.meadow[1]) < 11));
      const s = 0.4 + Math.pow(r(), 2.4) * 2.6; ONE.position.set(x, SURF(x, z) + s * 0.25, z); ONE.rotation.set(r() * 3, r() * 3, r() * 3); ONE.scale.set(s, s * (0.55 + r() * 0.4), s * (0.8 + r() * 0.4)); ONE.updateMatrix();
      rocks.setMatrixAt(k, ONE.matrix); rocks.setColorAt(k, col.set(0xb4afa2).multiplyScalar(0.75 + r() * 0.35)); if (s > 1 && walkable(x, z)) colliders.circle(x, z, s * 0.8, "rock");
    }
    rocks.instanceColor.needsUpdate = true; S.add(rocks);
  }
  /* the trail: a ribbon of beaten earth and stones */
  {
    const pos = [], cl = [], c = new Color(); let acc = 0;
    for (let i = 0; i < TRAIL.length - 1; i++) {
      const [ax, az] = TRAIL[i], [bx, bz] = TRAIL[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 1.2), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz * 0.85, nz = ux * 0.85;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, p0 = [ax + (bx - ax) * t0, az + (bz - az) * t0], p1 = [ax + (bx - ax) * t1, az + (bz - az) * t1];
        const v = (p, s) => [p[0] + nx * s, SURF(p[0] + nx * s, p[1] + nz * s) + 0.05, p[1] + nz * s];
        const a = v(p0, -1), b = v(p0, 1), cc = v(p1, 1), d = v(p1, -1); pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
        c.set(0x8c7b5a).multiplyScalar(0.9 + noise2(acc * 0.3, 0) * 0.2); acc++; for (let q = 0; q < 6; q++) cl.push(c.r, c.g, c.b);
      }
    }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setAttribute("color", new Float32BufferAttribute(cl, 3)); g.computeVertexNormals();
    const m = new Mesh(g, new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 })); S.add(m);
  }
  /* the wayside cross, the shepherd's hut, the shrine, the meadow, the crown, the mouth of the cave */
  {
    const [cx, cz] = L.cross, y = SURF(cx, cz);
    wood.push(paint(put(new BoxGeometry(0.22, 3, 0.22), cx, y + 1.5, cz), 0x5a4630), paint(put(new BoxGeometry(1.4, 0.2, 0.2), cx, y + 2.3, cz), 0x5a4630));
    [0xb03a2e, 0xe8dcc0, 0x3a5a9a, 0xd8b030].forEach((c, k) => wood.push(paint(put(new PlaneGeometry(0.1, 0.7), cx - 0.5 + k * 0.32, y + 1.9, cz + 0.12), c)));
    metal.push(paint(put(new BoxGeometry(0.26, 0.3, 0.05), cx, y + 1.6, cz + 0.13), 0x9a9a9a)); colliders.circle(cx, cz, 0.4);
  }
  {
    const [hx, hz] = L.stazzo, y = SURF(hx, hz) - 0.3, w = 5, d = 4;
    for (const [ox, oz, sw, sd, sh] of [[0, -d / 2, w, 0.6, 2.4], [-w / 2, 0, 0.6, d, 2.2], [0, d / 2, w, 0.6, 1.4], [w / 2, -1.1, 0.6, 1.8, 2.2], [w / 2, 1.6, 0.6, 0.8, 1.2]]) { stone.push(paint(put(new BoxGeometry(sw, sh, sd), hx + ox, y + sh / 2, hz + oz), 0x9a9486, 0.1, r)); colliders.box(hx + ox - sw / 2, hz + oz - sd / 2, hx + ox + sw / 2, hz + oz + sd / 2); }
    for (let k = 0; k < 3; k++) wood.push(paint(put(new BoxGeometry(0.16, 0.16, 5.2), hx - 1.4 + k * 1.3, y + 1.8 - k * 0.5, hz, 0, 0.35 + k * 0.2), 0x3e3020));
    dark.push(paint(put(new PlaneGeometry(1.6, 0.9), hx, y + 1.3, hz - d / 2 + 0.31), 0x2a2620));
  }
  {
    const [sx, sz] = L.shrine, y = SURF(sx, sz) - 0.2;
    stone.push(paint(put(new BoxGeometry(6.5, 0.5, 4.5), sx, y + 0.25, sz), 0xb8b2a2), paint(put(new BoxGeometry(5.5, 0.4, 3.6), sx, y + 0.65, sz), 0xc2bcac));
    for (const [ox, oz, h] of [[-2.2, -1.3, 3.8], [0, -1.3, 2.1], [2.2, -1.3, 3.1]]) { stone.push(paint(put(new CylinderGeometry(0.32, 0.36, h, 8), sx + ox, y + 0.8 + h / 2, sz + oz), 0xd0cabc)); colliders.circle(sx + ox, sz + oz, 0.45); }
    stone.push(paint(put(new BoxGeometry(4.6, 0.6, 0.8), sx + 1.2, y + 1.2, sz + 1.2, 0.3, 0, 0.18), 0xc8c2b2));
  }
  {
    const [mx, mz] = L.meadow, y = SURF(mx, mz);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; lime.push(paint(put(new DodecahedronGeometry(0.32, 0), mx + Math.cos(a) * 6.5, y + 0.12, mz + Math.sin(a) * 6.5), 0xe8e4d8)); }
    const fl = new InstancedMesh(new IcosahedronGeometry(0.09, 0), new MeshBasicMaterial({ color: 0xffffff }), 220);
    for (let k = 0; k < 220; k++) { const a = r() * 6.283, rr = Math.sqrt(r()) * 12, x = mx + Math.cos(a) * rr, z = mz + Math.sin(a) * rr; ONE.position.set(x, SURF(x, z) + 0.12, z); ONE.scale.setScalar(0.7 + r() * 0.8); ONE.rotation.set(0, 0, 0); ONE.updateMatrix(); fl.setMatrixAt(k, ONE.matrix); fl.setColorAt(k, col.set([0xf4f0e4, 0xe8d26a, 0xb8a0e0, 0xe89ab0][k % 4])); }
    fl.instanceColor.needsUpdate = true; S.add(fl);
  }
  {
    const [cx, cz] = L.crown, base = SURF(0, -214);
    for (let k = 0; k < 34; k++) {
      const a = Math.PI * 0.08 + k / 34 * Math.PI * 1.84, rr = 13 + r() * 5, x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr * 0.8, h = 7 + r() * 13;
      lime.push(paint(put(new CylinderGeometry(1.2 + r() * 1.4, 2.2 + r() * 1.6, h, 5), x, Math.max(base, SURF(x, z)) + h / 2 - 1, z, r() * 3), 0xb9b4a6, 0.15, r));
    }
    const my = SURF(L.mouth[0], L.mouth[1]);   // the mouth: a dark slit framed by fallen blocks
    lime.push(paint(put(new BoxGeometry(6, 4.5, 3), L.mouth[0], my + 1.8, L.mouth[1] - 2.2), 0xa8a395), paint(put(new BoxGeometry(1.6, 2.4, 1.6), L.mouth[0] - 2.2, my + 0.8, L.mouth[1] - 0.6, 0.4), 0xb4af9f), paint(put(new BoxGeometry(1.4, 1.8, 1.8), L.mouth[0] + 2.1, my + 0.6, L.mouth[1] - 0.5, -0.3), 0xb4af9f));
    W.mouthHole = new Mesh(put(new PlaneGeometry(1.5, 1.0), L.mouth[0], my + 0.75, L.mouth[1] - 0.68), new MeshBasicMaterial({ color: 0x050304 })); S.add(W.mouthHole);
    const gl = glowSprite("255,190,200", 2.6); gl.position.set(L.mouth[0], my + 0.8, L.mouth[1] - 0.5); gl.material.opacity = 0.5; S.add(gl); W.mouthGlow = gl;
    colliders.box(L.mouth[0] - 3, L.mouth[1] - 3.7, L.mouth[0] + 3, L.mouth[1] - 0.7);
  }
  bake(stone, masonry(VC(), "rough"), S); bake(wood, VC(), S); bake(dark, VC(), S); bake(metal, VC(), S); bake(lime, masonry(VC(), "rock"), S);

  /* fireflies over the meadow and the woods + drifting mist banks (sprites) */
  {
    const n = 90, g = new BufferGeometry(), p = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const x = (r() * 2 - 1) * 40, z = -50 - r() * 110; p[k * 3] = x; p[k * 3 + 1] = SURF(x, z) + 0.6 + r() * 2.5; p[k * 3 + 2] = z; }
    g.setAttribute("position", new Float32BufferAttribute(p, 3)); W.flies = new Points(g, new PointsMaterial({ color: 0xd8f0a0, size: 0.18, transparent: true, opacity: 0.0, depthWrite: false, blending: AdditiveBlending })); S.add(W.flies);
    for (let k = 0; k < (tier ? 10 : 6); k++) { const s = glowSprite("210,214,230", 26 + r() * 20); const x = (r() * 2 - 1) * 50, z = -40 - r() * 150; s.position.set(x, SURF(x, z) + 3 + r() * 4, z); s.material.opacity = 0.1; s.userData.ph = r() * 6; S.add(s); W.mist.push(s); }
    const lamp = glowSprite("255,190,110", 2.4); lamp.position.copy(W.gateLamp); S.add(lamp); W.glows.push(lamp);
    for (const [lx, lz] of [[-2.8, 1.8], [3.2, 14], [-11, 9], [10.8, 4.2], [-5, -20]]) { const s = glowSprite("255,190,110", 1.8); s.position.set(lx, SURF(lx, lz) + 3.1, lz); S.add(s); W.glows.push(s); }
  }
  /* sheep in a pen outside the walls (instanced) */
  {
    const n = 14, body = new InstancedMesh(new BoxGeometry(0.9, 0.6, 0.55), new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n), head = new InstancedMesh(new BoxGeometry(0.3, 0.32, 0.3), new MeshLambertMaterial({ color: 0x2a2420 }), n);
    W.sheep = [];
    for (let k = 0; k < n; k++) { const x = -18 + (r() - 0.5) * 9, z = -40 + (r() - 0.5) * 6; W.sheep.push({ x, z, a: r() * 6, ph: r() * 6 }); body.setColorAt(k, col.set(k % 5 === 0 ? 0x5a504a : 0xe4ddd0)); }
    body.instanceColor.needsUpdate = true; S.add(body, head); W.sheepMesh = { body, head };
    for (let k = 0; k < 4; k++) wood.push(paint(put(new BoxGeometry(k % 2 ? 0.1 : 11, 0.9, k % 2 ? 7 : 0.1), -18 + (k === 1 ? 5.5 : k === 3 ? -5.5 : 0), SURF(-18, -40) + 0.45, -40 + (k === 0 ? 3.5 : k === 2 ? -3.5 : 0)), 0x6a5236));
    bake(wood, VC(), S);
  }

  /* ===================================================================== the kingdom ===================================================================== */
  onProgress(0.6, "Opening the mountain…");
  const kstone = [], kgold = [], kcrys = [], kpale = [], kdark = [], kglowM = [];
  const KX = K.x, KZ = K.z, kp = (x, y, z) => [KX + x, y, KZ + z];
  {
    // the tunnel and the bridge over the abyss
    for (let z = 2; z > -6; z -= 1.2) for (const s of [-1, 1]) kstone.push(paint(put(new DodecahedronGeometry(1.3 + r() * 0.6, 0), ...kp(s * (2.2 + r() * 0.5), 0.8 + r() * 1.8, z), r() * 3, r() * 3), 0x3a3238, 0.2, r));
    kstone.push(paint(put(new BoxGeometry(6, 1.2, 9), ...kp(0, 3.9, -1)), 0x2e2830));
    for (let z = -4; z > -32; z -= 1) { kstone.push(paint(put(new BoxGeometry(1.9, 0.3, 0.95), ...kp((r() - 0.5) * 0.06, -0.15, z), (r() - 0.5) * 0.04), 0x5a4e46, 0.2, r)); for (const s of [-1, 1]) kdark.push(paint(put(new BoxGeometry(0.08, 0.08, 1), ...kp(s * 0.98, 0.9, z)), 0x2a201a)); if (z % 3 === 0) for (const s of [-1, 1]) kdark.push(paint(put(new BoxGeometry(0.1, 1, 0.1), ...kp(s * 0.98, 0.45, z)), 0x2a201a)); }
    W.abyss = new Mesh(put(new PlaneGeometry(120, 60), ...kp(0, -40, -18), 0, -Math.PI / 2), new MeshBasicMaterial({ color: 0x150a20, fog: false })); Kg.add(W.abyss);
    for (let k = 0; k < 14; k++) { const s = glowSprite(k % 3 ? "130,90,220" : "90,180,230", 14 + r() * 22); s.position.set(KX + (r() < 0.5 ? -1 : 1) * (4 + r() * 22), -6 - r() * 22, KZ - 4 - r() * 28); s.material.opacity = 0.32; Kg.add(s); }
    for (let k = 0; k < 4; k++) { const g2 = new DodecahedronGeometry(3 + r() * 3, 0); g2.scale(1, 2.5, 1); kstone.push(paint(put(g2, ...kp((k % 2 ? 1 : -1) * (9 + r() * 8), -8 - r() * 6, -8 - k * 6)), 0x2a2232)); }   // rock spires rising out of the abyss
    // the antechamber, the bronze doors' frame, the crystal door
    for (const s of [-1, 1]) { kstone.push(paint(put(new BoxGeometry(2, 9, 12), ...kp(s * 4.4, 4.5, -38)), 0x3a3238, 0.1, r)); kgold.push(paint(put(new BoxGeometry(0.9, 8, 0.9), ...kp(s * 2.75, 4, -34)), 0x7a5a2a)); }
    kgold.push(paint(put(new BoxGeometry(6.4, 1, 1), ...kp(0, 8.3, -34)), 0x7a5a2a)); kstone.push(paint(put(new BoxGeometry(10, 2, 12), ...kp(0, 10, -38)), 0x2e2830));
    const leafG = new BoxGeometry(2.3, 7.4, 0.25); leafG.translate(1.15, 3.7, 0);
    const bronze = new MeshStandardMaterial({ color: 0x8a6230, metalness: 0.75, roughness: 0.35, emissive: 0x1a0e04 });
    W.doors = [-1, 1].map(s => { const m = new Mesh(leafG, bronze); m.position.set(KX + s * 2.3, 0, KZ - 34); m.scale.x = -s; Kg.add(m); return m; });
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const b = new Mesh(new SphereGeometry(0.12, 6, 4), bronze); b.position.set(1.15 + (k % 2) * 0.6 - 0.3, 1.8 + Math.floor(k / 2) * 3.6, 0.15); W.doors[(s + 1) / 2].add(b); }
    for (let k = 0; k < 16; k++) { const s2 = 0.12 + r() * 0.22, g2 = new OctahedronGeometry(1, 0); g2.scale(s2, s2 * (2 + r() * 2), s2); kcrys.push(paint(put(g2, ...kp((k % 2 ? 1 : -1) * (3.45 + r() * 0.2), 0.6 + r() * 6.5, -35.5 - r() * 8), r() * 0.6, 0, (k % 2 ? 1 : -1) * (0.3 + r() * 0.5)), [0x9ad8ff, 0xd0b0ff, 0xffd0e8][k % 3])); }
    W.crystalDoor = new Mesh(put(new BoxGeometry(2.6, 4.6, 0.18), ...kp(0, 2.3, L.kDoor)), new MeshStandardMaterial({ color: 0xc8e8ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, emissive: 0x3a6a8a, emissiveIntensity: 0.6, depthWrite: false }));
    Kg.add(W.crystalDoor); for (const s of [-1, 1]) kcrys.push(paint(put(new BoxGeometry(0.35, 4.8, 0.35), ...kp(s * 1.45, 2.4, L.kDoor)), 0xb8e0ff));
    // the wall of the mountain's heart: a cliff of dark rock across the abyss, pierced only by the crystal door
    kstone.push(paint(put(new BoxGeometry(60, 90, 2.4), ...kp(-31.3, 0, L.kDoor - 0.6)), 0x342c38, 0.1, r), paint(put(new BoxGeometry(60, 90, 2.4), ...kp(31.3, 0, L.kDoor - 0.6)), 0x342c38, 0.1, r), paint(put(new BoxGeometry(3, 40, 2.4), ...kp(0, 24.6, L.kDoor - 0.6)), 0x342c38));
    for (let k = 0; k < 18; k++) kstone.push(paint(put(new DodecahedronGeometry(2 + r() * 4, 0), ...kp((r() - 0.5) * 70, -30 + r() * 60, L.kDoor + 0.8 + r() * 1.5), r() * 3, r() * 3), 0x2e2632, 0.2, r));
    for (let k = 0; k < 40; k++) { const s2 = 0.2 + r() * 0.5, g2 = new OctahedronGeometry(1, 0); g2.scale(s2, s2 * (2.5 + r() * 2), s2); const x = (r() < 0.5 ? -1 : 1) * (3 + r() * 30), y = -20 + r() * 40; kcrys.push(paint(put(g2, ...kp(x, y, L.kDoor + 0.9 + r() * 0.6), 0, 0, (r() - 0.5) * 1.2), [0x9ad8ff, 0xd0b0ff, 0xffd0e8, 0x90ffe0][k % 4])); }   // crystal veins in the cliff
    kglowM.push([0, 9, -44, "200,170,255", 16], [0, -12, -24, "120,90,230", 40]);
    kstone.push(paint(put(new BoxGeometry(9, 1, 15), ...kp(0, -0.5, -39)), 0x3c3440), paint(put(new BoxGeometry(5, 1, 6), ...kp(0, -0.5, 0.5)), 0x3c3440));   // floors of the antechamber and the tunnel
  }
  onProgress(0.7, "Lighting the underground sky…");
  {
    // the cavern: a dome of dark rock studded with crystals
    const dome = new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); const p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (noise2(x * 3 + 5, z * 3 + y * 2) - 0.5) * 0.18; p.setXYZ(i, x * n, y * n, z * n); }
    dome.computeVertexNormals(); dome.scale(48, 38, 56);
    const domeM = new Mesh(put(dome, ...kp(0, -1, -100)), new MeshLambertMaterial({ color: 0x2e2442, emissive: 0x150e26, side: BackSide, flatShading: true })); Kg.add(domeM);
    const floor = new CircleGeometry(1, 48); floor.scale(48, 56, 1); const fp = floor.attributes.position; const fc = new Float32Array(fp.count * 3), c = new Color();
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i); c.set(0x3a4e56).lerp(col.set(0x52627a), noise2(x * 0.2, y * 0.2)); fc[i * 3] = c.r; fc[i * 3 + 1] = c.g; fc[i * 3 + 2] = c.b; }
    floor.setAttribute("color", new Float32BufferAttribute(fc, 3));
    const fm = new Mesh(floor, new MeshLambertMaterial({ vertexColors: true, emissive: 0x0c1220 })); fm.rotation.x = -Math.PI / 2; fm.position.set(KX, -0.02, KZ - 100); Kg.add(fm);
    const nC = [160, 260, 360][tier] || 260, crys = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: 0xffffff, fog: false }), nC);
    for (let k = 0; k < nC; k++) { const a = r() * Math.PI * 2, e = 0.25 + r() * 1.2, x = Math.cos(a) * Math.cos(e) * 46, y = Math.sin(e) * 36, z = Math.sin(a) * Math.cos(e) * 54; ONE.position.set(KX + x, y - 1, KZ - 100 + z); ONE.rotation.set(r() * 3, r() * 3, r() * 3); ONE.scale.set(0.3 + r() * 0.7, 0.6 + r() * 2.4, 0.3 + r() * 0.7); ONE.updateMatrix(); crys.setMatrixAt(k, ONE.matrix); crys.setColorAt(k, col.set([0x9ad8ff, 0xd8c0ff, 0xffe0b0, 0x9affe0][k % 4]).multiplyScalar(0.6 + r() * 0.5)); }
    crys.instanceColor.needsUpdate = true; Kg.add(crys); W.crystals = crys;
    // the mountain that hangs upside down from the ceiling, with a city of tiny lit windows
    const inv = new ConeGeometry(16, 22, 12, 6); const ip = inv.attributes.position; for (let i = 0; i < ip.count; i++) { const y = ip.getY(i); if (y < 10.9) { ip.setX(i, ip.getX(i) * (0.8 + noise2(i * 0.7, y) * 0.5)); ip.setZ(i, ip.getZ(i) * (0.8 + noise2(y, i * 0.3) * 0.5)); } }
    inv.computeVertexNormals(); const invM = new Mesh(put(inv, ...kp(0, 25, -113), 0, Math.PI), new MeshLambertMaterial({ color: 0x3a2e48, flatShading: true })); Kg.add(invM);
    const nW = 120, iw = new InstancedMesh(new BoxGeometry(0.25, 0.35, 0.05), new MeshBasicMaterial({ color: 0xffd890, fog: false }), nW);
    for (let k = 0; k < nW; k++) { const y = 15 + Math.pow(r(), 0.8) * 18, rad = 14 * (1 - (36 - y) / 22) * 0.55 + 1.2, a = r() * 6.283; ONE.position.set(KX + Math.sin(a) * rad, y, KZ - 113 + Math.cos(a) * rad); ONE.rotation.set(0, a, 0); ONE.scale.setScalar(1); ONE.updateMatrix(); iw.setMatrixAt(k, ONE.matrix); }
    Kg.add(iw);
    // floating fragments of staircases and arches: impossible architecture, drifting
    W.floaters = [];
    for (let k = 0; k < 6; k++) {
      const parts = []; if (k % 2 === 0) for (let s = 0; s < 7; s++) parts.push(paint(put(new BoxGeometry(2.2, 0.35, 0.8), 0, s * 0.35, -s * 0.8), 0xd8d0e8));
      else { parts.push(paint(put(new TorusGeometry(2.4, 0.4, 6, 14, Math.PI), 0, 0, 0), 0xd8d0e8)); for (const s of [-1, 1]) parts.push(paint(put(new BoxGeometry(0.8, 3, 0.8), s * 2.4, -1.5, 0), 0xd8d0e8)); }
      const m = new Mesh(mergeGeometries(parts), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a2440 }));
      const a = k / 6 * Math.PI * 2 + 0.3; m.position.set(KX + Math.cos(a) * 26, 9 + (k % 3) * 5, KZ - 100 + Math.sin(a) * 30); m.rotation.set(r(), r() * 6, r() * 0.6 + (k % 2 ? Math.PI / 2 : 0)); m.userData = { ph: r() * 6, y: m.position.y, spin: (r() - 0.5) * 0.08 };
      Kg.add(m); W.floaters.push(m);
    }
  }
  onProgress(0.78, "Filling the lake…");
  {
    // the lake, the causeway, the island and the palace of the throne
    const [lx, lz, rx, rz] = L.lake, lake = new CircleGeometry(1, 48); lake.scale(rx, rz, 1);
    W.lakeMat = new MeshStandardMaterial({ color: 0x0a2a3a, roughness: 0.08, metalness: 0.6, emissive: 0x06303a, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 });
    const lm = new Mesh(lake, W.lakeMat); lm.rotation.x = -Math.PI / 2; lm.position.set(KX + lx, -0.25, KZ + lz); Kg.add(lm);
    for (let z = L.causeway[0]; z > L.causeway[1]; z -= 1.1) kstone.push(paint(put(new BoxGeometry(3.1, 0.5, 1.05), ...kp(0, 0.1, z)), 0xb8b0c8, 0.1, r));
    const [ix, iz, ir] = L.island; kstone.push(paint(put(new CylinderGeometry(ir, ir + 0.6, 1.2, 24), ...kp(ix, 0, iz)), 0xc8c0d8));
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (Math.abs(Math.sin(a / 2)) < 0.18 || Math.cos(a) > 0.9) continue; const x = ix + Math.sin(a) * 7.4, z = iz + Math.cos(a) * 7.4; kpale.push(paint(put(new CylinderGeometry(0.42, 0.5, 9, 10), ...kp(x, 5.1, z)), 0xe8e2f0)); kgold.push(paint(put(new BoxGeometry(1.2, 0.5, 1.2), ...kp(x, 9.7, z)), 0xb08a40)); }
    kgold.push(paint(put(new TorusGeometry(7.4, 0.5, 6, 32), ...kp(ix, 10.1, iz), 0, Math.PI / 2), 0xb08a40));
    kpale.push(paint(put(new CylinderGeometry(7.6, 7.6, 9.5, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), ...kp(ix, 5.3, iz)), 0x6a5a80));   // back wall of the hall
    // the throne
    const [tx, tz] = L.throne;
    kgold.push(paint(put(new CylinderGeometry(2.2, 2.6, 0.6, 12), ...kp(tx, 0.9, tz)), 0xb8a060), paint(put(new BoxGeometry(1.8, 0.7, 1.5), ...kp(tx, 1.55, tz)), 0xc8a050), paint(put(new BoxGeometry(1.9, 4.6, 0.3), ...kp(tx, 3.3, tz - 0.75)), 0xb08a40));
    for (let k = 0; k < 7; k++) kgold.push(paint(put(new ConeGeometry(0.18, 1.1 + (3 - Math.abs(k - 3)) * 0.4, 5), ...kp(tx - 0.9 + k * 0.3, 6 + (3 - Math.abs(k - 3)) * 0.2, tz - 0.75)), 0xd8b060));
    kglowM.push([tx, 4.4, tz - 0.6, "255,214,140", 6], [0, 13, -113, "255,210,150", 22], [-20, 9, -70, "200,230,255", 26], [22, 10, -122, "220,190,255", 26]);
    // gardens: pale luminous trees, flowers, the feast table, the bench
    const nT = 34, tTr = new InstancedMesh(new CylinderGeometry(0.12, 0.22, 1, 6).translate(0, 0.5, 0), new MeshLambertMaterial({ color: 0xe8e4f0, emissive: 0x302838 }), nT), tCr = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false }), nT);
    const spots = []; for (let k = 0; k < nT; k++) { const x = -14 - r() * 26, z = -56 - r() * 46; if (Math.hypot(x - L.feast[0], z - L.feast[1]) < 4 || walkable(KX + x, KZ + z) === false) { k--; continue; } spots.push([x, z]); }
    spots.push([L.bench[0] - 1.8, L.bench[1] - 1.2]);
    spots.forEach(([x, z], k) => { if (k >= nT) return; const h = 3 + r() * 3; ONE.position.set(KX + x, 0, KZ + z); ONE.rotation.set(0, r() * 6, 0); ONE.scale.set(1, h, 1); ONE.updateMatrix(); tTr.setMatrixAt(k, ONE.matrix); ONE.position.y = h; ONE.scale.set(1.3 + r(), 1.1 + r() * 0.6, 1.3 + r()); ONE.updateMatrix(); tCr.setMatrixAt(k, ONE.matrix); tCr.setColorAt(k, col.set([0xbfe8ff, 0xf0d0ff, 0xd8fff0, 0xffe0f0][k % 4])); colliders.circle(KX + x, KZ + z, 0.35); });
    tCr.instanceColor.needsUpdate = true; Kg.add(tTr, tCr); W.kTrees = tCr;
    const nF = 400, fl = new InstancedMesh(new OctahedronGeometry(0.1, 0), new MeshBasicMaterial({ color: 0xffffff, fog: false }), nF);
    for (let k = 0; k < nF; k++) { let x, z; do { x = (r() * 2 - 1) * 44; z = -50 - r() * 100; } while (!walkable(KX + x, KZ + z)); ONE.position.set(KX + x, 0.1, KZ + z); ONE.rotation.set(0, r() * 3, 0); ONE.scale.setScalar(0.6 + r()); ONE.updateMatrix(); fl.setMatrixAt(k, ONE.matrix); fl.setColorAt(k, col.set([0x9ad8ff, 0xf0b0ff, 0xfff0a0, 0xa0ffd8][k % 4])); }
    fl.instanceColor.needsUpdate = true; Kg.add(fl); W.kFlowers = fl;
    { const [fx, fz] = L.feast; kpale.push(paint(put(new BoxGeometry(5.2, 0.15, 1.4), ...kp(fx, 0.95, fz)), 0xf0e8f4)); for (const s of [-2.2, 2.2]) kpale.push(paint(put(new BoxGeometry(0.2, 0.9, 1.1), ...kp(fx + s, 0.45, fz)), 0xd8d0e0));
      W.feastFood = []; for (let k = 0; k < 9; k++) { const m = new Mesh(new SphereGeometry(0.16 + (k % 3) * 0.05, 8, 6), new MeshLambertMaterial({ color: [0x8a2a5a, 0xd8a020, 0x6a8a2a, 0xe8d8b0, 0xa02a2a][k % 5], emissive: 0x1a0a10 })); m.position.set(KX + fx - 2 + k * 0.5, 1.15, KZ + fz + (k % 2 ? 0.25 : -0.25)); Kg.add(m); W.feastFood.push(m); }
      for (let k = 0; k < 4; k++) kgold.push(paint(put(new CylinderGeometry(0.07, 0.05, 0.28, 8), ...kp(fx - 1.5 + k, 1.17, fz - 0.4)), 0xd8b060)); colliders.box(KX + fx - 2.7, KZ + fz - 0.8, KX + fx + 2.7, KZ + fz + 0.8); }
    { const [bx, bz] = L.bench; kpale.push(paint(put(new BoxGeometry(2.4, 0.2, 0.7), ...kp(bx, 0.55, bz)), 0xe8e2f0), paint(put(new BoxGeometry(0.3, 0.5, 0.6), ...kp(bx - 1, 0.25, bz)), 0xd8d0e0), paint(put(new BoxGeometry(0.3, 0.5, 0.6), ...kp(bx + 1, 0.25, bz)), 0xd8d0e0)); colliders.box(KX + bx - 1.2, KZ + bz - 0.4, KX + bx + 1.2, KZ + bz + 0.4); }
    // the dancing pavilion
    { const [dx, dz] = L.dancers; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, x = dx + Math.sin(a) * 6.5, z = dz + Math.cos(a) * 6.5; kpale.push(paint(put(new CylinderGeometry(0.3, 0.36, 6, 8), ...kp(x, 3, z)), 0xe8e2f0)); colliders.circle(KX + x, KZ + z, 0.4); }
      const dm = new SphereGeometry(7, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2); kpale.push(paint(put(dm, ...kp(dx, 6, dz)), 0x8a7aa8)); kpale.push(paint(put(new CylinderGeometry(6.8, 6.8, 0.2, 24), ...kp(dx, 0.1, dz)), 0xc8c0d8)); kglowM.push([dx, 4, dz, "230,190,255", 7]); }
    // the knight's stone, the lower garden's steps and its dark pool
    { const [qx, qz] = L.knight; kstone.push(paint(put(new DodecahedronGeometry(0.6, 0), ...kp(qx - 0.3, 0.2, qz - 0.3)), 0x5a5466)); }
    { const [px, pz] = L.pool; W.poolMat = new MeshStandardMaterial({ color: 0x050508, roughness: 0.05, metalness: 0.8 }); const pm = new Mesh(new CircleGeometry(4.6, 32), W.poolMat); pm.rotation.x = -Math.PI / 2; pm.position.set(KX + px, -1.5, KZ + pz); Kg.add(pm);
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; kstone.push(paint(put(new BoxGeometry(1.7, 0.4, 0.7), ...kp(px + Math.sin(a) * 4.9, -1.35, pz + Math.cos(a) * 4.9), a), 0x4a4458)); }
      W.dresses = []; for (let k = 0; k < 5; k++) { const a = -0.5 + k * 0.35, m = new Mesh(new PlaneGeometry(0.9, 1.6), new MeshLambertMaterial({ color: [0xe8e0f0, 0xd8c8e8, 0xf0e0e8][k % 3], side: DoubleSide })); m.rotation.set(-Math.PI / 2, 0, a); m.position.set(KX + px + Math.sin(a + 3.6) * 6.2, -1.2 + 0.02 * k, KZ + pz + Math.cos(a + 3.6) * 6.2); m.visible = false; Kg.add(m); W.dresses.push(m); }
      // serpents: chains of beads that coil in the pool on Saturday
      const nS = 6, seg = 16; W.serpents = new InstancedMesh(new SphereGeometry(0.18, 6, 5), new MeshLambertMaterial({ color: 0x2a4a3a, emissive: 0x0a1a10 }), nS * seg); W.serpents.userData = { n: nS, seg, on: 0 }; W.serpents.count = 0; W.serpents.frustumCulled = false; Kg.add(W.serpents); }
    // the round crystal window onto the world above
    { const [wx, wz] = L.window; W.windowMat = new MeshBasicMaterial({ color: 0xa8c0e0, fog: false }); const wm = new Mesh(new CircleGeometry(3.4, 32), W.windowMat); wm.position.set(KX + wx + 0.4, 4.6, KZ + wz); wm.rotation.y = Math.PI / 2; Kg.add(wm);
      kgold.push(paint(put(new TorusGeometry(3.5, 0.3, 6, 32), ...kp(wx + 0.45, 4.6, wz), Math.PI / 2), 0xb08a40)); kglowM.push([wx + 1.5, 4.6, wz, "190,215,255", 9]); W.windowPos = new Vector3(KX + wx + 0.4, 4.6, KZ + wz); }
    // leaves for the Sibyl's answer (hidden until the ending)
    W.leaves = new InstancedMesh(new PlaneGeometry(0.35, 0.5), new MeshBasicMaterial({ color: 0xe8d8a0, side: DoubleSide, transparent: true, opacity: 0.9, fog: false }), 70); W.leaves.count = 0; W.leaves.frustumCulled = false; Kg.add(W.leaves);
  }
  bake(kstone, masonry(VC(), "rock"), Kg); bake(kdark, VC(), Kg);
  bake(kgold, new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a1a04 }), Kg);
  bake(kpale, new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1a1428 }), Kg);
  bake(kcrys, new MeshBasicMaterial({ vertexColors: true, fog: false }), Kg);
  kglowM.forEach(([x, y, z, c, s]) => { const g = glowSprite(c, s); g.position.set(KX + x, y, KZ + z); g.material.opacity = 0.55; Kg.add(g); W.glows.push(g); });
  for (let k = 0; k < (tier ? 26 : 14); k++) { const g = glowSprite(["160,220,255", "230,190,255", "255,220,170"][k % 3], 1.2 + r() * 1.6); let x, z; do { x = (r() * 2 - 1) * 42; z = -52 - r() * 96; } while (!walkable(KX + x, KZ + z)); g.position.set(KX + x, 1.5 + r() * 4, KZ + z); g.material.opacity = 0.6; g.userData = { ph: r() * 6, y: g.position.y }; Kg.add(g); W.anim.push(g); }
  { const n = 160, g = new BufferGeometry(), p = new Float32Array(n * 3); for (let k = 0; k < n; k++) { p[k * 3] = KX + (r() * 2 - 1) * 44; p[k * 3 + 1] = r() * 18; p[k * 3 + 2] = KZ - 50 - r() * 100; } g.setAttribute("position", new Float32BufferAttribute(p, 3)); W.motes = new Points(g, new PointsMaterial({ color: 0xd8e8ff, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending, fog: false })); Kg.add(W.motes); }

  onProgress(0.86, "The mountain is ready.");
  W.setZone = z => { S.visible = z !== "kingdom"; Kg.visible = z === "kingdom"; };
  /** time under the mountain shows in its garden: the pale trees and flowers drift through the seasons as your days pass */
  W.setDays = day => {
    const m = ((4 + day / 30.4) % 12 + 12) % 12, warm = Math.max(0, Math.sin((m - 3) / 12 * Math.PI * 2)), cold = Math.max(0, -Math.sin((m - 3) / 12 * Math.PI * 2));
    W.kTrees.material.color.setRGB(1, 1 - cold * 0.1 - warm * 0.05, 1 - warm * 0.45).lerp(col.set(0xb8d0ff), cold * 0.35);
    W.kFlowers.material.color.setRGB(1, 1 - warm * 0.2, 1 - warm * 0.5).multiplyScalar(1 - cold * 0.35);
  };
  /** per-frame life of the world (cheap) */
  W.update = (dt, t, look) => {
    if (S.visible) {
      for (const m of W.mist) { m.position.x += Math.sin(t * 0.07 + m.userData.ph) * dt * 0.6; m.material.opacity = (0.08 + Math.sin(t * 0.2 + m.userData.ph) * 0.03) * (look.mist || 1); }
      W.flies.material.opacity = (look.night || 0) * (0.55 + Math.sin(t * 3) * 0.2);
      const { body, head } = W.sheepMesh; W.sheep.forEach((s, k) => { s.a += Math.sin(t * 0.3 + s.ph) * dt * 0.3; const y = SURF(s.x, s.z); ONE.position.set(s.x, y + 0.55, s.z); ONE.rotation.set(0, s.a, 0); ONE.scale.setScalar(1); ONE.updateMatrix(); body.setMatrixAt(k, ONE.matrix); ONE.position.set(s.x + Math.sin(s.a) * 0.55, y + 0.62 + Math.sin(t * 1.3 + s.ph) * 0.05 - (Math.sin(t * 0.4 + s.ph) > 0.5 ? 0.25 : 0), s.z + Math.cos(s.a) * 0.55); ONE.updateMatrix(); head.setMatrixAt(k, ONE.matrix); });
      body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
      W.mouthGlow.material.opacity = 0.35 + Math.sin(t * 1.7) * 0.12;
      W.glows.forEach(g => { if (g.parent === S) g.material.opacity = (look.lamps || 0) * (0.75 + Math.sin(t * 9 + g.position.x) * 0.06); });
    }
    if (Kg.visible) {
      for (const f of W.floaters) { f.position.y = f.userData.y + Math.sin(t * 0.3 + f.userData.ph) * 0.8; f.rotation.y += f.userData.spin * dt; }
      for (const g of W.anim) { g.position.y = g.userData.y + Math.sin(t * 0.6 + g.userData.ph) * 0.5; g.material.opacity = 0.45 + Math.sin(t * 1.3 + g.userData.ph) * 0.2; }
      W.motes.rotation.y = Math.sin(t * 0.02) * 0.05; W.motes.position.y = Math.sin(t * 0.15) * 0.5;
      W.lakeMat.emissiveIntensity = 0.5 + Math.sin(t * 0.7) * 0.1 + (look.ench || 0) * 0.4;
      const sp = W.serpents, u = sp.userData;
      if (u.on > 0.01) {
        sp.count = u.n * u.seg; const [px, pz] = L.pool;
        for (let s = 0; s < u.n; s++) for (let k = 0; k < u.seg; k++) { const a = t * (0.4 + s * 0.07) + s * 1.1 - k * 0.22, rr = 1.2 + s * 0.5 + Math.sin(k * 0.4 + t + s) * 0.3; ONE.position.set(KX + px + Math.cos(a) * rr, -1.45 + Math.max(0, Math.sin(t * 1.3 + s) * 0.8 - k * 0.06) * (k < 4 ? 1 : 0.2) + (u.on - 1) * 1.5, KZ + pz + Math.sin(a) * rr); const sc = (1 - k / u.seg * 0.7) * (k === 0 ? 1.35 : 1); ONE.scale.setScalar(sc); ONE.rotation.set(0, 0, 0); ONE.updateMatrix(); sp.setMatrixAt(s * u.seg + k, ONE.matrix); }
        sp.instanceMatrix.needsUpdate = true;
      } else sp.count = 0;
    }
  };
  return W;
}
