// WILL-O'-THE-WISPS: rare blue-green lights drifting between the trees. They appear at irregular times and places,
// wander slowly and irregularly, shy away from the lantern, and fade. Clicking (or tapping) one before it fades
// unlocks a secret card in the Archive (once; afterwards the wisps only scatter).
import { Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending, PointLight, Vector3 } from "three";
import { H, forestDensity, slopeY, lakeR, cragR } from "./terrain.js";
import { covered, headerBottom, halfFovX, inView } from "./presences.js";

const COLOR = [0.42, 1.55, 1.25];

export function createWisps({ scene, camera, host, F, timeU, rate = 1, project, lanternScreen, onCatch, onSpawn, reduce }) {
  const MAX = 3;
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(new Float32Array(MAX * 3), 3)); g.setAttribute("aA", new Float32BufferAttribute(new Float32Array(MAX), 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: timeU, uPx: { value: 1 }, uCol: { value: new Vector3(...COLOR) } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: /* glsl */`attribute float aA; uniform float uPx, uTime; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; vA = aA;
        gl_PointSize = clamp(3400. / -mv.z, 12., 70.) * uPx * (.85 + .15 * sin(uTime * 9. + position.x)); }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c) * 2.; if (r > 1. || vA < .003) discard;
        float core = exp(-r * r * 40.), halo = exp(-r * r * 5.) * .5 + exp(-r * r * 1.6) * .12;
        gl_FragColor = vec4((uCol * (core * 3. + halo) + vec3(core * 1.4)) * vA, 1.); }`,
  });
  const pts = new Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  const light = new PointLight(0x7fe8d0, 0, 26, 1.4); light.position.set(0, -500, 0); scene.add(light);
  const list = [];
  let clock = 0, next = 9 + Math.random() * 10;

  function spawnPoint() {
    const yaw = Math.atan2(-camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);   // camera heading
    // somewhere in the picture and not under the title or the buttons (a wisp behind the big title was "seen" by the
    // journal but by nobody else); the last tries accept any place, as v9 did
    const hb = headerBottom(), hf = halfFovX(camera);
    for (let i = 0; i < 90; i++) {
      const r = 55 + Math.random() * 170, a = yaw + (Math.random() - 0.5) * (i < 70 ? 2 * hf : 0.85), x = camera.position.x + Math.sin(a) * r, z = camera.position.z - Math.cos(a) * r;
      const h = H(x, z), f = forestDensity(x, z, h, slopeY(x, z)), lr = lakeR(x, z);
      if (cragR(x, z) < 1.4) continue;
      if (f > 0.22 || (lr > 1.05 && lr < 1.5)) {
        const p = new Vector3(x, h + 1.2 + Math.random() * 2.2, z);
        if (i < 70) { const sp = project(p); if (!inView(sp, hb + 30) || covered(sp.x, sp.y, 30)) continue; }
        return p;
      }
    }
    return null;
  }
  function spawn() {
    const p = spawnPoint(); if (!p) return;
    list.push({ anchor: p, pos: p.clone(), t: 0, life: 9 + Math.random() * 7, seed: Math.random() * 100, caught: 0, flee: new Vector3() }); onSpawn && onSpawn(p);
  }
  const tmp = new Vector3();
  function update(dt, { idle = true } = {}) {
    clock += dt;
    if (idle && list.length < F.wisps && clock > next) { spawn(); next = clock + (16 + Math.random() * 30) / rate; }
    const L = lanternScreen ? lanternScreen() : null;
    const pos = g.attributes.position.array, aA = g.attributes.aA.array; let best = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i]; w.t += dt;
      const s = w.seed, t = clock;
      // slow, irregular wandering: a few incommensurate sines, plus a drift away from the lantern when it comes close
      tmp.set(Math.sin(t * 0.37 + s) * 2.4 + Math.sin(t * 0.91 + s * 2.1) * 0.8, Math.sin(t * 0.63 + s * 1.7) * 0.7 + Math.sin(t * 1.9 + s) * 0.18, Math.cos(t * 0.29 + s * 0.6) * 2.6 + Math.sin(t * 1.13 + s * 1.3) * 0.6);
      if (L && L.on && !w.caught) {
        const sp = project(w.pos); if (sp) { const dx = sp.x - L.x, dy = sp.y - L.y, d = Math.hypot(dx, dy); if (d < 70) { const k = (70 - d) / 70 * 2.2 * dt; w.flee.x += Math.sign(dx || 1) * k * 1.6; w.flee.y += k * 0.3; } } }
      w.flee.multiplyScalar(Math.exp(-dt * 0.2));
      w.pos.copy(w.anchor).add(tmp).add(w.flee);
      let a = Math.min(1, w.t / 2.2) * Math.min(1, (w.life - w.t) / 2.6);
      a *= reduce ? 1 : 0.72 + 0.18 * Math.sin(t * 7.1 + s) + 0.1 * Math.sin(t * 13.3 + s * 2.);
      if (w.caught) { w.caught += dt; a = Math.max(0, 1.8 - w.caught * 2.2) * (1 + w.caught * 3); w.pos.y += dt * 3; }
      w.a = Math.max(0, a);
      if (w.t > w.life || (w.caught && w.caught > 0.85)) { list.splice(i, 1); continue; }
      if (w.a > best) { best = w.a; light.position.copy(w.pos); }
    }
    for (let i = 0; i < MAX; i++) { const w = list[i]; if (w) { pos[i * 3] = w.pos.x; pos[i * 3 + 1] = w.pos.y; pos[i * 3 + 2] = w.pos.z; aA[i] = w.a; } else aA[i] = 0; }
    g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    light.intensity = F.wispLight ? best * 160 : 0;
  }
  /** a click/tap at client (x, y): catch the wisp under it. Returns true when something was caught. */
  function tryCatch(x, y, coarse) {
    const R = coarse ? 46 : 30;
    for (const w of list) {
      if (w.caught || w.a < 0.18) continue;
      const sp = project(w.pos); if (!sp) continue;
      if (Math.hypot(sp.x - x, sp.y - y) < R) { w.caught = 0.001; onCatch && onCatch(w); return true; }
    }
    return false;
  }
  const onDown = e => { if (e.button > 0) return; if (e.target && e.target.closest && e.target.closest("a,button,input,select")) return; if (tryCatch(e.clientX, e.clientY, e.pointerType !== "mouse")) e.stopPropagation(); };
  host.addEventListener("pointerdown", onDown, true);
  return {
    update, tryCatch, points: pts, light,
    /** for tests and the curious: summon one now */
    summon() { let p = null; for (let i = 0; i < 25 && !p; i++) { const q = spawnPoint(); const sp = q && project(q); if (sp && sp.on && sp.y > 80) p = q; } if (p) { list.push({ anchor: p, pos: p.clone(), t: 2.2, life: 30, seed: Math.random() * 100, caught: 0, flee: new Vector3() }); onSpawn && onSpawn(p); } return list.length; },
    active: () => list.filter(w => !w.caught).map(w => ({ ...project(w.pos), a: w.a })),
    setPx(v) { mat.uniforms.uPx.value = v; },
    dispose() { host.removeEventListener("pointerdown", onDown, true); scene.remove(pts, light); g.dispose(); mat.dispose(); },
  };
}
