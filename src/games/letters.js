// GAME 2 - Spell the Spirit (replaces "Word scramble"): click the floating rune cubes in the right order.
import {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, TorusGeometry, RingGeometry,
  AmbientLight, PointLight, Raycaster, Vector2, Vector3, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute,
} from "three";
import { createStage } from "../engine.js";
import { el, shuffle, rand, damp, textTexture, good, bad, pick } from "../common.js";

export function start(host, ctx) {
  const st = createStage(host, { bg: 0x080616, fog: 0.018, fogColor: 0x080616, fov: 45 });
  if (!st) return { dispose() {} };
  const { scene, camera } = st;
  scene.add(new AmbientLight(0x6a5ad0, 1.4));
  const key = new PointLight(0x8a6bb0, 220, 60, 1.6); key.position.set(0, 7, 9); scene.add(key);
  const rim = new PointLight(0xb4c9a8, 90, 40, 1.8); rim.position.set(-9, 2, 4); scene.add(rim);

  // altar disc + rotating rings
  const altar = new Group(); scene.add(altar);
  const disc = new Mesh(new CylinderGeometry(9.5, 10.5, .7, 48), new MeshStandardMaterial({ color: 0x15122e, roughness: .9, metalness: .2 })); disc.position.y = -3.6; altar.add(disc);
  const ringA = new Mesh(new TorusGeometry(8.4, .06, 8, 96), new MeshBasicMaterial({ color: 0x8a6bb0 })); ringA.rotation.x = Math.PI / 2; ringA.position.y = -3.2; altar.add(ringA);
  const ringB = new Mesh(new TorusGeometry(6.2, .05, 8, 96), new MeshBasicMaterial({ color: 0xb4c9a8 })); ringB.rotation.x = Math.PI / 2; ringB.position.y = -3.2; altar.add(ringB);
  // dust
  const dp = []; for (let i = 0; i < 220; i++) dp.push(rand(-14, 14), rand(-4, 9), rand(-10, 6));
  const dg = new BufferGeometry(); dg.setAttribute("position", new Float32BufferAttribute(dp, 3));
  const dust = new Points(dg, new PointsMaterial({ color: 0xb9a8ff, size: .08, transparent: true, opacity: .7 })); scene.add(dust);

  /* ----- state ----- */
  let word, hint, cubes, slots, free, done = false, solved = 0, score = 0, aspect = 1.6;
  const raycaster = new Raycaster(), ptr = new Vector2();
  const hud = el("div", "hud3d"), top = el("div", "hud-top"), stats = el("span", "hud-stats"), qEl = el("p", "hud-q"), msg = el("p", "hud-msg");
  const bar = el("div", "hud-bar"); const bReset = el("button", "ghost", "Reset"), bNew = el("button", "ghost", "New word"), bHint = el("button", "ghost", "Hint");
  bar.append(bReset, bHint, bNew); top.append(stats); hud.append(top, qEl, msg, bar); host.append(hud);

  const faceMat = new Map();
  const mat = ch => { if (!faceMat.has(ch)) faceMat.set(ch, new MeshStandardMaterial({ map: textTexture(ch, { w: 256, h: 256, size: 190, color: "#f3eaff", bg: "#2b1f66", border: "#8a6bb0", pad: 10 }), roughness: .45, metalness: .25, emissive: 0x2a1b66, emissiveIntensity: .6 })); return faceMat.get(ch); };

  function newWord() {
    cleanup();
    const pickW = ctx.WORDS[Math.random() * ctx.WORDS.length | 0]; word = pickW[0]; hint = pickW[1];
    let mix; do { mix = shuffle(word.split("")); } while (mix.join("") === word && word.length > 1);
    cubes = mix.map((ch, i) => { const m = new Mesh(new BoxGeometry(1, 1, 1), mat(ch)); m.userData = { ch, i, slot: -1, spin: rand(-.6, .6), ph: rand(0, 6.28) }; scene.add(m); return m; });
    slots = new Array(word.length).fill(null);
    done = false; msg.textContent = ""; msg.className = "hud-msg"; qEl.textContent = "Spell the spirit: " + hint + " (" + word.length + " letters)";
    stats.innerHTML = `Solved <b>${solved}</b> · Points <b>${score}</b>`;
    layout(true);
  }
  function cleanup() { if (cubes) cubes.forEach(c => { scene.remove(c); c.geometry.dispose(); }); if (slotMarks) slotMarks.forEach(s => { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }); slotMarks = []; }
  let slotMarks = [];

  // slot positions + floating pool positions; rows adapt to the screen shape, camera distance fits everything
  let slotPos = [], poolPos = [];
  const STEP = 1.3, T = Math.tan(22.5 * Math.PI / 180);
  function layout(snap) {
    const n = word.length; let best = null;
    for (let rows = 1; rows <= 4; rows++) {
      const per = Math.ceil(n / rows), wNeed = per * STEP + 1.2, hNeed = 5.6 + rows * 2 * STEP;
      const dist = Math.max(hNeed / 2 / T, wNeed / 2 / T / aspect);
      if (!best || dist < best.dist - 0.01) best = { rows, per, dist };
    }
    const { rows, per, dist } = best; slotPos = []; poolPos = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / per), c = i % per, cnt = r === rows - 1 ? n - per * r : per, x = (c - (cnt - 1) / 2) * STEP;
      slotPos.push(new Vector3(x, -1.3 - r * STEP, 0));
      poolPos.push(new Vector3(x * 1.02, .9 + r * STEP * 1.1 + Math.sin(i * 2.1) * .22, Math.cos(i * 1.7) * .6));
    }
    slotMarks.forEach(s => { scene.remove(s); s.geometry.dispose(); s.material.dispose(); }); slotMarks = [];
    slotPos.forEach(p => { const s = new Mesh(new RingGeometry(.5, .58, 32), new MeshBasicMaterial({ color: 0xb4c9a8, transparent: true, opacity: .75 })); s.position.set(p.x, p.y, -.6); scene.add(s); slotMarks.push(s); });
    cubes.forEach((c, i) => { c.userData.s = 1; if (snap) { c.position.copy(poolPos[i]); c.position.z -= 6; c.scale.setScalar(.01); } });
    altar.position.y = -1.3 - (rows - 1) * STEP - .9 + 3.2;
    baseZ = dist; lookY = ((.9 + (rows - 1) * STEP * 1.1 + .3) + (-1.3 - (rows - 1) * STEP - .5)) / 2; camY = lookY + 1.1;
  }
  let baseZ = 16, camY = 1, lookY = 0;
  st.onResize((w, h) => { aspect = w / h; if (word) layout(false); });

  function target(c) { const u = c.userData; return u.slot >= 0 ? slotPos[u.slot] : poolPos[u.i]; }
  function place(c) {
    const u = c.userData;
    if (u.slot >= 0) { slots[u.slot] = null; u.slot = -1; pick(); }
    else { const i = slots.indexOf(null); if (i < 0) return; slots[i] = c; u.slot = i; pick(); }
    if (!slots.includes(null)) check(); else { msg.textContent = ""; msg.className = "hud-msg"; }
  }
  function check() {
    const guess = slots.map(c => c.userData.ch).join("");
    if (guess === word) {
      done = true; solved++; score += 10; good(); msg.textContent = "Perfect! The word was " + word + " ✔"; msg.className = "hud-msg ok"; stats.innerHTML = `Solved <b>${solved}</b> · Points <b>${score}</b>`;
      cubes.forEach((c, i) => { c.material = c.material.clone(); c.material.emissive.setHex(0x1fbf7d); c.material.emissiveIntensity = 1; c.userData.jump = performance.now() + i * 70; });
    } else { bad(); msg.textContent = "Not quite — press Reset or click a rune to swap it."; msg.className = "hud-msg no"; cubes.forEach(c => { c.userData.shake = 1; }); }
  }
  bReset.onclick = () => { if (!cubes) return; cubes.forEach(c => c.userData.slot = -1); slots.fill(null); done = false; msg.textContent = ""; msg.className = "hud-msg"; };
  bNew.onclick = newWord;
  bHint.onclick = () => { if (done) return; // place the next correct letter
    const need = slots.findIndex((c, i) => !c || c.userData.ch !== word[i]); if (need < 0) return;
    const okPlaced = c => c.userData.slot >= 0 && word[c.userData.slot] === c.userData.ch;
    const cand = cubes.find(c => c.userData.ch === word[need] && !okPlaced(c));
    if (!cand) return; const other = slots[need]; if (other) { other.userData.slot = -1; slots[need] = null; }
    if (cand.userData.slot >= 0) slots[cand.userData.slot] = null; cand.userData.slot = need; slots[need] = cand; score = Math.max(0, score - 2); stats.innerHTML = `Solved <b>${solved}</b> · Points <b>${score}</b>`; pick();
    if (!slots.includes(null)) check(); };

  // picking
  let down = null;
  st.canvas.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
  st.canvas.addEventListener("pointerup", e => {
    if (!down || done) { down = null; return; } down = null;
    const r = st.canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ptr, camera); const hit = raycaster.intersectObjects(cubes, false)[0]; if (hit) place(hit.object);
  });
  let hov = null; const mx = { x: 0, y: 0 };
  st.canvas.addEventListener("pointermove", e => {
    const r = st.canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); mx.x = ptr.x; mx.y = ptr.y;
    raycaster.setFromCamera(ptr, camera); const h = cubes && raycaster.intersectObjects(cubes, false)[0]; hov = h ? h.object : null; st.canvas.style.cursor = hov ? "pointer" : "default";
  });

  st.onFrame((dt, t) => {
    ringA.rotation.z += dt * .15; ringB.rotation.z -= dt * .25; dust.rotation.y += dt * .02;
    camera.position.x = damp(camera.position.x, mx.x * 1.2, 3, dt); camera.position.y = damp(camera.position.y, camY + mx.y * .6, 3, dt); camera.position.z = damp(camera.position.z, baseZ, 4, dt); camera.lookAt(0, lookY, 0);
    if (!cubes) return;
    cubes.forEach(c => {
      const u = c.userData, p = target(c); let y = p.y; const inSlot = u.slot >= 0;
      if (!inSlot) y += Math.sin(t * 1.3 + u.ph) * .18;
      if (u.jump && performance.now() > u.jump) y += Math.abs(Math.sin((performance.now() - u.jump) / 260)) * .5;
      const sx = u.shake ? (Math.sin(t * 60) * .12 * u.shake) : 0; if (u.shake) u.shake = Math.max(0, u.shake - dt * 2.5);
      c.position.x = damp(c.position.x, p.x + sx, 9, dt); c.position.y = damp(c.position.y, y, 9, dt); c.position.z = damp(c.position.z, p.z, 7, dt);
      const s = u.s * (c === hov ? 1.12 : 1); c.scale.setScalar(damp(c.scale.x, s, 9, dt));
      c.rotation.y = damp(c.rotation.y, inSlot ? 0 : Math.sin(t * .8 + u.ph) * .5 + u.spin * .3, 6, dt); c.rotation.x = damp(c.rotation.x, inSlot ? 0 : Math.sin(t * .6 + u.ph) * .25, 6, dt);
    });
  });

  // wait for the web font so the runes render with Cinzel
  (document.fonts && document.fonts.load ? document.fonts.load("700 80px Cinzel") : Promise.resolve()).finally(() => { if (!st.canvas.isConnected) return; word = "x"; cubes = []; slotMarks = []; newWord(); });
  return { dispose() { hud.remove(); st.dispose(); }, _t: { state: () => ({ word, solved, score, done }) } };
}
