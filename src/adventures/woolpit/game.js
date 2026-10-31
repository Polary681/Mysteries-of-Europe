// THE GREEN CHILDREN OF WOOLPIT - 3D narrative adventure (third person). Story rules live in story.js; this file is scene, input, UI and flow.
import { Color, HemisphereLight, DirectionalLight, PointLight, Vector3 } from "three";
import { createStage } from "../../engine.js";
import { AudioBus } from "../../shared/audio.js";
import { createInput } from "../../shared/input.js";
import { createShell } from "../../shared/ui.js";
import { sceneSVG } from "../../ui/art.js";
import { load, save, clear, loadObj } from "../../shared/save.js";
import { el } from "../../common.js";
import { Colliders, makeSky, makeHuman, makeShadow, nameLabel } from "../../shared/world.js";
import { ChaseCam } from "../../shared/world.js";
import { Dialogue, applyFx, clamp, restoreState, validPos } from "../../narrative/core.js";
import { createDialogueUI } from "../../narrative/dialogue-ui.js";
import * as ST from "./story.js";
import { buildVillage, L, groundH } from "./world.js";

const LOOKS = {
  day: { top: 0x5d86c8, mid: 0xa9c4e4, bot: 0xf0dcb0, fog: 0xcdbf98, fogD: 0.0115, sunC: 0xffe2a0, sunI: 2.0, hS: 0xbcd0ff, hG: 0x6a5a3a, hI: 0.95, stars: 0, sunGlow: 1, win: 0, sun: [0.5, 0.55, -0.45] },
  grey: { top: 0x6f7f98, mid: 0xa6b0bd, bot: 0xcfd0cb, fog: 0xb4b9bb, fogD: 0.019, sunC: 0xdfe6f0, sunI: 0.9, hS: 0xb8c4d6, hG: 0x5a5a48, hI: 1.0, stars: 0, sunGlow: 0.1, win: 0.25, sun: [0.2, 0.5, 0.6] },
  day2: { top: 0x4f7cb8, mid: 0x9db9d8, bot: 0xe6d0a8, fog: 0xc3b995, fogD: 0.0125, sunC: 0xffd894, sunI: 1.8, hS: 0xb0c6f0, hG: 0x65563a, hI: 0.9, stars: 0, sunGlow: 1, win: 0, sun: [-0.5, 0.4, -0.5] },
  dusk: { top: 0x241f55, mid: 0x6a4f8a, bot: 0xe0845f, fog: 0x5a456a, fogD: 0.017, sunC: 0xff9a5a, sunI: 0.8, hS: 0x7a6aa8, hG: 0x3a2a3a, hI: 0.7, stars: 0.45, sunGlow: 1, win: 1, sun: [0.8, 0.08, -0.3] },
  hollow: { top: 0x070c24, mid: 0x142a45, bot: 0x2c5560, fog: 0x1b3440, fogD: 0.032, sunC: 0x7aa8c0, sunI: 0.2, hS: 0x4a6a9a, hG: 0x1a2a2a, hI: 0.55, stars: 1, sunGlow: 0, win: 1, sun: [-0.3, 0.5, 0.4] },
};
const GREEN = new Color(0x86d070), TAN = new Color(0xe2b898), GLOW = new Color(0x1a4a14);
const VOICE = { girl: { pitch: 470, kind: "sine" }, boy: { pitch: 560, kind: "sine" }, edith: { pitch: 300, kind: "triangle" }, hugh: { pitch: 150, kind: "sawtooth" }, aldwin: { pitch: 200, kind: "triangle" }, maud: { pitch: 255, kind: "triangle" }, richard: { pitch: 175, kind: "triangle" }, walter: { pitch: 230, kind: "triangle" }, narr: { pitch: 0 }, you: { pitch: 0 } };
const ITEMS = { bread: "Bread", water: "Cup of water", bean: "Raw broad beans", bell: "Handbell", tonic: "Herb tonic", cloth: "Strange cloth" };
const OBJ = { pits: [L.pits, 4.8], cloth: [L.cloth, 2.6], well: [L.well, 2.6], beans: [L.beans, 5], bell: [L.altar, 3.0], grave: [L.grave, 2.8], bed: [L.bed, 2.6], bench: [L.bench, 2.6] };
const REL_TXT = r => r >= 4 ? "Devoted" : r >= 2 ? "Trusting" : r >= 1 ? "Friendly" : r <= -2 ? "Hostile" : r <= -1 ? "Wary" : "Neutral";
const SCENE_EVENTS = new Set(["act2", "act3", "boy_dead_scene", "dusk", "mob_scene", "hollow", "finale"]);
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "The Green Children of Woolpit", kicker: "Legend · Suffolk, England · 12th century", accent: "#9cba84", accent2: "#d6c07e", art: sceneSVG("woolpit"), journal: true,
    tagline: "A harvest field. Two children with green skin. A village that must decide what they are.",
    note: "A narrative adventure with real choices. Your decisions change what people trust, fear and understand, and there are six different endings. The story follows the 12th-century chronicles, and a codex (J) always tells you what is historical and what is invented here.",
    controls: [["W A S D", "move"], ["Shift", "run"], ["Mouse drag / ← →", "look"], ["E / Space", "interact"], ["1-4", "choose"], ["J", "journal"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, world = null, cam = null, sky = null, D = null, S = null, player = null, hud = null, journalEl = null;
  let running = false, paused = false, busy = false, talking = false, journalOpen = false, disposed = false, phase = "day", endingStarted = false, pendingRelocate = false, cine = null, hollowBells = null;
  let npcs = {}, villagers = [], torchLights = [], hemi, sun, curLook = null, tgtLook = null, stepT = 0, saveTimer = 0, lastPrompt = "", nearest = null, placedWhere = null, degraded = false, emaDt = 0.016, lowFrames = 0, shownGrave = false;
  const col = new Colliders(), tmpV = new Vector3(), pad = Object.assign(new Vector3(), { x: 0, z: 0 });

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && s.s.act >= 2 && !s.s.ending && ["manor", "church", "barn", "reeve"].includes(s.s.where) ? s : null; };   // (from act 2 on the children are always somewhere: a save without it is damaged)
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    const found = Object.keys(endingsFound()).length;
    shell.title({
      hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${found} / 6</p>`,
      onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); },
    });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume();
    shell.loading(0, "Waking the village…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0xcdbf98, fog: 0.012, fov: 58, far: 330, maxPR: 1.6 });
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: false });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(0.8); stage.scene.add(sky.mesh); hemi = new HemisphereLight(0xbcd0ff, 0x6a5a3a, 0.9); sun = new DirectionalLight(0xffe2a0, 2); sun.position.set(40, 50, -30);
      stage.scene.add(hemi, sun);
      for (let i = 0; i < 2; i++) { const pl = new PointLight(0xff9a40, 0, 16, 1.6); stage.scene.add(pl); torchLights.push(pl); }
      cam = new ChaseCam(stage.camera, { dist: 5.2, height: 1.65 }); cam.groundAt = groundH;
      curLook = {}; tgtLook = {};
      wireInput();
      world = buildVillage(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.7, m)); await frame();
      shell.loading(0.85, "Gathering the villagers…"); await frame();
      buildPeople();
      stage.onFrame(tick);
    }
    shell.loading(0.95, "Almost there…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false; cine = null; cam.clearShot();
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i));
    mobOn = false; torchLights.forEach(l => { l.intensity = 0; }); world.hollowGlow.material.opacity = 0; placedWhere = null; layoutAll(true); setPhase(phaseFor(), true);
    if (saved && validPos(saved.pos)) { player.h.group.position.set(saved.pos[0], 0, saved.pos[1]); player.h.group.rotation.y = saved.pos[2] || 0; } else { player.h.group.position.set(24, 0, 23.6); player.h.group.rotation.y = Math.PI / 2; }
    cam.yaw = Math.PI / 2 + 0.3; cam.snap(); syncVisuals(); updateHud();
    shell.close(); shell.setRunning(true); shell.objective(ST.objective(S)); running = true; input.enabled = true; hudShow(true);
    if (!saved) { audio.stopAllLayers(); startAmbience(); await shell.fade(false, 900); converse("a1_arrive"); }
    else { audio.stopAllLayers(); startAmbience(); await shell.fade(false, 700); shell.toast("Progress restored. Welcome back."); }
  }

  /* ---------------- people ---------------- */
  function buildPeople() {
    const mk = (id, o, name = ST.WHO[id] && ST.WHO[id].name) => {
      const h = makeHuman(o); h.group.add(makeShadow(0.55, 0.9)); stage.scene.add(h.group);
      const label = name ? nameLabel(name) : null; if (label) { label.position.y = (o.scale || 1) * 2.0; h.group.add(label); label.visible = false; }
      return { id, h, label, vis: true };
    };
    player = mk("you", { cloth: 0x7a5a2a, cloth2: 0x3a2c1a, hair: 0x2a1c10, scale: 1 }, null);
    const kid = { skin: 0x86d070, cloth: 0x6f8274, cloth2: 0x55665a, hair: 0x9aa050, emissive: 0x1a4a14, robe: false, stripes: false };
    npcs.girl = mk("girl", { ...kid, scale: 0.82, longHair: true }); npcs.boy = mk("boy", { ...kid, scale: 0.72 });
    npcs.edith = mk("edith", { cloth: 0x9a5a3a, cloth2: 0xe9e2cf, hair: 0x6a3a1a, hat: "coif", longHair: true });
    npcs.hugh = mk("hugh", { cloth: 0x4a5a3a, cloth2: 0x2a2a1a, hair: 0x3a2a1a, hat: "cap", beard: true, scale: 1.06 });
    npcs.aldwin = mk("aldwin", { cloth: 0x3a2f2a, cloth2: 0x2a2018, robe: true, hair: 0xcfcfcf, scale: 1.0 });
    npcs.maud = mk("maud", { cloth: 0x5a4a6a, cloth2: 0x3a2f48, robe: true, hair: 0xb0b0b0, hat: "coif", scale: 0.94 });
    npcs.richard = mk("richard", { cloth: 0x2a3a6a, cloth2: 0xc9a24a, hair: 0x2a1c10, beard: true, scale: 1.06 });
    npcs.walter = mk("walter", { cloth: 0x222222, cloth2: 0x111111, robe: true, hood: true, hair: null });
    const cl = [0x7a5a3a, 0x6a6a4a, 0x8a4a3a, 0x4a5a6a, 0x7a6a4a];
    for (let i = 0; i < 10; i++) { const v = mk("villager", { cloth: cl[i % 5], cloth2: 0x3a2c1a, hair: [0x3a2a1a, 0x6a4a2a, 0xa08040, 0x222018][i % 4], hat: i % 3 === 0 ? "cap" : null, scale: 0.94 + (i % 4) * 0.04, longHair: i % 2 === 1 }, null); v.torch = world.torch(v.h.group, 0.42, 1.3, 0.35); v.torch.visible = false; villagers.push(v); }
  }
  const A1 = { girl: [28, 20.6], boy: [29.1, 20.2], edith: [24.5, 18.5], hugh: [26, 25.2], aldwin: [32, 17.8], maud: [32.8, 24], richard: [-34, -26.2], walter: [-7, -6.4] };
  const KIDS = { manor: [[-31.2, -26.4], [-30.2, -26.8]], church: [[-21.6, -4.2], [-21.1, -5.3]], barn: [[15.2, -15.3], [16.4, -15.1]], reeve: [[11.4, 14.7], [12.6, 14.9]] };
  const VIL1 = [[22.5, 21.5], [24, 16], [30, 15.5], [34, 19], [34.5, 23.5], [30, 26.5], [22, 24.5], [36, 26], [26, 14], [20, 19]];
  const VIL2 = [[-3, -10], [9, -6], [-10, 6], [2, 9], [18, -1], [-2, -14], [-18, 12], [14, 2], [-12, -2], [4, 14]];
  const VIL_ANGRY = [[7.5, 8.5], [9.5, 10.5], [6, 11], [10.5, 7.5]];
  function place(n, x, z, face) { n.h.group.position.set(x, groundH(x, z), z); if (face) n.h.faceToward(face[0], face[1], 1); n.home = { x, z }; }
  function layoutAll(force) {
    const act = S.act, hid = (n, v) => { n.vis = v; n.h.group.visible = v; };
    const c = S.where; placedWhere = c;
    if (act === 1) {
      for (const k of ["girl", "boy", "edith", "hugh", "aldwin", "maud", "richard"]) { place(npcs[k], ...A1[k], [28, 20]); hid(npcs[k], true); }
      place(npcs.walter, ...A1.walter); hid(npcs.walter, false); npcs.girl.h.faceToward(24, 23, 1); npcs.boy.h.faceToward(24, 23, 1);
      villagers.forEach((v, i) => { place(v, ...VIL1[i], [28, 20.4]); hid(v, true); v.torch.visible = false; });
    } else {
      const k = KIDS[c];
      if (act === 2) { place(npcs.girl, ...k[0], [k[0][0], k[0][1] + 5]); place(npcs.boy, ...k[1], [k[1][0], k[1][1] + 5]); hid(npcs.boy, true); }
      else if (S.boy === "lives") { place(npcs.girl, 5.2, -4.6, [0, 0]); place(npcs.boy, 6.6, -3.6, [0, 0]); hid(npcs.boy, true); }
      else { place(npcs.girl, -24.6, 5.6, [L.grave[0], L.grave[1]]); hid(npcs.boy, false); }
      hid(npcs.girl, true);
      place(npcs.edith, 22.5, -12.5, [L.beans[0], L.beans[1]]); place(npcs.hugh, act === 2 && c === "reeve" ? 12 : 7, act === 2 && c === "reeve" ? 11.6 : 5, [0, 0]);
      place(npcs.aldwin, -16.2, -4.2, [-30, -4]); place(npcs.maud, -11.5, 16.5, [-14, 18]); place(npcs.richard, -34, -26.2, [-34, -20]); place(npcs.walter, -7, -6.4, [0, 0]);
      for (const kk of ["edith", "hugh", "aldwin", "maud", "richard", "walter"]) hid(npcs[kk], true);
      const angry = S.susp >= 5; villagers.forEach((v, i) => { const p = angry && i < 4 ? VIL_ANGRY[i] : VIL2[i]; place(v, p[0], p[1], angry && i < 4 ? [11, 14] : [0, 0]); hid(v, i < (angry ? 10 : 7)); v.torch.visible = false; });
    }
  }
  function syncVisuals() {
    for (const k of ["girl", "boy"]) { const n = npcs[k], sk = n.h.skinM; sk.color.copy(GREEN).lerp(TAN, clamp(S.skin, 0, 1)); sk.emissive.copy(GLOW).multiplyScalar(1 - clamp(S.skin, 0, 1)); }
    world.grave.visible = S.boy === "dead" && S.act >= 3; world.altarBell.visible = !S.items.bell; world.hidden.cloth.visible = !S.items.cloth && S.act >= 2 || S.act === 1;
    if (S.boy === "weak" && S.act === 3) npcs.boy.h.group.visible = npcs.boy.vis = false;
    npcs.walter.h.group.visible = npcs.walter.vis = S.act >= 2; if (!endingStarted) setPhase(phaseFor());
    shell.objective(ST.objective(S));
  }
  const phaseFor = () => (S.ending || endingStarted ? phase : S.act === 1 ? "day" : S.act === 2 ? "grey" : "day2");
  function setPhase(name, instant) {
    phase = name; const t = LOOKS[name]; tgtLook = { top: new Color(t.top), mid: new Color(t.mid), bot: new Color(t.bot), fog: new Color(t.fog), sunC: new Color(t.sunC), hS: new Color(t.hS), hG: new Color(t.hG), fogD: t.fogD, sunI: t.sunI, hI: t.hI, stars: t.stars, sunGlow: t.sunGlow, win: t.win, sun: new Vector3(...t.sun).normalize() };
    if (instant || !curLook.top) curLook = { top: tgtLook.top.clone(), mid: tgtLook.mid.clone(), bot: tgtLook.bot.clone(), fog: tgtLook.fog.clone(), sunC: tgtLook.sunC.clone(), hS: tgtLook.hS.clone(), hG: tgtLook.hG.clone(), fogD: t.fogD, sunI: t.sunI, hI: t.hI, stars: t.stars, sunGlow: t.sunGlow, win: t.win, sun: tgtLook.sun.clone() };
    startAmbience();
  }
  function applyLook(dt) {
    const k = 1 - Math.exp(-dt * 1.4), T = tgtLook, C = curLook; if (!T || !C.top) return;
    for (const key of ["top", "mid", "bot", "fog", "sunC", "hS", "hG", "sun"]) C[key].lerp(T[key], k);
    for (const key of ["fogD", "sunI", "hI", "stars", "sunGlow", "win"]) C[key] += (T[key] - C[key]) * k;
    const susp = S ? S.susp : 0, trust = S ? S.trust : 0; // visible consequence: more suspicion = colder, thicker, darker air
    stage.scene.fog.color.copy(C.fog); stage.scene.fog.density = C.fogD * (1 + susp * 0.05) * (degraded ? 1.35 : 1); stage.scene.background.copy(C.fog);
    hemi.color.copy(C.hS); hemi.groundColor.copy(C.hG); hemi.intensity = C.hI * (1 - susp * 0.02); sun.color.copy(C.sunC); sun.intensity = C.sunI * (1 + clamp(trust, 0, 8) * 0.015) * (1 - susp * 0.03); sun.position.copy(C.sun).multiplyScalar(60);
    sky.set({ top: C.top, mid: C.mid, bot: C.bot, stars: C.stars, sun: C.sunGlow, sunDir: C.sun, sunCol: C.sunC });
    world.winMat.color.setHex(0x2a2418).lerp(new Color(0xffc86a), clamp(C.win, 0, 1));
  }

  /* ---------------- ambience ---------------- */
  function startAmbience() {
    if (!audio.ctx) return; const night = phase === "dusk" || phase === "hollow";
    audio.layer("wind", { kind: "pink", filter: "lowpass", freq: night ? 420 : 600, gain: night ? 0.085 : 0.06, lfoRate: 0.11, lfoDepth: 0.5 });
    if (!audio.layers.has("grass")) audio.layer("grass", { kind: "white", filter: "highpass", freq: 3800, q: 0.4, gain: 0.006, lfoRate: 0.2, lfoDepth: 0.6 });
    audio.setLayer("wind", night ? 0.085 : phase === "grey" ? 0.075 : 0.05, 2);
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    if (!night) audio._amb.push(audio.every(() => audio.chirp(2600 + Math.random() * 1500), 2500, 7000)); else audio._amb.push(audio.every(() => audio.cricket(), 500, 1800));
    if (phase === "hollow" || (S && S.act === 3 && S.flags.heard_bells_detail && phase === "dusk")) audio._amb.push(audio.every(() => audio.bell([392, 523, 587, 659, 784][(Math.random() * 5) | 0], 0.03, Math.random() * 1.6 - 0.8), 1600, 4200));
  }

  /* ---------------- input & controls ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" });
    input.on((a, x) => {
      if (!running || disposed) return;
      if (a === "pause") return togglePause();
      if (a === "mute") return toggleSound();
      if (paused) return;
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (!busy) tryInteract(); }
      if (a === "num" && talking && !busy) dlg.pickNum(x);
    });
    shell.bind({ pause: () => togglePause(), sound: () => toggleSound(), journal: () => { if (running && !paused) toggleJournal(); } });
    host.addEventListener("pointerdown", () => { audio.resume(); });
  }
  const toggleSound = () => { audio.setMuted(!audio.muted); shell.setSoundIcon(!audio.muted); };
  function togglePause() {
    if (!running) return;
    if (journalOpen) return toggleJournal();
    if (paused) { shell.resume(); paused = false; audio.duck(1); return; }
    paused = true; audio.duck(0.25);
    shell.pauseMenu({ onResume: () => { paused = false; audio.duck(1); }, onRestart: () => { paused = false; audio.duck(1); clear(ST.SAVE_KEY); shell.fade(true, 300).then(() => begin(null)); }, onExit: () => { persist(); dispose(); onExit(); }, onSound: toggleSound, soundOn: () => !audio.muted });
  }

  /* ---------------- HUD (meters, prompt, journal) ---------------- */
  function hudShow(v) {
    if (!hud) {
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="meters"><div class="m" data-m="trust"><b>Trust</b><i><u></u></i></div><div class="m" data-m="susp"><b>Suspicion</b><i><u></u></i></div><div class="m" data-m="know"><b>Knowledge</b><i><u></u></i></div></div>`;
      host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = '<kbd>E</kbd><span></span>'; host.querySelector(".adv-ui").append(pr); hud.prompt = pr;
      pr.addEventListener("pointerdown", e => { e.preventDefault(); if (!busy && !talking && running && !paused) tryInteract(); });
    }
    hud.style.display = v ? "" : "none"; if (!v) hud.prompt.hidden = true;
  }
  function updateHud(pulse) {
    if (!hud || !S) return;
    const set = (k, v, max, mn = 0) => { const m = hud.querySelector(`[data-m=${k}]`); m.querySelector("u").style.width = Math.round((v - mn) / (max - mn) * 100) + "%"; m.title = `${v}`; if (pulse === k) { m.classList.remove("pulse"); void m.offsetWidth; m.classList.add("pulse"); } };
    set("trust", S.trust, 10, -3); set("susp", S.susp, 10); set("know", S.know, 20);
  }
  function toggleJournal() {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking; audio.duck(1); return; }
    journalOpen = true; input.enabled = false; audio.duck(0.5); renderJournal("journal");
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove();
    journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["journal", "Journal"], ["codex", "Codex"], ["people", "People"], ["words", "Words"]];
    let body = "";
    if (tab === "journal") {
      const clues = Object.keys(S.clues);
      body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p><h4>Clues <small>${clues.length}</small></h4>` + (clues.length ? `<ul>${clues.map(c => `<li>${ST.CLUE_TEXT[c] || c}</li>`).join("")}</ul>` : "<p class=mut>Nothing yet. Look at things and talk to people.</p>")
        + `<h4>How you are seen</h4><p class="mut">Trust ${S.trust}/10 · Suspicion ${S.susp}/10 · Knowledge ${S.know}/20. These numbers change how people treat you, and how the story can end.</p>`;
    } else if (tab === "codex") {
      const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]);
      body = `<p class="mut">What is history and what is invented. ${got.length} / ${ids.length} entries found.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${c.kind === "historical" ? "Historical" : c.kind === "invented" ? "Invented for this game" : "Uncertain / disputed"}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join("");
    } else if (tab === "people") {
      body = ["edith", "hugh", "aldwin", "maud", "richard", "walter"].map(id => { const w = ST.WHO[id], r = S.rel[id] || 0; return `<div class="rel"><b>${w.name}</b> <small>${w.role}</small><span>${REL_TXT(r)}</span><i><u style="width:${Math.round((r + 3) / 8 * 100)}%"></u></i></div>`; }).join("");
    } else {
      const ws = Object.keys(S.words); body = ws.length ? `<p class="mut">Words of the children’s language that you have learned.</p><ul>${ws.map(w => `<li><b>${ST.WORDS[w]}</b> = ${w}</li>`).join("")}</ul>` : "<p class=mut>You have not learned any of their words yet. Showing them objects may help.</p>";
    }
    journalEl.innerHTML = `<div class="adv-card jr"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else renderJournal(b.dataset.t); });
    host.querySelector(".adv-ui").append(journalEl);
  }

  /* ---------------- interaction ---------------- */
  function candidates() {
    const p = player.h.group.position, out = [];
    for (const id of ["girl", "boy", "edith", "hugh", "aldwin", "maud", "richard", "walter"]) {
      const n = npcs[id]; if (!n.vis || !n.h.group.visible) continue; const node = ST.talkNode(id, S); if (!node) continue;
      const d = Math.hypot(n.h.group.position.x - p.x, n.h.group.position.z - p.z); if (d < 3.2) out.push({ kind: "talk", id, d, node });
    }
    for (const id in OBJ) { if (!ST.objectAvailable(id, S)) continue; const [[x, z], r] = OBJ[id], d = Math.hypot(x - p.x, z - p.z); if (d < r) { const node = ST.objectNode(id, S); if (node) out.push({ kind: "obj", id, d: d * 0.8, node }); } }
    return out.sort((a, b) => a.d - b.d);
  }
  function tryInteract() { const c = candidates()[0]; if (!c) return false; converse(c.node, c.kind === "talk" ? c.id : null); return true; }
  function updatePrompt() {
    const c = (running && !talking && !busy && !paused && !journalOpen) ? candidates()[0] : null; nearest = c;
    const txt = c ? ST.labelFor(c.id, S) : ""; if (txt === lastPrompt) return; lastPrompt = txt;
    hud.prompt.hidden = !c; hud.prompt.querySelector("span").textContent = txt; input.buttons.interact && input.buttons.interact.classList.toggle("ready", !!c);
  }

  /* ---------------- conversation flow ---------------- */
  async function converse(nodeId, speakerId) {
    if (busy || talking) return; talking = true; input.enabled = false; hud.prompt.hidden = true; lastPrompt = ""; stage.host.classList.add("in-dialogue");
    try { if (speakerId) { facePlayer(npcs[speakerId]); } await present(D.start(nodeId)); } catch (e) { console.error(e); endTalk(); }
  }
  async function step(kind, i) { if (busy || !talking) return; try { await present(kind === "choose" ? D.choose(i) : D.advance()); } catch (e) { console.error(e); endTalk(); } }
  function facePlayer(n) { if (n && n.h) { n.h.faceToward(player.h.group.position.x, player.h.group.position.z, 1); } }
  async function present(v) {
    busy = true;
    try {
      const ev = D.drainEvents(), hasToast = ev.some(e => e.t === "toast"), scene = ev.filter(e => e.t === "event" && SCENE_EVENTS.has(e.id));
      for (const e of ev) handleEvent(e, hasToast);
      if (scene.length) { dlg.hide(); cine = null; cam.clearShot(); await transition(scene.map(e => e.id)); }
      if (S.ending && !endingStarted) { await playEnding(); return; }
      if (!v) { endTalk(); return; }
      showView(v);
    } finally { busy = false; }
  }
  function showView(v) {
    const who = ST.WHO[v.who] || ST.WHO.narr; const n = npcs[v.who];
    dlg.show(v, who, VOICE[v.who] || VOICE.narr); setShot(v);
    if (n && n.h && v.who !== "you") { facePlayer(n); const r = Math.random(); n.h.gesture(v.garbled ? "cower" : r < 0.35 ? "nod" : r < 0.55 ? "shrug" : r < 0.7 ? "point" : "shake", 900); }
  }
  function setShot(v) {
    let id = v.who; if (id === "narr" || id === "you") id = S.act === 1 && !S.seen.a1_where ? "girl" : (S.act === 3 && (S.seen.mob_open || S.seen.finale) ? "girl" : null);
    const n = id && npcs[id]; if (!n || !n.h.group.visible) { cam.clearShot(); return; }
    const p = player.h.group.position, q = n.h.group.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, rx = -uz, rz = ux, hh = n.h.scale * 1.45;
    cam.setShot({ pos: new Vector3(p.x - ux * 3.3 + rx * 1.8, groundH(p.x, p.z) + 2.15, p.z - uz * 3.3 + rz * 1.8), look: new Vector3(q.x * 0.8 + p.x * 0.2, groundH(q.x, q.z) + hh * 0.92, q.z * 0.8 + p.z * 0.2), fov: 46 });
  }
  function endTalk() {
    dlg.hide(); cam.clearShot(); talking = false; input.enabled = !journalOpen; stage.host.classList.remove("in-dialogue");
    if (placedWhere !== S.where && S.act >= 2) { relocateKids(); }
    syncVisuals(); updateHud(); persist();
  }
  async function relocateKids() { busy = true; await shell.fade(true, 500); layoutAll(); await shell.fade(false, 700); busy = false; }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "meter": { const names = { trust: "Trust", susp: "Suspicion", know: "Knowledge" }; shell.toast(`${names[e.k]} ${e.d > 0 ? "+" : ""}${e.d}`, e.k === "susp" ? (e.d > 0 ? "bad" : "good") : (e.d > 0 ? "good" : "bad")); updateHud(e.k); audio[e.k === "susp" ? (e.d > 0 ? "bad" : "good") : (e.d > 0 ? "good" : "bad")](); break; }
      case "rel": shell.toast(e.d > 0 ? `${ST.WHO[e.id].name} thinks better of you.` : `${ST.WHO[e.id].name} thinks less of you.`, e.d > 0 ? "good" : "bad"); break;
      case "item": shell.toast("Picked up: " + (ITEMS[e.id] || e.id), "item"); break;
      case "clue": if (!hasToast) shell.toast("New clue in your journal (J).", "clue"); break;
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
      case "word": audio.good(); break;
    }
  }

  /* ---------------- scene transitions ---------------- */
  async function transition(ids) {
    await shell.fade(true, 700);
    for (const id of ids) {
      if (id === "act2") { shell.toast("Tip: press E to talk or examine things, J for your journal.", "clue"); layoutAll(); player.h.group.position.set(L.green[0] + 2, 0, L.green[1] + 4); setPhase("grey"); audio.bell(262, 0.08); }
      else if (id === "act3") { layoutAll(); const p = S.where === "church" ? [-15.5, -4] : [2, 3]; player.h.group.position.set(p[0], 0, p[1]); setPhase("day2"); audio.bell(262, 0.08); }
      else if (id === "boy_dead_scene") { world.grave.visible = true; npcs.boy.vis = npcs.boy.h.group.visible = false; npcs.girl.h.group.position.set(-24.6, groundH(-24.6, 5.6), 5.6); player.h.group.position.set(-21.6, 0, 6.4); for (let i = 0; i < 3; i++) setTimeout(() => audio.bell(196, 0.1), i * 1900); }
      else if (id === "dusk") { setPhase("dusk"); player.h.group.position.set(3, 0, 1.2); npcs.girl.vis = npcs.girl.h.group.visible = true; npcs.girl.h.group.position.set(4.8, groundH(4.8, -0.6), -0.6); npcs.girl.h.faceToward(0, 0, 1); if (S.boy === "lives") { npcs.boy.vis = npcs.boy.h.group.visible = true; npcs.boy.h.group.position.set(5.9, groundH(5.9, 0.3), 0.3); } villagers.forEach(v => { v.h.group.visible = v.vis = false; }); }
      else if (id === "mob_scene") { stageMob("mob"); }
      else if (id === "finale") { stageMob("finale"); setPhase("dusk"); }
      else if (id === "hollow") { stageMob("hollow"); setPhase("hollow"); const [hx, hz] = L.hollow; player.h.group.position.set(hx - 3.2, 0, hz + 1); npcs.girl.vis = npcs.girl.h.group.visible = true; npcs.girl.h.group.position.set(hx - 1.6, groundH(hx, hz), hz + 1.6); npcs.girl.h.faceToward(hx + 4, hz - 2, 1); if (S.boy === "lives") { npcs.boy.vis = npcs.boy.h.group.visible = true; npcs.boy.h.group.position.set(hx - 2.2, groundH(hx, hz), hz + 2.4); npcs.boy.h.faceToward(hx + 4, hz - 2, 1); } world.hollowGlow.material.opacity = 0.5; audio.bell(523, 0.07, 0.4); }
      player.h.group.position.y = groundH(player.h.group.position.x, player.h.group.position.z);
    }
    cam.yaw = Math.atan2(-(npcs.girl.h.group.position.x - player.h.group.position.x), -(npcs.girl.h.group.position.z - player.h.group.position.z)) + 0.3; cam.snap(); startAmbience();
    await shell.fade(false, 900);
  }
  let mobOn = false;
  function stageMob(mode) { // mode: "mob" | "finale" | "hollow"
    const on = mode === "mob"; mobOn = on; torchLights.forEach(l => { l.intensity = on ? 5 : 0; });
    if (!on) {
      villagers.forEach(v => { v.torch.visible = false; v.h.group.visible = v.vis = false; });
      if (mode === "hollow" || S.flags.fled_mob) { for (const k of ["edith", "hugh", "aldwin", "maud", "richard", "walter"]) npcs[k].vis = npcs[k].h.group.visible = false; return; }
      layoutFinaleCast(); return;
    }
    player.h.group.position.set(0.5, groundH(0.5, 1.5), 1.5); npcs.girl.vis = npcs.girl.h.group.visible = true; place(npcs.girl, 1.9, 1.0, [0, 8]);
    if (S.boy === "lives") { place(npcs.boy, 2.6, 2.0, [0, 8]); npcs.boy.vis = npcs.boy.h.group.visible = true; } else npcs.boy.vis = npcs.boy.h.group.visible = false;
    place(npcs.hugh, 0, 6.2, [0, 0]); place(npcs.edith, -3.2, 5.0, [0, 0]); place(npcs.aldwin, 3.3, 5.2, [0, 0]); place(npcs.maud, -5.5, 6.5, [0, 0]); place(npcs.richard, 6.2, 7.8, [0, 0]);
    for (const k of ["hugh", "edith", "aldwin", "maud"]) npcs[k].vis = npcs[k].h.group.visible = true; npcs.richard.vis = npcs.richard.h.group.visible = S.rel.richard >= 1;
    villagers.forEach((v, i) => { const a = (-0.95 + i * 0.21) * Math.PI * 0.62, r = 8.2 + (i % 3) * 1.3; place(v, Math.sin(a) * r, Math.cos(a) * r + 1, [0.5, 1.5]); v.h.group.visible = v.vis = true; v.torch.visible = true; });
    npcs.hugh.h.gesture("point", 1500);
  }
  function layoutFinaleCast() { place(npcs.edith, -3.4, 4.5, [0, 0]); place(npcs.aldwin, 3.8, 4.8, [0, 0]); place(npcs.hugh, 0.5, 6.6, [0, 0]); place(npcs.maud, -6, 5.5, [0, 0]); place(npcs.richard, 6.5, 6.2, [0, 0]); npcs.richard.vis = npcs.richard.h.group.visible = S.rel.richard >= 1; npcs.walter.vis = npcs.walter.h.group.visible = true; place(npcs.walter, -1.6, -1.8, [3, 0]); }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    endingStarted = true; dlg.hide(); talking = true; input.enabled = false; hud.prompt.hidden = true; hudShow(false);
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id]; const found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    const g = npcs.girl.h.group, p0 = g.position.clone(), [hx, hz] = L.hollow, t0 = performance.now();
    const gp = g.position;
    cine = (dt) => {
      const k = (performance.now() - t0) / 1000;
      cam.setShot({ pos: new Vector3(gp.x + 3.2 - k * 0.15, gp.y + 1.9 + k * 0.1, gp.z + 3.4), look: new Vector3(gp.x, gp.y + 1.2, gp.z), fov: 42 });
      if (id === "bells") { const w = Math.min(1, k / 3.4), tx = hx + 3, tz = hz - 2; gp.x = p0.x + (tx - p0.x) * w; gp.z = p0.z + (tz - p0.z) * w; npcs.girl.h.faceToward(tx, tz, 0.2); world.hollowGlow.material.opacity = 0.5 + w * 0.5; if (S.boy === "lives") { const b = npcs.boy.h.group.position; b.x = gp.x - 0.7; b.z = gp.z + 0.4; } if (k > 3.1) { g.visible = false; npcs.boy.h.group.visible = false; } }
    };
    if (id === "bells") { for (let i = 0; i < 5; i++) setTimeout(() => audio.bell([523, 659, 784, 659, 880][i], 0.09, (i - 2) * 0.3), i * 700); }
    else if (id === "omen") setPhase("grey"); else if (id === "font") audio.bell(330, 0.08); else if (id === "ink") audio.piano(392, { vel: 0.4, wet: 0.7 });
    await new Promise(r => setTimeout(r, 4200)); await shell.fade(true, 1300); cine = null; cam.clearShot();
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 6, cls: E.cls, adv: "woolpit", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }

  /* ---------------- persistence ---------------- */
  function persist() { if (!S || !player || S.ending || endingStarted || S.act < 2) return; save(ST.SAVE_KEY, { v: 1, s: S, pos: [player.h.group.position.x, player.h.group.position.z, player.h.group.rotation.y] }); }

  /* ---------------- main loop ---------------- */
  function tick(dt, t) {
    if (!running || disposed) return;
    if (paused) return;
    // adaptive quality for weak machines
    emaDt += (dt - emaDt) * 0.05; if (!degraded && emaDt > 0.05) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); } } else lowFrames = Math.max(0, lowFrames - 1);
    dlg.tick(dt);
    const g = player.h.group;
    if (!talking && !busy && !journalOpen && input.enabled) {
      const lk = input.takeLook(); cam.rotate(lk.dx, lk.dy); cam.yaw -= input.turn() * dt * 1.9;
      const mv = input.move(), run = input.running(), sp = run ? 5.3 : 3.2, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      let vx = fx * mv.y + rx * mv.x, vz = fz * mv.y + rz * mv.x; const m = Math.hypot(vx, vz);
      if (m > 0.05) { vx /= Math.max(1, m); vz /= Math.max(1, m); g.position.x += vx * sp * dt; g.position.z += vz * sp * dt; let a = Math.atan2(vx, vz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += a * Math.min(1, dt * 12);
        stepT -= dt * sp; if (stepT < 0) { stepT = 1.5; audio.step("grass", 0.035); } }
      col.resolve(g.position, 0.38);
      const b = L.bounds, bx = g.position.x - b.cx, bz = g.position.z - b.cz, bd = Math.hypot(bx, bz); if (bd > b.r) { g.position.x = b.cx + bx / bd * b.r; g.position.z = b.cz + bz / bd * b.r; }
      g.position.y = groundH(g.position.x, g.position.z); player.h.update(dt, t, { speed: m > 0.05 ? sp * Math.min(1, m) : 0 });
    } else player.h.update(dt, t, { speed: 0 });
    // npcs
    const pp = g.position;
    for (const k in npcs) { const n = npcs[k]; if (!n.vis) continue; const gp = n.h.group.position, d = Math.hypot(gp.x - pp.x, gp.z - pp.z); n.h.update(dt, t, { speed: 0, lookAt: d < 9 ? { x: pp.x, y: pp.y + 1.5, z: pp.z } : null }); if (d < 5 && !talking) n.h.faceToward(pp.x, pp.z, Math.min(1, dt * 1.6)); if (n.label) { n.label.visible = d < 7 && !talking; if (n.label.visible) { const cd = Math.hypot(gp.x - cam.cam.position.x, gp.z - cam.cam.position.z), k = clamp(cd / 6, 0.45, 1.2); n.label.scale.set(1.9 * k, 0.4 * k, 1); } } }
    for (const v of villagers) { if (!v.vis) continue; v.h.update(dt, t, { speed: 0 }); if (mobOn || S.act === 1) v.h.faceToward(npcs.girl.h.group.position.x, npcs.girl.h.group.position.z, Math.min(1, dt * 2)); }
    if (mobOn) { const f = 0.85 + Math.sin(t * 17) * 0.1 + Math.random() * 0.08; torchLights[0].intensity = 5 * f; torchLights[1].intensity = 4 * f; torchLights[0].position.set(npcs.hugh.h.group.position.x + 1, 2, npcs.hugh.h.group.position.z + 1); torchLights[1].position.set(pp.x - 2, 2.2, pp.z + 2.2); world.flames.forEach(fl => fl.scale.setScalar(1.7 + Math.sin(t * 19 + fl.id) * 0.25)); }
    world.mist.forEach(s => { s.position.x += Math.sin(t * 0.2 + s.userData.ph) * dt * 0.25; s.material.opacity = 0.14 + Math.sin(t * 0.4 + s.userData.ph) * 0.05; });
    if (phase === "hollow") world.hollowGlow.material.opacity = Math.max(world.hollowGlow.material.opacity, 0.3) + Math.sin(t * 2) * 0.002;
    // church walls fade when the player is inside (so the camera can see)
    { const c = world.churchBox, inside = pp.x > c.x0 && pp.x < c.x1 && pp.z > c.z0 && pp.z < c.z1, tgt = inside ? 0.14 : 1; world.churchMats.forEach(m => { m.opacity += (tgt - m.opacity) * Math.min(1, dt * 5); }); cam.dist += ((inside ? 3.1 : 5.2) - cam.dist) * Math.min(1, dt * 4); }
    applyLook(dt);
    if (cine) cine(dt);
    cam.update(dt, { x: pp.x, y: pp.y, z: pp.z }); sky.follow(stage.camera);
    updatePrompt();
    saveTimer += dt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); };
  addEventListener("pagehide", onHide);
  function dispose() {
    if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide);
    try { persist(); } catch (e) { /* ignore */ }
    try { stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ }
    host.innerHTML = "";
  }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get phase() { return phase; }, get degraded() { return degraded; },
      begin: s => begin(s), tp: (x, z) => { player.h.group.position.set(x, groundH(x, z), z); }, pos: () => [player.h.group.position.x, player.h.group.position.z], npcPos: id => { const g = npcs[id].h.group; return [g.position.x, g.position.z, g.visible]; },
      near: () => candidates().map(c => c.kind + ":" + c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), dlgText: () => dlg.root.querySelector(".dlg-text").textContent, dlgVisible: () => dlg.visible,
      jump: async id => { while (busy) await new Promise(r => setTimeout(r, 50)); talking = true; input.enabled = false; return present(D.start(id)); },
      skip: () => dlg.skip(), ending: () => S && S.ending, endingsFound, toggleJournal, persist, stage: () => stage, patch: p => { Object.assign(S, p); syncVisuals(); updateHud(); },
      wait: ms => new Promise(r => setTimeout(r, ms)), fx: f => { const ev = applyFx(S, f, []); ev.forEach(e => handleEvent(e)); updateHud(); syncVisuals(); },
    },
  };
}
