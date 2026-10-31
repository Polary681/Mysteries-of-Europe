// The landing valley as pure functions (no three.js objects): terrain height, the castle crag, forest cover.
// Shared by the renderer (hero3d.js) and by the systems that live in the valley (lake, lantern, wisps, presences, camera flights).
// 1 unit = 1 metre. The camera stands on a knoll at the origin looking down -z (towards the south, see sky.js).
import { noise2, fbm, smooth, lerp } from "../shared/world.js";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const DEG = Math.PI / 180;

/* =====================================================================================  WORLD LAYOUT
   1 unit = 1 metre. The camera stands on a knoll at the origin looking down -z, over a misty valley, at a castle
   built on a rocky crag ~340 m away; forested hills rise behind it and snowy mountains close the horizon. */
export const C = { x: 70, z: -272, T: 70, rx: 38, rz: 38, rot: 45 * DEG };      // crag centre, plateau height, plateau radii, castle yaw
export const CAM_UP = 13;                                                       // eye height above the knoll
/* the dark lake at the foot of the crag (water level in metres; a shelf of ground holds it above the valley floor) */
export const LAKE = { x: 30, z: -134, rx: 82, rz: 72, rot: 0.3, level: 12 };
/** normalised distance from the lake centre (1 = shoreline), irregular */
export function lakeR(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.z, c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot);
  const u = (dx * c - dz * s) / LAKE.rx, v = (dx * s + dz * c) / LAKE.rz, a = Math.atan2(v, u);
  return Math.hypot(u, v) * (1 + (noise2(Math.cos(a) * 1.3 + 2.1, Math.sin(a) * 1.3 - 4.7) - 0.5) * 0.3);
}

export function ridged(x, z, oct) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let i = 0; i < oct; i++) { let n = 1 - Math.abs(noise2(x * f, z * f) * 2 - 1); n *= n * w; w = clamp(n * 1.6, 0, 1); s += n * a; f *= 2.03; a *= 0.5; }
  return s;
}
export const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
/** normalised distance from the crag centre (1 = plateau edge), with an irregular outline */
export function cragR(x, z) {
  const ex = (x - C.x) / C.rx, ez = (z - C.z) / C.rz, r = Math.hypot(ex, ez), a = Math.atan2(ez, ex);
  return r * (1 + (noise2(Math.cos(a) * 1.7 + 5.3, Math.sin(a) * 1.7 + 9.1) - 0.5) * 0.22);
}
/** terrain height (metres) */
export function H(x, z) {
  const d = -z;
  const n1 = fbm(x * 0.0026 + 31.7, z * 0.0026 - 12.3, 4), n2 = fbm(x * 0.011 - 4.1, z * 0.011 + 8.8, 4);
  let h = 36 * Math.exp(-(x * x) / (250 * 250) - ((d + 40) * (d + 40)) / (125 * 125));                // the knoll under the camera
  const side = smooth(130, 560, Math.abs(x - 40 + (n1 - 0.5) * 260));                                // valley walls
  h += side * (45 + 120 * n1) * smooth(-150, 250, d);
  h += smooth(430, 1050, d + (n1 - 0.5) * 320) * (60 + 170 * n1);                                     // forested hills behind
  const m = smooth(1300, 3200, d + (n1 - 0.5) * 600);                                                 // the mountain range
  if (m > 0) h += m * (140 + 820 * ridged(x * 0.00062 + 3.3, z * 0.00062 + 1.1, 5) * (0.5 + 0.6 * n1));
  h += (n2 - 0.45) * (7 + Math.min(Math.max(d, 0), 1500) * 0.022);                                     // rolling ground
  // a long spur joins the crag to the hills behind it
  const sx = x - C.x + (z - C.z) * 0.12, behind = smooth(C.z + 40, C.z - 60, z);
  h = smax(h, (C.T - 16 - Math.max(0, (C.z - z) * 0.03)) * Math.exp(-(sx * sx) / (62 * 62)) * behind, 24);
  // the lake: a shelf of meadow lifted just above the water level, and the basin carved into it
  const lr = lakeR(x, z);
  if (lr < 2.4) {
    const shore = LAKE.level + 0.6 + Math.max(0, lr - 1) * 5 + (n2 - 0.45) * 1.5;
    h = lerp(h, Math.max(h, shore), 1 - smooth(1.3, 2.4, lr));
    if (lr < 1.25) h = Math.min(h, LAKE.level - 0.5 - 4 * smooth(1.0, 0.35, lr) + Math.max(0, lr - 1) * 9);
  }
  // the crag: a flat top under the castle, a steep drop (dressed with rock meshes, see the "cliffs" step), then a talus slope
  const r = cragR(x, z);
  if (r < 2.7) {
    let hc;
    if (r < 0.88) hc = C.T + (n2 - 0.5) * 1.0;
    else if (r < 1.15) hc = lerp(C.T, C.T * 0.5, smooth(0.88, 1.15, r));
    else hc = C.T * 0.5 * (1 - smooth(1.15, 2.6, r));
    hc += (ridged(x * 0.035 + 7, z * 0.035 - 3, 3) - 0.4) * 10 * smooth(1.1, 1.3, r) * (1 - smooth(1.7, 2.4, r));
    if (r > 0.85) hc = Math.min(hc, C.T - 2);                                           // nothing pokes above the walls
    h = smax(h, hc, 6);
  }
  return h;
}
/** 0..1 forest cover */
export function forestDensity(x, z, h, ny) {
  let v = smooth(0.34, 0.5, fbm(x * 0.0068 + 70.3, z * 0.0068 - 21.7, 3));
  v *= 1 - smooth(360, 480, h + (noise2(x * 0.01, z * 0.01) - 0.5) * 100);   // tree line
  v *= smooth(0.7, 0.84, ny);                                                  // bare where the ground is steep
  v *= smooth(1.28, 1.7, cragR(x, z));                                         // the castle rock stays bare
  v *= smooth(-2, 6, h);                                                       // wet meadows on the valley floor
  v *= smooth(1.25, 1.75, lakeR(x, z));                                         // open shores around the lake
  return v;
}
export const slopeY = (x, z) => { const e = 1.5, dx = H(x + e, z) - H(x - e, z), dz = H(x, z + e) - H(x, z - e); return 2 * e / Math.hypot(dx, 2 * e, dz); };

