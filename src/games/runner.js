// GAME 1 - Legend Runner (replaces "Guess the legend"): steer the ghost through the gate with the right answer.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, SphereGeometry,
  LatheGeometry, Vector2, InstancedMesh, Object3D, PointLight, AmbientLight, HemisphereLight, DirectionalLight, Points, PointsMaterial,
  BufferGeometry, Float32BufferAttribute, AdditiveBlending, DoubleSide,
} from "three";
import { createStage } from "../engine.js";
import { el, shuffle, rand, clamp, damp, textTexture, good, bad, pick, inView } from "../common.js";

const LANE = 2.7, GAP = 62, SPEED0 = 11;
const COL = [0x8a6bb0, 0xb4c9a8, 0xd6c07e];

export function start(host, ctx) {
  const st = createStage(host, { bg: 0x070a1c, fog: 0.026, fogColor: 0x070a1c, fov: 62 });
  if (!st) return { dispose() {} };
  const { scene, camera } = st;

  /* ----- data: shuffle questions and answers ----- */
  const Q = shuffle(ctx.QUIZ).map(q => { const right = q[1][q[2]], o = shuffle(q[1]); return { q: q[0], o, ok: o.indexOf(right) }; });
  const N = Q.length;

  /* ----- lights ----- */
  scene.add(new HemisphereLight(0x8a9bff, 0x1a0f33, 0.9));
  const moon = new DirectionalLight(0xbfd0ff, 1.1); moon.position.set(-8, 14, 6); scene.add(moon); scene.add(moon.target);
  scene.add(new AmbientLight(0x30206a, 0.8));

  /* ----- ground: long road with lane lines ----- */
  const LEN = GAP * (N + 2) + 80;
  const ground = new Mesh(new PlaneGeometry(120, LEN + 120), new MeshStandardMaterial({ color: 0x0b1030, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -LEN / 2 + 40); scene.add(ground);
  const road = new Mesh(new PlaneGeometry(LANE * 3 + 1.2, LEN + 120), new MeshStandardMaterial({ color: 0x1a1f4a, roughness: .8, emissive: 0x0a0c26 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -LEN / 2 + 40); scene.add(road);
  const lineMat = new MeshBasicMaterial({ color: 0x6b57d6 });
  for (const x of [-LANE / 2, LANE / 2, -LANE * 1.5 - .5, LANE * 1.5 + .5]) {
    const l = new Mesh(new PlaneGeometry(.12, LEN + 120), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, -LEN / 2 + 40); scene.add(l);
  }

  /* ----- spooky forest on both sides (instanced) ----- */
  const trunkG = new CylinderGeometry(.18, .32, 4, 6), crownG = new ConeGeometry(1.6, 5, 7);
  const COUNT = 260, trunks = new InstancedMesh(trunkG, new MeshStandardMaterial({ color: 0x1b1330, roughness: 1 }), COUNT);
  const crowns = new InstancedMesh(crownG, new MeshStandardMaterial({ color: 0x0f2a2a, roughness: 1 }), COUNT);
  const d = new Object3D();
  for (let i = 0; i < COUNT; i++) {
    const side = i % 2 ? 1 : -1, x = side * rand(8, 30), z = 30 - rand(0, LEN + 60), s = rand(.8, 1.7);
    d.position.set(x, 2 * s, z); d.scale.set(s, s, s); d.rotation.set(rand(-.08, .08), rand(0, 6), rand(-.08, .08)); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
    d.position.set(x, 5.6 * s, z); d.updateMatrix(); crowns.setMatrixAt(i, d.matrix);
  }
  scene.add(trunks, crowns);

  /* ----- sky: stars + moon follow the camera ----- */
  const sky = new Group(); scene.add(sky);
  const sp = []; for (let i = 0; i < 400; i++) { const a = rand(0, 6.28), h = rand(.15, 1), r = 160; sp.push(Math.cos(a) * r, h * 120 + 10, Math.sin(a) * r - 40); }
  const sg = new BufferGeometry(); sg.setAttribute("position", new Float32BufferAttribute(sp, 3));
  sky.add(new Points(sg, new PointsMaterial({ color: 0xcfd6ff, size: 1.3, sizeAttenuation: false, fog: false })));
  const moonM = new Mesh(new SphereGeometry(9, 24, 18), new MeshBasicMaterial({ color: 0xeef0ff, fog: false })); moonM.position.set(-40, 62, -150); sky.add(moonM);
  const halo = new Mesh(new SphereGeometry(15, 24, 18), new MeshBasicMaterial({ color: 0x8c9cff, transparent: true, opacity: .16, fog: false, blending: AdditiveBlending, depthWrite: false })); halo.position.copy(moonM.position); sky.add(halo);

  /* ----- the ghost ----- */
  const ghost = new Group();
  const prof2 = [new Vector2(0.001, 0), new Vector2(.55, .02), new Vector2(.5, .25), new Vector2(.58, .45), new Vector2(.62, .8), new Vector2(.55, 1.15), new Vector2(.38, 1.45), new Vector2(.12, 1.62), new Vector2(0.001, 1.66)];
  const body = new Mesh(new LatheGeometry(prof2, 20), new MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0x7c8cff, emissiveIntensity: .55, roughness: .5, transparent: true, opacity: .93 }));
  ghost.add(body);
  const eyeM = new MeshBasicMaterial({ color: 0x10142c });
  for (const x of [-.2, .2]) { const e = new Mesh(new SphereGeometry(.09, 10, 8), eyeM); e.position.set(x, 1.15, .5); e.scale.set(1, 1.5, .6); ghost.add(e); }
  const mouth = new Mesh(new SphereGeometry(.08, 10, 8), eyeM); mouth.position.set(0, .88, .55); mouth.scale.set(1, 1.2, .5); ghost.add(mouth);
  const glow = new PointLight(0x9fb4ff, 14, 14, 1.6); glow.position.set(0, 1.2, 1.4); ghost.add(glow);
  scene.add(ghost);

  /* ----- gates: one per question ----- */
  const gates = [];
  function makeGate(i) {
    const g = new Group(), z = -(i + 1) * GAP; g.position.z = z;
    const lanes = [];
    for (let l = 0; l < 3; l++) {
      const x = (l - 1) * LANE, col = COL[l], grp = new Group(); grp.position.x = x;
      const pil = new MeshStandardMaterial({ color: 0x2a2060, emissive: col, emissiveIntensity: .35, roughness: .6 });
      for (const px of [-1.15, 1.15]) { const p = new Mesh(new BoxGeometry(.3, 3.6, .3), pil); p.position.set(px, 1.8, 0); grp.add(p); }
      const lintel = new Mesh(new BoxGeometry(2.6, .3, .35), pil); lintel.position.y = 3.6; grp.add(lintel);
      const portal = new Mesh(new PlaneGeometry(2, 3.4), new MeshBasicMaterial({ color: col, transparent: true, opacity: .22, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
      portal.position.y = 1.75; grp.add(portal);
      const tex = textTexture(Q[i].o[l], { w: 768, h: 384, size: 72, color: "#fff", bg: "rgba(10,12,38,.82)", border: "#" + col.toString(16).padStart(6, "0") });
      const label = new Mesh(new PlaneGeometry(2.7, 1.35), new MeshBasicMaterial({ map: tex, transparent: true, fog: false })); label.position.set(0, 4.7, 0); grp.add(label);
      const lamp = new PointLight(col, 7, 9, 1.8); lamp.position.set(0, 2.2, 1); grp.add(lamp);
      g.add(grp); lanes.push({ grp, portal, pil });
    }
    scene.add(g); return { g, z, lanes, done: false };
  }
  for (let i = 0; i < N; i++) gates.push(makeGate(i));

  /* ----- HUD (HTML on top of the canvas) ----- */
  const hud = el("div", "hud3d");
  const top = el("div", "hud-top"), qEl = el("p", "hud-q"), chips = el("div", "hud-chips"), msg = el("p", "hud-msg"), stats = el("span", "hud-stats");
  top.append(stats); hud.append(top, qEl, chips, msg);
  const touch = el("div", "touchbar"); const bl = el("button", "", "◀"), br = el("button", "", "▶"); bl.setAttribute("aria-label", "Move left"); br.setAttribute("aria-label", "Move right"); touch.append(bl, br); hud.append(touch);
  host.append(hud);
  const COLN = ["#8a6bb0", "#b4c9a8", "#d6c07e"];

  /* ----- state ----- */
  let lane = 1, px = 0, z = 0, speed = SPEED0, score = 0, qi = 0, over = false, started = false, answered = false, t0 = 0, shake = 0;
  const showQ = () => {
    if (qi >= N) return; const q = Q[qi];
    qEl.textContent = q.q; chips.innerHTML = "";
    q.o.forEach((o, i) => { const c = el("span", "chip"); c.style.setProperty("--c", COLN[i]); c.textContent = ["◀ ", "▲ ", "▶ "][i] + o; chips.append(c); });
    stats.innerHTML = `Question <b>${qi + 1}/${N}</b> · Points <b>${score}</b>`;
  };
  const say = (t, ok) => { msg.textContent = t; msg.className = "hud-msg " + (ok == null ? "" : ok ? "ok" : "no"); };
  const intro = el("div", "overlay", `<h3>Legend Runner</h3><p>Run through the gate with the right answer.<br><b>← →</b> / <b>A D</b> to change lane · swipe or tap the arrows on a phone.</p><button class="ghost">Start</button>`);
  host.append(intro);
  intro.querySelector("button").onclick = () => { intro.remove(); started = true; showQ(); say("Go!"); pick(); };

  const move = d => { if (!started || over) return; lane = clamp(lane + d, 0, 2); pick(); };
  bl.onpointerdown = e => { e.preventDefault(); move(-1); }; br.onpointerdown = e => { e.preventDefault(); move(1); };
  const key = e => { if (!started || over || !inView(host)) return; if (["ArrowLeft", "a", "A"].includes(e.key)) { move(-1); e.preventDefault(); } if (["ArrowRight", "d", "D"].includes(e.key)) { move(1); e.preventDefault(); } };
  window.addEventListener("keydown", key);
  let sx = null;
  st.canvas.addEventListener("pointerdown", e => { sx = [e.clientX, e.clientY]; });
  st.canvas.addEventListener("pointerup", e => {
    if (!sx) return; const dx = e.clientX - sx[0]; sx = null;
    if (Math.abs(dx) > 28) move(dx > 0 ? 1 : -1); else { const r = st.canvas.getBoundingClientRect(); move(e.clientX - r.left < r.width / 2 ? -1 : 1); }
  });

  function finish() {
    over = true; const o = el("div", "overlay", `<h3>${score >= N - 1 ? "Mystery solved!" : "The legends fade…"}</h3><p>You scored <b>${score} / ${N}</b>.</p><button class="ghost">Play again</button>`);
    host.append(o); o.querySelector("button").onclick = () => { ctx.restart(); };
    chips.innerHTML = ""; qEl.textContent = ""; say("");
  }

  /* ----- main loop ----- */
  st.onFrame((dt, t) => {
    if (started && !over) { z -= speed * dt; speed = Math.min(SPEED0 + qi * 0.9, 16); }
    px = damp(px, (lane - 1) * LANE, 11, dt);
    ghost.position.set(px, .15 + Math.sin(t * 3) * .12, z); ghost.rotation.z = (px - (lane - 1) * LANE) * -.12; ghost.rotation.y = Math.sin(t * 2) * .12;
    body.material.emissiveIntensity = .5 + Math.sin(t * 4) * .12;
    shake = Math.max(0, shake - dt * 3);
    camera.position.set(px * .55 + (Math.random() - .5) * shake * .3, 3.6 + shake * .1, z + 8);
    camera.lookAt(px * .35, 1.5, z - 14);
    sky.position.set(camera.position.x, 0, camera.position.z);
    moon.position.set(px - 8, 14, z + 6); moon.target.position.set(px, 0, z);

    for (let i = 0; i < gates.length; i++) {
      const G = gates[i]; G.lanes.forEach((L, li) => { L.portal.material.opacity = (L.fixed ?? .2) + .06 * Math.sin(t * 4 + li); });
      if (!G.done && z < G.z && started) {
        G.done = true; answered = true; const q = Q[i]; const okLane = q.ok;
        const right = lane === okLane;
        G.lanes.forEach((L, li) => { const c = li === okLane ? 0xb4c9a8 : (li === lane ? 0xff3b5c : 0x3a3366); L.portal.material.color.setHex(c); L.portal.material.opacity = li === okLane || li === lane ? .6 : .08; L.fixed = L.portal.material.opacity; });
        if (right) { score++; good(); say("Correct! ✔", true); } else { bad(); shake = 1; say("Not quite — the answer was “" + q.o[okLane] + "”", false); }
        qi++; stats.innerHTML = `Question <b>${Math.min(qi + 1, N)}/${N}</b> · Points <b>${score}</b>`;
        if (qi >= N) setTimeout(finish, 1800); else setTimeout(() => { if (!over) { showQ(); } }, 1700);
      }
    }
    if (over) { z -= 0; }
  });

  return { _t: { ok: () => (Q[Math.min(qi, N - 1)].ok), lane: () => lane, state: () => ({ score, qi, over }) }, dispose() { window.removeEventListener("keydown", key); hud.remove(); intro.remove(); host.querySelectorAll(".overlay").forEach(o => o.remove()); st.dispose(); } };
}
