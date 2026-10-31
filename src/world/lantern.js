// THE LANTERN: on the landing page the cursor becomes a small lantern that really lights the valley. Its warm light is a
// point light placed where the pointer meets the ground (or the forest canopy), the post pass thins the valley mist
// around it and adds a soft halo, the far impostor trees and the lake pick it up too. Mouse, pen and touch (the lantern
// follows the finger while it is down, then lingers and fades). Nothing requires a mouse.
import { PointLight, Vector3, Vector4 } from "three";
import { H, forestDensity } from "./terrain.js";

const SVG = `<svg viewBox="0 0 32 48" width="26" height="39" aria-hidden="true" focusable="false">
  <path d="M16 2.5c-3 0-5.2 2.2-5.2 5" fill="none" stroke="#b9ab8c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M9 11h14l-1.6 3H10.6z" fill="#3a3329" stroke="#c2b38f" stroke-width=".9"/>
  <path d="M10.6 14h10.8l1.6 22H9z" fill="url(#lg)" stroke="#c2b38f" stroke-width="1"/>
  <path d="M16 14v22M12.8 14l-1.3 22M19.2 14l1.3 22" stroke="#4a3f30" stroke-width=".7" opacity=".7"/>
  <path d="M16 20c-2 3-3 5-3 7a3 3 0 0 0 6 0c0-2-1-4-3-7z" fill="#fff2c4"/>
  <path d="M8 36h16l-1.4 4H9.4z" fill="#3a3329" stroke="#c2b38f" stroke-width=".9"/>
  <defs><radialGradient id="lg" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".55" stop-color="#e28a2e" stop-opacity=".55"/><stop offset="1" stop-color="#5b2d0c" stop-opacity=".35"/></radialGradient></defs></svg>`;

/* ---- tilt (phones): tipping the phone moves the lantern. One window listener shared by every lantern (the valley is
   rebuilt after an adventure); on iOS the browser asks for permission, which needs a tap (see hero.js "Tilt" button). */
const tilt = { on: false, b0: null, g0: null, gx: 0, gy: 0, at: 0 };
const onOrient = e => {
  if (e.beta == null || e.gamma == null) return;
  if (tilt.b0 == null) { tilt.b0 = e.beta; tilt.g0 = e.gamma; }        // the way the phone is held when it starts is "centre"
  let x = (e.gamma - tilt.g0) / 22, y = (e.beta - tilt.b0) / 22;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;   // landscape: the axes swap
  if (ang === 90) [x, y] = [y, -x]; else if (ang === -90 || ang === 270) [x, y] = [-y, x]; else if (ang === 180) [x, y] = [-x, -y];
  tilt.gx = Math.max(-1, Math.min(1, x)); tilt.gy = Math.max(-1, Math.min(1, y)); tilt.at = performance.now();
};
export const tiltNeedsPermission = () => typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
export const tiltSupported = () => typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
export function setTilt(v) {
  if (v === tilt.on) return tilt.on; tilt.on = !!v; tilt.b0 = tilt.g0 = null;
  if (tilt.on) addEventListener("deviceorientation", onOrient); else removeEventListener("deviceorientation", onOrient);
  return tilt.on;
}
export const tiltState = () => ({ on: tilt.on, live: tilt.on && performance.now() - tilt.at < 1500, gx: tilt.gx, gy: tilt.gy });
/** where no permission is needed (Android), tilting simply works on touch screens */
export function autoTilt() { if (tiltSupported() && !tiltNeedsPermission()) setTilt(true); }
/** tests: feed a fake orientation */
export const _orient = (beta, gamma) => onOrient({ beta, gamma });

export function createLantern({ host, scene, camera, F, reduce }) {
  const pos = { value: new Vector4(0, -1000, 0, 26) }, k = { value: 0 };            // shared with the fog pass, water, impostors
  const light = new PointLight(0xffb15e, 0, 85, 1.2); light.position.set(0, -1000, 0); scene.add(light);
  const el = document.createElement("div"); el.className = "lantern"; el.setAttribute("aria-hidden", "true"); el.innerHTML = `<span class="lantern-glow"></span><span class="lantern-body">${SVG}</span>`;
  host.append(el);
  const target = new Vector3(0, -1000, 0), cur = new Vector3(0, -1000, 0), ndc = new Vector3(), dir = new Vector3(), org = new Vector3();
  let dirty = false, lift = 8, px = -1, py = -1, active = false, want = 0, level = 0, linger = 0, lastX = 0, swing = 0, touchDown = false, enabled = true, overUI = false, hit = false;

  /** ray-march the analytic terrain (+ forest canopy) from the camera through the pointer */
  function cast() {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height * 2 - 1), 0.5).unproject(camera);
    org.setFromMatrixPosition(camera.matrixWorld); dir.copy(ndc).sub(org).normalize();
    const surf = (x, z) => { const h = H(x, z); return h + forestDensity(x, z, h, 1) * 16; };   // ground + forest canopy
    let t = 4, prev = 4, found = false;
    for (let i = 0; i < 60 && t < 1600; i++) {
      const x = org.x + dir.x * t, y = org.y + dir.y * t, z = org.z + dir.z * t;
      if (y < surf(x, z)) { found = true; break; }
      prev = t; t += 3 + t * 0.06;
    }
    if (found) { let a = prev, b = t; for (let i = 0; i < 6; i++) { const m = (a + b) / 2, x = org.x + dir.x * m, y = org.y + dir.y * m, z = org.z + dir.z * m; if (y < surf(x, z)) b = m; else a = m; } t = (a + b) / 2; }
    else t = 420;
    hit = found; lift = 5 + t * 0.045;
    target.copy(org).addScaledVector(dir, t); target.y += found ? lift : 0;
  }
  const move = e => {
    if (!enabled) return;
    px = e.clientX; py = e.clientY;
    overUI = !!(e.target && e.target.closest && e.target.closest("a,button,input,select,label,.hero-content h1,.hero-content p"));
    el.classList.toggle("over-ui", overUI);
    el.style.transform = `translate3d(${px}px,${py}px,0)`;
    if (e.pointerType === "touch") { touchDown = e.type !== "pointerup" && e.type !== "pointercancel"; if (!touchDown) linger = 1.4; }
    active = true; want = 1; dirty = true;
  };
  const leave = e => { if (e.pointerType === "touch") return; active = false; want = 0; };
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerdown", move, { passive: true });
  host.addEventListener("pointerup", move, { passive: true });
  host.addEventListener("pointercancel", move, { passive: true });
  host.addEventListener("pointerleave", leave);
  host.classList.add("has-lantern");

  function update(dt) {
    // tilt: when the phone tips (and no finger is down) the lantern drifts across the valley with it
    if (tilt.on && enabled && !touchDown && performance.now() - tilt.at < 1500) {
      const r = host.getBoundingClientRect(), tx = r.left + r.width * (0.5 + 0.44 * tilt.gx), ty = r.top + r.height * (0.56 + 0.36 * tilt.gy), k = 1 - Math.exp(-dt * 5);
      px = px < 0 ? tx : px + (tx - px) * k; py = py < 0 ? ty : py + (ty - py) * k; el.style.transform = `translate3d(${px}px,${py}px,0)`;
      active = true; want = 1; linger = 2; dirty = true;
    }
    if (dirty || (active && level > 0.05 && Math.random() < 0.15)) { dirty = false; cast(); }   // at most once a frame (the camera sways too)
    if (touchDown) want = 1; else if (linger > 0) { linger -= dt; if (linger <= 0) want = 0; }
    level += (want - level) * (1 - Math.exp(-dt * 4));
    if (cur.y < -500) cur.copy(target); else cur.lerp(target, 1 - Math.exp(-dt * 9));
    const vx = (px - lastX) / Math.max(dt, 0.001); lastX = px;
    swing += ((reduce ? 0 : Math.max(-22, Math.min(22, -vx * 0.03))) - swing) * (1 - Math.exp(-dt * 6));
    el.style.setProperty("--sw", swing.toFixed(1) + "deg"); el.style.opacity = (enabled ? Math.min(1, level * 1.4) : 0).toFixed(3);
    const flick = reduce ? 1 : 0.9 + 0.06 * Math.sin(performance.now() * 0.013) + 0.04 * Math.sin(performance.now() * 0.029);
    const camD = cur.distanceTo(camera.position);
    light.position.copy(cur);
    light.intensity = F.lanternLight && enabled ? level * flick * 5 * Math.pow(lift, 1.2) * (hit ? 1 : 0.2) : 0;   // ~5 lux-ish right under it
    light.distance = lift * 4.5;
    pos.value.set(cur.x, cur.y, cur.z, 22 + camD * 0.08); k.value = enabled ? level * flick : 0;
  }
  return {
    pos, k, light, el, update,
    /** screen position of the lantern (for the wisps and the figure on the ridge) */
    screen: () => ({ x: px, y: py, on: level > 0.3 && enabled }),
    setEnabled(v) { enabled = !!v; if (!v) { want = 0; } host.classList.toggle("has-lantern", enabled); },
    dispose() { host.removeEventListener("pointermove", move); host.removeEventListener("pointerdown", move); host.removeEventListener("pointerup", move); host.removeEventListener("pointercancel", move); host.removeEventListener("pointerleave", leave); el.remove(); scene.remove(light); },
  };
}
