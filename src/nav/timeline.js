// A tiny timeline for the cinematic navigation: tweens driven by requestAnimationFrame, all bound to one "run" so a
// transition can be skipped (everything jumps to its end state at once) or aborted cleanly. No dependencies.
export const ease = {
  linear: t => t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outQuart: t => 1 - Math.pow(1 - t, 4),
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);

/** one run of a transition: shared skip/abort flags and the cleanup list */
export function createRun({ speed = 1 } = {}) {
  const run = { skipped: false, aborted: false, speed, cleanups: [], anims: new Set(), onSkip: new Set() };
  run.skip = () => { if (run.skipped) return; run.skipped = true; run.onSkip.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); run.anims.forEach(a => { try { a.finish(); } catch (e) { /* ignore */ } }); };
  run.cleanup = fn => run.cleanups.push(fn);
  run.dispose = () => { while (run.cleanups.length) { try { run.cleanups.pop()(); } catch (e) { console.error(e); } } };
  /** tween over `ms`: fn(easedT, rawT) every frame; resolves at the end (at once when skipped) */
  run.tween = (ms, fn, ez = ease.inOutCubic) => new Promise(res => {
    const dur = Math.max(1, ms / run.speed), t0 = performance.now();
    const step = now => {
      const k = run.skipped || run.aborted ? 1 : clamp01((now - t0) / dur);
      try { fn(ez(k), k); } catch (e) { console.error(e); }
      if (k >= 1) res(); else requestAnimationFrame(step);
    };
    if (run.skipped) { try { fn(1, 1); } catch (e) { console.error(e); } res(); } else requestAnimationFrame(step);
  });
  /** wait `ms` (resolves at once when skipped) */
  run.wait = ms => new Promise(res => {
    if (run.skipped || ms <= 0) return res();
    const t = setTimeout(done, ms / run.speed); function done() { clearTimeout(t); run.onSkip.delete(done); res(); }
    run.onSkip.add(done);
  });
  /** a Web Animation that follows the run (finished on skip) */
  run.animate = (el, frames, opts) => {
    if (!el || !el.animate) return Promise.resolve();
    const a = el.animate(frames, { fill: "forwards", ...opts, duration: (opts.duration || 300) / run.speed, delay: (opts.delay || 0) / run.speed });
    run.anims.add(a); if (run.skipped) a.finish();
    return a.finished.then(() => run.anims.delete(a), () => run.anims.delete(a));
  };
  /** two frames: let the browser paint what was just put on screen */
  run.frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return run;
}
