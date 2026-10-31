// GAME 4 - The Hoia Baciu Lantern: explore a haunted 3D forest, follow the light beams, collect the wisps (each one tells a fact).
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, BoxGeometry, RingGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3, InstancedMesh, Object3D, PointLight, AmbientLight, DirectionalLight, HemisphereLight, Sprite, SpriteMaterial,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, AdditiveBlending, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createStage } from "../engine.js";
import { el, rand, clamp, good, bad, pick, inView } from "../common.js";

const FACTS = [
  "Hoia Baciu lies just outside Cluj-Napoca, in Transylvania, Romania.",
  "It is nicknamed «the Bermuda Triangle of Romania».",
  "In 1968 a photographer, Emil Barnea, snapped a strange disc in the sky above the forest: it became a famous alleged UFO photo.",
  "Many trees grow in strange curves and loops, and nobody has proved why.",
  "At the heart of the forest lies a perfectly round clearing where almost nothing grows.",
  "Legend says the forest is named after a shepherd, Baciu, who vanished there with his flock of 200 sheep.",
  "Visitors report cold spots, dizziness and the feeling of being watched. Scientists point to suggestion and the dense, dark woods.",
  "A famous tale says a girl vanished in the forest and returned five years later with no memory of it.",
];
const R_WORLD = 46, N_WISP = FACTS.length;

function glowTexture(c1 = "255,255,255") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${c1},1)`); gr.addColorStop(.25, `rgba(${c1},.55)`); gr.addColorStop(1, `rgba(${c1},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function groundTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#0c1a17"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const a = rand(.05, .35); g.fillStyle = `rgba(${(rand(10, 50)) | 0},${(rand(40, 90)) | 0},${(rand(30, 70)) | 0},${a})`; g.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), rand(1, 4)); }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(26, 26); t.colorSpace = SRGBColorSpace; return t;
}
// a twisted, tapering trunk with a few bent branches, merged into one geometry
function twistedTree() {
  const parts = [];
  const tube = (pts, r, seg = 18) => {
    const curve = new CatmullRomCurve3(pts), g = new TubeGeometry(curve, seg, r, 6, false), p = g.attributes.position, n = 7;
    for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg), k = 1 - .82 * (i / seg); for (let j = 0; j < n; j++) { const idx = i * n + j; p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k); } }
    g.computeVertexNormals(); return g;
  };
  const trunk = [new Vector3(0, 0, 0), new Vector3(.9, 1.2, .2), new Vector3(-.5, 2.6, .6), new Vector3(.9, 4, -.3), new Vector3(-.2, 5.4, .1), new Vector3(.4, 6.4, 0)];
  parts.push(tube(trunk, .34, 22));
  for (const [t, dx, dz, up] of [[.35, 1.6, .4, 1.2], [.55, -1.5, -.6, 1.6], [.72, .8, 1.4, 1.2], [.85, -1, .5, 1.3]]) {
    const c = new CatmullRomCurve3(trunk), s = c.getPointAt(t);
    parts.push(tube([s, s.clone().add(new Vector3(dx * .4, up * .35, dz * .4)), s.clone().add(new Vector3(dx * .8, up * .9, dz * .8)), s.clone().add(new Vector3(dx * 1.1, up * .8 + .3, dz * 1.1))], .12, 8));
  }
  parts.forEach(g => { g.deleteAttribute("uv"); }); // same attribute set for merge
  return mergeGeometries(parts);
}

export function start(host, ctx) {
  const st = createStage(host, { bg: 0x050a14, fog: 0.05, fogColor: 0x050a14, fov: 60, far: 160 });
  if (!st) return { dispose() {} };
  const { scene, camera } = st;

  scene.add(new AmbientLight(0x3a4a9a, 0.9));
  scene.add(new HemisphereLight(0x5c70ff, 0x0b1a14, 0.5));
  const moon = new DirectionalLight(0x9db4ff, 0.8); moon.position.set(-20, 40, 10); scene.add(moon);
  const lantern = new PointLight(0xaaffd8, 40, 24, 1.5); scene.add(lantern);

  const gt = groundTexture();
  const ground = new Mesh(new PlaneGeometry(260, 260), new MeshStandardMaterial({ map: gt, roughness: 1, color: 0x9fb0a8 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);

  /* ----- layout: wisps, clearing, trees ----- */
  const wispPos = [new Vector3(0, 0, 0)]; // the last fact (heart of the forest) sits in the clearing
  const ringN = N_WISP - 1;
  for (let i = 0; i < ringN; i++) { const a = (i / ringN) * Math.PI * 2 + rand(-.25, .25), r = rand(17, 38); wispPos.push(new Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); }
  const spawn = new Vector3(0, 0, 41);
  const trees = []; let guard = 0;
  while (trees.length < 250 && guard++ < 6000) {
    const a = rand(0, 6.28), r = Math.sqrt(rand(0, 1)) * (R_WORLD + 6), x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.hypot(x, z) < 10.5) continue; if (Math.hypot(x - spawn.x, z - spawn.z) < 5) continue;
    if (wispPos.some(w => Math.hypot(x - w.x, z - w.z) < 3.2)) continue; if (trees.some(t => Math.hypot(x - t.x, z - t.z) < 2.4)) continue;
    trees.push({ x, z, s: rand(.85, 1.55), ry: rand(0, 6.28), m: Math.random() < .5 ? -1 : 1 });
  }
  const tg = twistedTree(), tm = new MeshStandardMaterial({ color: 0x2a2236, roughness: 1, emissive: 0x0a0716 });
  const inst = new InstancedMesh(tg, tm, trees.length), o = new Object3D();
  trees.forEach((t, i) => { o.position.set(t.x, 0, t.z); o.rotation.set(0, t.ry, 0); o.scale.set(t.s * t.m, t.s, t.s); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
  scene.add(inst);
  // clearing: standing stones + glowing ring
  const stoneG = new BoxGeometry(.9, 2.2, .6), stoneM = new MeshStandardMaterial({ color: 0x3c3a52, roughness: .9 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, s = new Mesh(stoneG, stoneM); s.position.set(Math.sin(a) * 8.4, 1.1, Math.cos(a) * 8.4); s.rotation.set(rand(-.12, .12), a, rand(-.12, .12)); scene.add(s); trees.push({ x: s.position.x, z: s.position.z, s: .7, stone: true }); }
  const circle = new Mesh(new RingGeometry(7.2, 7.5, 64), new MeshBasicMaterial({ color: 0x8a6bb0, transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false })); circle.rotation.x = -Math.PI / 2; circle.position.y = .03; scene.add(circle);
  const dark = new Mesh(new RingGeometry(0, 7.2, 64), new MeshBasicMaterial({ color: 0x050709, transparent: true, opacity: .7 })); dark.rotation.x = -Math.PI / 2; dark.position.y = .02; scene.add(dark);
  // fireflies
  const fp = []; for (let i = 0; i < 160; i++) fp.push(rand(-45, 45), rand(.4, 4), rand(-45, 45));
  const fg = new BufferGeometry(); fg.setAttribute("position", new Float32BufferAttribute(fp, 3)); const flies = new Points(fg, new PointsMaterial({ color: 0xbfffe0, size: .12, transparent: true, opacity: .8 })); scene.add(flies);

  /* ----- player ----- */
  const player = new Group(); scene.add(player);
  const cloak = new Mesh(new ConeGeometry(.5, 1.5, 10), new MeshStandardMaterial({ color: 0x3b2f8a, roughness: .8 })); cloak.position.y = .75; player.add(cloak);
  const head = new Mesh(new SphereGeometry(.24, 14, 12), new MeshStandardMaterial({ color: 0xf1d3b8, roughness: .7 })); head.position.y = 1.66; player.add(head);
  const hood = new Mesh(new SphereGeometry(.28, 14, 12, 0, 6.283, 0, 1.9), new MeshStandardMaterial({ color: 0x2a2166, roughness: .8 })); hood.position.y = 1.7; hood.rotation.x = -.25; player.add(hood);
  const arm = new Group(); arm.position.set(.4, 1.2, .1); player.add(arm);
  const pole = new Mesh(new CylinderGeometry(.025, .025, .8, 6), new MeshStandardMaterial({ color: 0x6b5a3a })); pole.rotation.x = Math.PI / 2; pole.position.z = .38; arm.add(pole);
  const lamp = new Mesh(new SphereGeometry(.15, 12, 10), new MeshBasicMaterial({ color: 0xcffff0 })); lamp.position.set(0, -.05, .8); arm.add(lamp);
  const lampGlow = new Sprite(new SpriteMaterial({ map: glowTexture("170,255,220"), blending: AdditiveBlending, depthWrite: false, transparent: true })); lampGlow.scale.setScalar(1.8); lamp.add(lampGlow);

  /* ----- wisps ----- */
  const gl = glowTexture("120,255,200");
  const wisps = wispPos.map((p, i) => {
    const g = new Group(); g.position.set(p.x, 1.5, p.z);
    g.add(new Mesh(new SphereGeometry(.28, 14, 12), new MeshBasicMaterial({ color: 0xd8fff0 })));
    const h = new Sprite(new SpriteMaterial({ map: gl, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false })); h.scale.setScalar(3.2); g.add(h);
    const beam = new Mesh(new CylinderGeometry(.07, .22, 50, 10, 1, true), new MeshBasicMaterial({ color: 0x66ffc4, transparent: true, opacity: .22, blending: AdditiveBlending, depthWrite: false, fog: false })); beam.position.y = 25; g.add(beam);
    scene.add(g); return { g, p, fact: FACTS[i], got: false, ph: rand(0, 6.28), beam };
  });

  /* ----- wraiths ----- */
  const wraiths = [0, 1, 2].map(i => {
    const g = new Group(); const body = new Mesh(new ConeGeometry(.7, 2.4, 10, 1, true), new MeshBasicMaterial({ color: 0x0a0716, transparent: true, opacity: .88, side: 2 })); body.position.y = 1.2; body.rotation.x = Math.PI; g.add(body);
    for (const x of [-.18, .18]) { const e = new Mesh(new SphereGeometry(.07, 8, 6), new MeshBasicMaterial({ color: 0xff3b5c })); e.position.set(x, 1.9, .3); g.add(e); }
    const a = i / 3 * 6.283 + 1, r = 22 + i * 6; g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); scene.add(g); return { g, v: new Vector3(), ph: rand(0, 6), cd: 0 };
  });

  /* ----- HUD ----- */
  const hud = el("div", "hud3d"), top = el("div", "hud-top"), stats = el("span", "hud-stats"), bar = el("div", "lbar", "<i></i>"), fillEl = bar.firstChild, compass = el("div", "compass", "▲"), toast = el("div", "toast"), vign = el("div", "vign");
  top.append(stats, bar); hud.append(vign, top, compass, toast);
  const joyBase = el("div", "joy"), joyKnob = el("i"); joyBase.append(joyKnob); hud.append(joyBase); host.append(hud);
  const intro = el("div", "overlay", `<h3>The Hoia Baciu Lantern</h3><p>The forest swallows the lost. Follow the <b>glowing beams</b> and collect all <b>${N_WISP} wisps</b> before your lantern dies. Avoid the red-eyed wraiths!<br><b>W A S D</b> move · <b>Shift</b> run · <b>drag</b> or <b>← →</b> to look. On a phone: left stick to walk, drag on the right to look.</p><button class="ghost">Enter the forest</button>`);
  host.append(intro);

  /* ----- state & input ----- */
  const pos = spawn.clone(); let yaw = 0, light = 1, got = 0, started = false, over = false, time = 0, hurt = 0, inv = 0, bob = 0, face = 0;
  const keys = new Set(), joy = { x: 0, y: 0 };
  const kd = e => { if (!started || over || !inView(host)) return; const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "q", "e"].includes(k)) { keys.add(k); e.preventDefault(); } };
  const ku = e => keys.delete(e.key.toLowerCase());
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  let look = null;
  st.canvas.addEventListener("pointerdown", e => { const r = st.canvas.getBoundingClientRect(); if (e.pointerType === "touch" && e.clientX - r.left < r.width * .45) return; look = { id: e.pointerId, x: e.clientX }; st.canvas.setPointerCapture(e.pointerId); });
  st.canvas.addEventListener("pointermove", e => { if (look && look.id === e.pointerId) { yaw -= (e.clientX - look.x) * .006; look.x = e.clientX; } });
  const endLook = e => { if (look && look.id === e.pointerId) look = null; }; st.canvas.addEventListener("pointerup", endLook); st.canvas.addEventListener("pointercancel", endLook);
  // virtual joystick (touch)
  let jid = null, jo = null;
  host.addEventListener("pointerdown", e => { if (e.pointerType !== "touch" || !started) return; const r = host.getBoundingClientRect(); if (e.clientX - r.left > r.width * .45 || jid != null) return; jid = e.pointerId; jo = [e.clientX, e.clientY]; joyBase.style.display = "block"; joyBase.style.left = (e.clientX - r.left - 50) + "px"; joyBase.style.top = (e.clientY - r.top - 50) + "px"; });
  host.addEventListener("pointermove", e => { if (e.pointerId !== jid) return; let dx = e.clientX - jo[0], dy = e.clientY - jo[1]; const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx = dx / l * m; dy = dy / l * m; } joy.x = dx / m; joy.y = -dy / m; joyKnob.style.transform = `translate(${dx}px,${dy}px)`; });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; joy.x = joy.y = 0; joyBase.style.display = "none"; joyKnob.style.transform = ""; }; host.addEventListener("pointerup", jend); host.addEventListener("pointercancel", jend);
  intro.querySelector("button").onclick = () => { intro.remove(); started = true; pick(); };

  let toastT = null; const say = t => { toast.textContent = t; toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("on"), 5200); };
  const fmt = s => (s / 60 | 0) + ":" + String(s % 60 | 0).padStart(2, "0");
  const refresh = () => { stats.innerHTML = `Wisps <b>${got}/${N_WISP}</b> · Time <b>${fmt(time)}</b>`; fillEl.style.width = (light * 100) + "%"; fillEl.style.background = light < .25 ? "#ff3b5c" : "#b4c9a8"; };
  function end(win) {
    over = true; win ? good() : bad();
    const o = el("div", "overlay", win ? `<h3>You escaped at dawn!</h3><p>All ${N_WISP} wisps found in <b>${fmt(time)}</b>. Hoia Baciu lets you go… this time.</p><button class="ghost">Play again</button>` : `<h3>The lantern goes out…</h3><p>The forest keeps you. You found <b>${got}/${N_WISP}</b> wisps.</p><button class="ghost">Try again</button>`);
    host.append(o); o.querySelector("button").onclick = () => ctx.restart();
  }

  const fwd = new Vector3(), rgt = new Vector3();
  st.onFrame((dt, t) => {
    if (started && !over) {
      time += dt; light -= dt / 115; hurt = Math.max(0, hurt - dt * 1.5); inv = Math.max(0, inv - dt);
      if (keys.has("arrowleft") || keys.has("q")) yaw += dt * 1.9; if (keys.has("arrowright") || keys.has("e")) yaw -= dt * 1.9;
      let ix = joy.x + (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), iy = joy.y + (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); rgt.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const sp = (keys.has("shift") ? 7.6 : 5.2) * (l > 0 ? 1 : 0);
      const mv = new Vector3().addScaledVector(fwd, iy).addScaledVector(rgt, ix);
      if (mv.lengthSq() > 0) { pos.addScaledVector(mv, sp * dt); face = Math.atan2(mv.x, mv.z); bob += dt * sp * 1.6; }
      // collisions: trees, stones, world edge
      for (const tr of trees) { const dx = pos.x - tr.x, dz = pos.z - tr.z, rr = (tr.stone ? .75 : .5 * tr.s + .1) + .4, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = tr.x + dx / d * rr; pos.z = tr.z + dz / d * rr; } }
      const pr = Math.hypot(pos.x, pos.z); if (pr > R_WORLD) { pos.x *= R_WORLD / pr; pos.z *= R_WORLD / pr; }
      // wisps
      let near = null, nd = 1e9;
      for (const w of wisps) { if (w.got) continue; const d = Math.hypot(pos.x - w.p.x, pos.z - w.p.z); if (d < nd) { nd = d; near = w; } if (d < 1.7) { w.got = true; w.g.visible = false; got++; light = Math.min(1, light + .22); good(); say(`Wisp ${got}/${N_WISP}: ${w.fact}`); if (got >= N_WISP) setTimeout(() => end(true), 900); } }
      if (near) { const vx = near.p.x - pos.x, vz = near.p.z - pos.z; compass.style.transform = `rotate(${Math.atan2(vx * rgt.x + vz * rgt.z, vx * fwd.x + vz * fwd.z)}rad)`; compass.style.opacity = nd < 3 ? .3 : .9; }
      // wraiths
      for (const w of wraiths) {
        const dx = pos.x - w.g.position.x, dz = pos.z - w.g.position.z, d = Math.hypot(dx, dz), chase = d < 17;
        w.ph += dt * .6; const tx = chase ? dx / d : Math.sin(w.ph), tz = chase ? dz / d : Math.cos(w.ph * 1.3), spd = chase ? 2.7 + got * .12 : 1.2;
        w.g.position.x += tx * spd * dt; w.g.position.z += tz * spd * dt; w.g.position.y = Math.sin(t * 2 + w.ph * 3) * .25; w.g.rotation.y = Math.atan2(tx, tz);
        const wr = Math.hypot(w.g.position.x, w.g.position.z); if (wr > R_WORLD) { w.g.position.x *= R_WORLD / wr; w.g.position.z *= R_WORLD / wr; }
        if (d < 1.4 && inv <= 0) { light -= .2; hurt = 1; inv = 1.8; bad(); const a = rand(0, 6.28); w.g.position.set(pos.x + Math.sin(a) * 28, 0, pos.z + Math.cos(a) * 28); const rr = Math.hypot(w.g.position.x, w.g.position.z); if (rr > R_WORLD) { w.g.position.x *= R_WORLD / rr; w.g.position.z *= R_WORLD / rr; } }
        w.g.visible = true;
      }
      if (light <= 0) { light = 0; end(false); }
      refresh();
    }
    // visuals
    player.position.set(pos.x, Math.abs(Math.sin(bob)) * .08, pos.z);
    let dy = face - player.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.rotation.y += dy * Math.min(1, dt * 10);
    arm.rotation.x = Math.sin(t * 2) * .05;
    const f = clamp(light, 0, 1), flick = 1 + Math.sin(t * 17) * .04 + Math.sin(t * 7.3) * .05;
    lantern.position.set(pos.x + Math.sin(player.rotation.y) * .6, 1.4, pos.z + Math.cos(player.rotation.y) * .6); lantern.intensity = (6 + 44 * f) * flick; lantern.distance = 10 + 16 * f;
    st.scene.fog.density = .042 + (1 - f) * .03;
    lampGlow.material.opacity = .4 + f * .6;
    camera.position.set(pos.x + Math.sin(yaw) * 7.5, 4.6, pos.z + Math.cos(yaw) * 7.5); camera.lookAt(pos.x, 1.4, pos.z);
    wisps.forEach(w => { w.g.position.y = 1.5 + Math.sin(t * 2 + w.ph) * .35; w.beam.material.opacity = .16 + .08 * Math.sin(t * 3 + w.ph); });
    circle.material.opacity = .4 + .2 * Math.sin(t * 1.5); flies.rotation.y = t * .01; flies.position.y = Math.sin(t * .5) * .3;
    vign.style.opacity = hurt * .8 + (f < .25 ? (.25 - f) * 2 : 0);
  });
  refresh();
  return { _t: { warp: i => { pos.copy(wisps[i].p); pos.x += 0.5; }, state: () => ({ got, light, over, x: pos.x, z: pos.z }), start: () => intro.querySelector('button') && intro.querySelector('button').click() }, dispose() { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); clearTimeout(toastT); hud.remove(); intro.remove(); host.querySelectorAll(".overlay").forEach(x => x.remove()); st.dispose(); } };
}
