// Fully synthesised audio (WebAudio): wind, rain, sea, birds, crickets, thunder, bells, piano, voice blips.
// No audio files are used, so everything works offline and there are no licence issues.
const AC = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;

export class AudioBus {
  constructor() { this.ok = !!AC; this.ctx = null; this.layers = new Map(); this.muted = false; this.timers = new Set(); this.duckLevel = 1; this.level = 1; }

  init() {
    if (!this.ok || this.ctx) return;
    try { this.ctx = new AC(); } catch (e) { this.ok = false; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9 * this.level;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    // reverb (generated impulse response)
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(2.6, 2.4);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.5; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    // noise buffers
    this.bufs = { white: this._noise("white"), pink: this._noise("pink"), brown: this._noise("brown") };
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => { /* the context was closed while resuming (adventure left at once): nothing to resume */ }); }
  setMuted(m) { this.muted = m; this._applyMaster(); }
  duck(level) { this.duckLevel = level; this._applyMaster(); }
  _applyMaster() { if (!this.ctx) return; this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9 * this.level * this.duckLevel, this.ctx.currentTime, 0.08); }

  _noise(kind) {
    const c = this.ctx, len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "pink") { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }
  _impulse(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _pan(p) { if (!this.ctx.createStereoPanner) return null; const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); return n; }

  /* ---------- continuous ambience layers ---------- */
  // opts: kind (noise colour), filter (lowpass|bandpass|highpass), freq, q, gain, lfoRate, lfoDepth (gain modulation 0..1)
  layer(name, o) {
    if (!this.ctx) return null; this.stopLayer(name);
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.bufs[o.kind || "pink"]; src.loop = true; src.loopStart = Math.random() * 2;
    const f = c.createBiquadFilter(); f.type = o.filter || "lowpass"; f.frequency.value = o.freq || 800; f.Q.value = o.q || 0.7;
    const g = c.createGain(); g.gain.value = 0;
    const node = { src, f, g, base: o.gain ?? 0.2 };
    src.connect(f); f.connect(g);
    const p = o.pan != null ? this._pan(o.pan) : null; if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    if (o.lfoRate) { // slow modulation (gusts, waves)
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.lfoRate; lg.gain.value = (o.lfoDepth ?? 0.4) * node.base; lfo.connect(lg); lg.connect(g.gain); lfo.start(); node.lfo = lfo;
    }
    src.start(); g.gain.setTargetAtTime(node.base, c.currentTime, 1.2);
    this.layers.set(name, node); return node;
  }
  setLayer(name, gain, tc = 1.5, freq = null) {
    const n = this.layers.get(name); if (!n || !this.ctx) return; n.base = gain; n.g.gain.setTargetAtTime(gain, this.ctx.currentTime, tc);
    if (freq) n.f.frequency.setTargetAtTime(freq, this.ctx.currentTime, tc);
  }
  stopLayer(name) { const n = this.layers.get(name); if (!n) return; try { n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); n.src.stop(this.ctx.currentTime + 1); if (n.lfo) n.lfo.stop(this.ctx.currentTime + 1); } catch (e) { /* already stopped */ } this.layers.delete(name); }
  stopAllLayers() { [...this.layers.keys()].forEach(k => this.stopLayer(k)); this.timers.forEach(t => clearTimeout(t)); this.timers.clear(); }

  // repeating random events (birdsong, distant sheep...) -> returns stop fn
  every(fn, minMs, maxMs) {
    let alive = true, id;
    const tick = () => { if (!alive) return; fn(); id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs)); this.timers.add(id); };
    id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs)); this.timers.add(id);
    return () => { alive = false; clearTimeout(id); this.timers.delete(id); };
  }

  /* ---------- one-shot sounds ---------- */
  tone({ freq = 440, dur = 0.2, type = "sine", vol = 0.1, attack = 0.005, slide = 0, pan = 0, wet = 0 } = {}) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); const p = this._pan(pan); if (p) { g.connect(p); p.connect(this.master); if (wet) p.connect(this.verb); } else { g.connect(this.master); if (wet) g.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  burst({ dur = 0.15, freq = 800, q = 1, vol = 0.2, kind = "white", filter = "bandpass", pan = 0, wet = 0 } = {}) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.bufs[kind]; s.loopStart = Math.random() * 2;
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); const p = this._pan(pan); if (p) { g.connect(p); p.connect(this.master); if (wet) p.connect(this.verb); } else { g.connect(this.master); if (wet) g.connect(this.verb); }
    s.loop = true; s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  step(surface = "grass", vol = 0.05) { const f = surface === "stone" ? 1800 : surface === "sand" ? 1200 : surface === "wood" ? 700 : 500; this.burst({ dur: 0.09, freq: f * (0.8 + Math.random() * 0.4), q: 0.8, vol, kind: "brown" }); }
  thunder(strength = 1) {
    this.burst({ dur: 3.2 * strength, freq: 140, q: 0.5, vol: 0.55 * Math.min(1, strength), kind: "brown", filter: "lowpass", wet: 0.6 });
    setTimeout(() => this.burst({ dur: 2.2, freq: 90, q: 0.4, vol: 0.35 * strength, kind: "brown", filter: "lowpass", wet: 0.5 }), 350);
  }
  bell(freq = 330, vol = 0.12, pan = 0) {
    if (!this.ctx || this.muted) return;
    [[1, 1], [2.0, 0.55], [2.76, 0.4], [4.07, 0.22], [5.4, 0.12]].forEach(([m, a]) => this.tone({ freq: freq * m, dur: 3.2 / m + 0.8, type: "sine", vol: vol * a, attack: 0.003, pan, wet: 0.7 }));
  }
  // Soft piano-like voice: inharmonic additive partials + hammer click.
  piano(freq, { vel = 0.7, dur = 2.4, pan = 0, wet = 0.55, ghost = false } = {}) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime;
    const out = c.createGain(); out.gain.value = vel * 0.22; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = ghost ? 1800 : 1500 + vel * 3200; out.connect(lp);
    const p = this._pan(pan); const dest = p || this.master; if (p) p.connect(this.master); lp.connect(dest); if (wet) { const w = c.createGain(); w.gain.value = wet; lp.connect(w); w.connect(this.verb); }
    [[1, 1, 1], [2, 0.5, 0.8], [3.01, 0.28, 0.6], [4.03, 0.16, 0.45], [5.08, 0.08, 0.3], [6.2, 0.04, 0.2]].forEach(([m, a, dm]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = freq * m * (m > 1 ? 1 + 0.0004 * m : 1);
      const d = dur * dm; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.exponentialRampToValueAtTime(a * 0.25, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    });
    // hammer
    const s = c.createBufferSource(); s.buffer = this.bufs.white; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = Math.min(6000, freq * 6); bp.Q.value = 1.2; const hg = c.createGain(); hg.gain.setValueAtTime(0.18 * vel, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(bp); bp.connect(hg); hg.connect(out); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  // little "speech" tick for dialogue text
  blip(pitch = 220, vol = 0.03, kind = "triangle") { this.tone({ freq: pitch * (0.92 + Math.random() * 0.2), dur: 0.05, type: kind, vol, attack: 0.002 }); }
  chirp(base = 3000) {
    for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) setTimeout(() => this.tone({ freq: base * (0.8 + Math.random() * 0.5), dur: 0.09, type: "sine", vol: 0.018, slide: 900 * (Math.random() < 0.5 ? 1 : -1), pan: (Math.random() - 0.5) }), i * 110);
  }
  cricket() { for (let i = 0; i < 4; i++) setTimeout(() => this.tone({ freq: 4300, dur: 0.04, type: "square", vol: 0.004, attack: 0.002 }), i * 55); }
  good() { this.tone({ freq: 523, dur: 0.14, type: "triangle", vol: 0.05 }); setTimeout(() => this.tone({ freq: 784, dur: 0.2, type: "triangle", vol: 0.05 }), 100); }
  bad() { this.tone({ freq: 190, dur: 0.3, type: "sawtooth", vol: 0.03, slide: -90 }); }
  click() { this.tone({ freq: 660, dur: 0.05, type: "square", vol: 0.018 }); }

  dispose() { this.stopAllLayers(); try { this.ctx && this.ctx.close().catch(() => { /* already closed */ }); } catch (e) { /* ignore */ } this.ctx = null; }
}
