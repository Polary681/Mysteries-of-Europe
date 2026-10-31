import { CanvasTexture, SRGBColorSpace } from "three";

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const inView = h => { const r = h.getBoundingClientRect(); return r.bottom > 80 && r.top < innerHeight - 80; };
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/* ---------- little HTML helpers for the HUD that sits on top of the canvas ---------- */
export function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

/* ---------- canvas text -> texture (so 3D objects can carry readable labels) ---------- */
export function wrapLines(ctx, text, maxW) {
  const words = text.split(" "); const lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
export function textTexture(text, { w = 1024, h = 512, size = 84, color = "#fff", bg = null, font = "Cinzel", weight = 700, border = null, pad = 40 } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, 48); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 44); g.stroke(); }
  let s = size, lines;
  for (; s > 26; s -= 4) { g.font = `${weight} ${s}px ${font}, serif`; lines = wrapLines(g, text, w - pad * 2); if (lines.length * s * 1.18 <= h - pad) break; }
  g.font = `${weight} ${s}px ${font}, serif`; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  const lh = s * 1.18, y0 = h / 2 - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- tiny synth sound effects (no audio files needed => works offline) ---------- */
let actx = null; export const sfx = { muted: false };
export function beep(freq = 440, dur = 0.12, type = "sine", vol = 0.06, slide = 0) {
  if (sfx.muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume().catch(() => { /* needs a user gesture first: the next beep retries */ });
    const o = actx.createOscillator(), g = actx.createGain(); const t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* audio is optional */ }
}
export const good = () => { beep(523, .1, "triangle"); setTimeout(() => beep(784, .16, "triangle"), 90); };
export const bad = () => beep(180, .28, "sawtooth", .05, -90);
export const pick = () => beep(660, .07, "square", .03);

/* ---- Space / Enter: the keys that read the dialogue on. A click made by one of them (a "keyboard click": detail 0, right
   after the key event) must not press a button that merely had the focus, or that appeared while the key was held.
   Mouse clicks, taps, screen readers and scripts are not affected (they come with no Space/Enter key event). ---- */
const keyState = { down: new Map(), lastAt: -1e9, lastDownStart: -1e9 };
if (typeof window !== "undefined" && window.addEventListener) {
  const isKey = e => e.key === " " || e.key === "Enter";
  window.addEventListener("keydown", e => { if (!isKey(e)) return; if (!keyState.down.has(e.key)) keyState.down.set(e.key, performance.now()); keyState.lastAt = performance.now(); }, true);
  window.addEventListener("keyup", e => { if (!isKey(e)) return; keyState.lastDownStart = keyState.down.has(e.key) ? keyState.down.get(e.key) : -1e9; keyState.down.delete(e.key); keyState.lastAt = performance.now(); }, true);
  window.addEventListener("blur", () => keyState.down.clear());
}
/** was this click made by a Space/Enter key press? */
export const keyClick = e => !!e && e.detail === 0 && performance.now() - keyState.lastAt < 120;
/** was that key already down before time t0 (performance.now())? i.e. pressed for something else, still held */
export const keyHeldSince = t0 => {
  for (const v of keyState.down.values()) if (v < t0) return true;
  return performance.now() - keyState.lastAt < 120 && keyState.lastDownStart < t0;
};
