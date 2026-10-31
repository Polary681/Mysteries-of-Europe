// PRESENCES SEEN ONLY IN PASSING, and the EVENT DIRECTOR that times every rare thing in the valley.
//   - crows circling the keep (always there; one sometimes strays on a wider loop)
//   - a cloud bank veils the Moon, and while it is dark two small eyes may open in the forest
//   - a figure on a ridge, motionless for a few seconds; it is gone as soon as you point at it
//   - the lake's lies: the reflected castle in ruins, a figure in a reflected window, a red Moon in the water
//   - on special nights: bonfires on the hills (folklore, see sky.js NIGHTS)
// Rules: random but controlled; long gaps; one event at a time; nothing during the intro, a transition or when the
// landing page is not on screen; nothing that blocks a click (all of it is drawn, none of it is in the DOM).
import { InstancedMesh, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Object3D, Vector3, Points, AdditiveBlending, Mesh, PlaneGeometry, CanvasTexture, MeshBasicMaterial, DoubleSide } from "three";
import { H, C, forestDensity, slopeY, cragR, lakeR } from "./terrain.js";

const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ crows */
function crowGeometry() {
  // body (two thin triangles), two wings (3 triangles each) — aW: 0 body, -1/+1 wing side; aR: distance along the wing (0..1)
  const P = [], W = [], R = [];
  const tri = (a, b, c, w, r) => { P.push(...a, ...b, ...c); W.push(w, w, w); R.push(...r); };
  tri([0, 0, -0.42], [0.07, 0, 0.1], [-0.07, 0, 0.1], 0, [0, 0, 0]); tri([0.05, 0, 0.1], [-0.05, 0, 0.1], [0, 0.02, 0.38], 0, [0, 0, 0]);   // body + tail
  tri([-0.03, 0, -0.32], [0.035, 0.01, -0.36], [0, 0.04, -0.5], 0, [0, 0, 0]);                                                         // head
  for (const s of [-1, 1]) {
    tri([0.05 * s, 0, -0.16], [0.05 * s, 0, 0.06], [0.42 * s, 0, -0.08], s, [0.1, 0.1, 0.55]);
    tri([0.42 * s, 0, -0.08], [0.05 * s, 0, 0.06], [0.44 * s, 0, 0.08], s, [0.55, 0.1, 0.6]);
    tri([0.42 * s, 0, -0.08], [0.44 * s, 0, 0.08], [0.78 * s, 0, 0.04], s, [0.55, 0.6, 1.0]);
  }
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(P, 3)); g.setAttribute("aW", new Float32BufferAttribute(W, 1)); g.setAttribute("aR", new Float32BufferAttribute(R, 1));
  g.computeBoundingSphere(); return g;
}
function createCrows(scene, n, timeU, keep) {
  const mat = new ShaderMaterial({
    uniforms: { uTime: timeU }, side: DoubleSide,
    vertexShader: /* glsl */`attribute float aW; attribute float aR; uniform float uTime;
      void main(){ vec3 p = position; float id = float(gl_InstanceID);
        float flap = sin(uTime * (7.5 + mod(id, 3.) * .9) + id * 1.7);
        float glide = smoothstep(-.2, .6, sin(uTime * .35 + id * 2.3));            // long glides between bursts of flapping
        float ang = mix(flap * 1.05, .38, glide) * aW;
        float r = abs(p.x); p.y += sin(ang) * r * (.6 + .4 * aR); p.x = sign(p.x) * cos(ang) * r;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.); }`,
    fragmentShader: "void main(){ gl_FragColor = vec4(.0035, .0035, .004, 1.); }",
  });
  const im = new InstancedMesh(crowGeometry(), mat, n); im.frustumCulled = false; scene.add(im);
  const o = new Object3D(), birds = [];
  // h: 0..1, where the bird flies inside the band of sky above the keep that is actually in the picture (see update);
  // v9 flew them 30-58 m above the keep, which on a wide screen is above the top edge of the frame (or under the header)
  for (let i = 0; i < n; i++) birds.push({ r: rand(14, 36), h: Math.random(), w: rand(0.16, 0.3) * (Math.random() < 0.7 ? 1 : -1), a: rand(0, 6.28), bob: rand(0, 6.28), s: rand(3.6, 4.4), stray: 0, strayT: rand(12, 50) });
  const p = new Vector3(), q = new Vector3();
  return {
    mesh: im,
    /** band: { lo, hi } world heights the flock keeps between (the director keeps it inside the frame) */
    update(dt, band) {
      const lo = band ? band.lo : keep.y + 8, hi = band ? band.hi : keep.y + 40;
      for (let i = 0; i < n; i++) {
        const b = birds[i]; b.a += b.w * dt; b.bob += dt * 0.6; b.strayT -= dt;
        if (b.strayT < 0) { b.stray = b.stray ? 0 : 1; b.strayT = b.stray ? rand(12, 20) : rand(25, 70); }
        b.cur = (b.cur || b.r) + ((b.stray ? b.r * 3.2 : b.r) - (b.cur || b.r)) * (1 - Math.exp(-dt * 0.25));
        b.dip = (b.dip || 0) + ((b.stray ? 1 : 0) - (b.dip || 0)) * (1 - Math.exp(-dt * 0.3));
        // a stray drops lower on its wide loop, out over the valley where the mist shows it up
        const R = b.cur, y = lo + b.h * (hi - lo) + Math.sin(b.bob) * 2 - b.dip * 16;
        p.set(keep.x + Math.cos(b.a) * R, y, keep.z + Math.sin(b.a) * R);
        q.set(-Math.sin(b.a) * Math.sign(b.w), 0, Math.cos(b.a) * Math.sign(b.w));            // tangent = heading
        o.position.copy(p); o.lookAt(p.x - q.x, p.y, p.z - q.z); o.rotateZ(-Math.sign(b.w) * 0.75); o.rotateX(0.35); o.scale.setScalar(b.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------------ small glowing points (eyes, bonfires) */
function glowPoints(scene, n, color, timeU, sizeK = 1, flick = 0, minPx = 2) {
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("aA", new Float32BufferAttribute(new Float32Array(n), 1));
  const m = new ShaderMaterial({
    uniforms: { uTime: timeU, uCol: { value: new Vector3(...color) }, uPx: { value: 1 }, uK: { value: sizeK }, uFlick: { value: flick }, uMin: { value: minPx } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: /* glsl */`attribute float aA; uniform float uTime, uPx, uK, uFlick, uMin; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
        float f = 1. + uFlick * (.25 * sin(uTime * 11. + position.x) + .15 * sin(uTime * 23. + position.z));
        vA = aA * f; gl_PointSize = max(clamp(uK * 900. / -mv.z, 2., 26.) * uPx, uMin); }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c) * 4.; if (r2 > 1. || vA < .003) discard;
        gl_FragColor = vec4(uCol * (exp(-r2 * 14.) * 2.2 + exp(-r2 * 3.) * .3) * vA, 1.); }`,
  });
  const p = new Points(g, m); p.frustumCulled = false; p.renderOrder = 2; scene.add(p);
  return { points: p, set(i, v, a) { const pa = g.attributes.position.array; pa[i * 3] = v.x; pa[i * 3 + 1] = v.y; pa[i * 3 + 2] = v.z; g.attributes.aA.array[i] = a; g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = true; }, alpha(i, a) { g.attributes.aA.array[i] = a; g.attributes.aA.needsUpdate = true; }, mat: m };
}

/* ------------------------------------------------------------------ the figure on the ridge */
function figureTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 160; const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.beginPath(); g.ellipse(32, 22, 9, 11, 0, 0, Math.PI * 2); g.fill();                      // hood
  g.beginPath(); g.moveTo(21, 26); g.quadraticCurveTo(14, 60, 12, 158); g.lineTo(52, 158); g.quadraticCurveTo(50, 60, 43, 26); g.closePath(); g.fill();   // cloak
  g.beginPath(); g.moveTo(14, 70); g.quadraticCurveTo(6, 110, 9, 158); g.lineTo(16, 158); g.closePath(); g.fill();
  const t = new CanvasTexture(c); return t;
}
function haloTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  g.scale(1, 2);   // an upright ellipse that fades to nothing before every edge of the plane
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
}
/** skyline points: where a ray from the camera grazes the terrain (a figure there is outlined against the sky/mist) */
function skylinePoints(cam, yaw) {
  const out = [];
  for (let k = 0; k < 48; k++) {
    const a = yaw + (k / 47 - 0.5) * 1.2; let best = -1e9, bp = null;
    for (let d = 120; d < 1400; d += 12) {
      const x = cam.x + Math.sin(a) * d, z = cam.z - Math.cos(a) * d, h = H(x, z), e = (h - cam.y) / d;
      if (e > best) { best = e; bp = { x, z, h, d }; }
    }
    if (bp && bp.d > 200 && bp.d < 1390 && cragR(bp.x, bp.z) > 2.2 && Math.abs(Math.atan2(C.x - cam.x, -(C.z - cam.z)) - a) > 0.08) out.push(new Vector3(bp.x, bp.h, bp.z));
  }
  return out;
}

/** is this client point under the page's text or controls (the title, the buttons, the header, the captions)?
 *  Things meant to be noticed must not appear there, or nobody sees them. */
const COVER = "header, .site-header, .hero-content > *, .hero-almanac, .hero-postcard, .hero-gaze, .hero-tour, .hero-tilt, .hero-scroll, .hero-skip";
let coverRects = [], coverAt = -1e9;
/** the boxes of the visible text lines and of the buttons (not the full-width blocks around them: on a phone those would
 *  cover the whole valley). Cached for half a second. */
function coverBoxes() {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (now - coverAt < 500) return coverRects;
  coverAt = now; coverRects = [];
  try {
    const rng = document.createRange();
    for (const el of document.querySelectorAll(COVER)) {
      if (el.hidden || !el.getClientRects().length) continue;
      if (el.matches("header, a, button, .hero-almanac") ) { coverRects.push(el.getBoundingClientRect()); continue; }
      for (const b of el.querySelectorAll("a, button")) coverRects.push(b.getBoundingClientRect());
      rng.selectNodeContents(el); for (const r of rng.getClientRects()) if (r.width && r.height) coverRects.push(r);
    }
  } catch (e) { /* no DOM */ }
  return coverRects;
}
/** is this client point under the page's text or controls (the title, the buttons, the header, the captions)?
 *  Things meant to be noticed must not appear there, or nobody sees them. */
export function covered(x, y, pad = 14) {
  for (const r of coverBoxes()) if (x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad) return true;
  return false;
}
/** half the horizontal field of view of the camera (radians) */
export const halfFovX = cam => Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect) * 0.95;
/** a projected point well inside the window (not at its edges) and below `top` */
export function inView(sp, top = 0, m = 18) {
  if (!sp || !sp.on) return false;
  const W = typeof innerWidth === "number" && innerWidth ? innerWidth : 1e9, Hh = typeof innerHeight === "number" && innerHeight ? innerHeight : 1e9;
  return sp.x > m && sp.x < W - m && sp.y > Math.max(top, m) && sp.y < Hh - m;
}
/** client y of the bottom of the fixed header (nothing above it is visible) */
export function headerBottom() { try { const h = document.querySelector("header"); const r = h && h.getBoundingClientRect(); return r && r.bottom > 0 && r.top <= 1 ? r.bottom : 0; } catch (e) { return 0; } }

/* ------------------------------------------------------------------ the director */
export function createPresences({ scene, camera, F, timeU, keepWorld, night, lake, sky, project, pointerScreen, reduce, onEvent = null }) {
  const mul = night ? night.presences : 1;
  const crows = createCrows(scene, F.crows, timeU, keepWorld);
  const eyes = glowPoints(scene, 2, [1.9, 2.0, 0.55], timeU, 0.32, 0, 6.5);
  eyes.mat.depthTest = false;   // the ground in front was checked when they were placed; a single spruce must not swallow them
  // depthWrite on: the post pass hazes every pixel by the depth it finds there; without its own depth the figure took
  // the haze of the far land behind it and disappeared into it
  const fig = new Mesh(new PlaneGeometry(1, 1).translate(0, 0.5, 0), new MeshBasicMaterial({ map: figureTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: true, alphaTest: 0.35 }));
  fig.material.color.setRGB(0.002, 0.002, 0.003); fig.visible = false; fig.renderOrder = 1; scene.add(fig);
  // a breath of pale mist behind the figure, so its outline reads against the dark hills
  const halo = new Mesh(new PlaneGeometry(1, 1).translate(0, 0.5, 0), new MeshBasicMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  halo.material.color.setRGB(0.05, 0.058, 0.07); halo.visible = false; halo.renderOrder = 0; scene.add(halo);
  // bonfires on special nights
  let fires = null;
  if (night && night.fires) {
    const n = Math.min(night.fires, F.fires), yaw = Math.atan2(-camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
    fires = glowPoints(scene, n, night.fireTint, timeU, 6, 1, 7);
    for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
      const a = yaw + (Math.random() - 0.5) * 1.1, d = rand(380, 1500), x = camera.position.x + Math.sin(a) * d, z = camera.position.z - Math.cos(a) * d, h = H(x, z);
      if (h < 60 || slopeY(x, z) < 0.86 || lakeR(x, z) < 1.4) continue;
      fires.set(i, new Vector3(x, h + 2, z), 1); i++;
    }
  }
  const veil = { value: 0 };   // shared with the sky and the stars
  /** a point at the forest edge (trees behind, open ground in front), in plain view, for the eyes */
  function findEyes() {
    const yaw = yawNow(), cam = camera.position, hb = headerBottom(), hf = halfFovX(camera);
    // the second pass drops the 'edge' rule and looks farther (narrow phone views see little forest close by)
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 220; i++) {
      const a = yaw + rand(-hf, hf), d = rand(55, pass ? 480 : 260), x = cam.x + Math.sin(a) * d, z = cam.z - Math.cos(a) * d, h = H(x, z);
      if (lakeR(x, z) < 1.3 || forestDensity(x, z, h, slopeY(x, z)) < 0.3) continue;
      if (!pass) { const ex = x - Math.sin(a) * 10, ez = z + Math.cos(a) * 10, eh = H(ex, ez); if (forestDensity(ex, ez, eh, slopeY(ex, ez)) > 0.2) continue; }   // the edge
      const p = new Vector3(x, h + 1.4, z);
      let clear = true; for (let k = 0.08; k < 0.96 && clear; k += 0.05) { const q = cam.clone().lerp(p, k); if (H(q.x, q.z) > q.y - 0.4) clear = false; }   // the ground does not hide them
      if (!clear) continue;
      const sp = project(p); if (!inView(sp, hb + 20) || covered(sp.x, sp.y, 24)) continue;
      return p;
    }
    return null;
  }
  let ridge = [], clock = 0, next = 18 + Math.random() * 10, cur = null;
  const yawNow = () => Math.atan2(-camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
  const env = (t, a, hold, b) => Math.max(0, Math.min(1, t / a, (a + hold + b - t) / b));   // attack / hold / release

  /* ---- the events (each: duration, weight, can(), start(), step(t, dt) -> false when finished) ---- */
  const events = {
    veil: {
      w: 1.2, dur: 17, seenAt: 6, seen: e => (e.eye ? "eyes" : null),
      start(e) {
        // eyes: at the edge of the forest, near enough to be seen, inside the picture and not under the title.
        // (v9 only searched a narrow cone straight ahead, which is all lake and open shore: no eyes ever opened)
        e.eye = findEyes();
        const yaw = yawNow(); e.side = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
        if (e.eye) {   // far enough apart to read as a pair of eyes (about 9 px), whatever the distance
          const a = project(e.eye), b = project(e.eye.clone().add(e.side));
          const ppm = a && b ? Math.max(0.5, Math.hypot(a.x - b.x, a.y - b.y)) : 8;
          e.side.multiplyScalar(Math.max(0.34, 4.5 / ppm));
        }
      },
      step(e, t) {
        veil.value = env(t, 3.5, 9, 4.5);
        if (e.eye) {
          const k = env(t - 4.2, 1.6, 6.2, 2.2), blink = (t % 3.3) > 3.12 ? 0.05 : 1;
          eyes.set(0, e.eye.clone().sub(e.side), k * blink); eyes.set(1, e.eye.clone().add(e.side), k * blink);
        }
        return t < this.dur;
      },
      end() { veil.value = 0; eyes.alpha(0, 0); eyes.alpha(1, 0); },
    },
    ridge: {
      w: 1, dur: 9, seenAt: 1.0, seen: e => (e.none ? null : "ridge"),
      can() { if (!ridge.length) ridge = skylinePoints(camera.position, yawNow()); return ridge.length > 0; },
      start(e) {
        // a crest point that is in the picture, below the header and not under the title or the buttons (v9 often stood
        // the figure right behind the big title, about 9 px tall: nobody ever saw it)
        const hb = headerBottom(), ok = [], P = pointerScreen ? pointerScreen() : null;
        for (const p of ridge) {
          const a = project(p), b = project(p.clone().setY(p.y + 1)); if (!inView(a, hb) || !b) continue;
          if (P && P.on && Math.hypot(a.x - P.x, a.y - P.y) < 160) continue;   // not right under the lantern: it would vanish before anyone saw it
          const ppm = Math.max(0.05, Math.abs(a.y - b.y)), hm = Math.max(2.9 * p.distanceTo(camera.position) / 260, 26 / ppm);   // at least ~26 px tall
          const top = a.y - hm * ppm; if (top < hb + 8 || covered(a.x, a.y, 18) || covered(a.x, top, 18)) continue;
          ok.push([p, hm]);
        }
        ok.sort((u, v) => u[0].distanceTo(camera.position) - v[0].distanceTo(camera.position));
        const pick = ok.length ? ok[Math.floor(Math.random() * Math.max(1, Math.ceil(ok.length * 0.5)))] : null;   // one of the nearer half
        if (!pick) { e.none = true; return; }
        const [p, hm] = pick; fig.position.copy(p).setY(p.y - hm * 0.04); fig.scale.set(hm * 0.4, hm, 1); fig.visible = true; e.gone = 0;
        halo.position.copy(fig.position); halo.scale.set(hm * 1.1, hm * 1.35, 1); halo.position.y -= hm * 0.12; halo.visible = true;
      },
      step(e, t, dt) {
        if (e.none) return false;
        fig.quaternion.copy(camera.quaternion);
        const P = pointerScreen ? pointerScreen() : null, sp = project(fig.position.clone().setY(fig.position.y + fig.scale.y * 0.5));
        if (!e.gone && t > 1.1 && P && P.on && sp && Math.hypot(sp.x - P.x, sp.y - P.y) < 85) e.gone = t;   // looked at (once it has fully appeared, and been noted): gone
        let a = env(t, 1.2, 6, 1.8); if (e.gone) a *= Math.max(0, 1 - (t - e.gone) / 0.28);
        fig.material.opacity = a * 0.92; halo.quaternion.copy(camera.quaternion); halo.material.opacity = a * 0.55;
        return t < this.dur && !(e.gone && t - e.gone > 0.3);
      },
      end() { fig.visible = false; fig.material.opacity = 0; halo.visible = false; halo.material.opacity = 0; },
    },
    ruin: {
      w: 1.1, dur: 24, can: () => !!lake, seenAt: 7, seen: () => "ruin",
      step(e, t) { lake.anomaly.uRuin.value = env(t, 6, 12, 6); return t < this.dur; },
      end() { lake.anomaly.uRuin.value = 0; },
    },
    figure: {
      w: 1, dur: 9, can: () => !!lake, seenAt: 2.4, seen: () => "figure",
      start(e) { const wins = lake.figureWindows || []; lake.anomaly.uFigureWin.value = wins.length ? (Math.random() < 0.7 ? wins[0] : wins[Math.floor(Math.random() * wins.length)]) : -1; },   // mostly the gateway: the biggest, so it can be seen
      step(e, t) { lake.anomaly.uFigure.value = env(t, 1.6, 5, 2.4); return t < this.dur; },
      end() { lake.anomaly.uFigure.value = 0; lake.anomaly.uFigureWin.value = -1; },
    },
    redmoon: {
      w: night && night.id === "samhain" ? 3 : 0.7, dur: 15, can: () => !!lake, seenAt: 5, seen: () => "redmoon",
      start() { lake.anomaly.uPhantomOn.value = lake.moonInWater ? 0 : 1; },
      step(e, t) { lake.anomaly.uRedMoon.value = env(t, 4, 7, 4); return t < this.dur; },
      end() { lake.anomaly.uRedMoon.value = 0; lake.anomaly.uPhantomOn.value = 0; },
    },
  };
  const names = Object.keys(events);
  let lastName = null;
  function pick() {
    const ok = names.filter(n => (!events[n].can || events[n].can()) && n !== lastName);
    let tot = ok.reduce((s, n) => s + events[n].w, 0), r = Math.random() * tot;
    for (const n of ok) { r -= events[n].w; if (r <= 0) return n; }
    return ok[0];
  }
  function start(name) {
    if (cur) stop();
    const ev = events[name]; if (!ev || (ev.can && !ev.can())) return false;
    cur = { name, t: 0 }; ev.start && ev.start(cur); lastName = name;
    if (onEvent && !cur.none) { const at = cur.eye || (name === "ridge" ? fig.position : keepWorld), sp = at && project(at), W = typeof innerWidth === "number" ? innerWidth : 0;
      try { onEvent("presence", { name, pan: sp && W ? Math.max(-1, Math.min(1, sp.x / W * 2 - 1)) : 0 }); } catch (err) { /* optional */ } }
    return true;
  }
  function stop() { if (!cur) return; events[cur.name].end && events[cur.name].end(cur); cur = null; }

  // the band of sky above the keep that is inside the picture, below the header (measured while the camera rests)
  const band = { lo: keepWorld.y + 6, hi: keepWorld.y + 40 }, kq = new Vector3(), tq = new Vector3();
  let bandT = 0;
  function measureBand() {
    kq.copy(keepWorld).project(camera); if (kq.z > 1 || kq.z < -1) return;
    // client y <-> NDC y from two projected points (the canvas may be scrolled or not fill the window)
    const c1 = project(keepWorld), c2 = project(tq.copy(keepWorld).setY(keepWorld.y + 20)), y2 = tq.project(camera).y;
    let top = 0.82;
    if (c1 && c2 && Math.abs(c2.y - c1.y) > 1e-3) top = kq.y + (headerBottom() + 14 - c1.y) * (y2 - kq.y) / (c2.y - c1.y);
    tq.set(kq.x, Math.min(0.92, top), kq.z).unproject(camera);
    band.lo = keepWorld.y + 1; band.hi = Math.max(band.lo + 10, Math.min(keepWorld.y + 58, tq.y - 3));
  }
  return {
    veil, crows, band,
    update(dt, { idle }) {
      if (idle && (bandT -= dt) <= 0) { bandT = 2; measureBand(); }
      crows.update(dt, band);
      if (fires) fires.mat.uniforms.uPx.value = eyes.mat.uniforms.uPx.value;
      if (cur) {
        const ev = events[cur.name], t0 = cur.t; cur.t += dt;
        // a sighting counts once the event has been on screen long enough to be noticed (the Archivist's journal records it)
        if (onEvent && ev.seenAt && t0 < ev.seenAt && cur.t >= ev.seenAt) { const id = ev.seen(cur); if (id) { try { onEvent("sighting", { id }); } catch (e) { /* optional */ } } }
        if (!ev.step(cur, cur.t, dt)) { stop(); next = clock + rand(20, 45) / mul; }
      }
      if (!idle || reduce) return;
      clock += dt;
      if (!cur && clock > next) {
        const n = pick(); if (n) start(n);
        next = clock + rand(25, 60) / mul;
      }
    },
    /** force an event now (tests, curious visitors): "veil" | "ridge" | "ruin" | "figure" | "redmoon" */
    trigger: name => start(name),
    current: () => (cur ? cur.name : null),
    stop,
    setPx(v) { eyes.mat.uniforms.uPx.value = v; },
  };
}
