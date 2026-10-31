// Procedural 3D building blocks shared by the adventures: noise, sky, rain, low-poly humans, colliders, shadows, camera rigs.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry,
  ShaderMaterial, BackSide, Color, Vector3, LineSegments, BufferGeometry, Float32BufferAttribute, CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, AdditiveBlending,
} from "three";

/* ---------------- deterministic randomness + noise ---------------- */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (ix, iy) => { let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2; a *= 0.5; } return s; }
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- sky dome (gradient + sun glow + stars) ---------------- */
export function makeSky() {
  const u = { uTop: { value: new Color(0x4a78c8) }, uMid: { value: new Color(0x9ec0e8) }, uBot: { value: new Color(0xe8d8b8) },
    uStars: { value: 0 }, uSunDir: { value: new Vector3(0.3, 0.5, -0.8).normalize() }, uSunCol: { value: new Color(0xffe2a0) }, uSun: { value: 0 } };
  const m = new Mesh(new SphereGeometry(380, 24, 16), new ShaderMaterial({
    uniforms: u, side: BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 vD;uniform vec3 uTop,uMid,uBot,uSunDir,uSunCol;uniform float uStars,uSun;
      void main(){float h=clamp(vD.y*1.25+0.08,0.,1.);vec3 c=mix(uBot,uMid,smoothstep(0.,.3,h));c=mix(c,uTop,smoothstep(.25,1.,h));
      float s=max(dot(normalize(vD),normalize(uSunDir)),0.);c+=uSunCol*(pow(s,90.)*1.1+pow(s,5.)*.22)*uSun;
      float st=step(.9972,fract(sin(dot(floor(vD*150.),vec3(12.9898,78.233,37.719)))*43758.5453));c+=vec3(st)*uStars*smoothstep(.04,.35,vD.y);
      gl_FragColor=vec4(c,1.);}`,
  }));
  m.renderOrder = -10; m.frustumCulled = false;
  return { mesh: m, u, follow(cam) { m.position.copy(cam.position); },
    set({ top, mid, bot, stars, sun, sunDir, sunCol }) { if (top != null) u.uTop.value.set(top); if (mid != null) u.uMid.value.set(mid); if (bot != null) u.uBot.value.set(bot); if (stars != null) u.uStars.value = stars; if (sun != null) u.uSun.value = sun; if (sunDir) u.uSunDir.value.copy(sunDir); if (sunCol != null) u.uSunCol.value.set(sunCol); } };
}

/* ---------------- GPU rain (world-anchored volume that follows the camera) ---------------- */
export function makeRain({ count = 2500, size = 40, height = 26, speed = 24, slant = 0.18, len = 0.9, color = 0xaec6ff, opacity = 0.35 } = {}) {
  const pos = [], tip = [], seed = [];
  for (let i = 0; i < count; i++) { const x = Math.random() * size, y = Math.random() * height, z = Math.random() * size, s = Math.random(); pos.push(x, y, z, x, y, z); tip.push(0, 1); seed.push(s, s); }
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setAttribute("aTip", new Float32BufferAttribute(tip, 1)); g.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  const u = { uTime: { value: 0 }, uCam: { value: new Vector3() }, uColor: { value: new Color(color) }, uOp: { value: opacity }, uSize: { value: size }, uH: { value: height }, uSpeed: { value: speed }, uSlant: { value: slant }, uLen: { value: len } };
  const m = new LineSegments(g, new ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `attribute float aTip;attribute float aSeed;uniform float uTime,uSize,uH,uSpeed,uSlant,uLen;uniform vec3 uCam;varying float vT;
      void main(){vec3 p=position;p.x=mod(p.x-uCam.x,uSize)-uSize*.5+uCam.x;p.z=mod(p.z-uCam.z,uSize)-uSize*.5+uCam.z;
      p.y=mod(p.y-uTime*uSpeed*(.8+aSeed*.4),uH)+uCam.y-uH*.45;p.x+=aTip*uSlant*uLen;p.y+=aTip*uLen;vT=aTip;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: "uniform vec3 uColor;uniform float uOp;varying float vT;void main(){gl_FragColor=vec4(uColor,uOp*(1.-vT*.7));}",
  }));
  m.frustumCulled = false; let intensity = 1;
  return { mesh: m, u, setIntensity(i) { intensity = i; u.uOp.value = opacity * Math.min(1, 0.25 + i); m.geometry.setDrawRange(0, Math.floor(count * 2 * Math.max(0, Math.min(1, i)))); m.visible = i > 0.01; }, get intensity() { return intensity; },
    update(dt, cam) { u.uTime.value += dt; u.uCam.value.copy(cam.position); } };
}

/* ---------------- soft blob shadow ---------------- */
let _shTex = null;
const shadowTex = () => { if (_shTex) return _shTex; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _shTex = new CanvasTexture(c); return _shTex; };
export function makeShadow(r = 0.5, op = 1) { const m = new Mesh(new PlaneGeometry(r * 2, r * 2), new MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: op })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1; return m; }

/* ---------------- glow sprite ---------------- */
let _glowTex = {};
export function glowSprite(color = "255,255,255", scale = 2) {
  if (!_glowTex[color]) { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.3, `rgba(${color},.45)`); gr.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; _glowTex[color] = t; }
  const s = new Sprite(new SpriteMaterial({ map: _glowTex[color], blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.scale.setScalar(scale); return s;
}

/* ---------------- floating name label (sprite) ---------------- */
export function nameLabel(text, { color = "#fff", bg = "rgba(6,8,30,.7)" } = {}) {
  const c = document.createElement("canvas"); c.width = 384; c.height = 80; const g = c.getContext("2d");
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 8, 376, 64, 30); g.fill(); g.font = "700 34px Cinzel, serif"; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 192, 42);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false })); s.scale.set(1.9, 0.4, 1); s.renderOrder = 20; return s;
}

/* ---------------- colliders (circles + axis-aligned boxes) ---------------- */
export class Colliders {
  constructor() { this.c = []; this.b = []; }
  circle(x, z, r, tag) { const o = { x, z, r, tag, on: true }; this.c.push(o); return o; }
  box(x0, z0, x1, z1, tag) { const o = { x0, z0, x1, z1, tag, on: true }; this.b.push(o); return o; }
  resolve(p, r) {
    for (const c of this.c) { if (!c.on) continue; const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; } }
    for (const b of this.b) {
      if (!b.on) continue; const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) { if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else { // centre inside the box: push out through the nearest side
        const l = p.x - b.x0, rt = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rt, t, bt); if (m === l) p.x = b.x0 - r; else if (m === rt) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r; } }
    }
    return p;
  }
}

/* ---------------- low-poly humans ---------------- */
const _gm = new Map();
const stdMat = (color, extra = {}) => { const k = color + JSON.stringify(extra); if (!_gm.has(k)) _gm.set(k, new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra })); return _gm.get(k); };
export function makeHuman({ skin = 0xe0b59a, cloth = 0x6b4a2f, cloth2 = null, hair = 0x3a2a1a, scale = 1, robe = false, hood = false, hat = null, longHair = false, beard = false, emissive = 0, stripes = false } = {}) {
  const g = new Group(), skinM = new MeshStandardMaterial({ color: skin, roughness: 0.85, flatShading: true, emissive }), clothM = stdMat(cloth), c2 = stdMat(cloth2 ?? cloth), hairM = stdMat(hair);
  const body = new Group(); g.add(body);
  let torso;
  if (robe) { torso = new Mesh(new CylinderGeometry(0.24, 0.42, 1.25, 10), clothM); torso.position.y = 0.72; body.add(torso); }
  else { torso = new Mesh(new BoxGeometry(0.46, 0.62, 0.28), clothM); torso.position.y = 1.08; body.add(torso); const belt = new Mesh(new BoxGeometry(0.48, 0.07, 0.3), c2); belt.position.y = 0.82; body.add(belt); }
  if (stripes) for (let i = 0; i < 3; i++) { const s = new Mesh(new BoxGeometry(0.47, 0.04, 0.29), c2); s.position.y = 0.98 + i * 0.14; body.add(s); }
  const legs = [-1, 1].map(s => { const p = new Group(); p.position.set(s * 0.12, 0.78, 0); const l = new Mesh(new BoxGeometry(0.15, 0.7, 0.17), robe ? clothM : c2); l.position.y = -0.35; p.add(l); if (robe) l.visible = false; body.add(p); return p; });
  const arms = [-1, 1].map(s => { const p = new Group(); p.position.set(s * 0.3, 1.34, 0); const a = new Mesh(new BoxGeometry(0.11, 0.55, 0.12), clothM); a.position.y = -0.26; const h = new Mesh(new SphereGeometry(0.07, 8, 6), skinM); h.position.y = -0.56; p.add(a, h); body.add(p); return p; });
  const head = new Group(); head.position.y = 1.5; body.add(head);
  const sk = new Mesh(new SphereGeometry(0.19, 12, 10), skinM); sk.position.y = 0.17; head.add(sk);
  const eyeM = stdMat(0x15121a); for (const s of [-1, 1]) { const e = new Mesh(new SphereGeometry(0.025, 6, 5), eyeM); e.position.set(s * 0.07, 0.2, 0.17); head.add(e); }
  const nose = new Mesh(new BoxGeometry(0.03, 0.05, 0.04), skinM); nose.position.set(0, 0.16, 0.19); head.add(nose);
  if (hair != null && !hood && !hat) { const h = new Mesh(new SphereGeometry(0.205, 12, 8, 0, Math.PI * 2, 0, 1.7), hairM); h.position.y = 0.19; h.rotation.x = -0.25; head.add(h); }
  if (longHair) { const h = new Mesh(new BoxGeometry(0.34, 0.5, 0.12), hairM); h.position.set(0, 0.0, -0.1); head.add(h); }
  if (hood) { const h = new Mesh(new SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, 2.0), clothM); h.position.y = 0.17; h.rotation.x = -0.3; head.add(h); }
  if (hat === "cap") { const h = new Mesh(new CylinderGeometry(0.2, 0.22, 0.1, 10), c2); h.position.y = 0.36; head.add(h); }
  if (hat === "coif") { const h = new Mesh(new SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, 1.9), stdMat(0xe9e2cf)); h.position.y = 0.18; h.rotation.x = -0.2; head.add(h); }
  if (beard) { const b = new Mesh(new BoxGeometry(0.22, 0.16, 0.1), hairM); b.position.set(0, 0.04, 0.12); head.add(b); }
  g.scale.setScalar(scale);
  // animation state
  const st = { ph: Math.random() * 6, gest: null, look: 0, lookPitch: 0 };
  const h = {
    group: g, head, arms, legs, body, skinM, scale, baseY: 0,
    update(dt, t, { speed = 0, lookAt = null } = {}) {
      st.ph += dt * (3 + speed * 2.2); const w = Math.min(1, speed / 2.2), s = Math.sin(st.ph * 2);
      legs[0].rotation.x = s * 0.7 * w; legs[1].rotation.x = -s * 0.7 * w; arms[0].rotation.x = -s * 0.55 * w; arms[1].rotation.x = s * 0.55 * w;
      body.position.y = Math.abs(s) * 0.05 * w + Math.sin(t * 1.7 + st.ph) * 0.006; body.rotation.z = Math.sin(st.ph * 2) * 0.03 * w;
      // head turns toward target
      let ty = 0, tp = 0;
      if (lookAt) { const dx = lookAt.x - g.position.x, dz = lookAt.z - g.position.z; let a = Math.atan2(dx, dz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); ty = Math.max(-1.1, Math.min(1.1, a)); tp = Math.max(-0.3, Math.min(0.3, -(lookAt.y - (g.position.y + 1.5 * this.scale)) * 0.1)); }
      st.look += (ty - st.look) * Math.min(1, dt * 6); st.lookPitch += (tp - st.lookPitch) * Math.min(1, dt * 6);
      head.rotation.y = st.look; head.rotation.x = st.lookPitch;
      // gestures
      if (st.gest) {
        const k = (performance.now() - st.gest.t0) / st.gest.dur;
        if (k >= 1) st.gest = null; else {
          const e = Math.sin(k * Math.PI);
          switch (st.gest.type) {
            case "nod": head.rotation.x += Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); break;
            case "shake": head.rotation.y += Math.sin(k * Math.PI * 5) * 0.4 * (1 - k); break;
            case "wave": arms[1].rotation.x = -2.5 * e; arms[1].rotation.z = Math.sin(k * 20) * 0.3 * e; break;
            case "point": arms[1].rotation.x = -1.4 * e; break;
            case "beg": arms[0].rotation.x = -1.0 * e; arms[1].rotation.x = -1.0 * e; break;
            case "cower": body.rotation.x = 0.25 * e; head.rotation.x += 0.3 * e; break;
            case "shrug": arms[0].rotation.z = 0.5 * e; arms[1].rotation.z = -0.5 * e; break;
          }
        }
      } else { arms[1].rotation.z *= 0.9; arms[0].rotation.z *= 0.9; body.rotation.x *= 0.9; }
    },
    gesture(type, dur = 900) { st.gest = { type, t0: performance.now(), dur }; },
    faceToward(x, z, k = 1) { let a = Math.atan2(x - g.position.x, z - g.position.z) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += a * k; },
    setLie(v) { g.rotation.x = v ? -Math.PI / 2 : 0; g.position.y = v ? 0.25 : 0; },
  };
  return h;
}

/* ---------------- camera rigs ---------------- */
// third-person chase camera with optional cinematic "shot" override
export class ChaseCam {
  constructor(cam, { dist = 5.2, height = 1.7, minPitch = -0.15, maxPitch = 0.85 } = {}) {
    this.cam = cam; this.yaw = 0; this.pitch = 0.32; this.dist = dist; this.height = height; this.minPitch = minPitch; this.maxPitch = maxPitch;
    this.shot = null; this.pos = new Vector3(); this.look = new Vector3(); this.fov = cam.fov; this.baseFov = cam.fov; this.init = false; this.groundAt = () => 0;
  }
  rotate(dx, dy) { this.yaw -= dx; this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy)); }
  setShot(s) { this.shot = s; }  // {pos:Vector3, look:Vector3, fov?}
  clearShot() { this.shot = null; }
  update(dt, target) {
    let wantPos, wantLook, wantFov = this.baseFov;
    if (this.shot) { wantPos = this.shot.pos; wantLook = this.shot.look; wantFov = this.shot.fov || this.baseFov; }
    else {
      const cp = Math.cos(this.pitch), d = this.dist;
      wantPos = new Vector3(target.x + Math.sin(this.yaw) * cp * d, target.y + this.height + Math.sin(this.pitch) * d, target.z + Math.cos(this.yaw) * cp * d);
      const gy = this.groundAt(wantPos.x, wantPos.z) + 0.6; if (wantPos.y < gy) wantPos.y = gy;
      wantLook = new Vector3(target.x, target.y + this.height * 0.85, target.z);
    }
    if (!this.init) { this.pos.copy(wantPos); this.look.copy(wantLook); this.init = true; }
    const k = 1 - Math.exp(-(this.shot ? 3.2 : 9) * dt); this.pos.lerp(wantPos, k); this.look.lerp(wantLook, k); this.fov += (wantFov - this.fov) * k;
    this.cam.position.copy(this.pos); this.cam.lookAt(this.look); if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
  snap() { this.init = false; }
}
