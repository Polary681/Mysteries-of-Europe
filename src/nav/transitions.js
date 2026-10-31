// THE JOURNEYS: every transition of the cinematic navigation, each designed for its path.
//   flight    the valley -> the map      the camera crosses the valley, skims the lake through the mist, passes the castle
//                                        gate, rises above the castle; the land turns into contour lines and becomes the 2D
//                                        map, which zooms out from the Harz to the whole of Europe and settles in its panel
//   landing   the map -> the valley      the reverse: the map zooms into the castle's place, becomes the land seen from
//                                        above, and the camera comes down to the overlook
//   ascent    the valley -> a chapter    the camera tilts up into tonight's sky (the same stars as the page sky), the
//                                        valley fades away and the chapter rises out of the night
//   descent   a chapter -> the valley    the reverse: from the sky down to the valley
//   passage   chapter -> chapter         a bank of mist crosses the screen (downwards when you go deeper, upwards when
//                                        you go back) carrying the title of the chapter you are entering
//   portal / portalClose                 a legend opens from the place you clicked (its card's picture, its map pin) and
//                                        folds back into it when you leave
//   cardOpen / cardClose                 an Archive card lifts out of the grid into the inspector, and flies back
//   fade                                 reduced motion: a short cross-fade for everything
import { Vector3, Quaternion, Matrix4, CatmullRomCurve3 } from "three";
import { ease, lerp, clamp01 } from "./timeline.js";
import { sceneSVG } from "../ui/art.js";
import { REF } from "../world/astro.js";
import { nextQuote } from "../ui/quotes.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SECTION_COLOR = { intro: "#b4c9a8", prologo: "#b4c9a8", mappe: "#9cba84", leggende: "#a08ac0", archivio: "#c9b27a", giochi: "#93b6cb" };

/** which journey for which path */
export function pickTransition(from, to, { hasHero, quick, origin }) {
  if (to.type === "legend") return "portal";
  if (from.type === "legend") return "portalClose";
  if (to.type === "card") return "cardOpen";
  if (from.type === "card") return "cardClose";
  if (quick) return "passage";
  if (hasHero && from.id === "intro" && to.id === "mappe") return "flight";
  if (hasHero && from.id === "mappe" && to.id === "intro") return "landing";
  if (hasHero && from.id === "intro" && to.id !== "intro") return "ascent";
  if (hasHero && to.id === "intro") return "descent";
  return "passage";
}

/* ======================================================================== helpers */
function chapterOf(id) {
  const s = document.getElementById(id); if (!s) return { k: "", t: "" };
  if (id === "intro") return { k: "An archive of European folklore", t: "Mysteries of Europe" };
  if (id === "prologo") return { k: "Prologue", t: "Where the map ends" };
  return { k: (s.querySelector(".kicker") || {}).textContent || "", t: (s.querySelector("h2") || {}).textContent || "" };
}
/** the place of the reference location on the 2D map (Lambert azimuthal equal-area, same parameters as tools/build-geo.mjs) */
export function mapPoint(lon, lat) {
  const D = Math.PI / 180, W = (window.GEO && GEO.view.w) || 1600, H = (window.GEO && GEO.view.h) || 1180;
  // d3.geoAzimuthalEqualArea().rotate([-13, -54]).scale(1830).translate([W * .5, H * .46])
  let l = (lon - 13) * D; const p = lat * D, dp = -54 * D;
  const cp = Math.cos(p), x = Math.cos(l) * cp, y = Math.sin(l) * cp, z = Math.sin(p), k = z * Math.cos(dp) + x * Math.sin(dp);
  const lam = Math.atan2(y, x * Math.cos(dp) - z * Math.sin(dp)), phi = Math.asin(Math.max(-1, Math.min(1, k)));
  const cc = Math.cos(lam) * Math.cos(phi), kk = Math.sqrt(2 / (1 + cc));
  return [W * 0.5 + 1830 * kk * Math.cos(phi) * Math.sin(lam), H * 0.46 - 1830 * kk * Math.sin(phi)];
}
const heroEl = () => document.getElementById("intro");
const hero3d = () => (window.MOE3D && MOE3D.hero) || null;
function flyingOn(run, { fadeIn = false } = {}) {
  const h = heroEl(); h.classList.add("flying"); document.body.classList.add("nav-journey");
  if (fadeIn) h.querySelector(".hero-scene").style.opacity = "0";
  run.cleanup(() => { h.classList.remove("flying", "fade-out"); h.querySelector(".hero-scene").style.opacity = ""; document.body.classList.remove("nav-journey"); });
}
function skipButton(run, label = "Skip ›") {
  const b = el("button", "flight-skip", label); b.type = "button"; document.body.append(b);
  b.addEventListener("click", e => { e.stopPropagation(); run.skip(); });
  requestAnimationFrame(() => b.classList.add("on")); run.cleanup(() => b.remove());
  const onDown = e => { if (!e.target.closest(".flight-skip")) run.skip(); }; addEventListener("pointerdown", onDown, true); run.cleanup(() => removeEventListener("pointerdown", onDown, true));
}
/** a quaternion looking from `pos` to `target` with an up vector */
function lookQuat(pos, target, up) { const m = new Matrix4().lookAt(pos, target, up); return new Quaternion().setFromRotationMatrix(m); }
/** a fullscreen clone of the 2D map (for the flight and the landing) */
function mapClone(host) {
  const src = document.getElementById("map"); if (!src) return null;
  const wrap = el("div", "flight-map"); const svg = src.cloneNode(true); svg.removeAttribute("id"); svg.classList.add("map-clone"); svg.setAttribute("preserveAspectRatio", "xMidYMid slice"); svg.setAttribute("aria-hidden", "true");
  svg.querySelectorAll("[tabindex]").forEach(n => n.removeAttribute("tabindex"));
  wrap.append(svg); document.body.append(wrap);
  return { wrap, svg, setVB(v) {
    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    const r = wrap.getBoundingClientRect(), u = Math.max(v.w / Math.max(1, r.width), v.h / Math.max(1, r.height));   // map units per pixel (labels, pins keep their size)
    svg.style.setProperty("--u", u.toFixed(4)); svg.style.setProperty("--z", ((window.GEO ? GEO.view.w : 1600) / v.w).toFixed(3));
  } };
}
const rectOf = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
function placeBox(box, r) { Object.assign(box.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" }); }
const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
const vbAround = (cx, cy, w, aspect) => ({ x: cx - w / 2, y: cy - w / aspect / 2, w, h: w / aspect });

/* ======================================================================== the chapter passage */
async function passage(ctx) {
  const { run, to, dir, host } = ctx, up = dir < 0, ch = chapterOf(to.id);
  const P = el("div", "passage" + (up ? " up" : ""), `<div class="ps-fog"></div><div class="ps-motes"></div><div class="ps-card"><p class="ps-k">${esc(ch.k)}</p><p class="ps-t">${esc(ch.t)}</p><span class="ps-line"></span></div>`);
  P.style.setProperty("--cc", SECTION_COLOR[to.id] || "#b4c9a8"); document.body.append(P); run.cleanup(() => P.remove());
  const fog = P.querySelector(".ps-fog"), card = P.querySelector(".ps-card"), line = P.querySelector(".ps-line"), motes = P.querySelector(".ps-motes");
  for (let i = 0; i < 14; i++) { const m = el("i"); m.style.left = Math.random() * 100 + "%"; m.style.top = Math.random() * 100 + "%"; motes.append(m);
    run.animate(m, [{ opacity: 0, transform: "translateY(0)" }, { opacity: 0.6, offset: 0.5 }, { opacity: 0, transform: `translateY(${up ? 60 : -60}px)` }], { duration: 1400, delay: 200 + Math.random() * 300, easing: "ease-out" }); }
  const main = $("main"), sgn = up ? -1 : 1;
  // 1) the mist rises (or falls) over the page; the page sinks a little into it
  run.animate(main, [{ transform: "none", opacity: 1 }, { transform: `translateY(${-24 * sgn}px) scale(.985)`, opacity: 0.55 }], { duration: 560, easing: "cubic-bezier(.5,0,.75,0)" });
  await run.animate(fog, [{ transform: "translateY(0)" }, { transform: `translateY(${-150 * sgn}vh)` }], { duration: 620, easing: "cubic-bezier(.45,0,.55,1)" });
  // 2) behind the mist: the new place
  main.getAnimations().forEach(a => a.cancel());
  await ctx.swap();
  run.animate(card, [{ opacity: 0, transform: "translate(-50%,-40%)" }, { opacity: 1, transform: "translate(-50%,-50%)" }], { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" });
  run.animate(line, [{ width: "0" }, { width: "60%" }], { duration: 500, easing: "ease-out" });
  await run.wait(ctx.run.speed > 1 ? 120 : 420);
  // 3) the mist goes on and away; the new chapter rises out of it
  run.animate(card, [{ opacity: 1 }, { opacity: 0, transform: `translate(-50%,${-50 - 14 * sgn}%)` }], { duration: 420, easing: "ease-in" });
  run.animate(main, [{ transform: `translateY(${34 * sgn}px)`, opacity: 0.35 }, { transform: "none", opacity: 1 }], { duration: 760, easing: "cubic-bezier(.2,.7,.2,1)" });
  await run.animate(fog, [{ transform: `translateY(${-150 * sgn}vh)` }, { transform: `translateY(${-300 * sgn}vh)` }], { duration: 700, easing: "cubic-bezier(.45,0,.55,1)" });
  main.getAnimations().forEach(a => a.cancel());
}

/* ======================================================================== reduced motion */
async function fade(ctx) {
  const { run } = ctx, v = el("div", "passage"); v.style.background = "#07090a"; v.style.opacity = "0"; document.body.append(v); run.cleanup(() => v.remove());
  await run.animate(v, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
  await ctx.swap(); await run.frame();
  await run.animate(v, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
}

/* ======================================================================== the flight: valley -> map */
async function flight(ctx) {
  const { run, host } = ctx, H = hero3d(); if (!H || !H.isReady()) return passage(ctx);
  const R = H.rig;
  host.scrollTo(0); flyingOn(run); skipButton(run, "Skip the flight ›");
  const st = R.begin(); run.cleanup(() => { if (R.active) R.end(); });
  const g = R.gate(), castle = R.castle(), lake = R.lake(), north = R.north();
  const p0 = st.pos.clone(), q0 = lookQuat(p0, st.target, new Vector3(0, 1, 0)), fov0 = st.fov, shift0 = st.shift;
  st.useQuat = true; st.quat = q0.clone();
  // the path: over the forest edge, down through the mist, skimming the lake, up to the gate, through it, into the courtyard
  const approach = g.p.clone().addScaledVector(g.out, 46).add(new Vector3(0, 7, 0));
  const pts = [p0, new Vector3(lerp(p0.x, lake.x, 0.45), 30, lerp(p0.z, lake.z, 0.45)), new Vector3(lake.x + 6, 19, lake.z - 18),
    new Vector3(lerp(lake.x, approach.x, 0.55), 46, lerp(lake.z, approach.z, 0.55)), approach, g.p.clone().addScaledVector(g.out, 7).add(new Vector3(0, 0.6, 0)),
    g.p.clone().addScaledVector(g.out, -3).add(new Vector3(0, 0.4, 0)), g.court.clone().add(new Vector3(0, 1.5, 0))];
  const path = new CatmullRomCurve3(pts, false, "centripetal", 0.5);
  const lookAtPath = u => path.getPointAt(Math.min(1, u + 0.06)).add(new Vector3(0, -1.5 * (1 - u), 0));
  // 1) across the valley to the gate (the look leads the path; the lens widens a little)
  await run.tween(4300, (e, k) => {
    const u = ease.inOutSine(k), p = path.getPointAt(u * 0.86);
    st.pos.copy(p); st.quat.copy(lookQuat(p, k < 0.08 ? st.target.clone().lerp(lookAtPath(u * 0.86), k / 0.08) : lookAtPath(u * 0.86), new Vector3(0, 1, 0)));
    st.fov = lerp(fov0, 62, ease.inOutCubic(k)); st.shift = lerp(shift0, 0, ease.outCubic(Math.min(1, k * 2)));
    st.fade = 1 - 0.75 * Math.max(0, (u - 0.8) / 0.2);             // the dark of the gateway
  }, ease.linear);
  // 2) through the gate into the courtyard
  await run.tween(800, (e) => { const u = 0.86 + 0.14 * e, p = path.getPointAt(u); st.pos.copy(p); st.quat.copy(lookQuat(p, lookAtPath(Math.min(0.99, u)), new Vector3(0, 1, 0))); st.fade = 0.25 + 0.75 * e; }, ease.inOutSine);
  // 3) rising above the castle: the camera turns to look straight down, north at the top; the land becomes a map
  const pc = st.pos.clone(), qc = st.quat.clone(), top = new Vector3(castle.x + 30, 560, castle.z + 10);
  const qd = lookQuat(top, top.clone().add(new Vector3(0, -100, 0)), north);
  const ov = mapClone(host), W = GEO.view.w, Hh = GEO.view.h, home = mapPoint(REF.lon, REF.lat), asp = innerWidth / innerHeight;
  if (ov) { ov.wrap.style.opacity = "0"; placeBox(ov.wrap, { x: 0, y: 0, w: innerWidth, h: innerHeight }); ov.setVB(vbAround(home[0], home[1], W / 10, asp)); run.cleanup(() => ov.wrap.remove()); }
  await run.tween(2300, (e, k) => {
    const h = ease.inOutCubic(k);
    st.pos.set(lerp(pc.x, top.x, h), lerp(pc.y, top.y, ease.inCubic(k) * 0.4 + h * 0.6), lerp(pc.z, top.z, h));
    st.quat.copy(qc).slerp(qd, ease.inOutCubic(Math.min(1, k * 1.25)));
    st.fov = lerp(62, 48, h); st.map = clamp01((k - 0.45) / 0.5);
  }, ease.linear);
  // 4) the drawn land becomes the real map, which zooms out to Europe and settles into its panel
  const target = ctx.host.sectionY("mappe");
  await ctx.swap();                                                 // the map section is now under the scene
  const panel = document.getElementById("mapwrap"), dst = panel ? rectOf(panel) : { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const vb1 = host.mapView(), full = { x: vb1.x, y: vb1.y, w: vb1.w, h: vb1.h };
  if (ov) {
    await run.animate(ov.wrap, [{ opacity: 0 }, { opacity: 1 }], { duration: 650, easing: "ease-in-out" });
    heroEl().classList.add("fade-out"); R.end();
    const scr = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    await run.tween(1500, e => {
      const r = lerpRect(scr, dst, e); placeBox(ov.wrap, r); ov.wrap.style.borderRadius = (e * 4) + "px";
      const z = Math.exp(lerp(Math.log(W / 10), Math.log(full.w), e)), a2 = lerp(asp, dst.w / dst.h, e);
      const c = [lerp(home[0], full.x + full.w / 2, e), lerp(home[1], full.y + full.h / 2, e)];
      ov.setVB(vbAround(c[0], c[1], z, a2));
    }, ease.inOutCubic);
    await run.animate(ov.wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
  } else { R.end(); }
  void target;
}

/* ======================================================================== the landing: map -> valley */
async function landing(ctx) {
  const { run, host } = ctx, H = hero3d(); if (!H || !H.isReady()) return passage(ctx);
  const R = H.rig, panel = document.getElementById("mapwrap"), ov = mapClone(host);
  const W = GEO.view.w, home = mapPoint(REF.lon, REF.lat), asp = innerWidth / innerHeight;
  skipButton(run);
  if (ov && panel) {
    run.cleanup(() => ov.wrap.remove());
    const src = rectOf(panel), vb0 = host.mapView(), scr = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    placeBox(ov.wrap, src); ov.setVB(vb0);
    await run.tween(1300, e => {
      placeBox(ov.wrap, lerpRect(src, scr, e));
      const z = Math.exp(lerp(Math.log(vb0.w), Math.log(W / 10), e)), a2 = lerp(src.w / src.h, asp, e);
      ov.setVB(vbAround(lerp(vb0.x + vb0.w / 2, home[0], e), lerp(vb0.y + vb0.h / 2, home[1], e), z, a2));
    }, ease.inOutCubic);
  }
  // the valley from above, as a map, under the overlay
  flyingOn(run); const st = R.begin(); run.cleanup(() => { if (R.active) R.end(); });
  const castle = R.castle(), north = R.north(), base = R.basePose();
  const top = new Vector3(castle.x + 30, 560, castle.z + 10), qd = lookQuat(top, top.clone().add(new Vector3(0, -100, 0)), north), qb = lookQuat(base.pos, base.target, new Vector3(0, 1, 0));
  st.useQuat = true; st.quat = qd.clone(); st.pos.copy(top); st.map = 1; st.fov = 48; st.shift = 0; R.render();
  await ctx.swap(); await run.frame();
  if (ov) await run.animate(ov.wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-in-out" });
  // coming down: the contour lines fade back into the land, the camera settles on the overlook
  const mid = new Vector3(lerp(top.x, base.pos.x, 0.5), 260, lerp(top.z, base.pos.z, 0.6));
  await run.tween(3000, (e, k) => {
    const p = k < 0.5 ? top.clone().lerp(mid, ease.inOutSine(k * 2)) : mid.clone().lerp(base.pos, ease.outCubic((k - 0.5) * 2));
    st.pos.copy(p); st.quat.copy(qd).slerp(qb, ease.inOutCubic(clamp01((k - 0.15) / 0.8)));
    st.map = 1 - clamp01(k / 0.45); st.fov = lerp(48, base.fov, ease.inOutCubic(k)); st.shift = lerp(0, base.shift, ease.inOutCubic(clamp01((k - 0.5) * 2)));
  }, ease.linear);
  R.end();
}

/* ======================================================================== the ascent: valley -> sky -> chapter */
async function ascent(ctx) {
  const { run, host, to } = ctx, H = hero3d(); if (!H || !H.isReady()) return passage(ctx);
  const R = H.rig; host.scrollTo(0); flyingOn(run); skipButton(run);
  const st = R.begin(); run.cleanup(() => { if (R.active) R.end(); });
  const p0 = st.pos.clone(), q0 = lookQuat(p0, st.target, new Vector3(0, 1, 0)), north = R.north();
  const qz = lookQuat(p0, p0.clone().add(new Vector3(0, 100, 0)), north.clone().negate());   // the zenith, north at the top
  st.useQuat = true; st.quat = q0.clone();
  const ch = chapterOf(to.id), card = el("div", "passage", `<div class="ps-card"><p class="ps-k">${esc(ch.k)}</p><p class="ps-t">${esc(ch.t)}</p><span class="ps-line"></span></div>`);
  card.style.setProperty("--cc", SECTION_COLOR[to.id] || "#b4c9a8"); card.style.zIndex = "97"; document.body.append(card); run.cleanup(() => card.remove());
  const shift0 = st.shift, fov0 = st.fov;
  await run.tween(2100, (e, k) => { st.quat.copy(q0).slerp(qz, e); st.shift = lerp(shift0, 0, e); st.fov = lerp(fov0, 64, e); st.pos.y = p0.y + 18 * e; }, ease.inOutCubic);
  // the valley fades: what remains is the sky above the whole site
  const main = $("main"); main.style.opacity = "0"; run.cleanup(() => { main.style.opacity = ""; });
  await ctx.swap();
  const sky = window.MOE3D && MOE3D.ui && MOE3D.ui.pageSky && MOE3D.ui.pageSky(); if (sky) sky.setVisible(true);
  run.animate(card.querySelector(".ps-card"), [{ opacity: 0, transform: "translate(-50%,-40%)" }, { opacity: 1, transform: "translate(-50%,-50%)" }], { duration: 600, easing: "cubic-bezier(.2,.7,.2,1)" });
  run.animate(card.querySelector(".ps-line"), [{ width: "0" }, { width: "60%" }], { duration: 700, easing: "ease-out" });
  heroEl().classList.add("fade-out");
  await run.wait(900); R.end();
  main.style.opacity = "";
  run.animate(card.querySelector(".ps-card"), [{ opacity: 1 }, { opacity: 0, transform: "translate(-50%,-64%)" }], { duration: 500, easing: "ease-in" });
  await run.animate(main, [{ opacity: 0, transform: "translateY(40px)" }, { opacity: 1, transform: "none" }], { duration: 800, easing: "cubic-bezier(.2,.7,.2,1)" });
  main.getAnimations().forEach(a => a.cancel());
}

/* ======================================================================== the descent: chapter -> sky -> valley */
async function descent(ctx) {
  const { run, host } = ctx, H = hero3d(); if (!H || !H.isReady()) return passage(ctx);
  const R = H.rig, main = $("main");
  skipButton(run);
  await run.animate(main, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(30px)" }], { duration: 520, easing: "ease-in" });
  flyingOn(run, { fadeIn: true });
  const st = R.begin(); run.cleanup(() => { if (R.active) R.end(); });
  const base = R.basePose(), north = R.north();
  const qz = lookQuat(base.pos, base.pos.clone().add(new Vector3(0, 100, 0)), north.clone().negate()), qb = lookQuat(base.pos, base.target, new Vector3(0, 1, 0));
  st.useQuat = true; st.quat = qz.clone(); st.pos.copy(base.pos).add(new Vector3(0, 18, 0)); st.fov = 64; st.shift = 0; R.render();
  main.getAnimations().forEach(a => a.cancel()); main.style.opacity = "0"; run.cleanup(() => { main.style.opacity = ""; });
  await ctx.swap(); await run.frame();
  const scene = heroEl().querySelector(".hero-scene");
  await run.animate(scene, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out" }); scene.style.opacity = "1";
  scene.getAnimations().forEach(a => a.cancel());
  await run.tween(2200, (e, k) => { st.quat.copy(qz).slerp(qb, e); st.shift = lerp(0, base.shift, e); st.fov = lerp(64, base.fov, e); st.pos.copy(base.pos).add(new Vector3(0, 18 * (1 - e), 0)); }, ease.inOutCubic);
  R.end(); main.style.opacity = "";
}

/* ======================================================================== the portal: into a legend and back */
function legendMeta(k) {
  const A = window.MOE3D && MOE3D.archive, L = A && A.LEGENDS[k], D = (window.LEGENDS && LEGENDS[k]) || {};
  return { title: (L && L.title) || D.title || k, place: (L && L.place) || D.place || "", era: (L && L.era) || "", color: (L && L.color) || D.color || "#b4c9a8" };
}
function originShape(o) {
  if (!o || !o.getBoundingClientRect) return { kind: "center", x: innerWidth / 2, y: innerHeight / 2, r: null };
  const art = o.querySelector && o.querySelector(".cf-art"), r = (art || o).getBoundingClientRect();
  const isPin = o.closest && o.closest("svg");
  if (isPin || r.width < 60) return { kind: "pin", x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  return { kind: "rect", x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}
const insetOf = r => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 10px)`;
function buildPortal(k) {
  const m = legendMeta(k), P = el("div", "portal", `<div class="pt-art">${sceneSVG(k)}</div><div class="pt-shade"></div><span class="pt-ring"></span>
    <div class="pt-title"><p class="pt-k">${esc(m.place)}</p><p class="pt-t">${esc(m.title)}</p><p class="pt-s">${esc(m.era)}</p><p class="pt-q">“${esc(nextQuote())}”</p></div><p class="pt-busy">Preparing the scene</p>`);
  P.style.setProperty("--cc", m.color); P.setAttribute("aria-hidden", "true"); document.body.append(P); return P;
}
async function portal(ctx) {
  const { run, host, to } = ctx, k = to.id;
  // from a map pin: the map first leans in towards the place
  if (ctx.origin && ctx.origin.closest && ctx.origin.closest("svg")) await Promise.race([host.mapFocusLegend(k), run.wait(650)]);
  const o = originShape(ctx.origin), P = buildPortal(k); run.cleanup(() => P.remove());
  const art = P.querySelector(".pt-art"), title = P.querySelector(".pt-title"), ring = P.querySelector(".pt-ring");
  P.style.setProperty("--ox", o.x + "px"); P.style.setProperty("--oy", o.y + "px");
  const big = Math.hypot(innerWidth, innerHeight);
  const from = o.kind === "rect" ? insetOf(o.r) : `circle(${o.kind === "pin" ? 6 : 40}px at ${o.x}px ${o.y}px)`, toClip = o.kind === "rect" ? "inset(0px 0px 0px 0px round 0px)" : `circle(${big}px at ${o.x}px ${o.y}px)`;
  run.animate(art, [{ transform: "scale(1.18)", filter: "brightness(.7)" }, { transform: "scale(1)", filter: "brightness(1)" }], { duration: 1200, easing: "cubic-bezier(.2,.7,.2,1)" });
  if (o.kind !== "rect") run.animate(ring, [{ width: "0px", height: "0px", opacity: 1 }, { width: big * 2 + "px", height: big * 2 + "px", opacity: 0 }], { duration: 1100, easing: "cubic-bezier(.3,.6,.2,1)" });
  await run.animate(P, [{ clipPath: from, opacity: o.kind === "rect" ? 1 : 0.6 }, { clipPath: toClip, opacity: 1 }], { duration: 900, easing: "cubic-bezier(.6,.05,.2,1)" });
  await run.animate(title, [{ opacity: 0, transform: "translate(-50%,-42%)" }, { opacity: 1, transform: "translate(-50%,-50%)" }], { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)" });
  // the legend is built behind the portal (an adventure may need a moment: a discreet indicator says so)
  const slow = setTimeout(() => P.classList.add("busy"), 260); run.cleanup(() => clearTimeout(slow));
  await run.wait(380); await run.frame();
  await ctx.swap(); clearTimeout(slow); P.classList.remove("busy");
  await run.wait(260);
  run.animate(title, [{ opacity: 1 }, { opacity: 0, transform: "translate(-50%,-58%)" }], { duration: 420, easing: "ease-in" });
  await run.animate(P, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 120, easing: "ease-in-out" });
}
async function portalClose(ctx) {
  const { run, host, from } = ctx, k = from.id, P = buildPortal(k); run.cleanup(() => P.remove());
  const title = P.querySelector(".pt-title"); title.style.opacity = "1";
  await run.animate(P, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
  await ctx.swap(); await run.frame(); await run.frame();
  // fold back into the card (or the pin) the legend was opened from, if that is where we are going back to
  const origin = ctx.origin || host.legendOrigin(k);
  const home = origin && origin.closest ? origin.closest("section[id]") : null;
  if (!origin || (home && ctx.to.type === "section" && home.id !== ctx.to.id && !(home.id === "mappe" && ctx.to.id === "mappe"))) {
    run.animate(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await run.animate(P, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: "ease-in-out" }); return;
  }
  if (origin && origin.scrollIntoView && !origin.closest("svg")) { const r = origin.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) { origin.scrollIntoView({ block: "center" }); await run.frame(); } }
  const o = originShape(origin), big = Math.hypot(innerWidth, innerHeight);
  const toClip = o.kind === "rect" ? insetOf(o.r) : `circle(4px at ${o.x}px ${o.y}px)`, fromClip = o.kind === "rect" ? "inset(0px 0px 0px 0px round 0px)" : `circle(${big}px at ${o.x}px ${o.y}px)`;
  run.animate(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  await run.animate(P, [{ clipPath: fromClip, opacity: 1 }, { clipPath: toClip, opacity: o.kind === "rect" ? 0.9 : 0.4 }], { duration: 760, easing: "cubic-bezier(.6,.05,.2,1)" });
  await run.animate(P, [{ opacity: P.style.opacity || 0.9 }, { opacity: 0 }], { duration: 220 });
  if (origin && origin.focus && !origin.closest("svg")) origin.focus({ preventScroll: true });
}

/* ======================================================================== the Archive card: into the inspector and back */
async function cardOpen(ctx) {
  const { run } = ctx; const origin = ctx.origin;
  await ctx.swap();
  const d = document.querySelector("dialog.inspect[open]"), card = d && d.querySelector(".ins-card"); if (!card || !origin) return;
  const a = origin.getBoundingClientRect(), b = card.getBoundingClientRect(); if (!b.width) return;
  const dx = a.left - b.left, dy = a.top - b.top, s = a.width / b.width;
  d.classList.add("flip-in"); run.cleanup(() => d.classList.remove("flip-in"));
  const ghost = card.cloneNode(true); ghost.className = "flying-card ins-card cf " + (card.className.match(/is-\w+/g) || []).join(" "); ghost.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;--cc:${getComputedStyle(card).getPropertyValue("--cc")}`;
  d.append(ghost); run.cleanup(() => ghost.remove());
  origin.style.visibility = "hidden"; run.cleanup(() => { origin.style.visibility = ""; });
  await run.animate(ghost, [
    { transform: `translate(${dx}px,${dy}px) scale(${s})`, filter: "brightness(1)" },
    { transform: `translate(${dx * 0.35}px,${dy * 0.35 - 30}px) scale(${lerp(s, 1, 0.6)}) rotateY(-8deg)`, filter: "brightness(1.35)", offset: 0.55 },
    { transform: "none", filter: "brightness(1)" }], { duration: 640, easing: "cubic-bezier(.3,.6,.2,1)" });
  d.classList.remove("flip-in");
}
async function cardClose(ctx) {
  const { run, host, from } = ctx;
  const d = document.querySelector("dialog.inspect[open]"), card = d && d.querySelector(".ins-card"), b = card ? card.getBoundingClientRect() : null;
  const ghost = card ? card.cloneNode(true) : null;
  await ctx.swap();
  const target = host.cardElement(from.id); if (!ghost || !target || !b) return;
  const a = target.getBoundingClientRect(); if (a.bottom < 0 || a.top > innerHeight) return;
  ghost.className = "flying-card ins-card cf " + (card.className.match(/is-\w+/g) || []).join(" "); ghost.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;--cc:${getComputedStyle(target).getPropertyValue("--cc")}`;
  document.body.append(ghost); run.cleanup(() => ghost.remove());
  target.style.visibility = "hidden"; run.cleanup(() => { target.style.visibility = ""; });
  await run.animate(ghost, [{ transform: "none", opacity: 1 }, { transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width})`, opacity: 1 }], { duration: 480, easing: "cubic-bezier(.5,0,.2,1)" });
}

export const TRANSITIONS = { passage, fade, flight, landing, ascent, descent, portal, portalClose, cardOpen, cardClose };
