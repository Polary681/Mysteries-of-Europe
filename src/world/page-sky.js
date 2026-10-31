// THE PAGE SKY: the same real night as the landing valley, drawn behind every section of the site (one fixed 2D canvas),
// so the whole Archive lives under one sky. It is a star chart of the sky overhead: zenith in the middle, north up, east
// to the left (as it looks when you stand under it and look up). It slowly turns with the scroll, and it is where the
// constellations of the legends appear (constellations.js).
// Cheap: ~1,000-2,300 stars, redrawn at 12-30 fps only while visible, paused in hidden tabs, static with reduced motion.
import { catalogue } from "./celestial.js";
import { CONSTELLATIONS } from "./constellations.js";
import { tonight } from "./sky.js";
import { FEATURES, domTier } from "./quality.js";

const D2R = Math.PI / 180;

export function createPageSky(canvas, { reduce = false, getSky = null, onLabel = null } = {}) {
  const F = FEATURES[domTier()], g = canvas.getContext("2d");
  if (!g) return null;
  const stars = catalogue(F.skyMag).map(s => ({ ...s, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.8 }));
  let W = 0, Hh = 0, dpr = 1, R = 1, cx = 0, cy = 0, rot = 0, rotT = 0, raf = 0, last = 0, visible = true, running = false, t = 0;
  let sky = null, mat = null;
  const cons = Object.fromEntries(Object.keys(CONSTELLATIONS).map(k => [k, { k: 0, want: 0, pos: null }]));
  function readSky() {
    sky = (getSky && getSky()) || tonight();
    mat = sky.astro.eqToEnu;
    // per-star alt/az now (the page sky does not need to follow the minutes: it is re-read every few minutes)
    for (const s of stars) {
      const v = s.v, e = mat[0] * v[0] + mat[1] * v[1] + mat[2] * v[2], n = mat[3] * v[0] + mat[4] * v[1] + mat[5] * v[2], u = mat[6] * v[0] + mat[7] * v[1] + mat[8] * v[2];
      s.alt = Math.asin(Math.max(-1, Math.min(1, u))); s.az = Math.atan2(e, n);
    }
  }
  readSky(); setInterval(readSky, 180000);
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; Hh = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, Hh * 1.25) / 2 / Math.tan(33 * D2R) * 0.5; cx = W / 2; cy = Hh / 2;
    draw();
  }
  /** stereographic projection of (alt, az) around the zenith; north up, east to the left; turned by `rot` */
  function proj(alt, az) {
    const z = Math.PI / 2 - alt, r = 2 * R * Math.tan(z / 2), a = az + rot;
    return [cx - r * Math.sin(a), cy - r * Math.cos(a), r];
  }
  function draw() {
    if (!sky) return;
    g.clearRect(0, 0, W, Hh);
    const moonK = sky.moonLight || 0, lim = 5.3 - moonK * 1.1;
    // a faint glow of the horizon all around, warmer towards the Moon
    const hr = 2 * R; const grd = g.createRadialGradient(cx, cy, hr * 0.45, cx, cy, hr * 1.05);
    grd.addColorStop(0, "rgba(10,14,20,0)"); grd.addColorStop(1, "rgba(22,30,40,.35)"); g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
    for (const s of stars) {
      if (s.alt < 0.02 || s.mag > lim) continue;
      const [x, y] = proj(s.alt, s.az); if (x < -4 || y < -4 || x > W + 4 || y > Hh + 4) continue;
      const b = Math.pow(10, -0.4 * (s.mag - 1)), tw = reduce ? 1 : 0.78 + 0.22 * Math.sin(t * s.sp + s.ph);
      const a = Math.min(1, 0.16 + 0.55 * Math.pow(b, 0.5)) * tw * (0.55 + 0.45 * Math.min(1, s.alt * 3));
      const rad = Math.min(2.4, 0.55 + Math.sqrt(b) * 0.75);
      g.fillStyle = `rgba(${Math.round(s.col[0] * 255)},${Math.round(s.col[1] * 255)},${Math.round(s.col[2] * 255)},${(a * 0.8).toFixed(3)})`;
      if (rad < 1) g.fillRect(x - rad, y - rad, rad * 2, rad * 2); else { g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill(); }
    }
    // the Moon, if it is up
    const m = sky.astro.moon;
    if (m.alt > 0) {
      const [x, y] = proj(m.alt * D2R, m.az * D2R), rr = 7;
      const mg = g.createRadialGradient(x, y, 0, x, y, rr * 9); mg.addColorStop(0, `rgba(210,220,235,${0.16 * (0.4 + m.fraction)})`); mg.addColorStop(1, "rgba(210,220,235,0)");
      g.fillStyle = mg; g.fillRect(x - rr * 9, y - rr * 9, rr * 18, rr * 18);
      g.fillStyle = "rgba(20,24,28,.9)"; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
      // the lit part, turned towards the Sun: a half disc plus (gibbous) or minus (crescent) a half ellipse
      const sun = sky.astro.sun, [sx, sy] = proj(Math.max(-1.4, sun.alt * D2R), sun.az * D2R), ang = Math.atan2(sy - y, sx - x), f = m.fraction;
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = "rgba(236,235,224,.9)"; g.beginPath();
      g.arc(0, 0, rr, -Math.PI / 2, Math.PI / 2, false);
      g.ellipse(0, 0, Math.abs(2 * f - 1) * rr + 0.01, rr, 0, Math.PI / 2, -Math.PI / 2, f < 0.5);
      g.fill(); g.restore();
    }
    // the constellations of the legends
    for (const key in cons) {
      const c = cons[key], C = CONSTELLATIONS[key]; if (c.k <= 0.002) { c.pos = null; continue; }
      let [ax, ay, r] = proj(C.alt * D2R, C.az * D2R);
      const m = 70; ax = Math.max(m + 40, Math.min(W - m - 40, ax)); ay = Math.max(m + 60, Math.min(Hh - m, ay));
      const z = (90 - C.alt) * D2R, scale = Math.min(18, 1.45 * R / Math.pow(Math.cos(z / 2), 2) * D2R) * (Math.min(W, Hh) < 600 ? 0.7 : 1);
      const P = C.stars.map(([u, v]) => [ax + u * scale, ay - v * scale]);
      c.pos = { x: ax, y: ay + 8 * scale };
      const k = c.k, e = k * k * (3 - 2 * k);
      g.lineCap = "round";
      // lines draw themselves in, one after another
      C.lines.forEach(([i, j], n) => {
        const lk = Math.max(0, Math.min(1, e * (C.lines.length + 2) - n * 0.7)); if (lk <= 0) return;
        const [x1, y1] = P[i], [x2, y2] = P[j];
        g.strokeStyle = `rgba(214,226,232,${(0.58 * lk).toFixed(3)})`; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + (x2 - x1) * lk, y1 + (y2 - y1) * lk); g.stroke();
      });
      P.forEach(([x, y], i) => {
        const b = C.stars[i][2], tw = reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 2.1 + i * 1.7);
        const rr = (1.1 + b * 1.7) * (0.6 + 0.4 * e);
        const gl = g.createRadialGradient(x, y, 0, x, y, rr * 6); gl.addColorStop(0, `rgba(235,240,255,${(0.35 * e * tw).toFixed(3)})`); gl.addColorStop(1, "rgba(235,240,255,0)");
        g.fillStyle = gl; g.fillRect(x - rr * 6, y - rr * 6, rr * 12, rr * 12);
        g.fillStyle = `rgba(245,247,255,${(0.25 + 0.75 * e * tw).toFixed(3)})`; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
      });
    }
    // a discreet compass: where north, east, south and west lie at the edge of the page (it turns with the sky)
    g.font = "600 11px Outfit, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    for (const [lab, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const a = az * D2R + rot, dx = -Math.sin(a), dy = -Math.cos(a), m = 22, k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(dx)), (Hh / 2 - m) / Math.max(1e-6, Math.abs(dy)));
      const x = cx + dx * k, y = cy + dy * k;
      g.fillStyle = lab === "N" ? "rgba(214,192,126,.42)" : "rgba(217,214,200,.26)"; g.fillText(lab, x, y);
    }
    if (onLabel) onLabel(Object.fromEntries(Object.entries(cons).map(([k, c]) => [k, c.pos ? { ...c.pos, k: c.k } : null])));
  }
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016); if (dt < 1 / F.skyFps - 0.003) return; last = now;
    t += dt; rot += (rotT - rot) * (1 - Math.exp(-dt * 3));
    let busy = Math.abs(rotT - rot) > 1e-4;
    for (const k in cons) { const c = cons[k], sp = c.want ? 1.1 : 1.6; if (c.k !== c.want) { c.k = c.want ? Math.min(1, c.k + dt * sp) : Math.max(0, c.k - dt * sp); busy = true; } }
    draw();
  }
  let freed = false, holder = null;
  function setRunning() {
    const adv = document.body.classList.contains("adv-open");
    // during a 3D adventure the sky gives its canvas memory back (the adventure gets the whole GPU), then redraws
    if (adv && !freed) { freed = true; holder = canvas.parentNode; canvas.remove(); canvas.width = canvas.height = 1; }
    else if (!adv && freed) { freed = false; if (holder) holder.prepend(canvas); size(); }
    const want = visible && !document.hidden && !adv;
    if (want && !running) { running = true; last = performance.now(); if (reduce) draw(); else raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  addEventListener("resize", size); document.addEventListener("visibilitychange", setRunning);
  // a 3D adventure covers the page: the sky sleeps meanwhile (the adventure gets the whole machine)
  try { new MutationObserver(setRunning).observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (e) { /* old browsers */ }
  addEventListener("scroll", () => { rotT = -scrollY / Math.max(1, document.documentElement.scrollHeight) * 0.6; if (reduce) { rot = rotT; draw(); } }, { passive: true });
  size(); setRunning();
  return {
    show(k) { if (cons[k]) { cons[k].want = 1; if (reduce) { cons[k].k = 1; draw(); } } },
    hide(k) { if (cons[k]) { cons[k].want = 0; if (reduce) { cons[k].k = 0; draw(); } } },
    hideAll() { for (const k in cons) this.hide(k); },
    state: () => Object.fromEntries(Object.entries(cons).map(([k, c]) => [k, +c.k.toFixed(2)])),
    setVisible(v) { visible = v; setRunning(); },
    refresh() { readSky(); draw(); },
    /** for the cinematic navigation: where a sky direction lands on the page (alt/az in degrees) */
    project: (alt, az) => proj(alt * D2R, az * D2R),
    info: () => ({ R, cx, cy, rot }),
    /** where the compass letters are drawn (tests): screen position of N/E/S/W */
    compass: () => Object.fromEntries([["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, az]) => { const a = az * D2R + rot, dx = -Math.sin(a), dy = -Math.cos(a), k = Math.min((W / 2 - 22) / Math.max(1e-6, Math.abs(dx)), (Hh / 2 - 22) / Math.max(1e-6, Math.abs(dy))); return [l, [Math.round(cx + dx * k), Math.round(cy + dy * k)]]; })),
  };
}
