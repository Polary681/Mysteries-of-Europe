// BABA YAGA'S HUT - first-person fairy tale. Story rules: story.js, forest & yard: world.js, characters: models.js.
// The set pieces (the three horsemen, the hut that turns on its chicken legs, Baba Yaga flying in her mortar, the fence of
// skulls lighting up, the three pairs of hands, the flight over river and forest) are short cinematics driven by `tween`
// (game-time animations that pause with the game).
import { Color, HemisphereLight, DirectionalLight, Vector3, Group, Mesh, PlaneGeometry, MeshBasicMaterial, AdditiveBlending, ConeGeometry, CylinderGeometry, MeshStandardMaterial } from "three";
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
import { buildForest, H, SITES, INT, ROOM, FENCE_R, LANES } from "./world.js";
import { makeHut, makeYaga, makeRider, makeHands, makeCat, makeSkullLantern } from "./models.js";
import { openPoppy } from "./poppy.js";

const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const wait = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t * t * (3 - 2 * t);
// the time of day as a number: 0 night, 1 dawn (white rider), 2 day (red rider), 3 dusk, 4 night (black rider)
const KEYS = [
  { top: 0x04060f, mid: 0x0a1020, bot: 0x161c2c, fog: 0x0b101c, fogD: 0.024, hemi: 0.42, sun: 0.35, disk: 0.4, sunCol: 0x8ea4d8, stars: 1, sunDir: [0.4, 0.55, -0.6] },
  { top: 0x4f6ea8, mid: 0xb8c3d6, bot: 0xf0dccb, fog: 0xa9b0c2, fogD: 0.016, hemi: 1.0, sun: 0.9, disk: 0.9, sunCol: 0xffe2c8, stars: 0, sunDir: [0.9, 0.2, 0.3] },
  { top: 0x3a6fc0, mid: 0x9cc2ec, bot: 0xf4dcae, fog: 0xa8bccc, fogD: 0.012, hemi: 1.25, sun: 1.7, disk: 1.4, sunCol: 0xfff0d6, stars: 0, sunDir: [0.25, 1, 0.35] },
  { top: 0x272c5c, mid: 0x9a5a66, bot: 0xf29254, fog: 0x6c4c5a, fogD: 0.018, hemi: 0.75, sun: 1.0, disk: 1.0, sunCol: 0xff9a50, stars: 0.2, sunDir: [-0.9, 0.18, 0.1] },
  { top: 0x04060f, mid: 0x0a1020, bot: 0x161c2c, fog: 0x0b101c, fogD: 0.024, hemi: 0.42, sun: 0.35, disk: 0.4, sunCol: 0x8ea4d8, stars: 1, sunDir: [-0.4, 0.55, -0.6] },
];
const OBJ = {
  edge: [SITES.edge, 3.6], hut: [[0, 0], 9], well: [SITES.well, 2.5], barrel: [SITES.barrel, 2.1], broom: [SITES.broom, 1.9], door: [SITES.door, 2.4],
  pile1: [SITES.pile1, 2.1], pile2: [SITES.pile2, 2.1], pile3: [SITES.pile3, 2.1],
  exit: [[INT.x, INT.z + 1.9], 1.5], poppy: [[INT.x + 1.3, INT.z - 0.7], 1.8], stove: [[INT.x - 1.95, INT.z - 0.4], 1.9], cat: [[INT.x - 1.6, INT.z - 1.0], 2.3],
};

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "Baba Yaga’s Hut", kicker: "Legend · Russia and the East Slavic lands · after the fairy tale “Vasilisa the Beautiful”", accent: "#e39a3b", accent2: "#e8d29a", art: sceneSVG("babayaga"), journal: true,
    tagline: "Sent to the witch of the forest for fire, with nothing but your mother’s little doll in your pocket.",
    note: "This adventure follows the Russian fairy tale “Vasilisa the Beautiful”, collected by Alexander Afanasyev (1855–1863), and borrows the flight with the towel and the comb from his tale “Baba Yaga”. What the game adds is labelled in the codex (J).",
    controls: [["W A S D", "walk"], ["Shift", "run"], ["Mouse / drag", "look"], ["E / Space", "interact"], ["L (hold)", "ask the doll"], ["J", "journal"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, W = null, sky = null, D = null, S = null, hud = null, journalEl = null, hut = null, yaga = null, hands = null, cat = null, lantern = null, poppy = null, bars = null;
  let pendingScene = null, running = false, paused = false, busy = false, talking = false, journalOpen = false, disposed = false, endingStarted = false, asking = false, degraded = false, cine = 0;
  const P = { x: 0, z: 86, y: 0, yaw: 0, pitch: 0, bob: 0 };
  let hemi, sun, tod = 0.6, todT = 0.6, todSpeed = 0.5, askK = 0, stepT = 0, saveTimer = 0, lastPrompt = "", emaDt = 0.016, lowFrames = 0, igniteClock = 99, lookAt = null, lastHint = "";
  const col = new Colliders(), anims = new Set(), riders = [];
  const chase = { on: false, yp: new Vector3(), stop: null, river: null, comb: null, riverT: 0, out: 0, done: false };
  const yagaState = { on: false, row: 0, talk: 0, face: null };

  /* ---------------- game-time animation helpers ---------------- */
  const tween = (dur, f = () => {}) => new Promise(res => { const a = { t: 0, dur: Math.max(0.001, dur), f, res }; anims.add(a); f(0); });
  const pause = s => tween(s);
  async function cinematic(fn) {
    cine++; busy = true; input.enabled = false; input.releaseLock(); hudShow(false); bars.classList.add("on");
    try { await fn(); } catch (e) { console.error(e); }
    finally { cine = Math.max(0, cine - 1); if (!cine) { lookAt = null; bars.classList.remove("on"); busy = false; if (!talking) { input.enabled = !journalOpen; hudShow(true); } } }
  }

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && !s.s.ending ? s : null; };
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    shell.title({ hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${Object.keys(endingsFound()).length} / 4</p>`, onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); } });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume(); shell.loading(0, "Walking into the forest…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0x0b101c, fog: 0.02, fov: 70, far: 240, maxPR: 1.5 });
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: true, lookSpeed: 0.0034 });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(0.55); stage.scene.add(sky.mesh);
      hemi = new HemisphereLight(0xb8c4e8, 0x4a3a28, 0.6); sun = new DirectionalLight(0xffffff, 0.5); stage.scene.add(hemi, sun, sun.target, stage.camera);
      bars = el("div", "adv-letterbox noinput"); host.querySelector(".adv-ui").append(bars);
      wireInput();
      W = buildForest(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.7, m)); await frame();
      shell.loading(0.85, "Raising the hut on its legs…"); await frame();
      hut = makeHut(); hut.root.position.set(0, 0, 0); stage.scene.add(hut.root); col.circle(0, 0, 3.0);
      yaga = makeYaga(); yaga.group.visible = false; stage.scene.add(yaga.group);
      hands = makeHands(); hands.hands.forEach(h => stage.scene.add(h.g));
      cat = makeCat(); cat.group.position.copy(W.catSpot); cat.group.rotation.y = 0.5; stage.scene.add(cat.group);
      lantern = makeSkullLantern(); lantern.group.position.set(0.42, -0.42, -0.95); lantern.group.visible = false; stage.camera.add(lantern.group);
      stage.onFrame(tick);
    }
    shell.loading(0.95, "Feeding the doll…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false; cine = 0; anims.clear(); clearRiders(); resetChase();
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i));
    if (saved && validPos(saved.pos)) { P.x = saved.pos[0]; P.z = saved.pos[1]; P.yaw = saved.pos[2] || 0; } else { P.x = 0.4; P.z = 85; P.yaw = 0; }
    P.pitch = 0; P.y = groundY(P.x, P.z); syncWorld(true);
    shell.close(); shell.setRunning(true); running = true; input.enabled = true; hudShow(true); updateHud(); shell.objective(ST.objective(S));
    audio.stopAllLayers(); startAmbience(); await shell.fade(false, 1000);
    if (!saved) converse("start"); else shell.toast("Progress restored.");
  }
  /** put the world in the state the story says (used at start and after loading a save) */
  function syncWorld(instant) {
    const ph = S.phase;
    todT = ph === "road" ? (S.riders.red ? 2 : S.riders.white ? 1 : 0.6) : ph === "gate" ? 4 : ph === "tasks" ? (ST.tasksDone(S) >= 2 ? 2 : 1) : todT;
    if (instant) { tod = todT; igniteClock = 99; }
    const turned = ph !== "road" && ph !== "gate";
    hut.root.rotation.y = turned ? 0 : Math.PI; hut.state.crouch = ph === "tasks" ? 1 : 0;
    yaga.group.visible = false; yagaState.on = false;
    W.barrelWater.visible = !!S.tasks.water; W.wellBucket.visible = !S.items.bucket && !S.tasks.water;
    W.broom.visible = !S.items.broom && !S.tasks.sweep;
    for (const k in W.piles) W.piles[k].visible = !S.piles[k];
    W.bowlFill.material = S.tasks.poppy ? W.bowlClean || (W.bowlClean = new MeshStandardMaterial({ color: 0x3e4658, roughness: 0.6 })) : W.bowlFill.material;
    lantern.group.visible = !!S.items.skull;
    shell.objective(ST.objective(S));
  }
  function startAmbience() {
    if (!audio.ctx) return;
    audio.layer("wind", { kind: "pink", filter: "lowpass", freq: 600, gain: 0.05, lfoRate: 0.08, lfoDepth: 0.6 });
    audio.layer("leaves", { kind: "white", filter: "bandpass", freq: 3200, q: 0.6, gain: 0.008, lfoRate: 0.15, lfoDepth: 0.8 });
    audio.layer("fire", { kind: "brown", filter: "lowpass", freq: 300, gain: 0, lfoRate: 0.5, lfoDepth: 0.5 });
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    audio._amb.push(audio.every(() => { if (!S || S.inside) return; if (dayK() > 0.5) audio.chirp(2600 + Math.random() * 1500); else audio.cricket(); }, 2500, 7000));
    audio._amb.push(audio.every(() => { if (!S || S.inside || dayK() > 0.4) return; const p = Math.random() * 2 - 1; audio.tone({ freq: 360, dur: 0.4, type: "sine", vol: 0.018, slide: -40, pan: p, wet: 0.8 }); setTimeout(() => audio.tone({ freq: 320, dur: 0.7, type: "sine", vol: 0.016, slide: -30, pan: p, wet: 0.8 }), 450); }, 11000, 24000));
    audio._amb.push(audio.every(() => { if (S && !S.inside && hut && Math.hypot(P.x, P.z) < 40) cluck(0.5); }, 9000, 20000));
  }
  /* ---------------- sounds of the tale ---------------- */
  const cluck = (v = 1) => { audio.tone({ freq: 520, dur: 0.07, type: "square", vol: 0.02 * v, slide: -120 }); setTimeout(() => audio.tone({ freq: 470, dur: 0.1, type: "square", vol: 0.016 * v, slide: -160 }), 110); };
  const thump = (v = 1, pan = 0) => { audio.tone({ freq: 52, dur: 0.4, type: "sine", vol: 0.22 * v, slide: -18, pan }); audio.burst({ dur: 0.25, freq: 160, q: 0.6, vol: 0.12 * v, kind: "brown", filter: "lowpass", pan }); };
  const creak = () => audio.tone({ freq: 120 + Math.random() * 60, dur: 0.7, type: "sawtooth", vol: 0.022, slide: -50 - Math.random() * 40, wet: 0.4 });
  const hoof = (v, pan) => audio.burst({ dur: 0.07, freq: 260 + Math.random() * 80, q: 1.2, vol: 0.2 * v, kind: "brown", pan });
  const whoosh = (v = 1, pan = 0, dur = 1.2) => audio.burst({ dur, freq: 520, q: 0.5, vol: 0.12 * v, kind: "pink", filter: "bandpass", pan, wet: 0.4 });
  const cackle = () => { for (let i = 0; i < 7; i++) setTimeout(() => audio.tone({ freq: 760 + (i % 2) * 140 + Math.random() * 40, dur: 0.11, type: "sawtooth", vol: 0.03, slide: -260, wet: 0.5 }), i * 120); };
  const fwip = i => audio.tone({ freq: 900 + i * 25, dur: 0.12, type: "sine", vol: 0.015, slide: 400 });

  /* ---------------- input ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" }); input.addButton("listen", "🪆", { hold: true, cls: "listen" });
    input.on((a, x) => {
      if (!running || disposed) return;
      if (a === "pause") { if (poppy) { poppy.close(); return; } return togglePause(); }
      if (a === "mute") return toggleSound();
      if (paused || poppy) return;
      if (a === "listen") { asking = !!x; if (x) dollHint(); return; }
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (chase.on) throwNext(); else if (!busy) tryInteract(); }
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
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="echoes" title="Baba Yaga’s orders"></div><div class="watch" title="What you carry"></div>`; host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = "<kbd>E</kbd><span></span>"; ui.append(pr); hud.prompt = pr; pr.addEventListener("pointerdown", e => { e.preventDefault(); if (chase.on) throwNext(); else if (!busy && !talking && running && !paused) tryInteract(); });
      const cr = el("div", "crosshair"); ui.append(cr); hud.cross = cr;
      const lb = el("div", "listen-bar"); lb.innerHTML = "<span>the doll points the way</span><i><u></u></i>"; ui.append(lb); hud.lbar = lb;
    }
    hud.style.display = v ? "" : "none"; hud.cross.style.display = v ? "" : "none"; if (!v) { hud.prompt.hidden = true; lastPrompt = ""; }
  }
  function updateHud() {
    if (!hud || !S) return;
    const t = hud.querySelector(".echoes"); t.style.display = S.phase === "tasks" || S.phase === "return" ? "" : "none";
    t.classList.add("tasks"); t.innerHTML = ST.TASKS.map(k => `<b class="${S.tasks[k] ? "on" : ""}" title="${ST.TASK_LABEL[k]}">${{ water: "💧", sweep: "🧹", poppy: "🌾", supper: "🍲" }[k]}</b>`).join("");
    const it = ["doll", "bucket", "broom", "towel", "comb", "skull"].filter(k => S.items[k]).map(k => ({ doll: "the doll", bucket: "a bucket of water", broom: "a broom", towel: "a towel", comb: "a comb", skull: "the skull lantern" }[k]));
    hud.querySelector(".watch").textContent = "In your hands: " + it.join(", ");
  }
  function toggleJournal() {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking && !cine; audio.duck(1); return; }
    input.releaseLock(); journalOpen = true; input.enabled = false; audio.duck(0.5); renderJournal("journal");
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove(); journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["journal", "Journal"], ["codex", "Codex"], ["help", "How to play"]]; let body = "";
    if (tab === "journal") { const cl = Object.keys(S.clues); body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p>` + (S.phase === "tasks" ? `<h4>Baba Yaga’s orders</h4><ul>${ST.TASKS.map(k => `<li>${S.tasks[k] ? "✓" : "○"} ${ST.TASK_LABEL[k]}</li>`).join("")}</ul>` : "") + `<h4>What has happened <small>${cl.length}</small></h4>` + (cl.length ? `<ul>${cl.map(c => `<li>${ST.CLUE_TEXT[c] || c}</li>`).join("")}</ul>` : "<p class=mut>Nothing yet.</p>"); }
    else if (tab === "codex") { const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]); body = `<p class="mut">What comes from the tales, and what this game adds. ${got.length} / ${ids.length} entries found.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${c.kind === "historical" ? "Historical" : c.kind === "invented" ? "Invented for this game" : "Folklore (the tales)"}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join(""); }
    else body = `<ul><li><b>Ask the doll</b>: hold <kbd>L</kbd> (or the doll button). She tells you what to do next, and a bar at the top shows the way.</li><li><b>The road</b>: follow the forest path to the clearing. The three horsemen will pass you.</li><li><b>The hut</b> has its back to you. There are old words for that.</li><li><b>The chores</b>: water from the well to the barrel, the broom for the leaves, and inside the hut the stove and the poppy seed.</li><li><b>You can go home</b> by the forest path whenever you like, but not with fire unless you earn it.</li></ul>`;
    journalEl.innerHTML = `<div class="adv-card jr"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else renderJournal(b.dataset.t); });
    host.querySelector(".adv-ui").append(journalEl);
  }

  /* ---------------- the doll: hints and the way ---------------- */
  function dollTarget() {
    if (!S) return null;
    if (S.phase === "road") return [0, Math.max(14, P.z - 20)];
    if (S.phase === "gate") return [0, 2];
    if (S.phase === "lantern" || S.phase === "flight") return [0, 92];
    if (S.phase === "tasks") {
      if (S.inside) { if (!S.tasks.supper && S.tasks.water) return [INT.x - 1.95, INT.z - 0.4]; if (!S.tasks.poppy) return [INT.x + 1.3, INT.z - 0.7]; if (S.tasks.supper && !S.flags.cat_fed) return [INT.x - 1.6, INT.z - 1.0]; return [INT.x, INT.z + 2.0]; }
      if (!S.tasks.water) return S.items.bucket ? SITES.barrel : SITES.well;
      if (!S.tasks.sweep) { if (!S.items.broom) return SITES.broom; const k = ["pile1", "pile2", "pile3"].find(k => !S.piles[k]); return k ? SITES[k] : null; }
      return SITES.door;
    }
    return null;
  }
  const HINTS = {
    road: "Follow the path. Where the birches turn gold, she lives.", gate: "Say the old words to the hut. You know them: turn your back to the forest…", lantern: "Hold the skull high, and walk home. Do not look back.", flight: "Run! Throw the towel when she is close (E).",
  };
  function dollHint() {
    let t = HINTS[S.phase];
    if (S.phase === "tasks") t = ST.tasksDone(S) === 4 ? "All done. Now we wait for her." : S.inside ? (!S.tasks.poppy ? "The poppy seed is on the table. Give me a crust, and I will help — or do it yourself, if you have the eyes for it." : !S.tasks.water ? "Water first: the well is outside." : !S.tasks.supper ? "Light the stove and cook." : "Go back out to the yard.") : ST.objective(S);
    if (t && t !== lastHint) { shell.toast("The doll whispers: " + t, "clue"); lastHint = t; }
  }

  /* ---------------- interaction ---------------- */
  const fwd = () => ({ x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) });
  function candidates() {
    const out = [], f = fwd();
    for (const id in OBJ) {
      if (!ST.objectAvailable(id, S)) continue;
      const [[x, z], r] = OBJ[id], dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > r) continue; const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (id !== "hut" && id !== "edge" && dot < 0.15 && d > 1.4) continue; out.push({ id, d, score: (id === "hut" ? 20 : 0) + d - dot * 1.5 });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  function tryInteract() {
    const c = candidates()[0]; if (!c) return false;
    if (c.id === "door") { goInside(); return true; }
    if (c.id === "exit") { goOutside(); return true; }
    if (c.id.startsWith("pile")) { sweepPile(c.id); return true; }
    converse(ST.objectNode(c.id, S)); return true;
  }
  function updatePrompt() {
    let txt = "";
    if (chase.on && !talking) { const left = ["towel", "comb"].filter(k => S.items[k]); txt = left.length && chase.out < 2 ? (left[0] === "towel" ? "Throw the towel" : "Throw the comb") : ""; }
    else { const c = running && !talking && !busy && !paused && !journalOpen && !poppy ? candidates()[0] : null; txt = c ? ST.labelFor(c.id, S) : ""; }
    if (txt === lastPrompt) return; lastPrompt = txt; hud.prompt.hidden = !txt; hud.prompt.querySelector("span").textContent = txt; input.buttons.interact && input.buttons.interact.classList.toggle("ready", !!txt);
  }

  /* ---------------- conversation flow ---------------- */
  async function converse(nodeId) { if (talking) return; talking = true; input.enabled = false; input.releaseLock(); hud.prompt.hidden = true; lastPrompt = ""; try { await present(D.start(nodeId)); } catch (e) { console.error(e); endTalk(); } }
  async function step(kind, i) { if (busy || !talking) return; try { await present(kind === "choose" ? D.choose(i) : D.advance()); } catch (e) { console.error(e); endTalk(); } }
  async function present(v) {
    busy = true; let after = [];
    try {
      const ev = D.drainEvents(), hasToast = ev.some(e => e.t === "toast");
      for (const e of ev) { if (e.t === "event") after.push(e); else handleEvent(e, hasToast); }
      if (S.ending && !endingStarted) { busy = false; await playEnding(); return; }
      for (const e of after) if (e.id === "task") onTask(e.n);
      // a set piece starts when its line has been read (or at once, if the choice that triggers it has no line of its own)
      const scene = after.find(e => SCENES[e.id]); if (scene) pendingScene = scene;
      if (!v && pendingScene) { const sc = pendingScene; pendingScene = null; dlg.hide(); talking = false; busy = false; updateHud(); await SCENES[sc.id](sc); return; }
      if (!v) { busy = false; endTalk(); return; }
      const who = ST.WHO[v.who] || ST.WHO.narr; yagaState.talk = v.who === "yaga" ? 1 : 0;
      dlg.show(v, who, v.who === "yaga" ? { pitch: 170, kind: "sawtooth" } : v.who === "doll" ? { pitch: 520, kind: "sine" } : v.who === "cat" ? { pitch: 380, kind: "triangle" } : { pitch: 0 });
    } finally { busy = false; }
  }
  function endTalk() { dlg.hide(); talking = false; yagaState.talk = 0; if (!cine) { input.enabled = !journalOpen; hudShow(true); } updateHud(); shell.objective(ST.objective(S)); persist(); }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "item": shell.toast("Taken: " + ({ bucket: "a bucket of water", broom: "the broom", towel: "a towel", comb: "a comb", skull: "the skull lantern" }[e.id] || e.id), "item"); if (e.id === "bucket") W.wellBucket.visible = false; if (e.id === "broom") W.broom.visible = false; break;
      case "clue": if (!hasToast) shell.toast("New entry in your journal (J).", "clue"); break;
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
    }
  }

  /* ---------------- chores ---------------- */
  function sweepPile(k) {
    if (!S.items.broom) { converse("pile_need"); return; }
    cinematic(async () => {
      const g = W.piles[k], v = g.position.clone(); lookAt = v.clone(); audio.burst({ dur: 0.5, freq: 2500, q: 0.4, vol: 0.06, kind: "white" });
      for (let i = 0; i < 3; i++) { setTimeout(() => audio.burst({ dur: 0.3, freq: 2000 + i * 400, q: 0.5, vol: 0.05, kind: "white" }), i * 260); }
      await tween(0.9, t => { g.scale.setScalar(1 - ease(t)); g.position.y = v.y + Math.sin(t * Math.PI) * 0.3; });
      g.visible = false; g.scale.setScalar(1); g.position.copy(v);
      S.piles[k] = true;
      if (ST.piles(S) === 3) { S.tasks.sweep = true; delete S.items.broom; onTask("sweep"); } else shell.toast(`Swept (${ST.piles(S)} / 3).`);
      updateHud(); shell.objective(ST.objective(S)); persist();
    });
  }
  function onTask(n) {
    updateHud(); audio.good(); shell.objective(ST.objective(S));
    if (n === "water") W.barrelWater.visible = true;
    if (n === "poppy") W.bowlFill.material = W.bowlClean || (W.bowlClean = new MeshStandardMaterial({ color: 0x3e4658, roughness: 0.6 }));
    shell.toast(`Done: ${ST.TASK_LABEL[n].toLowerCase()} (${ST.tasksDone(S)} / 4).`, "good");
    if (ST.tasksDone(S) === 2 && !S.riders.red2) setTimeout(() => redRiderDay(), 900);
    if (ST.tasksDone(S) === 4) setTimeout(() => evening(), 1600);
  }
  async function goInside() {
    await cinematic(async () => {
      audio.tone({ freq: 90, dur: 0.6, type: "sawtooth", vol: 0.03, slide: -30 }); await shell.fade(true, 500);
      S.inside = true; P.x = INT.x; P.z = INT.z + 1.7; P.yaw = 0; P.pitch = -0.05; P.y = 0; await pause(0.1); await shell.fade(false, 600);
    });
    if (!S.seen.inside_first) converse("inside_first");
  }
  async function goOutside() {
    await cinematic(async () => { await shell.fade(true, 500); S.inside = false; P.x = SITES.door[0]; P.z = SITES.door[1] + 1.2; P.yaw = 0; P.pitch = 0; await pause(0.1); await shell.fade(false, 600); });
    persist();
  }

  /* ---------------- the set pieces ---------------- */
  function clearRiders() { riders.splice(0).forEach(r => stage && stage.scene.remove(r.m.group)); }
  /** a rider gallops from a to b (world xz) at `speed` m/s; resolves when he arrives (and is gone) */
  function ride(kind, a, b, { speed = 13, vanish = false } = {}) {
    const m = makeRider(kind), r = { m, a: new Vector3(a[0], 0, a[1]), b: new Vector3(b[0], 0, b[1]), t: 0, hoof: 0, pk: 0 }; stage.scene.add(m.group); riders.push(r);
    const dist = r.a.distanceTo(r.b), dur = dist / speed; m.group.rotation.y = Math.atan2(r.b.x - r.a.x, r.b.z - r.a.z);
    return tween(dur, k => {
      const p = r.a.clone().lerp(r.b, k); m.group.position.set(p.x, groundY(p.x, p.z), p.z); m.update(Math.max(0, (k - r.pk) * dur), 1); r.pk = k;
      if (vanish && k > 0.92) { const f = (k - 0.92) / 0.08; m.group.scale.setScalar(1 - f * 0.6); m.group.position.y -= f * 2.5; }
      const d = Math.hypot(p.x - P.x, p.z - P.z); r.hoof += 1; if (r.hoof % 6 === 0) { const v = clamp(1 - d / 60, 0, 1) ** 2; if (v > 0.02) { const rr = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) }, pan = clamp(((p.x - P.x) * rr.x + (p.z - P.z) * rr.z) / (d || 1), -1, 1); hoof(v, pan); setTimeout(() => hoof(v * 0.8, pan), 70); setTimeout(() => hoof(v * 0.6, pan), 140); } }
    }).then(() => { stage.scene.remove(m.group); const i = riders.indexOf(r); if (i >= 0) riders.splice(i, 1); });
  }
  async function riderOnRoad(kind) {
    S.riders[kind] = true;
    await cinematic(async () => {
      if (kind === "white") { lookAt = new Vector3(-14, 1.8, LANES[0]); const p = ride("white", [-75, LANES[0]], [75, LANES[0]]); await pause(4.2); todT = 1; todSpeed = 0.35; lookAt = new Vector3(14, 1.8, LANES[0]); await p; }
      else if (kind === "red") { lookAt = new Vector3(14, 1.8, LANES[1]); const p = ride("red", [75, LANES[1]], [-75, LANES[1]]); await pause(4.2); todT = 2; todSpeed = 0.35; lookAt = new Vector3(-14, 1.8, LANES[1]); await p; }
      else {
        lookAt = new Vector3(0, 1.8, P.z + 30); const p = ride("black", [2.2, P.z + 45], [0, FENCE_R + 0.4], { speed: 15, vanish: true });
        await pause(2.6); lookAt = new Vector3(0, 2.5, 0); todT = 4; todSpeed = 0.9; await p; igniteClock = 0; audio.thunder(0.35); await pause(3.4);
      }
    });
    converse("rider_" + kind);
  }
  const SCENES = {
    async hut_turn() {
      await cinematic(async () => {
        lookAt = new Vector3(0, 4.5, 0); cluck(1.2); await pause(0.6); creak();
        // the hut lifts itself, steps round on its chicken legs, and faces you
        const y0 = hut.root.rotation.y; let lastStep = 0;
        await tween(6.5, t => { const k = ease(t); hut.root.rotation.y = y0 - Math.PI * k; hut.state.walk = Math.min(1, Math.sin(t * Math.PI) * 1.6); hut.state.phase = t * Math.PI * 9; const st = Math.floor(t * 9); if (st !== lastStep) { lastStep = st; thump(0.9, (Math.random() - 0.5) * 0.6); if (st % 2) creak(); } });
        hut.state.walk = 0; hut.root.rotation.y = 0; thump(1.2); cluck(1.4); await pause(0.8);
        // it squats down: the door comes to the ground
        creak(); await tween(2.4, t => { hut.state.crouch = ease(t); }); thump(0.8); await pause(0.5);
        hut.doorGlow.material.opacity = 0.35; await pause(0.6);
        await yagaArrive();
      });
      converse("yaga_meet");
    },
    async night_pass() {
      await cinematic(async () => {
        await shell.fade(true, 1400); shell.toast("You sleep on the bench by the stove. Through the night, something walks round and round the hut.", "clue");
        yaga.group.visible = true; yaga.group.position.set(SITES.land[0], 0.2, SITES.land[1]); hut.state.crouch = 1;
        P.x = 1.2; P.z = 7.5; P.yaw = Math.PI * 0.1; P.pitch = 0.05; tod = 0.95; todT = 1; S.phase = "tasks"; await pause(1.6); updateHud();
        await shell.fade(false, 1600);
        // dawn: the white horseman passes the gate, and Baba Yaga flies off for the day
        lookAt = new Vector3(-10, 2, LANES[2]); const p = ride("white", [-75, LANES[2]], [75, LANES[2]]); await pause(4); lookAt = new Vector3(10, 2, LANES[2]); await p;
        lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0)); await pause(0.6); cackle();
        await yagaFlyAway();
      });
      S.riders.white2 = true; shell.objective(ST.objective(S)); persist();
      shell.toast("The doll whispers: we have until the black horseman comes. Water, broom, stove, poppy seed.", "clue");
    },
    async poppy_self() { await doPoppy("self"); },
    async poppy_doll() { await doPoppy("doll"); },
    async hands() {
      await cinematic(async () => {
        lookAt = new Vector3(0, 1.6, 3.2); audio.burst({ dur: 1.5, freq: 900, q: 0.4, vol: 0.08, kind: "pink", wet: 0.7 });
        // three pairs of hands come out of the door, circle the yard and go back in, carrying the poppy seed
        const door = new Vector3(0, hut.sill() + 1, 3.0);
        hands.hands.forEach(h => { h.g.visible = true; h.g.position.copy(door); });
        await tween(6, t => {
          hands.mat.opacity = Math.min(1, Math.sin(t * Math.PI) * 2.2);
          hands.hands.forEach((h, i) => {
            const pair = i >> 1, a = t * Math.PI * 2.2 + pair * 2.1 + (h.side > 0 ? 0.25 : 0), rad = Math.sin(t * Math.PI) * (4.5 + pair * 1.2);
            h.g.position.set(door.x + Math.sin(a) * rad + h.side * 0.18, door.y - 0.4 + Math.sin(t * 9 + i) * 0.25 + Math.sin(t * Math.PI) * 0.6, door.z + 3 + Math.cos(a) * rad * 0.8 - (1 - Math.sin(t * Math.PI)) * 3);
            h.g.rotation.set(Math.sin(t * 7 + i) * 0.5, a + Math.PI / 2, h.side * 0.4); h.trail.material.opacity = hands.mat.opacity * 0.4;
          });
          if (Math.random() < 0.04) whoosh(0.4, (Math.random() - 0.5));
        });
        hands.hands.forEach(h => { h.g.visible = false; }); hands.mat.opacity = 0;
        lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0)); await pause(0.8);
      });
      converse("yaga_ask");
    },
    async lantern() {
      await cinematic(async () => {
        lantern.group.visible = true; lantern.light.intensity = 0; updateHud(); audio.bell(196, 0.05);
        await tween(1.2, t => { lantern.light.intensity = 2.6 * t; });
        lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0)); cackle(); await pause(0.6);
        await yagaFlyAway();
        // the hut stands up and turns its back to the forest path again
        lookAt = new Vector3(0, 4, 0); creak(); await tween(2.2, t => { hut.state.crouch = 1 - ease(t); }); thump(0.8);
        const y0 = hut.root.rotation.y; await tween(5, t => { hut.root.rotation.y = y0 + Math.PI * ease(t); hut.state.walk = Math.min(1, Math.sin(t * Math.PI) * 1.6); hut.state.phase = t * Math.PI * 7; if (Math.random() < 0.05) thump(0.6); }); hut.state.walk = 0;
        hut.doorGlow.material.opacity = 0;
      });
      shell.objective(ST.objective(S));
    },
    async flight() {
      await cinematic(async () => {
        lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0));
        // she goes into the hut to light the big stove
        const from = yaga.group.position.clone(), to = new Vector3(0, hut.sill() + 0.2, 2.8);
        yagaState.row = 1; await tween(2.2, t => { yaga.group.position.lerpVectors(from, to, ease(t)); yaga.group.scale.setScalar(1 - t * 0.5); }); yaga.group.visible = false; yaga.group.scale.setScalar(1);
        audio.burst({ dur: 2, freq: 200, q: 0.5, vol: 0.12, kind: "brown", filter: "lowpass" }); W.stoveLight.intensity = 3;
        lookAt = new Vector3(P.x + 2, 1.4, P.z - 1); await pause(0.6);
      });
      await converseWait(S.flags.cat_fed ? "flight_cat" : "flight_doll");
      startChase();
    },
  };
  async function converseWait(id) { await converse(id); for (let i = 0; i < 6000 && talking; i++) await wait(50); }
  async function yagaArrive() {
    // Baba Yaga comes home over the trees in her mortar, rowing with the pestle and sweeping her tracks with the broom
    yaga.group.visible = true; yagaState.on = true; yagaState.row = 1;
    const pts = [new Vector3(-70, 34, -60), new Vector3(-30, 22, -30), new Vector3(10, 16, -26), new Vector3(24, 12, 0), new Vector3(10, 7, 14), new Vector3(-8, 4.5, 6), new Vector3(SITES.land[0], 0.2, SITES.land[1])];
    whoosh(1, -0.6, 2.5); setTimeout(() => cackle(), 1800); setTimeout(() => whoosh(1, 0.6, 2), 3200);
    let prev = pts[0].clone();
    await tween(7.5, t => {
      const p = catmull(pts, ease(t)); yaga.group.position.copy(p); const d = p.clone().sub(prev); if (d.lengthSq() > 1e-6) yaga.group.rotation.y = Math.atan2(d.x, d.z); prev = p;
      yaga.group.rotation.z = Math.sin(t * 6) * 0.08; lookAt = p.clone().add(new Vector3(0, 1.5, 0));
      if (Math.random() < 0.25) dust(p);
    });
    yagaState.row = 0.2; yaga.group.rotation.set(0, Math.atan2(P.x - SITES.land[0], P.z - SITES.land[1]), 0); thump(0.5);
    lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0)); await pause(0.8);
  }
  async function yagaFlyAway() {
    const p0 = yaga.group.position.clone(); yagaState.row = 1; whoosh(1, 0, 3); setTimeout(cackle, 600);
    const pts = [p0, p0.clone().add(new Vector3(0, 6, 0)), new Vector3(-12, 14, -8), new Vector3(-6, 22, -40), new Vector3(30, 34, -90)];
    await tween(5, t => { const p = catmull(pts, ease(t)); const d = p.clone().sub(yaga.group.position); if (d.lengthSq() > 1e-6) yaga.group.rotation.y = Math.atan2(d.x, d.z); yaga.group.position.copy(p); lookAt = p.clone(); if (Math.random() < 0.3) dust(p); });
    yaga.group.visible = false; yagaState.on = false;
  }
  async function yagaReturn() {
    yaga.group.visible = true; yagaState.on = true; yagaState.row = 1; whoosh(1, 0.5, 3); setTimeout(cackle, 1200);
    const pts = [new Vector3(40, 36, -90), new Vector3(10, 20, -40), new Vector3(-14, 12, -6), new Vector3(-6, 5, 8), new Vector3(SITES.land[0], 0.2, SITES.land[1])];
    let prev = pts[0].clone();
    await tween(6, t => { const p = catmull(pts, ease(t)); yaga.group.position.copy(p); const d = p.clone().sub(prev); if (d.lengthSq() > 1e-6) yaga.group.rotation.y = Math.atan2(d.x, d.z); prev = p; lookAt = p.clone().add(new Vector3(0, 1.5, 0)); if (Math.random() < 0.25) dust(p); });
    yagaState.row = 0.2; yaga.group.rotation.set(0, Math.atan2(P.x - SITES.land[0], P.z - SITES.land[1]), 0); thump(0.5);
  }
  const catmull = (pts, t) => { const n = pts.length - 1, f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)], u2 = u * u, u3 = u2 * u;
    return new Vector3().addScaledVector(p0, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1).addScaledVector(p2, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(p3, 0.5 * u3 - 0.5 * u2); };
  // dust and sparks swept up by the broom
  const dustPool = [];
  function dust(p) {
    let d = dustPool.find(x => !x.on); if (!d) { if (dustPool.length > 40) return; const s = glowSprite("200,180,150", 1); s.material.blending = 1; stage.scene.add(s); d = { s, on: false, t: 0 }; dustPool.push(d); }
    d.on = true; d.t = 0; d.s.visible = true; d.s.position.copy(p).add(new Vector3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6)); d.v = new Vector3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
  }
  async function redRiderDay() {
    if (S.riders.red2 || S.phase !== "tasks") return;
    if (talking || cine || poppy) { setTimeout(redRiderDay, 800); return; }
    S.riders.red2 = true;
    if (S.inside) { todT = 2; todSpeed = 0.4; for (let i = 0; i < 20; i++) setTimeout(() => hoof(0.25 * Math.sin(i / 20 * Math.PI), (i / 10 - 1)), i * 120); shell.toast("Outside, a red horseman gallops past the gate: the sun stands high.", "clue"); return; }
    await cinematic(async () => { lookAt = new Vector3(12, 2, LANES[2]); const p = ride("red", [75, LANES[2]], [-75, LANES[2]]); await pause(4); todT = 2; todSpeed = 0.4; lookAt = new Vector3(-12, 2, LANES[2]); await p; });
    shell.toast("The red horseman: the sun stands high. Half the day is gone.", "clue");
  }
  async function evening() {
    if (S.phase !== "tasks") return;
    if (cine || talking || poppy) { setTimeout(evening, 800); return; }
    S.riders.red2 = true;   // (if the red horseman was missed, e.g. after loading a save, the day simply goes on)
    S.phase = "return"; updateHud();
    await cinematic(async () => {
      if (S.inside) { await shell.fade(true, 600); S.inside = false; P.x = 1.5; P.z = 8; P.yaw = 0; await pause(0.1); await shell.fade(false, 700); }
      todT = 3; todSpeed = 0.6; await pause(1.5);
      lookAt = new Vector3(-10, 2, LANES[2]); const p = ride("black", [-75, LANES[2]], [0, FENCE_R + 0.4], { speed: 15, vanish: true });
      await pause(4.5); lookAt = new Vector3(0, 2.5, FENCE_R); todT = 4; todSpeed = 1.2; await p; igniteClock = 0; audio.thunder(0.35); await pause(2.5);
      await yagaReturn(); lookAt = yaga.group.position.clone().add(new Vector3(0, 2, 0)); await pause(0.5);
    });
    converse("yaga_back");
  }
  async function doPoppy(how) {
    if (how === "doll") {
      await cinematic(async () => { await shell.fade(true, 900); shell.toast("You give the doll a crust and fall asleep at the table. When you wake, the poppy seed is clean, every grain.", "clue"); await pause(1.5); await shell.fade(false, 900); });
      S.tasks.poppy = true; onTask("poppy"); persist(); return;
    }
    input.releaseLock(); input.enabled = false; hudShow(false);
    poppy = openPoppy(host.querySelector(".adv-ui"), { audio }); const res = await poppy.promise; poppy = null;
    hudShow(true); input.enabled = !talking && !cine;
    if (res === "self") { S.flags.poppy_self = true; S.tasks.poppy = true; onTask("poppy"); }
    else if (res === "doll") { S.flags.fed_doll = true; await doPoppy("doll"); return; }
    persist();
  }

  /* ---------------- the flight ---------------- */
  function resetChase() { chase.on = false; chase.out = 0; chase.done = false; chase.stop = null; if (chase.river) { stage && stage.scene.remove(chase.river); chase.river = null; } if (chase.comb) { stage && stage.scene.remove(chase.comb); chase.comb = null; } }
  function startChase() {
    chase.on = true; chase.t = 0; chase.wait = 4.5; chase.yp.set(0, 3, 2); updateHud(); shell.objective(ST.objective(S));
    shell.toast("Run! (hold Shift)", "bad");
  }
  function throwNext() {
    if (!chase.on || chase.out >= 2 || talking) return;
    const k = chase.out === 0 ? "towel" : "comb"; if (!S.items[k]) return; delete S.items[k]; chase.out++; updateHud();
    const z0 = Math.max(chase.yp.z + 1.2, P.z - 3.5), stopAt = Math.min(z0 - 3, chase.yp.z);
    if (k === "towel") {
      // the towel becomes a wide, black river across the path
      const m = new Mesh(new PlaneGeometry(70, 7, 1, 1), new MeshBasicMaterial({ color: 0x1b3a52, transparent: true, opacity: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(P.x, groundY(P.x, z0) + 0.15, z0); m.scale.set(0.01, 1, 1); stage.scene.add(m); chase.river = m;
      const shine = new Mesh(new PlaneGeometry(70, 7), new MeshBasicMaterial({ color: 0x6fb0e0, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false })); shine.position.z = 0.01; m.add(shine); m.userData.shine = shine;
      chase.stop = stopAt; chase.riverT = 7; audio.layer("river", { kind: "pink", filter: "lowpass", freq: 900, gain: 0.12, lfoRate: 0.3, lfoDepth: 0.5 });
      tween(1.2, t => { m.scale.x = 0.01 + ease(t) * 0.99; }); shell.toast("The towel falls, and becomes a wide black river!", "clue");
    } else {
      // the comb becomes a forest so dense that not even Baba Yaga can get through
      const g = new Group(); g.position.set(0, 0, z0); stage.scene.add(g); chase.comb = g;
      const trees = []; const geo = new ConeGeometry(1.6, 7, 7), tm = new MeshStandardMaterial({ color: 0x14281b, flatShading: true, roughness: 1 }), trunkG = new CylinderGeometry(0.14, 0.2, 2, 5), trM = new MeshStandardMaterial({ color: 0x2a1e14 });
      for (let i = 0; i < 34; i++) { const t = new Group(), x = (i / 33 - 0.5) * 34 + (Math.random() - 0.5) * 1.2, z = (Math.random() - 0.5) * 6; const c = new Mesh(geo, tm); c.position.y = 4.5; const tr = new Mesh(trunkG, trM); tr.position.y = 1; t.add(c, tr); t.position.set(P.x + x, groundY(P.x + x, z0 + z), z); t.scale.setScalar(0.01); g.add(t); trees.push([t, Math.random() * 0.5, 0.8 + Math.random() * 0.5]); }
      chase.stop = stopAt; chase.riverT = 1e9; for (let i = 0; i < 6; i++) setTimeout(() => { thump(0.6); creak(); }, i * 160);
      tween(1.6, t => trees.forEach(([m, d, s]) => m.scale.setScalar(Math.max(0.01, ease(clamp((t - d * 0.5) / 0.7, 0, 1)) * s)))); shell.toast("The comb falls, and a forest springs up behind you!", "clue");
    }
    // a glance back over your shoulder, to see what the towel or the comb has become
    if (!cine && !talking) { const yaw0 = P.yaw; cinematic(async () => { lookAt = new Vector3(P.x, 2.2, z0 - 2); await pause(1.7); lookAt = new Vector3(P.x - Math.sin(yaw0) * 10, 1.8, P.z - Math.cos(yaw0) * 10); await pause(0.6); }); }
  }
  function updateChase(dt) {
    if (!chase.on) return;
    chase.t += dt;
    if (chase.wait > 0) { chase.wait -= dt; if (chase.wait <= 0) { yaga.group.visible = true; yagaState.on = true; yagaState.row = 1; chase.yp.set(0, hut.sill() + 1, 3); cackle(); whoosh(1, 0, 2.5); shell.toast("The door bursts open: Baba Yaga is after you!", "bad"); } return; }
    // she flies along the path behind you; a river holds her up for a while, the comb-forest for good
    const tgt = new Vector3(P.x, groundY(P.x, P.z) + 2.6, P.z - 1.5), far = Math.hypot(chase.yp.x - P.x, chase.yp.z - P.z); let sp = 6.2 + Math.max(0, far - 18) * 0.35;   // far behind, she rows harder
    if (chase.stop != null && chase.yp.z > chase.stop - 0.5) { sp = 0; chase.yp.z = Math.min(chase.yp.z, chase.stop); if (chase.river) { chase.riverT -= dt; if (chase.riverT <= 0) { const r = chase.river; chase.river = null; chase.stop = null; audio.stopLayer("river"); shell.toast("Her oxen have drunk the river dry. She is coming again!", "bad"); tween(1.5, t => { r.scale.z = 1 - t; }).then(() => stage.scene.remove(r)); } } }
    const d = tgt.clone().sub(chase.yp); const L = d.length(); if (L > 0.01 && sp > 0) chase.yp.addScaledVector(d, Math.min(1, sp * dt / L));
    yaga.group.position.copy(chase.yp); yaga.group.rotation.y = Math.atan2(d.x, d.z); if (Math.random() < 0.3) dust(chase.yp);
    if (chase.river && chase.river.userData.shine) chase.river.userData.shine.material.opacity = 0.18 + 0.1 * Math.sin(chase.t * 4);
    const dist = Math.hypot(chase.yp.x - P.x, chase.yp.z - P.z);
    if (dist < 3 && chase.out < 2 && (chase.stop == null || chase.yp.z < chase.stop - 0.5)) { shell.toast("Without thinking, you throw it behind you!", "bad"); throwNext(); }
    if (Math.random() < dt * 0.6 && dist < 30) cackle();
    if (P.z > 86 && !chase.done && !talking) { chase.done = true; chase.on = false; audio.stopLayer("river"); converse("home_flight"); }
  }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    endingStarted = true; dlg.hide(); talking = true; input.enabled = false; hudShow(false); chase.on = false;
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id], found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    if (id === "stay") { cackle(); setTimeout(() => whoosh(1, 0, 3), 500); } else if (id === "lantern") audio.bell(196, 0.08); else if (id === "flight") audio.thunder(0.4); else cluck(0.5);
    await wait(2600); await shell.fade(true, 1400);
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 4, cls: E.cls, adv: "babayaga", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }
  function persist() { if (!S || S.ending || endingStarted || cine) return; if (!["road", "gate", "tasks"].includes(S.phase)) return; if (S.phase === "road" && !S.riders.white && P.z > 80) return; save(ST.SAVE_KEY, { v: 1, s: S, pos: [P.x, P.z, P.yaw] }); }

  /* ---------------- main loop ---------------- */
  const groundY = (x, z) => (Math.abs(x - INT.x) < 20 ? 0 : H(x, z));
  const dayK = () => clamp((tod - 0.55) / 0.5, 0, 1) * (1 - clamp((tod - 3.1) / 0.6, 0, 1));
  function applyTime(dt) {
    tod += clamp(todT - tod, -dt * todSpeed, dt * todSpeed);
    const i = clamp(Math.floor(tod), 0, 3), k = tod - i, A = KEYS[i], B = KEYS[i + 1], c = (a, b) => new Color(a).lerp(new Color(b), k);
    const fog = c(A.fog, B.fog), night = 1 - dayK();
    stage.scene.fog.color.copy(fog); stage.scene.background.copy(fog); stage.scene.fog.density = lerp(A.fogD, B.fogD, k) * (degraded ? 1.25 : 1);
    const sd = new Vector3(...A.sunDir).lerp(new Vector3(...B.sunDir), k).normalize();
    sky.set({ top: c(A.top, B.top), mid: c(A.mid, B.mid), bot: c(A.bot, B.bot), stars: lerp(A.stars, B.stars, k), sun: lerp(A.disk, B.disk, k), sunDir: sd,   /* by night the disc is the Moon */ sunCol: c(A.sunCol, B.sunCol) });
    sun.color.copy(c(A.sunCol, B.sunCol)); sun.intensity = lerp(A.sun, B.sun, k) * (S && S.inside ? 0.15 : 1); sun.position.copy(sd).multiplyScalar(50).add(stage.camera.position); sun.target.position.copy(stage.camera.position);
    hemi.intensity = lerp(A.hemi, B.hemi, k) * (S && S.inside ? 0.35 : 1);
    // the skulls' eyes light up one by one when night falls
    if (night > 0.5) igniteClock += dt; else igniteClock = 0;
    const n = W.eyes.length; let lit = 0;
    for (let j = 0; j < n; j++) { const e = clamp((igniteClock - (j >> 1) * 0.07) / 0.35, 0, 1) * night; if (e > 0.5) lit++; const o = e * (0.75 + 0.25 * Math.sin(performance.now() * 0.004 + j)); if (Math.abs(W.eyes[j].material.opacity - o) > 0.01) W.eyes[j].material.opacity = o; }
    if (lit && lit !== applyTime.lit && lit % 6 === 0) fwip(lit / 6); applyTime.lit = lit;
    W.eyeSockets.material.emissiveIntensity = night * 2.2 * clamp(igniteClock / 2, 0, 1);
    W.fenceLight.intensity = night * 6 * clamp(igniteClock / 2, 0, 1);
    if (hut.doorGlow.material.opacity > 0) hut.doorGlow.material.opacity = 0.08 + 0.3 * night;
    hut.glowMat.color.copy(new Color(0x2a2016).lerp(new Color(0xffb35c), clamp(night * 1.2, 0, 1)));   // dark panes by day, warm light by night
    W.windowMat.color.copy(new Color(0x10182a).lerp(new Color(0xd8e4f0), dayK()));
  }
  let timeScale = 1;   // tests only: run the tale faster in software rendering
  function tick(dt, t) {
    if (!running || disposed || paused) return;
    dt *= timeScale;
    emaDt += (dt - emaDt) * 0.05; if (!degraded && emaDt > 0.045) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); W.detail.forEach(m => { m.visible = false; }); } } else lowFrames = Math.max(0, lowFrames - 1);
    for (const a of [...anims]) { a.t += dt; const k = Math.min(1, a.t / a.dur); a.f(k); if (k >= 1) { anims.delete(a); a.res(); } }
    dlg.tick(dt);
    const cam = stage.camera;
    if (!cine && !talking && !busy && !journalOpen && !poppy && input.enabled) {
      const lk = input.takeLook(); P.yaw -= lk.dx; P.pitch = clamp(P.pitch - lk.dy, -1.25, 1.25); P.yaw -= input.turn() * dt * 1.8;
      const mv = input.move(), sp = (input.running() ? 4.3 : 2.5) * (S.inside ? 0.7 : 1), f = fwd(), r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
      let vx = f.x * mv.y + r.x * mv.x, vz = f.z * mv.y + r.z * mv.x; const m = Math.hypot(vx, vz);
      if (m > 0.05) {
        vx /= Math.max(1, m); vz /= Math.max(1, m); let nx = P.x + vx * sp * dt, nz = P.z + vz * sp * dt;
        if (S.inside) { nx = clamp(nx, INT.x + ROOM.x0 + 0.3, INT.x + ROOM.x1 - 0.3); nz = clamp(nz, INT.z + ROOM.z0 + 0.3, INT.z + ROOM.z1 - 0.3); }
        else { const ok = (x, z) => Math.hypot(x, z - 20) < 116 && z < 95; if (!ok(nx, nz)) { if (ok(nx, P.z)) nz = P.z; else if (ok(P.x, nz)) nx = P.x; else { nx = P.x; nz = P.z; } } }
        P.x = nx; P.z = nz; P.bob += dt * sp * 2.2; stepT -= dt * sp; if (stepT < 0) { stepT = 1.8; audio.step(S.inside ? "wood" : "grass", 0.04); }
      }
      const q = { x: P.x, z: P.z }; col.resolve(q, 0.35); P.x = q.x; P.z = q.z;
      // the three horsemen pass on the road; the black one brings the night at the edge of the clearing
      if (S.phase === "road" && !busy) {
        if (!S.riders.white && P.z < 76) riderOnRoad("white");
        else if (S.riders.white && !S.riders.red && P.z < 48) riderOnRoad("red");
        else if (S.riders.red && !S.riders.black && P.z < 29) riderOnRoad("black");
      }
      if ((S.phase === "lantern") && P.z > 86 && !talking && !endingStarted) converse("home_lantern");
    }
    // camera: during cinematics it turns smoothly towards what matters
    if (lookAt) { const dx = lookAt.x - P.x, dz = lookAt.z - P.z, dy = lookAt.y - (P.y + 1.6), yawT = Math.atan2(-dx, -dz), pT = Math.atan2(dy, Math.hypot(dx, dz)); let d = yawT - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 2.5); P.pitch += (clamp(pT, -0.9, 0.9) - P.pitch) * Math.min(1, dt * 2.5); }
    P.y = lerp(P.y, groundY(P.x, P.z), Math.min(1, dt * 12)); const bob = Math.sin(P.bob) * 0.035;
    cam.position.set(P.x, P.y + 1.6 + bob, P.z); cam.rotation.order = "YXZ"; cam.rotation.set(P.pitch, P.yaw, 0); sky.follow(cam);
    applyTime(dt);
    hut.update(dt); cat.update(dt, { purr: S.flags.cat_fed ? 1 : 0 });
    if (yaga.group.visible) yaga.update(dt, { row: yagaState.row, talk: yagaState.talk });
    for (const d of dustPool) if (d.on) { d.t += dt; d.s.position.addScaledVector(d.v, dt); d.s.material.opacity = Math.max(0, 0.35 * (1 - d.t / 1.6)); d.s.scale.setScalar(0.6 + d.t * 1.5); if (d.t > 1.6) { d.on = false; d.s.visible = false; } }
    lantern.group.rotation.z = Math.sin(t * 2.3) * 0.05 + Math.sin(P.bob * 0.5) * 0.04; if (lantern.group.visible && !cine) lantern.light.intensity = 2.6 + Math.sin(t * 7) * 0.2;
    // the stove inside
    const fireK = S.tasks.supper || W.stoveLight.intensity > 2.5 ? 1 : 0.15; W.fire.material.opacity = fireK * (0.6 + 0.2 * Math.sin(t * 9)); W.stoveLight.intensity = Math.max(fireK * (2.4 + Math.sin(t * 11) * 0.3), W.stoveLight.intensity * 0.99);
    audio.setLayer("fire", S.inside ? 0.04 * fireK : 0, 0.5); audio.setLayer("wind", S.inside ? 0.01 : 0.05, 0.6); audio.setLayer("leaves", S.inside ? 0 : 0.008 + 0.006 * dayK(), 0.8);
    updateChase(dt);
    // the doll's guidance
    askK += ((asking && !talking ? 1 : 0) - askK) * Math.min(1, dt * 4);
    { const target = dollTarget(); if (target && askK > 0.05) { let a = Math.atan2(-(target[0] - P.x), -(target[1] - P.z)) - P.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); hud.lbar.style.opacity = askK; hud.lbar.querySelector("u").style.left = 50 + clamp(a / 1.6, -1, 1) * 46 + "%"; hud.lbar.classList.toggle("ahead", Math.abs(a) < 0.25); } else hud.lbar.style.opacity = 0; }
    updatePrompt();
    saveTimer += dt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); }; addEventListener("pagehide", onHide);
  function dispose() { if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide); try { persist(); } catch (e) { /* ignore */ } try { poppy && poppy.close(); stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ } host.innerHTML = ""; }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get cine() { return cine; }, get tod() { return tod; }, get degraded() { return degraded; },
      get hut() { return hut && { yaw: hut.root.rotation.y, crouch: hut.state.crouch, y: hut.body.position.y }; }, get yaga() { return yaga && { on: yaga.group.visible, pos: yaga.group.position.toArray() }; },
      get chase() { return { on: chase.on, out: chase.out, wait: chase.wait, dist: yaga ? Math.hypot(chase.yp.x - P.x, chase.yp.z - P.z) : 0, stop: chase.stop, river: !!chase.river, comb: !!chase.comb }; },
      get eyesLit() { return W ? W.eyes.filter(e => e.material.opacity > 0.4).length : 0; }, get riders() { return riders.length; }, get poppyOpen() { return !!poppy; },
      tp: (x, z) => { P.x = x; P.z = z; P.y = groundY(x, z); }, pos: () => [P.x, P.z, P.yaw], H, near: () => candidates().map(c => c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), skip: () => dlg.skip(), dlgVisible: () => dlg.visible,
      look: (yaw, pitch) => { P.yaw = yaw; P.pitch = pitch || 0; }, ask: v => { asking = !!v; if (v) dollHint(); }, toggleJournal, persist, ending: () => S && S.ending, endingsFound, throwNext,
      patch: p => { Object.assign(S, p); syncWorld(true); updateHud(); }, poppySolve: () => poppy && poppy.solve(), poppyPick: (x, y) => poppy && poppy.pick(x, y), poppyCrumbs: () => poppy && poppy.crumbs(),
      setTimeScale: k => { timeScale = k; }, evening: () => evening(),
      jump: async id => { while (busy) await wait(50); talking = false; return converse(id); }, stage: () => stage, sites: SITES, INT,
    },
  };
}
