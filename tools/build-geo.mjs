// Generates js/geo-data.js from Natural Earth (via the "world-atlas" npm package,
// which is Natural Earth 1:50m admin-0 countries converted to TopoJSON; public domain).
//
//   npm run geo
//
// Output (window.GEO):
//   view      : {w,h}  size of the 2D map canvas (projected units)
//   countries : [{c, n, polys:[[ring,...holes]], ctr:[x,y]}]  planar, clipped to the view
//   grat      : graticule polylines (planar)
//   pins      : {cap:{code:[x,y]}, leg:{key:[x,y]}}
//   extra     : European countries that are not (yet) part of the school project
//   globe     : {mesh:[[lon,lat,...]], hi:{code:[[lon,lat,...]]}, cap:{code:[lon,lat]}, leg:{key:[lon,lat]}}
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as topojson from "topojson-client";
import { geoAzimuthalEqualArea, geoStream, geoGraticule10, geoCentroid } from "d3-geo";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const topo = JSON.parse(readFileSync(path.join(root, "node_modules/world-atlas/countries-50m.json"), "utf8"));
const fc = topojson.feature(topo, topo.objects.countries);

/* ---------- which countries do we know (numeric ISO 3166-1 -> our code) ---------- */
// Project countries (codes match js/data.js: note "UK")
const PROJECT = { 352:"IS",578:"NO",752:"SE",246:"FI",372:"IE",826:"UK",208:"DK",233:"EE",56:"BE",528:"NL",276:"DE",616:"PL",
  440:"LT",428:"LV",250:"FR",756:"CH",40:"AT",348:"HU",642:"RO",804:"UA",620:"PT",724:"ES",380:"IT",705:"SI",191:"HR",688:"RS",
  100:"BG",8:"AL",300:"GR" };
// Other European countries: shown + named, but not yet part of the project
const EXTRA = {
  203:["CZ","Czechia","Prague",50.08,14.44], 703:["SK","Slovakia","Bratislava",48.15,17.11],
  70:["BA","Bosnia and Herzegovina","Sarajevo",43.86,18.41], 499:["ME","Montenegro","Podgorica",42.44,19.26],
  807:["MK","North Macedonia","Skopje",42.0,21.43], 498:["MD","Moldova","Chișinău",47.01,28.86],
  112:["BY","Belarus","Minsk",53.9,27.57], 442:["LU","Luxembourg","Luxembourg",49.61,6.13],
  470:["MT","Malta","Valletta",35.9,14.51], 196:["CY","Cyprus","Nicosia",35.17,33.37],
  643:["RU","Russia","Moscow",55.76,37.62], 792:["TR","Türkiye","Ankara",39.93,32.86],
  "XK":["XK","Kosovo","Pristina",42.67,21.17],
};
const CAP = { IS:[64.15,-21.94],NO:[59.91,10.75],SE:[59.33,18.07],FI:[60.17,24.94],IE:[53.35,-6.26],UK:[51.51,-0.13],
  DK:[55.68,12.57],EE:[59.44,24.75],BE:[50.85,4.35],NL:[52.37,4.9],DE:[52.52,13.4],PL:[52.23,21.01],LT:[54.69,25.28],
  LV:[56.95,24.11],FR:[48.86,2.35],CH:[46.95,7.45],AT:[48.21,16.37],HU:[47.5,19.04],RO:[44.43,26.1],UA:[50.45,30.52],
  PT:[38.72,-9.14],ES:[40.42,-3.7],IT:[41.9,12.5],SI:[46.06,14.51],HR:[45.81,15.98],RS:[44.79,20.45],BG:[42.7,23.32],
  AL:[41.33,19.82],GR:[37.98,23.73] };
for (const v of Object.values(EXTRA)) CAP[v[0]] = [v[3], v[4]];
// legend locations [lat, lon] (keys = js/data.js LEGENDS)
// babayaga: the tales belong to no single place; the pin stands at Abramtsevo near Moscow, where Viktor Vasnetsov built the
// "Hut on Chicken Legs" pavilion in 1883
// sibilla: Monte Sibilla (2,173 m), above Montemonaco in the Marche: 42.900 N, 13.262 E (the cave opens just below the summit)
// bathory: Čachtice Castle (Csejte), Nitra region, Slovakia — then Nyitra County, Kingdom of Hungary: 48.725 N, 17.761 E
const LEG = { woolpit:[52.1,0.95], hoia:[46.77,23.55], skye:[57.3,-6.2], babayaga:[56.234,37.97], sibilla:[42.900,13.262], bathory:[48.725,17.761] };

/* ---------- projection: Lambert azimuthal equal-area (the EU standard, ETRS89-LAEA) ---------- */
const W = 1600, H = 1180;
const proj = geoAzimuthalEqualArea().rotate([-13, -54]).scale(1830).translate([W * 0.5, H * 0.46]).clipExtent([[0, 0], [W, H]]);
const projNoClip = geoAzimuthalEqualArea().rotate([-13, -54]).scale(1830).translate([W * 0.5, H * 0.46]);

/* ---------- helpers ---------- */
const area = r => { let a = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; a += r[2*i]*r[2*j+1] - r[2*j]*r[2*i+1]; } return a / 2; };
function dp(pts, tol) { // Douglas-Peucker on flat [x,y,...]
  const n = pts.length / 2; if (n < 4) return pts;
  const keep = new Uint8Array(n); keep[0] = keep[n-1] = 1; const st = [[0, n-1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const ax = pts[2*a], ay = pts[2*a+1], bx = pts[2*b], by = pts[2*b+1], dx = bx-ax, dy = by-ay, L = dx*dx+dy*dy;
    for (let i = a+1; i < b; i++) {
      let d;
      if (L === 0) d = Math.hypot(pts[2*i]-ax, pts[2*i+1]-ay);
      else { const t = Math.max(0, Math.min(1, ((pts[2*i]-ax)*dx + (pts[2*i+1]-ay)*dy) / L)); d = Math.hypot(pts[2*i]-(ax+t*dx), pts[2*i+1]-(ay+t*dy)); }
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2*i], pts[2*i+1]); return out;
}
const rd = (a, k) => a.map(v => Math.round(v * k) / k);
function inside(pt, ring) { let c = false; const n = ring.length / 2; for (let i = 0, j = n-1; i < n; j = i++) { const xi = ring[2*i], yi = ring[2*i+1], xj = ring[2*j], yj = ring[2*j+1]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi) c = !c; } return c; }

// collect projected (clipped) rings of a geometry
function ringsOf(obj, p) {
  const rings = []; let cur = null;
  geoStream(obj, p.stream({
    point(x, y) { cur.push(x, y); }, lineStart() { cur = []; }, lineEnd() { if (cur.length >= 6) rings.push(cur); cur = null; },
    polygonStart() {}, polygonEnd() {}, sphere() {}
  }));
  return rings;
}
function lineParts(obj, p) {
  const lines = []; let cur = null;
  geoStream(obj, p.stream({ point(x, y) { cur.push(x, y); }, lineStart() { cur = []; }, lineEnd() { if (cur.length >= 4) lines.push(cur); cur = null; }, polygonStart() {}, polygonEnd() {}, sphere() {} }));
  return lines;
}

/* ---------- 2D countries ---------- */
const countries = []; const names = {};
for (const f of fc.features) {
  const id = f.id === undefined ? (f.properties.name === "Kosovo" ? "XK" : null) : +f.id;
  let code = PROJECT[id] || (EXTRA[id] && EXTRA[id][0]) || null;
  const rings = ringsOf(f, proj).map(r => dp(r, 0.35)).map(r => rd(r, 10)).filter(r => r.length >= 6 && Math.abs(area(r)) > 1.5);
  if (!rings.length) continue;
  // outer vs hole: use sign of the biggest ring as "outer" orientation
  const big = rings.reduce((a, b) => Math.abs(area(a)) > Math.abs(area(b)) ? a : b);
  const sgn = Math.sign(area(big));
  const outers = rings.filter(r => Math.sign(area(r)) === sgn), holes = rings.filter(r => Math.sign(area(r)) !== sgn);
  const polys = outers.map(o => [o]);
  for (const h of holes) { const pt = [h[0], h[1]]; const host = polys.find(p => inside(pt, p[0])); if (host) host.push(h); }
  // label anchor: centroid of the largest outer ring
  const lo = outers.reduce((a, b) => Math.abs(area(a)) > Math.abs(area(b)) ? a : b);
  let cx = 0, cy = 0, A = 0; for (let i = 0, n = lo.length/2; i < n; i++) { const j = (i+1)%n, cr = lo[2*i]*lo[2*j+1]-lo[2*j]*lo[2*i+1]; A += cr; cx += (lo[2*i]+lo[2*j])*cr; cy += (lo[2*i+1]+lo[2*j+1])*cr; }
  const ctr = A ? [Math.round(cx/(3*A)), Math.round(cy/(3*A))] : [Math.round(lo[0]), Math.round(lo[1])];
  countries.push({ c: code, n: f.properties.name, polys, ctr });
}
// north-west of "Sphere"/graticule
const grat = lineParts(geoGraticule10(), proj).map(l => rd(dp(l, 0.6), 10));

/* ---------- pins ---------- */
const pin = ll => { const p = proj([ll[1], ll[0]]); return p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H ? [Math.round(p[0]*10)/10, Math.round(p[1]*10)/10] : null; };
const pins = { cap: {}, leg: {} };
for (const [k, v] of Object.entries(CAP)) pins.cap[k] = pin(v);
for (const [k, v] of Object.entries(LEG)) pins.leg[k] = pin(v);

/* ---------- globe data (lon/lat) ---------- */
const mesh = topojson.mesh(topo, topo.objects.countries); // each border/coastline once
const mesh2 = mesh.coordinates.map(l => { const flat = []; for (const [lo, la] of l) flat.push(lo, la); return rd(dp(flat, 0.07), 100); }).filter(l => l.length >= 4);
const hi = {};
for (const f of fc.features) {
  const id = f.id === undefined ? (f.properties.name === "Kosovo" ? "XK" : null) : +f.id;
  const code = PROJECT[id] || (EXTRA[id] && EXTRA[id][0]); if (!code) continue;
  const g = f.geometry; const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates; const loops = [];
  for (const poly of polys) {
    const c = geoCentroid({ type: "Polygon", coordinates: poly });
    if (c[0] < -32 || c[0] > 60 || c[1] < 28 || c[1] > 75) continue; // drop overseas territories
    const flat = []; for (const [lo, la] of poly[0]) flat.push(lo, la);
    loops.push(rd(dp(flat, 0.05), 100));
  }
  if (loops.length) hi[code] = loops;
}

/* ---------- output ---------- */
const extra = Object.values(EXTRA).map(v => ({ c: v[0], n: v[1], cap: v[2] }));
const globe = { mesh: mesh2, hi, cap: CAP, leg: LEG };
const out = { view: { w: W, h: H }, countries, grat, pins, extra, globe };
mkdirSync(path.join(root, "js"), { recursive: true });
const js = "/* GENERATED by tools/build-geo.mjs from Natural Earth 1:50m (public domain) - do not edit */\nwindow.GEO=" + JSON.stringify(out) + ";\n";
writeFileSync(path.join(root, "js/geo-data.js"), js);
console.log("countries:", countries.length, "named:", countries.filter(c => c.c).length, "mesh lines:", mesh2.length, "size KB:", (js.length/1024)|0);
const miss = [...Object.values(PROJECT), ...Object.values(EXTRA).map(v => v[0])].filter(c => !countries.some(x => x.c === c));
if (miss.length) console.log("MISSING:", miss.join(","));
