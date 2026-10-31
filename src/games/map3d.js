// GAME 3 - Capital Express 3D (replaces the text "capitals" quiz): a real extruded map of Europe built from Natural Earth borders.
import {
  Shape, Path, Vector2, ExtrudeGeometry, Mesh, MeshStandardMaterial, LineSegments, LineBasicMaterial, BufferGeometry, Float32BufferAttribute,
  PlaneGeometry, DirectionalLight, HemisphereLight, Raycaster, Sprite, SpriteMaterial, Group, Vector3, GridHelper,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createStage } from "../engine.js";
import { el, shuffle, damp, textTexture, good, bad, pick } from "../common.js";

const ROUNDS = 10;

export function start(host, ctx) {
  const st = createStage(host, { bg: 0x050716, fog: 0.012, fogColor: 0x050716, fov: 42 });
  if (!st) return { dispose() {} };
  const { scene, camera } = st;
  const { GEO, COUNTRIES } = ctx;
  scene.add(new HemisphereLight(0xaab4ff, 0x120a2a, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.9); sun.position.set(-10, 18, 8); scene.add(sun);
  const fill = new DirectionalLight(0x6a5aff, .8); fill.position.set(12, 6, -10); scene.add(fill);

  const S = 26 / GEO.view.w, CX = GEO.view.w / 2, CY = GEO.view.h / 2;
  const playable = new Map(COUNTRIES.map(c => [c[0], c]));
  const sea = new Mesh(new PlaneGeometry(120, 120), new MeshStandardMaterial({ color: 0x0a1344, roughness: .6, metalness: .3 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.02; scene.add(sea);
  const grid = new GridHelper(120, 60, 0x1a2466, 0x121a4d); grid.position.y = -.01; scene.add(grid);

  /* ----- build solid countries from the Natural Earth polygons ----- */
  const world = new Group(); scene.add(world);
  const baseMat = new MeshStandardMaterial({ color: 0x1b2050, roughness: .9 });
  const pos = { hi: [], lo: [] }; const meshes = []; const ctrs = {};
  const hues = [0x3a3f9e, 0x4a3a9e, 0x35508f, 0x5a3f9e, 0x3d4a96];
  GEO.countries.forEach((c, idx) => {
    const isP = c.c && playable.has(c.c), depth = isP ? .9 : .22;
    const geoms = [];
    for (const poly of c.polys) {
      const mk = r => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(new Vector2((r[i] - CX) * S, -(r[i + 1] - CY) * S)); return pts; };
      const shape = new Shape(mk(poly[0])); for (let h = 1; h < poly.length; h++) shape.holes.push(new Path(mk(poly[h])));
      geoms.push(new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }));
      // top outline
      const arr = isP ? pos.hi : pos.lo;
      for (const r of poly) for (let i = 0; i < r.length; i += 2) { const j = (i + 2) % r.length; arr.push((r[i] - CX) * S, depth + .006, (r[i + 1] - CY) * S, (r[j] - CX) * S, depth + .006, (r[j + 1] - CY) * S); }
    }
    for (const g of geoms) {
      const m = new Mesh(g, isP ? new MeshStandardMaterial({ color: hues[idx % hues.length], roughness: .55, metalness: .1, emissive: 0x000000 }) : baseMat);
      m.rotation.x = -Math.PI / 2; m.userData = { code: isP ? c.c : null, depth, name: c.n, flash: 0, flashCol: 0, raise: 0 };
      world.add(m); if (isP) meshes.push(m);
    }
    if (isP) ctrs[c.c] = new Vector3((c.ctr[0] - CX) * S, depth, (c.ctr[1] - CY) * S);
  });
  for (const [k, col] of [["lo", 0x3a2f8c], ["hi", 0xb9a4ff]]) { const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos[k], 3)); world.add(new LineSegments(g, new LineBasicMaterial({ color: col, transparent: k === "lo", opacity: k === "lo" ? .8 : 1 }))); }

  /* ----- camera ----- */
  const home = { p: new Vector3(0, 21, 15), t: new Vector3(0, 0, .5) };
  camera.position.copy(home.p);
  const ctl = new OrbitControls(camera, st.canvas);
  ctl.target.copy(home.t); ctl.enableZoom = false; /* enabled after the first click so the page can still scroll */ ctl.enableDamping = true; ctl.dampingFactor = .09; ctl.maxPolarAngle = 1.3; ctl.minDistance = 5; ctl.maxDistance = 38; ctl.screenSpacePanning = false; ctl.update();

  /* ----- HUD ----- */
  const hud = el("div", "hud3d"), top = el("div", "hud-top"), stats = el("span", "hud-stats"), qEl = el("p", "hud-q"), msg = el("p", "hud-msg"), bar = el("div", "hud-bar");
  const bHome = el("button", "ghost", "Reset view"); bar.append(bHome); top.append(stats); hud.append(top, qEl, msg, bar); host.append(hud);
  bHome.onclick = () => { camera.position.copy(home.p); ctl.target.copy(home.t); ctl.update(); };
  const intro = el("div", "overlay", `<h3>Capital Express 3D</h3><p>A real 3D map of Europe made from Natural Earth borders.<br><b>Drag</b> to rotate · <b>scroll / pinch</b> to zoom · <b>click</b> the right country.</p><button class="ghost">Start</button>`);
  host.append(intro);

  /* ----- game state ----- */
  const rounds = shuffle(COUNTRIES).slice(0, ROUNDS); let ri = -1, score = 0, tries = 0, locked = true, over = false, labels = [], timers = [];
  const later = (f, ms) => { const id = setTimeout(f, ms); timers.push(id); };
  const flash = (code, col, ms = 900) => meshes.forEach(m => { if (m.userData.code === code) { m.userData.flash = ms / 1000; m.userData.flashCol = col; } });
  function label(code, text) {
    const sp = new Sprite(new SpriteMaterial({ map: textTexture(text, { w: 512, h: 160, size: 80, color: "#fff", bg: "rgba(6,8,30,.85)", border: "#b4c9a8", pad: 20 }), depthTest: false, transparent: true }));
    sp.scale.set(4, 1.25, 1); sp.position.copy(ctrs[code]).add(new Vector3(0, 1.9, 0)); sp.renderOrder = 10; scene.add(sp); labels.push(sp); later(() => { scene.remove(sp); sp.material.map.dispose(); sp.material.dispose(); }, 2200);
  }
  function next() {
    ri++; tries = 0;
    if (ri >= ROUNDS) return finish();
    const c = rounds[ri]; qEl.innerHTML = `Find the country whose capital is <b>${c[2]}</b>`; msg.textContent = ""; msg.className = "hud-msg"; locked = false;
    stats.innerHTML = `Round <b>${ri + 1}/${ROUNDS}</b> · Points <b>${score}</b>`;
  }
  function finish() {
    over = true; qEl.textContent = ""; msg.textContent = ""; stats.innerHTML = `Points <b>${score}</b>`;
    const o = el("div", "overlay", `<h3>${score >= ROUNDS * 1.5 ? "Master cartographer!" : "Journey complete"}</h3><p>You scored <b>${score} / ${ROUNDS * 2}</b>.</p><button class="ghost">Play again</button>`);
    host.append(o); o.querySelector("button").onclick = () => ctx.restart();
  }
  intro.querySelector("button").onclick = () => { intro.remove(); pick(); next(); };

  /* ----- picking (click, not drag) ----- */
  const ray = new Raycaster(), ptr = new Vector2(); let hov = null, down = null;
  const toNDC = e => { const r = st.canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(meshes, false)[0]; };
  st.canvas.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") ctl.enableZoom = false; });
  st.canvas.addEventListener("pointerdown", e => { ctl.enableZoom = true; down = [e.clientX, e.clientY, performance.now()]; });
  st.canvas.addEventListener("pointermove", e => { if (e.buttons) return; const h = toNDC(e); hov = h ? h.object.userData.code : null; st.canvas.style.cursor = hov && !locked ? "pointer" : "grab"; });
  st.canvas.addEventListener("pointerup", e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), dt = performance.now() - down[2]; down = null;
    if (moved > 6 || dt > 700 || locked || over) return;
    const h = toNDC(e); if (!h) return; const code = h.object.userData.code, target = rounds[ri];
    if (code === target[0]) {
      locked = true; const pts = tries === 0 ? 2 : 1; score += pts; good(); flash(code, 0x1fe08a, 1800); meshes.forEach(m => { if (m.userData.code === code) m.userData.raise = 1.8; });
      msg.textContent = `Correct! ${target[1]} — capital ${target[2]} (+${pts})`; msg.className = "hud-msg ok"; label(code, target[1]); later(() => { meshes.forEach(m => m.userData.raise = 0); next(); }, 2000);
    } else {
      tries++; bad(); flash(code, 0xff3b5c, 700); const nm = playable.get(code)[1];
      if (tries >= 2) { locked = true; msg.textContent = `That's ${nm}. The answer was ${target[1]}.`; msg.className = "hud-msg no"; flash(target[0], 0x1fe08a, 2000); label(target[0], target[1]); later(next, 2300); }
      else { msg.textContent = `That's ${nm}. Try again!`; msg.className = "hud-msg no"; }
    }
  });

  st.onFrame((dt, t) => {
    ctl.update();
    for (const m of meshes) {
      const u = m.userData; let em = 0x000000, k = 0;
      if (u.flash > 0) { u.flash -= dt; em = u.flashCol; k = .9; } else if (u.code === hov && !locked) { em = 0x6a7aff; k = .55; }
      m.material.emissive.setHex(em); m.material.emissiveIntensity = k;
      m.scale.z = damp(m.scale.z, 1 + u.raise, 8, dt);
    }
  });

  return { _t: { target: () => rounds[ri][0], screen: code => { const v = ctrs[code].clone().project(camera), r = st.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, state: () => ({ ri, score, over }) }, dispose() { timers.forEach(clearTimeout); hud.remove(); intro.remove(); host.querySelectorAll(".overlay").forEach(o => o.remove()); ctl.dispose(); st.dispose(); } };
}
