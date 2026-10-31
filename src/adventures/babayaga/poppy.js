// The poppy seed: a small hands-on task. A bowl of blue-black poppy seed with crumbs of earth hidden in it; pick every crumb
// out (click or tap it). "Ask the doll" is always there, as in the tale. Resolves "self" (done by hand), "doll" or null.
import { el, keyClick, keyHeldSince } from "../../common.js";

export function openPoppy(host, { audio = null, crumbs = 16 } = {}) {
  let done = null; const promise = new Promise(r => { done = r; });
  const box = el("div", "adv-overlay poppy noinput");
  box.innerHTML = `<div class="adv-card pp"><p class="kicker">Baba Yaga’s orders</p><h3>Clean the poppy seed of earth</h3>
    <p class="pp-sub">Pick out every crumb of black earth. Poppy seeds are tiny, round and blue-grey; the earth is brown and crumbly.</p>
    <canvas width="640" height="400" aria-label="A bowl of poppy seed with crumbs of earth in it"></canvas>
    <p class="pp-count" aria-live="polite"></p>
    <div class="actions"><button data-k="doll">Ask the doll after all</button><button data-k="x">Leave it for now</button></div></div>`;
  host.append(box);
  const cv = box.querySelector("canvas"), g = cv.getContext("2d"), cx = 320, cy = 205, rx = 250, ry = 150;
  let s = 99; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const inBowl = (x, y, m = 0) => ((x - cx) / (rx - m)) ** 2 + ((y - cy) / (ry - m)) ** 2 < 1;
  const seeds = []; while (seeds.length < 900) { const x = cx + (r() - 0.5) * 2 * rx, y = cy + (r() - 0.5) * 2 * ry; if (inBowl(x, y, 18)) seeds.push([x, y, r() * 3.14, 0.75 + r() * 0.5, r()]); }
  const earth = []; while (earth.length < crumbs) { const x = cx + (r() - 0.5) * 2 * rx, y = cy + (r() - 0.5) * 2 * ry; if (inBowl(x, y, 40)) earth.push({ x, y, s: 3.6 + r() * 2.6, rot: r() * 6, out: 0, pts: [...Array(7)].map(() => 0.65 + r() * 0.5) }); }
  const left = () => earth.filter(e => !e.out).length;
  const count = () => { box.querySelector(".pp-count").textContent = left() ? `${crumbs - left()} of ${crumbs} crumbs picked out` : "Every grain is clean."; };
  function draw() {
    g.clearRect(0, 0, 640, 400);
    let gr = g.createRadialGradient(320, 200, 60, 320, 200, 380); gr.addColorStop(0, "#5a3e26"); gr.addColorStop(1, "#24170d"); g.fillStyle = gr; g.fillRect(0, 0, 640, 400);
    g.strokeStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, 30 + i * 46); g.bezierCurveTo(200, 20 + i * 46, 420, 44 + i * 46, 640, 28 + i * 46); g.stroke(); }
    g.fillStyle = "#3b2414"; g.beginPath(); g.ellipse(cx, cy + 10, rx + 22, ry + 22, 0, 0, 7); g.fill();
    gr = g.createRadialGradient(cx, cy - 30, 30, cx, cy, rx); gr.addColorStop(0, "#3a3c44"); gr.addColorStop(1, "#1d1e24"); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    for (const [x, y, a, k, t] of seeds) { g.fillStyle = t < 0.5 ? "#4d5566" : t < 0.85 ? "#3a4150" : "#6a7385"; g.beginPath(); g.ellipse(x, y, 2.1 * k, 1.6 * k, a, 0, 7); g.fill(); }
    // a little dish for the picked crumbs
    g.fillStyle = "#3b2414"; g.beginPath(); g.ellipse(585, 360, 42, 20, 0, 0, 7); g.fill(); g.fillStyle = "#1a1109"; g.beginPath(); g.ellipse(585, 357, 34, 14, 0, 0, 7); g.fill();
    for (const e of earth) {
      const k = Math.min(1, e.out), x = e.x + (585 + (e.rot - 3) * 6 - e.x) * k, y = e.y + (356 + (e.pts[0] - 0.9) * 10 - e.y) * k - Math.sin(k * Math.PI) * 60;
      g.fillStyle = "#6a4626"; g.beginPath(); e.pts.forEach((m, i) => { const a = e.rot + i / e.pts.length * 6.283, px = x + Math.cos(a) * e.s * m, py = y + Math.sin(a) * e.s * m * 0.85; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();
      g.fillStyle = "rgba(160,110,60,.55)"; g.beginPath(); g.arc(x - e.s * 0.3, y - e.s * 0.3, e.s * 0.25, 0, 7); g.fill();
    }
  }
  let raf = 0, fin = false;
  const loop = () => { raf = 0; let moving = false; for (const e of earth) if (e.out > 0 && e.out < 1) { e.out = Math.min(1, e.out + 0.06); moving = true; } draw(); if (moving) raf = requestAnimationFrame(loop); };
  const pick = (px, py) => {
    if (fin) return; let best = null, bd = 1e9;
    for (const e of earth) { if (e.out) continue; const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; best = e; } }
    if (best && bd < 18) { best.out = 0.01; audio && audio.tone({ freq: 700 + Math.random() * 300, dur: 0.06, type: "triangle", vol: 0.03 }); count(); if (!raf) raf = requestAnimationFrame(loop); if (!left()) finish("self"); }
    else audio && audio.tone({ freq: 160, dur: 0.08, type: "sine", vol: 0.02 });
  };
  const finish = how => { if (fin) return; fin = true; audio && how === "self" && audio.good(); setTimeout(() => { cancelAnimationFrame(raf); box.remove(); done(how); }, how === "self" ? 1100 : 0); };
  cv.addEventListener("pointerdown", e => { e.preventDefault(); const b = cv.getBoundingClientRect(); pick((e.clientX - b.left) / b.width * 640, (e.clientY - b.top) / b.height * 400); });
  const t0 = performance.now();
  box.addEventListener("click", e => {
    // the Space/Enter that opened the task must not press its focused button ("Ask the doll") by accident
    if (keyClick(e) && keyHeldSince(t0)) return;
    const k = e.target.closest("button")?.dataset.k; if (k === "doll") finish("doll"); else if (k === "x") finish(null); });
  box.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } });
  count(); draw(); setTimeout(() => { const b = box.querySelector("button"); b && b.focus({ preventScroll: true }); }, 50);
  return { promise, solve: () => { earth.forEach(e => { if (!e.out) e.out = 0.01; }); count(); if (!raf) raf = requestAnimationFrame(loop); finish("self"); }, pick, crumbs: () => earth.map(e => [e.x, e.y, e.out]), close: () => finish(null) };
}
