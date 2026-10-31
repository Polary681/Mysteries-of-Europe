// Hoia Baciu: a procedural night forest on a gentle hill (terrain, twisted trees, the round clearing, five traces). No external assets.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, TorusGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3, Float32BufferAttribute, InstancedMesh, Object3D, Color, DoubleSide,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, fbm, smooth as sm, lerp, glowSprite } from "../../shared/world.js";

export const SITES = {
  edge: [0, 74], sign: [2.6, 66.5], leave: [0, 72],
  t1: [-31, 34], t2: [29, 22], t3: [-34, -14], t4: [33, -30], t5: [-10, -52],
  clearing: [0, -10],
};
export const CLEAR_R = 12, WORLD_R = 84;
const PATHS = [
  [[0, 76], [0, 58], [-6, 40], [-2, 22], [0, 2]],
  [[-6, 40], [-20, 37], [-31, 34]], [[-2, 22], [14, 24], [29, 22]], [[-34, -14], [-20, -12], [-11, -10]],
  [[12, -12], [24, -22], [33, -30]], [[-4, -21], [-8, -36], [-10, -52]],
];
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export const pathDist = (x, z) => { let m = 99; for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) m = Math.min(m, segD(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1])); return m; };
const clearD = (x, z) => Math.hypot(x - SITES.clearing[0], z - SITES.clearing[1]);
// the sheep track: a straight line from the trace to the clearing and out the far side
const trackD = (x, z) => segD(x, z, -34, -14, 26, -6);

export function H(x, z) {
  let h = 4.2 * fbm(x * 0.018 + 3, z * 0.018 - 7, 3) + 1.2 * fbm(x * 0.07, z * 0.07, 2) - 2.4 + (z - 70) * -0.035;
  const cd = clearD(x, z); h = lerp(h, 1.2 + 0.15 * fbm(x * 0.2, z * 0.2, 2), sm(CLEAR_R + 7, CLEAR_R - 2, cd));
  const pd = pathDist(x, z); h = lerp(h, h * 0.9 + 0.05, sm(3, 0.8, pd) * 0.5);
  return h;
}

const mats = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, ...o })); return mats.get(k); };

// a tapering, crooked trunk (the famous "dancing" trees), merged with a few bent branches. `bend` 0 = nearly straight.
function trunkGeo(r, bend, h = 9) {
  const parts = [], R = r();
  const tube = (pts, rad, seg = 12) => {
    const curve = new CatmullRomCurve3(pts), g = new TubeGeometry(curve, seg, rad, 5, false), p = g.attributes.position, n = 6;
    for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg), k = 1 - 0.8 * (i / seg); for (let j = 0; j < n; j++) { const idx = i * n + j; p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k); } }
    g.deleteAttribute("uv"); g.computeVertexNormals(); return g;
  };
  const a = R * 6.28, kx = Math.cos(a), kz = Math.sin(a), b = bend;
  const pts = [new Vector3(0, -0.4, 0), new Vector3(kx * 1.6 * b, 0.6, kz * 1.6 * b), new Vector3(kx * 2.2 * b, 1.1 + 0.6 * (1 - b), kz * 2.2 * b), new Vector3(kx * 1.2 * b + 0.3 * r() - 0.15, 2.6, kz * 1.2 * b), new Vector3(0.5 * (r() - 0.5), h * 0.6, 0.5 * (r() - 0.5)), new Vector3(0.8 * (r() - 0.5), h, 0.8 * (r() - 0.5))];
  parts.push(tube(pts, 0.3, 14));
  const c = new CatmullRomCurve3(pts);
  for (let i = 0; i < 3; i++) {
    const t = 0.45 + i * 0.16, s = c.getPointAt(t), ang = r() * 6.28, l = 1.2 + r() * 1.6, up = 0.6 + r();
    parts.push(tube([s, s.clone().add(new Vector3(Math.cos(ang) * l * 0.5, up * 0.4, Math.sin(ang) * l * 0.5)), s.clone().add(new Vector3(Math.cos(ang + 0.6 * (r() - 0.5)) * l, up, Math.sin(ang) * l))], 0.09, 5));
  }
  return mergeGeometries(parts);
}

export function buildForest(scene, col, onProgress = () => {}) {
  const W = { root: new Group(), motes: {}, sources: {}, skyLights: [], props: {}, detail: [] }, r = rng(1968);
  scene.add(W.root);
  onProgress(0.05, "Growing the forest…");

  /* ---- terrain ---- */
  const S = 200, N = 150, g = new PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = H(x, z); p.setY(i, h);
    const cd = clearD(x, z), pd = pathDist(x, z), td = trackD(x, z), n = fbm(x * 0.15, z * 0.15, 2);
    c.setRGB(0.07 + n * 0.04, 0.085 + n * 0.05, 0.06 + n * 0.03); // leaf litter and moss
    if (pd < 2.2) c.lerp(new Color(0.16, 0.13, 0.1), sm(2.2, 0.6, pd) * 0.8);
    if (cd < CLEAR_R + 2) c.lerp(new Color(0.15, 0.15, 0.1).multiplyScalar(0.7 + 0.6 * n), sm(CLEAR_R + 2, CLEAR_R - 3, cd) * 0.85); // short thin grass, bare patches
    if (td < 1.1) c.lerp(new Color(0.12, 0.1, 0.08), sm(1.1, 0.3, td) * 0.7);
    const fd = Math.hypot(x - SITES.t5[0], z - SITES.t5[1]); if (fd < 7) c.lerp(new Color(0.42, 0.46, 0.52), sm(7, 2, fd) * 0.55); // frost
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  const ground = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: DoubleSide })); W.root.add(ground); W.ground = ground;
  onProgress(0.25, "Bending the trees…");

  /* ---- trees: 6 trunk variants (from nearly straight to wildly twisted) in instanced meshes ---- */
  const variants = [0.05, 0.15, 0.4, 0.7, 1.0, 1.25].map(b => trunkGeo(r, b, 8 + r() * 3));
  const bark = new MeshStandardMaterial({ color: 0x3a3430, roughness: 1, flatShading: true });
  const spots = variants.map(() => []), crowns = [];
  const free = (x, z, pad = 0) => pathDist(x, z) > 2.6 + pad && clearD(x, z) > CLEAR_R + 0.5 + pad && Math.hypot(x - SITES.edge[0], z - SITES.edge[1]) > 6 &&
    !Object.keys(SITES).some(k => k !== "clearing" && k !== "edge" && k !== "leave" && Math.hypot(x - SITES[k][0], z - SITES[k][1]) < 3.4 + pad) && trackD(x, z) > 1.4;
  for (let i = 0; i < 2600 && spots.flat().length < 820; i++) {
    const x = (r() - 0.5) * 190, z = (r() - 0.5) * 190; if (z > 80 || !free(x, z)) continue;
    const near = Math.hypot(x, z - SITES.clearing[1]), twisty = sm(70, 20, near) + (Math.hypot(x - SITES.t1[0], z - SITES.t1[1]) < 16 ? 0.8 : 0);
    const v = Math.min(5, Math.max(0, Math.floor(twisty * 3.2 + r() * 2.4))); spots[v].push([x, z, r() * 6.28, 0.8 + r() * 0.5]);
  }
  // the ring of trees around the clearing, a little more twisted
  for (let i = 0; i < 46; i++) { const a = i / 46 * 6.28 + r() * 0.06, d = CLEAR_R + 1.6 + r() * 2.2, x = SITES.clearing[0] + Math.cos(a) * d, z = SITES.clearing[1] + Math.sin(a) * d; if (pathDist(x, z) < 2.4 || trackD(x, z) < 1.4) continue; spots[3 + (i % 3)].push([x, z, r() * 6.28, 0.9 + r() * 0.3]); }
  const o = new Object3D();
  variants.forEach((geo, v) => {
    const list = spots[v]; if (!list.length) return; const im = new InstancedMesh(geo, bark, list.length);
    list.forEach(([x, z, rot, s], i) => { o.position.set(x, H(x, z), z); o.rotation.set(0, rot, 0); o.scale.set(s, s * (0.9 + r() * 0.3), s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); col.circle(x, z, 0.42 * s); crowns.push([x, z, s]); });
    W.root.add(im);
  });
  onProgress(0.5, "Thickening the canopy…");
  { // sparse dark crowns high up: they hide the sky without a wall of leaves
    const geo = new IcosahedronGeometry(1, 0), m = new MeshStandardMaterial({ color: 0x1a2418, roughness: 1, flatShading: true }), list = crowns.filter(() => r() < 0.55), im = new InstancedMesh(geo, m, list.length * 2);
    let k = 0; for (const [x, z, s] of list) for (let j = 0; j < 2; j++) { o.position.set(x + (r() - 0.5) * 3, H(x, z) + 7 + r() * 3 * s, z + (r() - 0.5) * 3); o.rotation.set(r(), r(), r()); o.scale.set(1.8 + r() * 1.6, 1 + r(), 1.8 + r() * 1.6); o.updateMatrix(); im.setMatrixAt(k++, o.matrix); }
    W.root.add(im); W.detail.push(im);
  }
  { // low brambles and fern clumps hugging the ground
    const geo = new IcosahedronGeometry(0.5, 0), m = new MeshStandardMaterial({ color: 0x1c2a1c, roughness: 1, flatShading: true }), list = [];
    for (let i = 0; i < 2400 && list.length < 900; i++) { const x = (r() - 0.5) * 180, z = (r() - 0.5) * 180; if (z > 78 || pathDist(x, z) < 1.6 || clearD(x, z) < CLEAR_R - 1 || trackD(x, z) < 0.9) continue; list.push([x, z]); }
    const im = new InstancedMesh(geo, m, list.length); list.forEach(([x, z], i) => { const s = 0.6 + r() * 1.1; o.position.set(x, H(x, z) + 0.05 * s, z); o.rotation.set(0, r() * 6.28, 0); o.scale.set(s * (0.9 + r() * 0.5), s * (0.35 + r() * 0.35), s * (0.9 + r() * 0.5)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); W.root.add(im); W.detail.push(im);
  }
  onProgress(0.65, "Marking the traces…");

  /* ---- set pieces ---- */
  const at = (k, dy = 0) => { const [x, z] = SITES[k]; return new Vector3(x, H(x, z) + dy, z); };
  const add = (mesh, v) => { mesh.position.copy(v); W.root.add(mesh); return mesh; };
  // the trail sign at the forest edge
  { const v = at("sign"); const post = add(new Mesh(new BoxGeometry(0.14, 1.6, 0.14), M(0x4a3a2a)), v.clone().add(new Vector3(0, 0.8, 0))); const board = add(new Mesh(new BoxGeometry(1.4, 0.8, 0.06), M(0x5d4a34)), v.clone().add(new Vector3(0, 1.55, 0))); board.rotation.y = 0.4; post.rotation.y = 0.4; col.circle(v.x, v.z, 0.3); }
  // the city behind you: a warm glow on the southern horizon
  for (let i = 0; i < 7; i++) { const s = glowSprite("255,170,90", 26 + r() * 20); s.position.set(-60 + i * 20 + r() * 8, 2 + r() * 4, 128); s.material.opacity = 0.22; W.root.add(s); }
  // t1: two trunks that grew into a ring
  { const v = at("t1"); const ring = add(new Mesh(new TorusGeometry(1.2, 0.26, 6, 16, Math.PI * 1.55), bark), v.clone().add(new Vector3(0, 1.0, -1.2))); ring.rotation.set(0, 0.5, 0.4); col.circle(v.x - 1.3, v.z - 1.6, 0.4); col.circle(v.x + 1.2, v.z - 0.8, 0.4); }
  // t2: Barnea-style tripod and a camera case on a stump
  { const v = at("t2"); for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28, leg = add(new Mesh(new CylinderGeometry(0.025, 0.025, 1.5, 4), M(0x5a5048, { metalness: 0.4 })), v.clone().add(new Vector3(Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3))); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    add(new Mesh(new BoxGeometry(0.16, 0.12, 0.12), M(0x222222)), v.clone().add(new Vector3(0, 1.48, 0))).rotation.x = -0.6;
    const stump = add(new Mesh(new CylinderGeometry(0.45, 0.55, 0.5, 8), bark), v.clone().add(new Vector3(1.4, 0.2, 0.6))); col.circle(stump.position.x, stump.position.z, 0.5);
    W.props.camera = add(new Mesh(new BoxGeometry(0.34, 0.22, 0.2), M(0x3b2618)), v.clone().add(new Vector3(1.4, 0.56, 0.6))); }
  // t3: the tally stick on the sheep track
  { const v = at("t3"); W.props.tally = add(new Mesh(new CylinderGeometry(0.03, 0.035, 1.1, 5), M(0x8a6a44)), v.clone().add(new Vector3(0.6, 0.06, 0.4))); W.props.tally.rotation.set(Math.PI / 2, 0, 0.7); }
  // t4: a red ribbon on a low branch
  { const v = at("t4"); const br = add(new Mesh(new CylinderGeometry(0.05, 0.08, 2.4, 5), bark), v.clone().add(new Vector3(-0.6, 1.1, 0))); br.rotation.z = 1.2;
    const rib = new Group(); rib.add(new Mesh(new BoxGeometry(0.16, 0.08, 0.02), M(0xb0182a, { emissive: 0x300008 }))); for (const s of [-1, 1]) { const t = new Mesh(new BoxGeometry(0.04, 0.32, 0.01), M(0xb0182a, { emissive: 0x300008 })); t.position.set(0.04 * s, -0.17, 0); t.rotation.z = 0.2 * s; rib.add(t); }
    rib.position.copy(v.clone().add(new Vector3(-0.2, 1.05, 0))); W.root.add(rib); W.props.ribbon = rib; const trunk = new Mesh(new CylinderGeometry(0.3, 0.38, 6, 7), bark); trunk.position.copy(v.clone().add(new Vector3(-1.7, 3, 0))); W.root.add(trunk); col.circle(v.x - 1.7, v.z, 0.45); }
  // t5: the cold spot: frost glitter and a pale mist
  { const v = at("t5"); const mist = glowSprite("190,215,255", 9); mist.position.copy(v.clone().add(new Vector3(0, 1.2, 0))); mist.material.opacity = 0.13; W.root.add(mist); W.coldMist = mist; }
  // the clearing: a faint ring of paler grass, and the lights above it (shown when the clearing "opens")
  { const v = at("clearing"); const ring = new Mesh(new TorusGeometry(CLEAR_R - 1, 0.18, 4, 64), new MeshBasicMaterial({ color: 0x8f86b0, transparent: true, opacity: 0.05, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(v.x, v.y + 0.06, v.z); W.root.add(ring); W.clearRing = ring;
    for (let i = 0; i < 5; i++) { const s = glowSprite("215,225,255", 2.2 + r() * 1.4); s.userData = { a: i / 5 * 6.28, r: 4 + r() * 6, h: 15 + r() * 6, sp: 0.08 + r() * 0.08 }; s.material.opacity = 0; W.root.add(s); W.skyLights.push(s); } }
  // traces: pale motes that drift where something is waiting, and a point to "hear" them from
  for (const k of ["t1", "t2", "t3", "t4", "t5"]) { const v = at(k, 1.4), m = glowSprite("200,190,255", 2.2); m.position.copy(v); m.material.opacity = 0; W.root.add(m); W.motes[k] = m; W.sources[k] = [v.x, v.z]; }
  onProgress(1, "Done");
  return W;
}
