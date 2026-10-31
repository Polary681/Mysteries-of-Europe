// THE CASTLE AT NIGHT: the landing scene's soundscape, synthesised with WebAudio (no audio files, works offline).
//
// OFF by default. Nothing is created until the visitor presses the Sound button (browsers also require that gesture); the
// header's button and volume slider drive the master level (only the volume is remembered). Switching off fades out in
// ~0.15 s and suspends the audio context; switching on fades the whole soundscape back in over a few seconds.
//
// The mix (all gains below are relative; the slider sets the master, squared so low levels feel natural):
//
//   ambience ──┬─ site layer: mountain wind + a faint distant air and drone
//              └─ landing layer: the lake against the rocky shore, leaves and branches, the lantern's small flame
//   effects  ─── small, quiet details: single laps and ripples, a soft splash, a gust through the leaves, a creak of old
//                timber, a distant chain, cloth flapping on the keep in a gust. At most two at once, never two of a kind.
//   events   ─── the occasional foreground sound: an owl, a night bird (nightjar), a distant bell, a stronger gust, and the
//                valley's own events (crows, will-o'-the-wisps, the rare presences, the castle's finale bell).
//                ONE AT A TIME. Each has a priority; a more important one may fade out a minor one (never cut it), others
//                wait in a short queue (different kinds only) or are dropped. Similar sounds share a family with its own
//                cool-down; after every event there is a stretch of silence before the next. While an event plays the
//                ambience and effects dip slightly (ducking).
//   ui       ─── the navigation whoosh and the relic sting (not part of the scene).
//
// Everything fades with how much of the landing is on screen; away from it nothing is scheduled, the queue is cleared and,
// once the fade is over, the audio context is suspended (it resumes, fading in, when the landing comes back). Inside a 3D
// adventure or in a hidden tab the context is suspended too. prefers-reduced-motion: no whoosh, and rarer events.
import { load, save } from "../shared/save.js";
const KEY = "moe.ambient.v1";
let ctx = null, master = null, on = false, inAdv = false, hidden = false, vol = 0.4, waterK = 0, sceneK = 1;
let noiseBuf = null, whiteBuf = null, B = null, P = null, tick = 0, awayT = 0;
const played = {};
const isPaused = () => inAdv || hidden;
{ const s = load(KEY, null); if (s && typeof s.vol === "number") vol = Math.max(0, Math.min(1, s.vol)); }
const listeners = new Set();
export const onAmbient = f => listeners.add(f);
const emit = () => listeners.forEach(f => { try { f({ on, vol }); } catch (e) { /* ignore */ } });
const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const R = (a, b) => a + Math.random() * (b - a);
const vary = (g, k = 0.2) => g * R(1 - k, 1 + k);   // ±20 % by default (about ±1.6 dB)

/* ------------------------------------------------------------------ mixer levels (relative) */
const LEVEL = { amb: 1.4, fx: 1.2, evt: 1.25, space: 0.75, ui: 1 };
const DUCK = { amb: 0.7, fx: 0.55 };                 // while a foreground event plays
const SITE_AWAY = 0;                                 // the site wind/drone away from the landing (0: the scene is silent elsewhere)

/* ------------------------------------------------------------------ helpers (need ctx) */
const gain = (v = 1, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
const tone = (type, f, t0, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); o.stop(t0 + dur); return o; };
const lfo = (f, depth, param, type = "sine") => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = gain(depth); o.connect(g).connect(param); o.start(); return o; };
// a stereo panner placed IN FRONT of `node`: sources connect to the returned panner, the panner feeds `node`
const pan = (p, node) => { if (!ctx.createStereoPanner) return node; const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p || 0)); n.connect(node); return n; };
/** an envelope: 0 -> peak in `a` s, held for `h` s, then an exponential release of `r` s */
const env = (g, t0, peak, a, h, r) => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.setValueAtTime(peak, t0 + a + h); g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak * 0.002), t0 + a + h + r); };
const noise = (t0, dur, rate = 1, buf = noiseBuf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(t0, Math.random() * (buf.duration - 0.1)); s.stop(t0 + dur); return s; };
const loopSrc = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * buf.duration); return s; };
/** a smooth move of an AudioParam (never a jump): to `v` over about `sec` seconds */
const glide = (param, v, sec, t = ctx.currentTime) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.setTargetAtTime(v, t, Math.max(0.02, sec / 3)); };
/** a swell on a parameter: up to `peak` in `a` s, held `h` s, back to `base` in `r` s */
const swell = (param, base, peak, a, h, r, t = ctx.currentTime) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(peak, t + a); param.setValueAtTime(peak, t + a + h); param.linearRampToValueAtTime(base, t + a + h + r); };

function buffers() {
  const sr = ctx.sampleRate;
  // brownish noise (wind, water, low rumbles)
  { const len = sr * 6, b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.06; d[i] = last; } noiseBuf = b; }
  // white noise (leaves, air, splashes, crackle)
  { const len = sr * 4, b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; whiteBuf = b; }
}
/** the small flame: sparse crackles and pops over a faint breath (8.3 s, so its loop never lines up with the others) */
function crackleBuffer() {
  const sr = ctx.sampleRate, len = Math.round(sr * 8.3), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let t = 0;
  while (t < len) {
    t += Math.round(sr * (Math.random() < 0.15 ? R(0.02, 0.08) : R(0.12, 0.6)));   // crackles come in little clusters
    const big = Math.random() < 0.08, a = big ? R(0.5, 0.9) : R(0.08, 0.35), n = Math.round(sr * (big ? R(0.006, 0.014) : R(0.0015, 0.005)));
    for (let i = 0; i < n && t + i < len; i++) d[t + i] += (Math.random() * 2 - 1) * a * Math.pow(1 - i / n, 2);
  }
  return b;
}
/** a small, dark "space" (convolution): distant sounds get a tail, as if heard across the valley */
function spaceIR() {
  const sr = ctx.sampleRate, len = Math.round(sr * 2.6), pre = Math.round(sr * 0.025), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = pre; i < len; i++) { lp = lp * 0.82 + (Math.random() * 2 - 1) * 0.18; d[i] = lp * Math.pow(1 - (i - pre) / (len - pre), 3.4) * 2.2; } }
  return b;
}

/* ------------------------------------------------------------------ the graph */
function build() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC(); buffers();
  master = gain(0, ctx.destination);
  B = {};
  B.amb = gain(LEVEL.amb, master); B.duckA = gain(1, B.amb);
  B.site = gain(1, B.duckA);                         // wind, air, drone
  B.land = gain(sceneK, B.duckA);                    // lake, leaves, lantern (fade with the landing)
  B.fx = gain(LEVEL.fx, master); B.duckF = gain(1, B.fx); B.fxIn = gain(sceneK, B.duckF);
  B.evt = gain(LEVEL.evt, master); B.evtIn = gain(sceneK, B.evt);
  B.space = gain(LEVEL.space * sceneK, master); B.verb = ctx.createConvolver(); B.verb.buffer = spaceIR(); B.verb.connect(B.space); B.send = gain(1, B.verb);
  B.ui = gain(LEVEL.ui, master);
  P = {};
  // --- mountain wind: smoothed noise through a slowly moving band-pass (the v5 wind), with a gust control
  { const src = loopSrc(noiseBuf), bp = filt("bandpass", 420, 0.7); lfo(0.06, 230, bp.frequency);
    const wg = gain(1.4); lfo(0.11, 0.5, wg.gain); lfo(0.037, 0.27, wg.gain);
    P.windGust = gain(1); P.windBP = bp; src.connect(bp).connect(wg).connect(P.windGust).connect(B.site); }
  // --- distant air: a faint high breath over the ridges
  { const src = loopSrc(whiteBuf, 0.9), hp = filt("highpass", 2600, 0.5), lp = filt("lowpass", 6500, 0.5), g = gain(0.012); lfo(0.045, 0.006, g.gain);
    src.connect(hp).connect(lp).connect(g).connect(B.site); }
  // --- the low drone (fifths, breathing very slowly): quieter than before, a sense of distance rather than music
  { const dg = gain(0.032); for (const [f, a] of [[55, 1], [82.5, 0.45], [110.4, 0.35]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gain(a, dg)); o.start(); }
    lfo(0.05, 0.016, dg.gain); dg.connect(B.site); }
  // --- the lake: low lapping (two slow, unrelated swells, so it never pulses like a metronome) + a little slosh
  { const w = loopSrc(noiseBuf, 0.55), lp = filt("lowpass", 520, 0.4), sw = gain(0.85); lfo(0.23, 0.32, sw.gain); lfo(0.37, 0.22, sw.gain);
    const sl = loopSrc(whiteBuf, 0.7), bp = filt("bandpass", 950, 0.9), sg = gain(0.006); lfo(0.31, 0.004, sg.gain); lfo(0.19, 0.003, sg.gain);
    P.water = gain(0.6); w.connect(lp).connect(sw).connect(P.water); sl.connect(bp).connect(sg).connect(P.water); P.water.connect(pan(-0.15, B.land)); }
  // --- leaves and branches: two decorrelated rustles, left and right, each breathing on its own
  { P.leafGust = gain(1, B.land); P.leafSwell = gain(1, P.leafGust);
    for (const [p, rate, f1, f2] of [[-0.75, 1, 0.071, 0.13], [0.7, 1.13, 0.089, 0.17]]) {
      const s = loopSrc(whiteBuf, rate), hp = filt("highpass", 1500, 0.5), lp = filt("lowpass", 6200, 0.5), g = gain(0.095); lfo(f1, 0.052, g.gain); lfo(f2, 0.026, g.gain);
      s.connect(hp).connect(lp).connect(g).connect(pan(p, P.leafSwell));
    } }
  // --- the lantern's small flame: crackle + a faint breath of fire, close and just right of centre
  { P.flame = gain(1, pan(0.2, B.land));
    const c = loopSrc(crackleBuffer()), bp = filt("bandpass", 2600, 0.6), cg = gain(0.04); c.connect(bp).connect(cg).connect(P.flame);
    const f = loopSrc(noiseBuf, 0.8), lp = filt("lowpass", 240, 0.6), fg = gain(0.095); lfo(0.9, 0.04, fg.gain); lfo(1.7, 0.024, fg.gain); f.connect(lp).connect(fg).connect(P.flame); }
  setWater(waterK); watchScene();
  return true;
}
const live = () => !!ctx && on && !isPaused() && ctx.state !== "closed";
/** a one-shot output: its own gain into a bus (panned), with an optional send to the space. Released after `life` s */
function shot(bus, p = 0, send = 0) {
  const out = gain(1), dst = pan(p, bus); out.connect(dst);
  if (send > 0) out.connect(gain(send, B.send));
  if (bus === B.evtIn) lastOuts.push(out);          // collected so the manager can fade this event if it must give way
  return out;
}
const release = (out, life) => setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, life * 1000 + 600);

/* ================================================================== the sounds */
// Each returns its length in seconds. `t` is the start time, `o` the options (pan, gain, variant).
const SOUND = {
  /* ---- effects (small, quiet) ---- */
  lap(t, o) {      // one lap of water against the stones: a soft double push of low-mid noise
    const out = shot(B.fxIn, o.pan, 0.05), dur = R(0.45, 0.9), f = R(330, 640);
    for (const [dt, a] of [[0, 1], [R(0.18, 0.3), R(0.35, 0.6)]]) { const s = noise(t + dt, dur + 0.2, R(0.55, 0.8)), bp = filt("bandpass", f * R(0.9, 1.15), 1.1), g = gain(0); env(g, t + dt, vary(0.9) * a, R(0.07, 0.13), 0, dur); s.connect(bp).connect(g).connect(out); }
    if (Math.random() < 0.35) { const s = noise(t + 0.08, 0.1, 1, whiteBuf), hp = filt("highpass", 1800), g = gain(0); env(g, t + 0.08, vary(0.025), 0.004, 0, 0.06); s.connect(hp).connect(g).connect(out); }
    release(out, dur + 1); return dur + 0.4;
  },
  drop(t, o) {     // ripples: one to three tiny drops (a quick upward chirp is how water "plinks")
    const out = shot(B.fxIn, o.pan, 0.12), n = 1 + (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0); let t0 = t;
    for (let i = 0; i < n; i++) { const f = R(650, 1150), s = tone("sine", f, t0, 0.12), g = gain(0); s.frequency.exponentialRampToValueAtTime(f * R(1.8, 2.4), t0 + 0.045); env(g, t0, vary(0.065), 0.002, 0, R(0.05, 0.09)); s.connect(g).connect(out); t0 += R(0.12, 0.45); }
    release(out, t0 - t + 1); return t0 - t + 0.2;
  },
  splash(t, o) {   // something small in the shallows (a fish, a pebble from the rocks): a soft splash, then ripples
    const out = shot(B.fxIn, o.pan, 0.15), s = noise(t, 0.6, 1, whiteBuf), hp = filt("highpass", 900, 0.6), lp = filt("lowpass", 4200), g = gain(0); env(g, t, vary(0.07), 0.012, 0.02, 0.32);
    s.connect(hp).connect(lp).connect(g).connect(out); const l = SOUND.drop(t + 0.25, o); release(out, 1.5); return Math.max(0.8, l + 0.25);
  },
  rustle(t) {      // a breath of air through the canopy (moves the leaf bed, adds no new sound source)
    const a = R(2, 3.2), h = R(0.4, 1.5), r = R(3, 4.5); swell(P.leafSwell.gain, 1, R(1.6, 2.2), a, h, r, t); return a + h + r;
  },
  creak(t, o) {    // old timber settling somewhere in the castle: a slow stick-slip groan, far away
    const out = shot(B.fxIn, o.pan, 0.45), dur = R(0.6, 1.4), f = R(70, 115);
    const s = tone("sawtooth", f, t, dur + 0.1); s.frequency.linearRampToValueAtTime(f * R(1.08, 1.2), t + dur * 0.55); s.frequency.linearRampToValueAtTime(f * R(0.88, 0.98), t + dur);
    const slip = gain(0.5), sl = tone("square", R(16, 30), t, dur + 0.1); sl.connect(gain(0.5, slip.gain));
    const bp = filt("bandpass", R(800, 1300), 5), lp = filt("lowpass", 1900), g = gain(0); env(g, t, vary(0.16), R(0.12, 0.25), dur * 0.4, dur * 0.6);
    s.connect(slip).connect(bp).connect(lp).connect(g).connect(out); release(out, dur + 1); return dur + 0.3;
  },
  metal(t, o) {    // a distant chain or latch: one or two thin clinks, mostly heard as their tail
    const out = shot(B.fxIn, o.pan, 0.7), n = Math.random() < 0.45 ? 2 : 1, lp = filt("lowpass", 3000); lp.connect(out); let t0 = t;
    for (let i = 0; i < n; i++) { const f = R(1350, 1900); [[1, 0.5], [1.53, 0.3], [2.31, 0.18], [3.12, 0.08]].forEach(([m, a]) => { const s = tone("sine", f * m, t0, 1), g = gain(0); env(g, t0, vary(0.022) * a, 0.002, 0, R(0.4, 0.8) / m); s.connect(g).connect(lp); }); t0 += R(0.25, 0.6); }
    release(out, t0 - t + 2); return t0 - t + 0.6;
  },
  flag(t, o) {     // cloth on the keep, flapping in a gust: band-passed air chopped by an irregular flutter
    const out = shot(B.fxIn, o.pan, 0.3), dur = R(2.2, 3.6), s = noise(t, dur + 0.1, 1.3, whiteBuf), bp = filt("bandpass", R(500, 750), 1.3), am = gain(0.5);
    const f1 = tone("sine", R(8, 10), t, dur + 0.1), f2 = tone("sine", R(12.5, 15), t, dur + 0.1); f1.connect(gain(0.3, am.gain)); f2.connect(gain(0.2, am.gain));
    const g = gain(0); env(g, t, vary(0.13), dur * 0.35, dur * 0.2, dur * 0.45); s.connect(bp).connect(am).connect(g).connect(out); release(out, dur + 1); return dur;
  },
  /* ---- events (foreground, one at a time) ---- */
  owl(t, o) {      // a tawny owl somewhere in the trees: "hoo … hu-hoooo" (o.variant "kewick": the female's sharp call)
    const out = shot(B.evtIn, o.pan, 0.35), lp = filt("lowpass", o.variant === "kewick" ? 2600 : 900); lp.connect(out); out.gain.value = o.gain || 1; const k = R(0.96, 1.04);
    if (o.variant === "kewick") {
      const call = (t0, f0, f1, dur, a) => { const s = tone("triangle", f0, t0, dur + 0.05), g = gain(0); s.frequency.exponentialRampToValueAtTime(f1, t0 + dur); env(g, t0, a, 0.015, dur * 0.4, dur * 0.6); s.connect(g).connect(lp); };
      call(t, 1450 * k, 1900 * k, 0.22, vary(0.09)); call(t + 0.26, 1900 * k, 1450 * k, 0.12, vary(0.075));
      release(out, 3); return 1.2;
    }
    const hoot = (t0, dur, f, peak, quaver) => {
      const s = tone("sine", f, t0, dur + 0.1), g = gain(0); s.frequency.linearRampToValueAtTime(f * 1.06, t0 + dur * 0.25); s.frequency.linearRampToValueAtTime(f * 0.93, t0 + dur);
      if (quaver) { const v = tone("sine", 7, t0, dur + 0.1); v.connect(gain(f * 0.025, s.frequency)); }
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.12, dur * 0.3)); g.gain.linearRampToValueAtTime(peak * 0.7, t0 + dur * 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
      s.connect(g).connect(lp);
    };
    const f = 395 * k, p = vary(0.15, 0.15); hoot(t, 0.55, f, p, false); hoot(t + R(1.7, 2.1), 0.16, f * 0.96, p * 0.62, false); hoot(t + R(2.2, 2.4), 1.25, f * 1.01, p * 0.92, true);
    release(out, 6); return 4;
  },
  bird(t, o) {     // a nightjar churring far off on the heath: a long purring trill that shifts pitch now and then
    const out = shot(B.evtIn, o.pan, 0.4), dur = R(3, 5.5), lp = filt("lowpass", 2600); lp.connect(out);
    const s = tone("sine", R(1050, 1250), t, dur + 0.1), am = gain(0.5), m = tone("sine", R(34, 40), t, dur + 0.1); m.connect(gain(0.5, am.gain));
    const step = t + dur * R(0.45, 0.65); s.frequency.setValueAtTime(s.frequency.value, step); s.frequency.linearRampToValueAtTime(s.frequency.value * R(0.86, 0.92), step + 0.08); m.frequency.setValueAtTime(m.frequency.value, step); m.frequency.linearRampToValueAtTime(m.frequency.value * 0.88, step + 0.08);
    const g = gain(0); env(g, t, vary(0.07), 0.5, dur - 1, 0.6); s.connect(am).connect(g).connect(lp); release(out, dur + 1); return dur + 0.3;
  },
  toll(t, o) {     // the castle's bell, far away: one to three slow strokes (o.strokes), dark and long-tailed
    const finale = !!o.finale, out = shot(B.evtIn, o.pan, finale ? 0.25 : 0.6), lp = filt("lowpass", finale ? 5000 : 1500); lp.connect(out);
    const n = o.strokes || 1, gap = finale ? 2.6 : R(3.2, 4), f0 = finale ? 196 : R(165, 205), a0 = finale ? 0.45 : vary(0.17, 0.12);
    for (let k = 0; k < n; k++) { const t0 = t + k * gap; [[1, 0.34], [2.0, 0.17], [2.4, 0.14], [3.0, 0.085], [0.5, 0.2], [4.2, 0.04]].forEach(([m, a]) => {
      const s = tone("sine", f0 * m, t0, 6.6), g = gain(0); env(g, t0, a * a0, 0.008, 0, m < 1.5 ? 6.4 : 2.9); s.connect(g).connect(lp); }); }
    const life = (n - 1) * gap + 6.6; release(out, life + 1); return life;
  },
  gust(t, o) {     // a stronger gust: the wind itself swells, the leaves answer, the flame flutters (o.whisper: the figure on the ridge)
    const a = R(2, 3), h = R(0.8, 1.8), r = R(3.5, 5), dur = a + h + r, peak = o.whisper ? 1.9 : R(1.45, 1.75);
    swell(P.windGust.gain, 1, peak, a, h, r, t); swell(P.leafGust.gain, 1, peak + 0.4, a + 0.4, h, r, t); swell(P.flame.gain, 1, 1.5, a, h * 0.5, r, t);
    P.windBP.frequency.cancelScheduledValues(t); P.windBP.frequency.setValueAtTime(420, t); P.windBP.frequency.linearRampToValueAtTime(R(650, 820), t + a); P.windBP.frequency.linearRampToValueAtTime(420, t + dur);
    const out = shot(B.evtIn, o.pan, 0.1), s = noise(t, dur, 0.9), bp = filt("bandpass", 340, 1.1), g = gain(0);
    bp.frequency.setValueAtTime(300, t); bp.frequency.linearRampToValueAtTime(820, t + a); bp.frequency.linearRampToValueAtTime(260, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vary(o.whisper ? 2.3 : 1.4, 0.12), t + a); g.gain.setValueAtTime(g.gain.value, t + a + h * 0.3); g.gain.linearRampToValueAtTime(0, t + dur); s.connect(bp).connect(g).connect(out);
    if (o.whisper) { const w = noise(t + 0.5, 2, 1.3), wb = filt("bandpass", 2600, 7), wg = gain(0); env(wg, t + 0.5, 0.9, 0.5, 0.3, 1.1); w.connect(wb).connect(wg).connect(out); }
    if (!o.whisper && Math.random() < 0.6) setTimeout(() => fx("flag", { pan: R(-0.1, 0.25) }), (a * 0.7) * 1000);   // cloth on the keep answers
    release(out, dur + 1); return dur;
  },
  crow(t, o) {     // two or three hoarse caws ("kraa") over the keep: a rasping buzz through two nasal formants
    const n = 2 + (Math.random() < 0.45 ? 1 : 0), out = shot(B.evtIn, (o.pan || 0) * 0.8, 0.2); out.gain.value = vary(0.1, 0.15);
    const f1 = filt("bandpass", 1150, 3.5), f2 = filt("bandpass", 1900, 4.5), hp = filt("highpass", 380); f1.connect(hp); f2.connect(hp); hp.connect(out);
    let t0 = t;
    for (let i = 0; i < n; i++) {
      const dur = 0.2 + Math.random() * 0.09, f = 400 + Math.random() * 90, a = tone("sawtooth", f, t0, dur + 0.05), b = tone("square", f * 1.012, t0, dur + 0.05);
      for (const x of [a, b]) { x.frequency.linearRampToValueAtTime(x.frequency.value * 1.07, t0 + dur * 0.3); x.frequency.exponentialRampToValueAtTime(x.frequency.value * 0.74, t0 + dur); }
      const rasp = gain(0.55), l = tone("square", 48 + Math.random() * 30, t0, dur + 0.05); l.connect(gain(0.45, rasp.gain));
      const g = gain(0); env(g, t0, 1.9, 0.02, dur * 0.45, dur * 0.55); a.connect(rasp); b.connect(rasp); rasp.connect(g); g.connect(f1); g.connect(f2);
      t0 += dur + 0.13 + Math.random() * 0.12;
    }
    release(out, t0 - t + 1); return t0 - t;
  },
  chime(t, o) {    // a will-o'-the-wisp: a glassy chime (o.caught: higher and brighter)
    const notes = o.caught ? [1175, 1568, 2349, 3136] : [1568, 2349], out = shot(B.evtIn, o.pan || 0, 0.35);
    notes.forEach((f, i) => { const t0 = t + i * (o.caught ? 0.09 : 0.18), s = tone("sine", f, t0, 2.5), g = gain(0); env(g, t0, 0.14, 0.01, 0, 2.4); s.connect(g).connect(out); });
    release(out, 3.5); return 2.6;
  },
  rumble(t) {      // the ruin in the water: a low collapse far away and the crackle of embers
    const out = shot(B.evtIn, 0, 0.3), dur = 7, s = noise(t, dur, 0.35), lp = filt("lowpass", 140, 0.9), g = gain(0); env(g, t, 0.5, 1.6, 2.2, 3); s.connect(lp).connect(g).connect(out);
    for (let i = 0; i < 16; i++) { const t0 = t + 0.8 + Math.random() * 5.5, c = noise(t0, 0.05, 2), hp = filt("highpass", 2400), cg = gain(0); env(cg, t0, 0.22 + Math.random() * 0.4, 0.002, 0, 0.04); c.connect(hp).connect(cg).connect(out); }
    release(out, dur + 1); return dur;
  },
  eerie(t) {       // a figure at a reflected window: two glassy tones beating slowly against each other
    const out = shot(B.evtIn, 0, 0.4), dur = 6;
    [[659.3, 0.1], [664.1, 0.1], [987.8, 0.05], [1318.5, 0.03]].forEach(([f, a]) => { const s = tone("sine", f, t, dur), g = gain(0); env(g, t, a, 1.8, 1.5, 2.6); s.connect(g).connect(out); });
    release(out, dur + 1); return dur;
  },
  redmoon(t) {     // the red Moon in the lake: a low, dissonant swell
    const out = shot(B.evtIn, 0, 0.3), dur = 10;
    [[73.4, 0.11], [77.8, 0.09], [110, 0.045], [155.6, 0.027]].forEach(([f, a]) => { const s = tone(f < 100 ? "triangle" : "sine", f, t, dur), g = gain(0); env(g, t, a, 3, 3, 3.8); s.connect(g).connect(out); });
    const s = noise(t, dur, 0.5), bp = filt("bandpass", 220, 2), g = gain(0); env(g, t, 0.55, 3, 3, 3.5); s.connect(bp).connect(g).connect(out);
    release(out, dur + 1); return dur;
  },
};

/* ================================================================== the event manager (one foreground sound at a time) */
// prio: 5 the castle's finale · 4 the valley's rare presences · 3 will-o'-the-wisps · 2 owl, bell, night bird · 1 gust, crow
// fam: similar sounds share a family (never together, and a cool-down between two of them)
// duck: dips the ambience and effects while it plays · wait: how long it may wait in the queue (s) · cool: family cool-down (s)
const EVENTS = {
  owl:          { sound: "owl", prio: 2, fam: "owl", duck: true, wait: 0, cool: [70, 150] },
  "owl-veil":   { sound: "owl", prio: 4, fam: "owl", duck: true, wait: 6, cool: [40, 60] },
  bird:         { sound: "bird", prio: 2, fam: "bird", duck: true, wait: 0, cool: [200, 420] },
  toll:         { sound: "toll", prio: 2, fam: "bell", duck: true, wait: 0, cool: [300, 600] },
  bell:         { sound: "toll", prio: 5, fam: "bell", duck: true, wait: 20, cool: [60, 60], opts: { finale: true, strokes: 3, pan: 0 } },
  gust:         { sound: "gust", prio: 1, fam: "gust", duck: false, wait: 0, cool: [60, 140] },
  "gust-ridge": { sound: "gust", prio: 4, fam: "gust", duck: false, wait: 5, cool: [30, 40], opts: { whisper: true } },
  crow:         { sound: "crow", prio: 1, fam: "crow", duck: false, wait: 0, cool: [40, 80] },
  wisp:         { sound: "chime", prio: 3, fam: "wisp", duck: false, wait: 3, cool: [4, 6] },
  "wisp-catch": { sound: "chime", prio: 3.5, fam: "wisp", duck: false, wait: 4, cool: [2, 3], opts: { caught: true } },
  rumble:       { sound: "rumble", prio: 4, fam: "presence", duck: true, wait: 6, cool: [20, 20] },
  eerie:        { sound: "eerie", prio: 4, fam: "presence", duck: true, wait: 6, cool: [20, 20] },
  redmoon:      { sound: "redmoon", prio: 4, fam: "presence", duck: true, wait: 6, cool: [20, 20] },
};
/** what the scene does by itself: the ambient events (only while the landing is in view) */
const AMBIENT = [
  { ev: "gust", first: [20, 45], every: [60, 140] },
  { ev: "owl", first: [25, 60], every: [75, 180], opts: () => ({ pan: R(-0.85, 0.85), variant: Math.random() < 0.25 ? "kewick" : "hoot" }) },
  { ev: "toll", first: [70, 160], every: [300, 600], opts: () => ({ pan: R(-0.15, 0.25), strokes: Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3 }) },
  { ev: "bird", first: [100, 220], every: [220, 480], opts: () => ({ pan: Math.random() < 0.5 ? R(-0.9, -0.5) : R(0.5, 0.9) }) },
];
/** small details: group = never two of the same group at once; at most two effects together */
const EFFECTS = [
  { fx: "lap", group: "water", every: [4, 11], wet: [2, 6], opts: () => ({ pan: R(-0.5, 0.25) }) },
  { fx: "drop", group: "drip", every: [10, 28], opts: () => ({ pan: R(-0.6, 0.4) }) },
  { fx: "splash", group: "drip", every: [55, 150], opts: () => ({ pan: R(-0.7, 0.3) }) },
  { fx: "rustle", group: "leaves", every: [18, 42] },
  { fx: "creak", group: "wood", every: [50, 130], opts: () => ({ pan: R(-0.1, 0.35) }) },
  { fx: "metal", group: "metal", every: [150, 360], opts: () => ({ pan: R(-0.15, 0.3) }) },
];
const FX_GROUP = Object.fromEntries(EFFECTS.map(e => [e.fx, e.group])); FX_GROUP.flag = "cloth";
const SILENCE = [14, 32];        // after a foreground event, this much quiet before the scene starts another one
let fg = null, queue = [], lastEnd = -1e9, quietUntil = 0, restUntil = 0, famNext = {}, ambNext = {}, fxNext = {}, fxBusy = {}, stats = { dropped: 0, preempted: 0, log: [], fxLog: [] };
const now = () => ctx.currentTime;
const slow = () => (reduce() ? 1.5 : 1);

function duck(onOff) {
  const t = now(); glide(B.duckA.gain, onOff ? DUCK.amb : 1, onOff ? 0.8 : 2.2, t); glide(B.duckF.gain, onOff ? DUCK.fx : 1, onOff ? 0.8 : 2.2, t);
}
function start(name, o = {}) {
  const def = EVENTS[name], t = now() + 0.05; lastOuts.length = 0;
  let len = 3; try { len = SOUND[def.sound](t, { ...(def.opts || {}), ...o }); } catch (e) { /* sound is optional */ }
  // the event's own output is the last node created for the evt bus: keep a handle to fade it if something more important comes
  fg = { name, prio: def.prio, fam: def.fam, duck: def.duck, end: t + len, outs: lastOuts.splice(0) };
  stats.log.push([+t.toFixed(1), name, +(t + len).toFixed(1)]); if (stats.log.length > 40) stats.log.shift();
  famNext[def.fam] = t + len + R(...def.cool) * slow();
  if (def.duck) duck(true);
}
function finish(fade = 0) {
  if (!fg) return;
  if (fade) { const t = now(); fg.outs.forEach(g => { try { glide(g.gain, 0, fade, t); } catch (e) { /* gone */ } }); }
  if (fg.duck) duck(false);
  lastEnd = now(); fg = null;
}
/** ask for a foreground event. Returns true if it plays now or waits its turn in the queue. */
function request(name, o = {}) {
  const def = EVENTS[name]; if (!def || !live() || sceneK < 0.2) return false;
  const t = now();
  if (fg && t >= fg.end) finish();
  if (!fg) {
    const famOk = def.prio >= 2 || t >= (famNext[def.fam] || 0);   // the scene's own owls and bells were already timed by the scheduler
    const quietOk = def.prio >= 2 || t >= restUntil;             // minor sounds respect the silence after an event
    if (def.prio >= 3 || (t - lastEnd >= 1.5 && famOk && quietOk)) { start(name, o); return true; }
    if (def.wait) return enqueue(name, o, def);
    stats.dropped++; return false;
  }
  if (fg.fam === def.fam && def.prio > fg.prio) { stats.preempted++; finish(0.5); start(name, o); return true; }   // the same kind, more important: it takes over
  if (fg.fam === def.fam) { stats.dropped++; return false; }                                                       // never two of a kind
  if (def.prio > fg.prio && fg.prio < 3) { stats.preempted++; finish(0.7); start(name, o); return true; }   // a short cross-fade, never a cut
  if (def.wait) return enqueue(name, o, def);
  stats.dropped++; return false;
}
function enqueue(name, o, def) {
  if (queue.some(q => EVENTS[q.name].fam === def.fam)) { stats.dropped++; return false; }   // a similar one is already waiting
  queue.push({ name, o, prio: def.prio, until: now() + def.wait }); queue.sort((a, b) => b.prio - a.prio); if (queue.length > 3) queue.length = 3;
  return true;
}
function fx(name, o = {}) {
  if (!live() || sceneK < 0.3) return false;
  const g = FX_GROUP[name], t = now(), busy = Object.values(fxBusy).filter(e => e > t).length;
  if (busy >= 2 || (fxBusy[g] || 0) > t) return false;
  if (fg && fg.prio >= 4) return false;                       // the rare presences get the quiet they need
  let len = 1; try { len = SOUND[name](t + 0.03, o); } catch (e) { /* optional */ }
  fxBusy[g] = t + len; stats.fxLog.push([+t.toFixed(1), name]); if (stats.fxLog.length > 40) stats.fxLog.shift(); return true;
}
// the scene's clock: one light tick, only while the sound is on and the landing is in view
function step() {
  if (!live()) return;
  const t = now();
  if (fg && t >= fg.end) { finish(); quietUntil = t + R(...SILENCE) * slow(); restUntil = t + R(4, 8); }
  queue = queue.filter(q => q.until > t);
  if (!fg && queue.length && t - lastEnd >= 1.2) { const q = queue.shift(); start(q.name, q.o); return; }
  if (sceneK < 0.5) return;
  if (!fg && t >= quietUntil) {
    const due = AMBIENT.filter(a => t >= (ambNext[a.ev] || 0) && t >= (famNext[EVENTS[a.ev].fam] || 0));
    if (due.length) { const a = due.sort((x, y) => EVENTS[y.ev].prio - EVENTS[x.ev].prio)[0]; ambNext[a.ev] = t + R(...a.every) * slow(); request(a.ev, a.opts ? a.opts() : {}); }
  }
  for (const e of EFFECTS) if (t >= (fxNext[e.fx] || 0)) { const r = waterK > 0.3 && e.wet ? e.wet : e.every; fxNext[e.fx] = t + R(...r) * slow(); fx(e.fx, e.opts ? e.opts() : {}); }
}
/** a fresh start of the scene's clock (on enabling): a quiet moment first, then each thing at its own first time */
function rearm() {
  const t = now(); fg = null; queue = []; lastEnd = -1e9; restUntil = 0; quietUntil = t + R(8, 15); famNext = {}; fxBusy = {};
  AMBIENT.forEach(a => { ambNext[a.ev] = t + R(...a.first) * slow(); });
  EFFECTS.forEach(e => { fxNext[e.fx] = t + R(2, Math.min(20, e.every[1])) ; });
}
// every one-shot output on the event bus is collected here while an event is being built, so the manager can fade it
const lastOuts = [];

/* ------------------------------------------------------------------ the landing in view (0..1) */
function watchScene() {
  const hero = document.getElementById("intro");
  const set = k => { sceneK = k; if (!B) return; const t = now(); glide(B.land.gain, k, 1.5, t); glide(B.fxIn.gain, k, 1.5, t); glide(B.evtIn.gain, k, 1.5, t); glide(B.space.gain, LEVEL.space * k, 1.5, t); glide(B.site.gain, SITE_AWAY + (1 - SITE_AWAY) * k, 2, t);
    if (k < 0.2) { queue = []; }
    // fully away: suspend the context once the fade is done (no CPU spent on silence); back in view: resume and re-arm
    clearTimeout(awayT);
    if (k === 0) awayT = setTimeout(() => { if (sceneK === 0 && ctx && ctx.state === "running") ctx.suspend().catch(() => { /* closed */ }); }, 4000);
    else if (live() && ctx.state === "suspended") { ctx.resume().catch(() => { /* needs a gesture */ }); rearm(); } };
  if (!hero || !("IntersectionObserver" in window)) { set(1); return; }
  new IntersectionObserver(es => set(Math.round(es[0].intersectionRatio * 20) / 20), { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }).observe(hero);
}

/* ================================================================== public API (unchanged) */
/** the valley's rare things each have a sound of their own (presences.js announces them when they begin): [event, delay s] */
const PRESENCE = { veil: ["owl-veil", 4.3], ridge: ["gust-ridge", 0.1], ruin: ["rumble", 1.2], figure: ["eerie", 0.5], redmoon: ["redmoon", 1.0] };
/** a sound for something that happened in the valley or the navigation. d.pan: -1..1, d.at: delay in seconds.
 *  `played` counts what the mixer accepted (played now, or waiting its turn in the queue). */
export function cue(name, d = {}) {
  if (!live()) return;
  if (name === "whoosh") { if (reduce()) return; played.whoosh = (played.whoosh || 0) + 1; whoosh(d.dur); return; }
  const ev = name === "owl" ? "owl-veil" : name === "gust" ? "gust-ridge" : name;
  if (!EVENTS[ev]) return;
  const go = () => { if (request(ev, { pan: d.pan || 0 })) played[name] = (played[name] || 0) + 1; };
  d.at ? setTimeout(go, d.at * 1000) : go();
}
function whoosh(dur = 1.2) {     // moving through the site: filtered noise sweeping up and away (ui bus)
  try { const t = now(), d = Math.max(0.6, Math.min(3, dur)), s = noise(t, d + 0.05, 1.6), bp = filt("bandpass", 260, 0.9), g = gain(0, B.ui);
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(1500, t + d * 0.45); bp.frequency.exponentialRampToValueAtTime(380, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.6, t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d); s.connect(bp).connect(g); release(g, d + 1); } catch (e) { /* optional */ }
}
/** the lake's level (0..1): 0 = the quiet lapping that is always there, 1 = the lantern hangs over the water */
export function setWater(k) { waterK = k; if (!ctx || !P) return; glide(P.water.gain, 0.6 + 0.45 * Math.max(0, Math.min(1, k)), 1.2); }
const TRANS_DUR = { flight: 2.6, landing: 2.4, ascent: 1.8, descent: 1.8, passage: 1.2, portal: 1.3, portalClose: 1.0, cardOpen: 0.8, cardClose: 0.7, fade: 0 };
addEventListener("moe:valley", e => {
  const d = e.detail || {};
  if (d.type === "water") setWater(d.k);
  else if (d.type === "crow") cue("crow", d);
  else if (d.type === "wisp" || d.type === "wisp-catch") cue(d.type, d);
  else if (d.type === "presence" && PRESENCE[d.name]) { const [ev, at] = PRESENCE[d.name]; setTimeout(() => { if (request(ev, { pan: d.pan || 0 })) played[ev] = (played[ev] || 0) + 1; }, at * 1000); }
});
addEventListener("moe:nav", e => { const d = e.detail || {}; if (d.type === "start" && TRANS_DUR[d.name]) cue("whoosh", { dur: TRANS_DUR[d.name] }); });

function apply(fresh = false) {
  if (!ctx) return;
  const target = on && !isPaused() ? vol * vol : 0, t = ctx.currentTime;   // squared: the slider feels natural at low levels
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
  if (target > 0) {
    // switching on (or coming back): the whole scene fades in over a few seconds; a slider move is a short glide
    master.gain.setTargetAtTime(target, t, fresh ? 0.9 : 0.12);
    if (ctx.state === "suspended" && sceneK > 0) ctx.resume().catch(() => { /* not allowed yet: the next gesture retries */ });
    if (!tick) tick = setInterval(step, 400);
  } else {
    master.gain.setTargetAtTime(0, t, 0.04);        // off: silent within ~0.15 s, without a click
    clearInterval(tick); tick = 0; fg = null; queue = [];
    setTimeout(() => { if (ctx && !(on && !isPaused()) && ctx.state === "running") ctx.suspend().catch(() => { /* closed meanwhile */ }); }, 250);
  }
}
export function setEnabled(v) {
  if (v && !ctx && !build()) return false;
  const was = on && !isPaused(); on = !!v;
  if (on && !was && !isPaused()) rearm();
  apply(on && !was); emit(); return on;
}
export const toggle = () => setEnabled(!on);
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); save(KEY, { vol }); apply(false); emit(); }
/** the adventures run their own sound: pause the ambience while one is open, and when the tab is hidden */
export function pause(v) { const was = live(); inAdv = !!v; if (!was && live()) rearm(); apply(!was && live()); }
try { hidden = !!document.hidden; } catch (e) { /* not in a browser */ }
document.addEventListener("visibilitychange", () => { const was = live(); hidden = document.hidden; if (!was && live()) rearm(); apply(!was && live()); });
export const state = () => ({ on, vol, water: waterK, scene: sceneK, played: { ...played }, fg: fg ? fg.name : null, queue: queue.map(q => q.name), dropped: stats.dropped, preempted: stats.preempted, log: stats.log.slice(), fxLog: stats.fxLog.slice() });
/** a short, soft chime used by the relic reveal (only when the visitor has switched the sound on) */
export function sting() {
  if (!ctx || !on || isPaused()) return;
  try { const t = ctx.currentTime; [392, 523.25, 784].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * .16); g.gain.linearRampToValueAtTime(.09 * Math.max(.3, vol), t + i * .16 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .16 + 1.6); o.connect(g).connect(B.ui); o.start(t + i * .16); o.stop(t + i * .16 + 1.7); }); } catch (e) { /* optional */ }
}
/** development aid (?audio=debug in tests): RMS level of each bus in dBFS, and a way to force a scene sound */
export function _meter() {
  if (!ctx) return null;
  if (!B._an) { B._an = {}; const nodes = { site: B.site, land: B.land, fx: B.fx, evt: B.evt, space: B.space, ui: B.ui, water: P.water, leaves: P.leafGust, flame: P.flame }; for (const k in nodes) { const a = ctx.createAnalyser(); a.fftSize = 2048; nodes[k].connect(a); B._an[k] = a; } const m = ctx.createAnalyser(); m.fftSize = 2048; master.connect(m); B._an.master = m; }
  const out = {}; const buf = new Float32Array(2048);
  for (const k in B._an) { B._an[k].getFloatTimeDomainData(buf); let s = 0, p = 0; for (const x of buf) { s += x * x; p = Math.max(p, Math.abs(x)); } out[k] = { rms: +(10 * Math.log10(s / buf.length + 1e-12)).toFixed(1), peak: +(20 * Math.log10(p + 1e-9)).toFixed(1) }; }
  return out;
}
export const _force = (kind, name, o = {}) => (kind === "fx" ? fx(name, o) : request(name, o));
/** development aid: render one effect/event offline (exact levels, independent of the live mix). Resolves to its peak and
 *  RMS (dBFS, before the bus levels and the master volume) */
export async function _render(name, o = {}, secs = 8) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC || !SOUND[name] || name === "gust" || name === "rustle") return null;
  const keep = { ctx, B, noiseBuf, whiteBuf };
  const off = new OAC(2, Math.round(44100 * secs), 44100);
  try {
    ctx = off; buffers(); const d = gain(1, off.destination);
    B = { fxIn: d, evtIn: d, send: gain(0) };
    SOUND[name](0.05, o);
  } finally { ({ ctx, B, noiseBuf, whiteBuf } = keep); lastOuts.length = 0; }
  const buf = await off.startRendering(); let pk = 0, s = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; if (v > 1e-4) { s += v * v; n++; } } }
  return { peak: +(20 * Math.log10(pk + 1e-9)).toFixed(1), rms: +(10 * Math.log10(s / Math.max(1, n) + 1e-12)).toFixed(1) };
}
