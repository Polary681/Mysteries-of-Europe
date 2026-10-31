// THE HOIA BACIU FOREST - first-person night walk. Story rules: story.js, terrain & set pieces: world.js.
// Same building blocks as the Skye adventure (stage, shell, input, audio bus, dialogue UI), a different mechanic:
// raise the lantern (hold L) to see the pale motes that mark the traces, and watch your watch fall behind.
import { Color, HemisphereLight, DirectionalLight, PointLight, Vector3, Group, Mesh, CylinderGeometry, MeshStandardMaterial } from "three";
import { createStage } from "../../engine.js";
import { AudioBus } from "../../shared/audio.js";
import { createInput } from "../../shared/input.js";
import { createShell } from "../../shared/ui.js";
import { sceneSVG } from "../../ui/art.js";
import { load, save, clear, loadObj } from "../../shared/save.js";
import { el } from "../../common.js";
import { Colliders, makeSky, glowSprite, lerp } from "../../shared/world.js";
import { Dialogue, clamp, restoreState, validPos } from "../../narrative/core.js";
import { createDialogueUI } from "../../narrative/dialogue-ui.js";
import * as ST from "./story.js";
import { buildForest, H, SITES, CLEAR_R, WORLD_R } from "./world.js";

const OBJ = { sign: [SITES.sign, 3.0], t1: [SITES.t1, 3.6], t2: [SITES.t2, 3.4], t3: [SITES.t3, 3.4], t4: [SITES.t4, 3.4], t5: [SITES.t5, 4.2], circle: [SITES.clearing, CLEAR_R - 2], leave: [SITES.leave, 4.2] };
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const wait = ms => new Promise(r => setTimeout(r, ms));
const C0 = { fog: new Color(0x10121c), top: new Color(0x070914), mid: new Color(0x141626), bot: new Color(0x262436) }, C1 = { fog: new Color(0x0c0b16), top: new Color(0x05040c), mid: new Color(0x120f22), bot: new Color(0x2a2140) };

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "The Hoia Baciu Forest", kicker: "Legend · Cluj-Napoca, Romania · reported folklore", accent: "#a08ac0", accent2: "#cfc3ea", art: sceneSVG("hoia"), journal: true,
    tagline: "A real forest at the edge of a real city, and every story people tell about it.",
    note: "Hoia Baciu is a real forest near Cluj-Napoca. The lights, the cold, the shepherd and the girl who came back are folklore and reported experiences, not proven facts; everything that happens to you here is invented. The codex (J) always says which is which.",
    controls: [["W A S D", "walk"], ["Shift", "run"], ["Mouse / drag", "look"], ["E / Space", "interact"], ["L (hold)", "raise the lantern"], ["J", "journal"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, W = null, sky = null, D = null, S = null, hud = null, journalEl = null;
  let running = false, paused = false, busy = false, talking = false, journalOpen = false, disposed = false, endingStarted = false, raising = false, degraded = false;
  const P = { x: 0, z: 72, y: 0, yaw: 0, pitch: 0, bob: 0 };
  let hemi, moon, lantern, raiseK = 0, stepT = 0, saveTimer = 0, lastPrompt = "", emaDt = 0.016, lowFrames = 0, look = 0, lightsK = 0, coldK = 0, watchTxt = "";
  const col = new Colliders();

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && !s.s.ending ? s : null; };
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    shell.title({ hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${Object.keys(endingsFound()).length} / 4</p>`, onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); } });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume(); shell.loading(0, "Walking out of the city…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0x10121c, fog: 0.03, fov: 70, far: 150, maxPR: 1.5 });   // the fog hides everything beyond ~100 m: a short far plane skips those trees
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: true, lookSpeed: 0.0034 });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(0.34); stage.scene.add(sky.mesh);
      hemi = new HemisphereLight(0x8a8cc0, 0x2a2a24, 0.75); moon = new DirectionalLight(0xb4c0f0, 0.55); moon.position.set(30, 60, -20); stage.scene.add(hemi, moon, stage.camera);
      lantern = new PointLight(0xffc27a, 3.4, 22, 1.4); lantern.position.set(0.25, -0.2, -0.2); stage.camera.add(lantern);
      { const lg = new Group(), body = new Mesh(new CylinderGeometry(0.014, 0.018, 0.05, 6), new MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 1.2 })), gl = glowSprite("255,190,100", 0.16); lg.add(body, gl); lg.position.set(0.3, -0.3, -0.52); stage.camera.add(lg); stage.lanternRig = lg; }
      wireInput(); W = buildForest(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.8, m)); await frame();
      stage.onFrame(tick);
    }
    shell.loading(0.95, "Lighting the lantern…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false;
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i));
    if (saved && validPos(saved.pos)) { P.x = saved.pos[0]; P.z = saved.pos[1]; P.yaw = saved.pos[2] || 0; } else { P.x = 0.6; P.z = 71; P.yaw = 0; }
    P.pitch = 0; P.y = H(P.x, P.z); syncWorld(); updateHud();
    shell.close(); shell.setRunning(true); shell.objective(ST.objective(S)); running = true; input.enabled = true; hudShow(true); updateHud();
    audio.stopAllLayers(); startAmbience(); await shell.fade(false, 1000);
    if (!saved) shell.toast(input.touch ? "Hold the lantern button to see what the forest hides. Drag on the right to look around." : "Hold L to raise the lantern. Click the scene to look around with the mouse.", "clue"); else shell.toast("Progress restored.");
  }

  function syncWorld() {
    for (const k of ST.TRACES) if (W.motes[k]) W.motes[k].visible = !S.trace[k];
    if (W.props.camera) W.props.camera.visible = !S.flags.camera; if (W.props.tally) W.props.tally.visible = !S.flags.tally; if (W.props.ribbon) W.props.ribbon.visible = !S.flags.ribbon;
    shell.objective(ST.objective(S));
  }
  function startAmbience() {
    if (!audio.ctx) return;
    audio.layer("wind", { kind: "pink", filter: "lowpass", freq: 700, gain: 0.05, lfoRate: 0.07, lfoDepth: 0.6 });
    audio.layer("hum", { kind: "brown", filter: "lowpass", freq: 160, gain: 0.05, lfoRate: 0.05, lfoDepth: 0.4 });
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    audio._amb.push(audio.every(() => { audio.burst({ dur: 0.05, freq: 1600 + Math.random() * 1600, q: 2, vol: 0.05 + 0.08 * coldK, kind: "white", pan: Math.random() * 2 - 1, wet: 0.5 }); }, 4000, 11000)); // twigs
    audio._amb.push(audio.every(() => { const p = Math.random() * 2 - 1; audio.tone({ freq: 380, dur: 0.35, type: "sine", vol: 0.02, slide: -40, pan: p, wet: 0.8 }); setTimeout(() => audio.tone({ freq: 330, dur: 0.6, type: "sine", vol: 0.018, slide: -30, pan: p, wet: 0.8 }), 420); }, 12000, 26000)); // owl
    audio._amb.push(audio.every(() => { if (S && S.trace.t3) audio.bell(1180 + Math.random() * 60, 0.012, Math.random() * 2 - 1); }, 9000, 20000)); // a sheep bell, very far, once you know the story
  }

  /* ---------------- input ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" }); input.addButton("listen", "🏮", { hold: true, cls: "listen" });
    input.on((a, x) => {
      if (!running || disposed) return;
      if (a === "pause") return togglePause();
      if (a === "mute") return toggleSound();
      if (paused) return;
      if (a === "listen") { raising = !!x; return; }
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (!busy) tryInteract(); }
      if (a === "num" && talking && !busy) dlg.pickNum(x);
    });
    shell.bind({ pause: () => togglePause(), sound: () => toggleSound(), journal: () => { if (running && !paused) toggleJournal(); } });
    host.addEventListener("pointerdown", () => audio.resume());
  }
  const toggleSound = () => { audio.setMuted(!audio.muted); shell.setSoundIcon(!audio.muted); };
  function togglePause() {
    if (!running) return;
    if (journalOpen) return toggleJournal();
    if (paused) { shell.resume(); paused = false; audio.duck(1); return; }
    input.releaseLock(); paused = true; audio.duck(0.25);
    shell.pauseMenu({ onResume: () => { paused = false; audio.duck(1); }, onRestart: () => { paused = false; audio.duck(1); clear(ST.SAVE_KEY); shell.fade(true, 300).then(() => begin(null)); }, onExit: () => { persist(); dispose(); onExit(); }, onSound: toggleSound, soundOn: () => !audio.muted });
  }

  /* ---------------- HUD & journal ---------------- */
  function hudShow(v) {
    if (!hud) {
      const ui = host.querySelector(".adv-ui");
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="echoes" title="Traces found"></div><div class="watch" title="Your watch"></div>`; host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = "<kbd>E</kbd><span></span>"; ui.append(pr); hud.prompt = pr; pr.addEventListener("pointerdown", e => { e.preventDefault(); if (!busy && !talking && running && !paused) tryInteract(); });
      const cr = el("div", "crosshair"); ui.append(cr); hud.cross = cr;
      const lb = el("div", "listen-bar"); lb.innerHTML = "<span>lantern raised</span><i><u></u></i>"; ui.append(lb); hud.lbar = lb;
    }
    hud.style.display = v ? "" : "none"; hud.cross.style.display = v ? "" : "none"; if (!v) hud.prompt.hidden = true;
  }
  function updateHud() { if (!hud || !S) return; hud.querySelector(".echoes").innerHTML = ST.TRACES.map(k => `<b class="${S.trace[k] ? "on" : ""}">✦</b>`).join(""); updateWatch(true); }
  function updateWatch(force) { const t = ST.watchTime(S); if (!force && t === watchTxt) return; watchTxt = t; const w = hud && hud.querySelector(".watch"); if (w) w.textContent = "⌚ " + t; }
  function toggleJournal() {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking; audio.duck(1); return; }
    input.releaseLock(); journalOpen = true; input.enabled = false; audio.duck(0.5); renderJournal("journal");
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove(); journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["journal", "Journal"], ["codex", "Codex"], ["help", "How to play"]]; let body = "";
    if (tab === "journal") { const cl = Object.keys(S.clues), items = [S.flags.camera && "an old camera, one frame left", S.flags.tally && "a notched hazel stick", S.flags.ribbon && "a red ribbon"].filter(Boolean); body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p><p class="mut">Your watch says ${ST.watchTime(S)}.${items.length ? " You carry " + items.join(", ") + "." : ""}</p><h4>What you have found <small>${cl.length}</small></h4>` + (cl.length ? `<ul>${cl.map(c => `<li>${ST.CLUE_TEXT[c] || c}</li>`).join("")}</ul>` : "<p class=mut>Nothing yet. Hold L to raise the lantern, and follow the pale lights.</p>"); }
    else if (tab === "codex") { const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]); body = `<p class="mut">What is real, what is told, and what is invented. ${got.length} / ${ids.length} entries found.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${c.kind === "historical" ? "Historical" : c.kind === "invented" ? "Invented for this game" : c.kind === "folklore" ? "Folklore" : "Reported / uncertain"}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join(""); }
    else body = `<ul><li><b>Raise the lantern</b>: hold <kbd>L</kbd> (or the lantern button). The pale motes that mark the traces glow, and a bar at the top shows which way to turn.</li><li><b>Find the traces</b>: the twisted grove, the tripod, the sheep track, the ribbon and the cold spot. What you pick up changes what you can do in the clearing.</li><li><b>The round clearing</b> in the middle of the forest lets you in once you have found three traces.</li><li><b>You can leave</b> by the trail you came in on, at any time.</li></ul>`;
    journalEl.innerHTML = `<div class="adv-card jr"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else renderJournal(b.dataset.t); });
    host.querySelector(".adv-ui").append(journalEl);
  }

  /* ---------------- interaction ---------------- */
  const fwd = () => ({ x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) });
  function candidates() {
    const out = [], f = fwd();
    for (const id in OBJ) {
      if (!ST.objectAvailable(id, S)) continue;
      const [[x, z], r] = OBJ[id], dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > r) continue; const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (id !== "circle" && dot < 0.1 && d > 1.6) continue; out.push({ id, d, score: id === "circle" ? 50 : d - dot * 1.5, node: ST.objectNode(id, S) });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  function tryInteract() { const c = candidates()[0]; if (!c) return false; converse(c.node); return true; }
  function updatePrompt() {
    const c = running && !talking && !busy && !paused && !journalOpen ? candidates()[0] : null; const txt = c ? ST.labelFor(c.id, S) : ""; if (txt === lastPrompt) return; lastPrompt = txt;
    hud.prompt.hidden = !c; hud.prompt.querySelector("span").textContent = txt; input.buttons.interact && input.buttons.interact.classList.toggle("ready", !!c);
  }

  /* ---------------- conversation flow ---------------- */
  async function converse(nodeId) { if (busy || talking) return; talking = true; input.enabled = false; input.releaseLock(); hud.prompt.hidden = true; lastPrompt = ""; try { await present(D.start(nodeId)); } catch (e) { console.error(e); endTalk(); } }
  async function step(kind, i) { if (busy || !talking) return; try { await present(kind === "choose" ? D.choose(i) : D.advance()); } catch (e) { console.error(e); endTalk(); } }
  async function present(v) {
    busy = true;
    try {
      const ev = D.drainEvents(), hasToast = ev.some(e => e.t === "toast");
      for (const e of ev) { if (e.t === "event") { if (e.id === "trace") onTrace(e.n); } else handleEvent(e, hasToast); }
      if (S.ending && !endingStarted) { await playEnding(); return; }
      if (!v) { endTalk(); return; }
      dlg.show(v, ST.WHO[v.who] || ST.WHO.narr, { pitch: 0 });
    } finally { busy = false; }
  }
  function endTalk() { dlg.hide(); talking = false; input.enabled = !journalOpen; syncWorld(); updateHud(); persist(); }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "item": shell.toast("Picked up: " + ({ camera: "Old film camera", tally: "Notched hazel stick", ribbon: "Red ribbon" }[e.id] || e.id), "item"); break;
      case "clue": if (!hasToast) shell.toast("New entry in your journal (J).", "clue"); break;
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
    }
  }
  function onTrace() {
    updateHud(); syncWorld(); audio.good();
    setTimeout(() => { audio.tone({ freq: 196, dur: 2.4, type: "sine", vol: 0.04, slide: -12, wet: 0.9 }); audio.tone({ freq: 233, dur: 2.4, type: "sine", vol: 0.03, slide: -14, wet: 0.9 }); }, 500); // the watch "skips": a low, unsettled chord
    if (ST.count(S) === 3) setTimeout(() => shell.toast("Somewhere ahead, the round clearing is waiting.", "clue"), 2600);
  }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    endingStarted = true; dlg.hide(); talking = true; input.enabled = false; hudShow(false);
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id], found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    if (id === "time") { audio.tone({ freq: 110, dur: 5, type: "sine", vol: 0.07, wet: 0.95 }); audio.tone({ freq: 116.5, dur: 5, type: "sine", vol: 0.05, wet: 0.95 }); }
    else if (id === "lights") { lightsK = 1; audio.burst({ dur: 0.06, freq: 2400, q: 1.2, vol: 0.18, kind: "white" }); setTimeout(() => audio.tone({ freq: 880, dur: 3, type: "sine", vol: 0.03, wet: 0.95 }), 300); }
    else if (id === "shepherd") { [0, 900, 1900].forEach((d, i) => setTimeout(() => audio.bell(1150 + i * 30, 0.04 - i * 0.01, i - 1), d)); }
    await wait(3200); await shell.fade(true, 1400);
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 4, cls: E.cls, adv: "hoia", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }
  function persist() { if (!S || S.ending || endingStarted) return; if (!ST.count(S) && !Object.keys(S.flags).length) return; save(ST.SAVE_KEY, { v: 1, s: S, pos: [P.x, P.z, P.yaw] }); }

  /* ---------------- main loop ---------------- */
  const inWorld = (x, z) => Math.hypot(x, z) < WORLD_R && z < 78;
  function tick(dt, t) {
    if (!running || disposed || paused) return;
    emaDt += (dt - emaDt) * 0.05; if (!degraded && emaDt > 0.045) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); W.detail.forEach(m => { m.visible = false; }); stage.camera.far = 105; stage.camera.updateProjectionMatrix(); } }   // slow machine: drop the canopy clumps and the brambles, see less far into the fog else lowFrames = Math.max(0, lowFrames - 1);
    dlg.tick(dt);
    const cam = stage.camera, n = ST.count(S);
    if (!talking && !busy && !journalOpen && input.enabled) {
      const lk = input.takeLook(); P.yaw -= lk.dx; P.pitch = clamp(P.pitch - lk.dy, -1.25, 1.25); P.yaw -= input.turn() * dt * 1.8;
      const mv = input.move(), sp = input.running() ? 4.0 : 2.4, f = fwd(), r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
      let vx = f.x * mv.y + r.x * mv.x, vz = f.z * mv.y + r.z * mv.x; const m = Math.hypot(vx, vz);
      if (m > 0.05) {
        vx /= Math.max(1, m); vz /= Math.max(1, m); const nx = P.x + vx * sp * dt, nz = P.z + vz * sp * dt;
        if (inWorld(nx, nz)) { P.x = nx; P.z = nz; } else if (inWorld(nx, P.z)) P.x = nx; else if (inWorld(P.x, nz)) P.z = nz;
        P.bob += dt * sp * 2.2; stepT -= dt * sp; if (stepT < 0) { stepT = 1.8; audio.step(Math.hypot(P.x - SITES.clearing[0], P.z - SITES.clearing[1]) < CLEAR_R ? "grass" : "sand", 0.035); }
      }
      const q = { x: P.x, z: P.z }; col.resolve(q, 0.35); P.x = q.x; P.z = q.z;
    }
    S.mins = (S.mins || 0) + dt / 4; updateWatch();
    raiseK += ((raising && !talking ? 1 : 0) - raiseK) * Math.min(1, dt * 4);
    // look: the forest darkens and the fog thickens with every trace (the "deeper in" feeling); a cold blue tint at the cold spot
    const dc = Math.hypot(P.x - SITES.clearing[0], P.z - SITES.clearing[1]), d5 = Math.hypot(P.x - SITES.t5[0], P.z - SITES.t5[1]);
    look += (n / 5 - look) * Math.min(1, dt * 0.5); coldK += (clamp(1 - (d5 - 3) / 8, 0, 1) - coldK) * Math.min(1, dt * 1.5);
    const fog = C0.fog.clone().lerp(C1.fog, look).lerp(new Color(0x1a2232), coldK * 0.6);
    stage.scene.fog.color.copy(fog); stage.scene.background.copy(fog); stage.scene.fog.density = (0.028 + 0.012 * look + 0.01 * coldK - (dc < CLEAR_R ? 0.008 : 0)) * (degraded ? 1.2 : 1);
    sky.set({ top: C0.top.clone().lerp(C1.top, look), mid: C0.mid.clone().lerp(C1.mid, look), bot: C0.bot.clone().lerp(C1.bot, look), stars: dc < CLEAR_R + 4 ? 0.7 : 0.25, sun: 0, sunDir: new Vector3(0.3, 0.6, -0.4), sunCol: 0x9ab4e8 }); sky.follow(cam);
    hemi.intensity = 0.7 - 0.2 * look + (dc < CLEAR_R ? 0.15 : 0); moon.intensity = 0.5 + (dc < CLEAR_R ? 0.3 : 0);
    // camera
    P.y = lerp(P.y, H(P.x, P.z), Math.min(1, dt * 12)); const bob = Math.sin(P.bob) * 0.035;
    cam.position.set(P.x, P.y + 1.62 + bob, P.z); cam.rotation.order = "YXZ"; cam.rotation.set(P.pitch, P.yaw, 0);
    lantern.intensity = 3.0 + raiseK * 1.6 + Math.sin(t * 9) * 0.15 + Math.random() * 0.12 - coldK * 0.8 * Math.random(); lantern.distance = 22 + raiseK * 8; stage.lanternRig.position.y = -0.3 + raiseK * 0.16;
    // motes at the traces, and the lights over the clearing once it is open
    for (const k in W.motes) { const m = W.motes[k]; if (!m.visible) continue; const d = Math.hypot(m.position.x - P.x, m.position.z - P.z), want = raiseK * 0.9 + (d < 16 ? 0.28 * (1 - d / 16) : 0); m.material.opacity += (want - m.material.opacity) * Math.min(1, dt * 5); m.scale.setScalar(2 + Math.sin(t * 2.2 + k.charCodeAt(1)) * 0.35); m.position.y = H(m.position.x, m.position.z) + 1.4 + Math.sin(t * 0.9 + k.charCodeAt(1)) * 0.25; }
    const wantLights = n >= 3 ? clamp(1 - (dc - CLEAR_R) / 40, 0.15, 1) : 0; lightsK += (Math.max(wantLights, endingStarted && S.ending === "lights" ? 1 : 0) - lightsK) * Math.min(1, dt * 0.8);
    W.skyLights.forEach((s, i) => { const u = s.userData, a = u.a + t * u.sp; s.position.set(SITES.clearing[0] + Math.cos(a) * u.r, H(SITES.clearing[0], SITES.clearing[1]) + u.h + Math.sin(t * 0.7 + i) * 1.2, SITES.clearing[1] + Math.sin(a) * u.r); s.material.opacity = lightsK * (0.45 + 0.25 * Math.sin(t * 1.7 + i * 2)); });
    W.clearRing.material.opacity = 0.03 + (n >= 3 ? 0.1 : 0) * (0.6 + 0.4 * Math.sin(t * 1.2)) + raiseK * 0.06;
    if (W.coldMist) W.coldMist.material.opacity = 0.1 + 0.08 * Math.sin(t * 0.8) + coldK * 0.08;
    audio.setLayer("wind", 0.05 * (1 - 0.6 * raiseK) * (dc < CLEAR_R ? 0.25 : 1), 0.6); audio.setLayer("hum", 0.04 + 0.05 * look + 0.05 * coldK, 0.8);
    view.style.filter = coldK > 0.05 ? `saturate(${1 - 0.5 * coldK}) hue-rotate(${-12 * coldK}deg)` : "";
    // the lantern bar: direction to the nearest unfound trace, or the clearing
    { const target = lanternTarget(); if (target && raiseK > 0.05) { let a = Math.atan2(-(target[0] - P.x), -(target[1] - P.z)) - P.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); hud.lbar.style.opacity = raiseK; hud.lbar.querySelector("u").style.left = 50 + clamp(a / 1.6, -1, 1) * 46 + "%"; hud.lbar.classList.toggle("ahead", Math.abs(a) < 0.25); } else hud.lbar.style.opacity = 0; }
    updatePrompt();
    saveTimer += dt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }
  function lanternTarget() {
    let best = null, bd = 1e9; for (const k of ST.TRACES) if (!S.trace[k]) { const [x, z] = W.sources[k], d = Math.hypot(x - P.x, z - P.z); if (d < bd) { bd = d; best = [x, z]; } }
    return ST.count(S) >= 3 && (!best || ST.hasAll(S)) ? SITES.clearing : best;
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); }; addEventListener("pagehide", onHide);
  function dispose() { if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide); try { persist(); } catch (e) { /* ignore */ } try { view.style.filter = ""; stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ } host.innerHTML = ""; }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get raiseK() { return raiseK; }, get degraded() { return degraded; }, get lightsK() { return lightsK; },
      tp: (x, z) => { P.x = x; P.z = z; P.y = H(x, z); }, pos: () => [P.x, P.z, P.yaw], H, near: () => candidates().map(c => c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), skip: () => dlg.skip(), dlgVisible: () => dlg.visible,
      look: (yaw, pitch) => { P.yaw = yaw; P.pitch = pitch || 0; }, raise: v => { raising = !!v; }, toggleJournal, persist, ending: () => S && S.ending, endingsFound, patch: p => { Object.assign(S, p); syncWorld(); updateHud(); },
      jump: async id => { while (busy) await wait(50); talking = true; input.enabled = false; return present(D.start(id)); }, stage: () => stage, sites: SITES,
    },
  };
}
