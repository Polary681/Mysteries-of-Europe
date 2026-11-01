// ELIZABETH BÁTHORY — THE BLOOD COUNTESS: a third-person gothic investigation in four acts: the village of Čachtice (July
// 1614), the castle, the investigation (evidence, documents, connections on the board) and the night of the report, with the
// countess herself at its centre. Story rules: story.js; scenery: world.js; characters: models.js. Reuses the shared stage,
// shell, input, dialogue UI, chase camera, low-poly humans, audio bus, saves and the Archive.
import { Color, HemisphereLight, DirectionalLight, PointLight, Vector3 } from "three";
import { createStage } from "../../engine.js";
import { AudioBus } from "../../shared/audio.js";
import { createInput } from "../../shared/input.js";
import { createShell } from "../../shared/ui.js";
import { sceneSVG } from "../../ui/art.js";
import { load, save, clear, loadObj } from "../../shared/save.js";
import { el, sfx } from "../../common.js";
import { Colliders, makeSky, makeHuman, makeShadow, nameLabel, ChaseCam } from "../../shared/world.js";
import { Dialogue, clamp, restoreState, validPos } from "../../narrative/core.js";
import { createDialogueUI } from "../../narrative/dialogue-ui.js";
import * as Archive from "../../shared/archive.js";
import { reveal, revealOpen } from "../../ui/archive-ui.js";
import { esc } from "../../ui/cards.js";
import * as ST from "./story.js";
import { buildWorld, groundH, walkable, roomAt, L, I, ix, ROOMS, C } from "./world.js";
import { makeCountess, dressClerk } from "./models.js";

const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const ease = t => t * t * (3 - 2 * t);
const LOOKS = {
  afternoon: { top: 0x5a6a80, mid: 0xa8aab0, bot: 0xd8c8a8, fog: 0xb4ad9c, fogD: 0.0075, sunC: 0xffe0b0, sunI: 1.5, hS: 0xc0c8d8, hG: 0x5a5440, hI: 0.95, stars: 0, sun: [0.6, 0.45, 0.4], win: 0.2, lamps: 0.2, flames: 0.6 },
  dusk:      { top: 0x1e2040, mid: 0x7a4a58, bot: 0xd88a5a, fog: 0x7a5a5a, fogD: 0.0095, sunC: 0xff9a5a, sunI: 1.0, hS: 0x8a8ab0, hG: 0x3a2a2a, hI: 0.75, stars: 0.3, sun: [-0.85, 0.12, 0.2], win: 0.8, lamps: 0.9, flames: 1 },
  night:     { top: 0x03050c, mid: 0x0c1428, bot: 0x1e2a40, fog: 0x141c2c, fogD: 0.011, sunC: 0xa8b8e8, sunI: 0.75, hS: 0x5a6a98, hG: 0x141418, hI: 0.6, stars: 1, sun: [0.3, 0.7, -0.5], win: 1, lamps: 1, flames: 1 },
  inside:    { top: 0, mid: 0, bot: 0, fog: 0x0e0a08, fogD: 0.024, sunC: 0xffb070, sunI: 0.18, hS: 0xb09a84, hG: 0x3a2a20, hI: 0.78, stars: 0, sun: [0.2, 0.8, 0.3], win: 1, lamps: 1, flames: 1 },
  dawn:      { top: 0x3a4a78, mid: 0xc89a9a, bot: 0xf4c8a0, fog: 0xc4a8a0, fogD: 0.008, sunC: 0xffc090, sunI: 1.2, hS: 0xb0b8d8, hG: 0x5a4a40, hI: 0.85, stars: 0, sun: [0.9, 0.15, -0.3], win: 0.3, lamps: 0.2, flames: 0.4 },
};
const VOICE = { secretary: { pitch: 210, kind: "triangle" }, marta: { pitch: 300, kind: "triangle" }, gergely: { pitch: 140, kind: "triangle" }, sexton: { pitch: 170, kind: "sawtooth" }, zuzana: { pitch: 280, kind: "triangle" },
  castellan: { pitch: 130, kind: "sawtooth" }, ilka: { pitch: 400, kind: "sine" }, elizabeth: { pitch: 240, kind: "sine" }, narr: { pitch: 0 }, you: { pitch: 0 } };
const ITEMS = { commission: "The Chamber’s commission", storekey: "The storeroom key" };
const SCENE_EVENTS = new Set(["act2", "act4", "passage"]);
const OBJ_POS = {
  road: [L.road, 4], door_in: [L.doorIn, 3.2], door_out: [ix(L.doorOut), 2.2],
  ...Object.fromEntries(Object.entries(L.obj).map(([k, p]) => [k, [ix(p), k === "report" ? 2.2 : k.endsWith("_door") ? 1.9 : 2.2]])),
};
const DOC_KINDS = new Set(["Official letter", "Parish record", "Investigation record", "Trial record", "Household record", "Private letter", "Legal document", "Correspondence", "Accounts", "Object", "Your own observation"]);
// a slow, melancholy galliard-like phrase in D minor (original), for the rooms of the castle
const PHRASE = [62, 65, 69, 67, 65, 64, 62, 0, 60, 62, 64, 65, 64, 62, 61, 62];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "Elizabeth Báthory — The Blood Countess", kicker: "Legend · Čachtice (Csejte), Kingdom of Hungary — today Slovakia · July 1614", accent: "#b8963e", accent2: "#7a1f2b", art: sceneSVG("bathory"), journal: true,
    tagline: "A clerk, a village that whispers, a castle on a hill — and the countess the world has already decided about.",
    note: "A third-person investigation. Gather testimonies and documents, connect them on the board in your journal (J), meet the countess, and write your report. Four endings. The journal says what is historical record, what historians dispute, what is later legend and what this game invents: the blood baths and the 650 victims are legend, not established fact. No graphic violence is shown.",
    controls: [["W A S D", "move"], ["Shift", "run"], ["Mouse drag / ← →", "camera"], ["E / Space", "interact"], ["1-4", "choose"], ["J", "journal & board"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  { const amb = load("moe.ambient.v1", null), vol = amb && typeof amb.vol === "number" ? amb.vol : 0.4; audio.level = 0.35 + 0.65 * Math.sqrt(clamp(vol, 0, 1)); if (vol <= 0.001 || sfx.muted) audio.muted = true; }
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, W = null, cam = null, sky = null, D = null, S = null, player = null, hud = null, journalEl = null, bars = null, docEl = null, countess = null;
  let cineCount = 0, winDim = 1, flameDim = 1, endWalk = 0, running = false, paused = false, busy = false, talking = false, journalOpen = false, disposed = false, endingStarted = false, degraded = false, cine = 0, revealing = false, timeScale = 1, holdShot = false;
  let phase = "afternoon", curLook = {}, tgtLook = {}, hemi, sun, lights = [], stepT = 0, saveTimer = 0, lastPrompt = "", emaDt = 0.016, lowFrames = 0, afterTalk = [], docQueue = [], boardSel = null, room = null, musicT = 0, musicStep = 0, pad = null, elizaWalk = 0, secretK = 0;
  const npcs = {}, extras = [], col = new Colliders(), anims = new Set(), wopt = { chambers: false, store: false, passage: false };

  const tween = (dur, f = () => {}) => new Promise(res => { const a = { t: 0, dur: Math.max(0.001, dur), f, res }; anims.add(a); f(0); });
  async function cinematic(fn) {
    cine++; cineCount++; busy = true; input.enabled = false; hudShow(false); bars.classList.add("on");
    try { await fn(); } catch (e) { console.error(e); }
    finally { cine = Math.max(0, cine - 1); if (!cine) { bars.classList.remove("on"); busy = false; cam.clearShot(); if (!talking) { input.enabled = !journalOpen && !docEl; hudShow(true); } } }
  }

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && !s.s.ending && s.s.seen && s.s.seen.start ? s : null; };
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    shell.title({ hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${Object.keys(endingsFound()).length} / 4</p>`, onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); } });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume(); shell.loading(0, "Riding into Nyitra County…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0xb4ad9c, fog: 0.008, fov: 56, far: 700, maxPR: 1.5 });
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: false });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(1.4); stage.scene.add(sky.mesh);
      hemi = new HemisphereLight(0xc0c8d8, 0x5a5440, 0.95); sun = new DirectionalLight(0xffe0b0, 1.5); stage.scene.add(hemi, sun, sun.target);
      for (let i = 0; i < 3; i++) { const pl = new PointLight(0xffb060, 0, 14, 1.7); stage.scene.add(pl); lights.push(pl); }
      bars = el("div", "adv-letterbox noinput"); host.querySelector(".adv-ui").append(bars);
      cam = new ChaseCam(stage.camera, { dist: 5.2, height: 1.7, minPitch: -0.3, maxPitch: 0.85 }); cam.groundAt = groundH;
      wireInput();
      let tier = 1; try { const gl = stage.renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"); const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); tier = /swiftshader|llvmpipe|software/i.test(name) ? 0 : matchMedia("(pointer: coarse)").matches ? 1 : 2; } catch (e) { /* unknown GPU */ }
      W = buildWorld(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.75, m), tier); await frame();
      shell.loading(0.88, "Gathering the household…"); await frame();
      buildPeople();
      stage.onFrame(tick);
    }
    shell.loading(0.96, "Trimming the wicks…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); if (!S.links) S.links = {}; D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false; cine = 0; anims.clear(); afterTalk = []; docQueue = []; boardSel = null; closeDoc(true);
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i));
    secretK = S.flags.passage_open ? 1 : 0;
    if (saved && validPos(saved.pos)) placePlayer(saved.pos[0], saved.pos[1], saved.pos[2] || 0); else placePlayer(L.start[0], L.start[1], Math.PI);
    syncWorld(true);
    shell.close(); shell.setRunning(true); running = true; input.enabled = true; hudShow(true); updateHud(); shell.objective(ST.objective(S));
    audio.stopAllLayers(); startAmbience(); await shell.fade(false, 1000);
    if (!saved) { bellToll(3); await openingShot(); converse("start"); } else shell.toast("Progress restored. Welcome back.");
  }
  function placePlayer(x, z, yaw) { player.h.group.position.set(x, groundH(x, z), z); player.h.group.rotation.y = yaw; cam.yaw = yaw + Math.PI; cam.pitch = 0.18; cam.snap(); }
  async function openingShot() {   // the first sight of the castle, from above the village roofs
    await cinematic(async () => {
      const top = 42; await tween(6.5, k => { const e = ease(k); cam.setShot({ pos: new Vector3(18 - e * 16, 14 - e * 10.5, 34 - e * 6), look: new Vector3(C[0] * (1 - e) + player.h.group.position.x * e, top + 8 - e * (top + 6), C[1] * (1 - e) + (player.h.group.position.z - 4) * e), fov: 50 - e * 6 }); });
    });
  }

  /* ---------------- people ---------------- */
  function buildPeople() {
    const mk = (id, o, name = ST.WHO[id] && ST.WHO[id].name) => {
      const h = makeHuman(o); h.group.add(makeShadow(0.55, 0.9)); stage.scene.add(h.group);
      const label = name ? nameLabel(name) : null; if (label) { label.position.y = (o.scale || 1) * 2.05; h.group.add(label); label.visible = false; }
      return { id, h, label, vis: true };
    };
    player = mk("you", { cloth: 0x1e1c22, cloth2: 0x141216, hair: 0x3a2a1a, scale: 1 }, null); dressClerk(player.h);
    npcs.secretary = mk("secretary", { cloth: 0x2a3a2a, cloth2: 0xb8963e, hair: 0x2a1c10, hat: "cap", beard: true, scale: 1.02 });
    npcs.marta = mk("marta", { cloth: 0x6a3a2a, cloth2: 0xe0d6c0, robe: true, hair: 0x5a3a20, hat: "coif", longHair: true, scale: 0.94 });
    npcs.gergely = mk("gergely", { cloth: 0x4a4038, cloth2: 0x2a2420, hair: 0xd0d0d0, beard: true, scale: 0.95 });
    npcs.sexton = mk("sexton", { cloth: 0x2a2a2e, cloth2: 0x1a1a1c, robe: true, hair: 0x6a5a4a, scale: 0.98 });
    npcs.zuzana = mk("zuzana", { cloth: 0x5a5a6a, cloth2: 0xd8d0c0, robe: true, hair: 0x2a1a10, hat: "coif", longHair: true, scale: 0.93 });
    npcs.castellan = mk("castellan", { cloth: 0x3a2a24, cloth2: 0x7a1f2b, hair: 0x6a6a6a, beard: true, hat: "cap", scale: 1.06 });
    npcs.ilka = mk("ilka", { cloth: 0x6a5a48, cloth2: 0xe8e0d0, robe: true, hair: 0xa07a40, hat: "coif", longHair: true, scale: 0.88 });
    [[-2.5, 1.2, 0x5a4a3a, true], [6.8, 3.5, 0x4a5a6a, false], [-9.5, 4.6, 0x6a4a3a, true], [2.4, 12, 0x5a5a3a, false], [14, 2.6, 0x7a5a3a, true], [-14, -8, 0x4a4a5a, false]].forEach(([x, z, c, fem], i) => {
      const e = mk("villager", { cloth: c, cloth2: 0x3a2c1a, hair: [0x3a2a1a, 0x6a4a2a, 0xa08040][i % 3], hat: fem ? "coif" : (i % 2 ? "cap" : null), longHair: fem, robe: fem, scale: 0.9 + (i % 3) * 0.05 }, null); e.home = [x, z]; extras.push(e); });
    countess = makeCountess(); stage.scene.add(countess.group);
    const lab = nameLabel(ST.WHO.elizabeth.name, { color: "#f0d8a0" }); lab.position.y = 2.05; countess.group.add(lab); lab.visible = false; countess.label = lab;
  }
  function setVis(n, v) { n.vis = v; n.h.group.visible = v; }
  function place(n, x, z, face) { n.h.group.position.set(x, groundH(x, z), z); if (face) n.h.faceToward(face[0], face[1], 1); }
  const surfArea = z => z > -60 ? "village" : "castle";
  function syncWorld(instant) {
    const insideZone = S.area === "inside"; W.setZone(insideZone ? "inside" : "surface");
    for (const k of ["secretary", "marta", "gergely", "sexton", "zuzana"]) { const p = L.npc[k]; place(npcs[k], p[0], p[1], [0, 3]); setVis(npcs[k], !insideZone); }
    npcs.sexton.h.faceToward(0, 3, 1); npcs.zuzana.h.faceToward(30, 14, 1);
    extras.forEach(e => { place(e, e.home[0], e.home[1], [0, 3]); setVis(e, !insideZone); });
    if (insideZone && S.act >= 3) { place(npcs.castellan, ...ix([6.5, -2.4]), ix([0, -6])); setVis(npcs.castellan, true); }
    else { place(npcs.castellan, ...L.castellan, [0, -100]); setVis(npcs.castellan, !insideZone && S.act >= 2); }
    place(npcs.ilka, ...ix(L.ilka), ix([-19, -13])); setVis(npcs.ilka, insideZone);
    countess.group.visible = insideZone && S.act >= 2; placeCountess();
    wopt.chambers = ST.chambersOpen(S) && S.act >= 2; wopt.store = !!S.items.storekey; wopt.passage = !!S.flags.passage_open;
    W.setLock("chambers", wopt.chambers); W.setLock("store", wopt.store);
    if (W.doorLeaves.passage) { W.doorLeaves.passage.rotation.y = secretK * 1.4; W.doorLeaves.passage.position.x = I.x - 25 - secretK * 0.6; }
    if (!endingStarted) setPhase(phaseFor(), instant);
    shell.objective(ST.objective(S)); updateHud(); startAmbience();
  }
  function placeCountess() {
    const g = countess.group;
    if (S.act === 3 && S.area === "inside") { const p = ix([12, -6]); g.position.set(p[0], 0, p[1]); elizaWalk = 0; }
    else { const p = ix(L.eliza); g.position.set(p[0], 0, p[1]); g.rotation.y = -Math.PI / 2; }
  }
  const phaseFor = () => S.area === "inside" ? "inside" : S.act === 1 ? "afternoon" : S.act >= 4 ? "night" : "dusk";
  function setPhase(name, instant) {
    phase = name; const t = LOOKS[name], Cc = c => new Color(c);
    tgtLook = { fog: Cc(t.fog), sunC: Cc(t.sunC), hS: Cc(t.hS), hG: Cc(t.hG), top: Cc(t.top), mid: Cc(t.mid), bot: Cc(t.bot), fogD: t.fogD, sunI: t.sunI, hI: t.hI, stars: t.stars, win: t.win, lamps: t.lamps, flames: t.flames, sun: new Vector3(...t.sun).normalize() };
    if (instant || !curLook.fog) curLook = Object.fromEntries(Object.entries(tgtLook).map(([k, v]) => [k, v && v.clone ? v.clone() : v]));
  }
  const winCol = new Color(), paneDay = new Color(0x9aa8b8), paneDusk = new Color(0x6a5a78), paneNight = new Color(0x1a2438);
  function applyLook(dt) {
    const k = 1 - Math.exp(-dt * 1.3), T = tgtLook, Cl = curLook; if (!T.fog) return;
    for (const key of ["fog", "sunC", "hS", "hG", "top", "mid", "bot", "sun"]) Cl[key].lerp(T[key], k);
    for (const key of ["fogD", "sunI", "hI", "stars", "win", "lamps", "flames"]) Cl[key] += (T[key] - Cl[key]) * k;
    const ins = S.area === "inside";
    stage.scene.fog.color.copy(Cl.fog); stage.scene.fog.density = Cl.fogD * (degraded ? 1.2 : 1); stage.scene.background.copy(Cl.fog);
    hemi.color.copy(Cl.hS); hemi.groundColor.copy(Cl.hG); hemi.intensity = Cl.hI; sun.color.copy(Cl.sunC); sun.intensity = Cl.sunI;
    sun.position.copy(Cl.sun).multiplyScalar(80).add(player.h.group.position); sun.target.position.copy(player.h.group.position);
    sky.mesh.visible = !ins; if (!ins) sky.set({ top: Cl.top, mid: Cl.mid, bot: Cl.bot, stars: Cl.stars, sun: phase === "night" ? 0 : 0.6, sunDir: Cl.sun, sunCol: Cl.sunC });
    W.winMat.color.set(0x2a2018).lerp(winCol.set(0xffbc66), clamp(Cl.win, 0, 1)); W.castleWinMat.color.set(0x2a2018).lerp(winCol.set(0xffb45a), clamp(Cl.win * 0.9 * winDim, 0, 1));
    W.ranges.material.color.set({ night: 0x3a4458, dawn: 0xc8a8a4, dusk: 0x9a8a98, afternoon: 0xd8d8d8 }[phase] || (S.act >= 4 ? 0x3a4458 : S.act >= 2 ? 0x9a8a98 : 0xd8d8d8));
    const pc = S.act >= 4 ? paneNight : S.act >= 2 ? paneDusk : paneDay; W.winPanes.forEach(p => p.material.color.copy(pc));
    W.lookState = { flames: Cl.flames * flameDim, mist: S.act >= 4 ? 1.4 : 1 };
  }
  /** the three point lights follow the player: candles and fires of the current room, or the lamps outside */
  const ROOM_LIGHTS = { hall: [[0, 1.2, -10.4, 0xff9a50, 5], [0, 4.6, -5, 0xffc070, 3], [0, 2.4, -1, 0xffb060, 1.2]], corrW: [[-15, 2.4, -6, 0xffb060, 2.4], [-21, 2.4, -6, 0xffb060, 2]], dining: [[-19, 2, -13, 0xffb060, 3.2], [-24, 1.6, -9, 0xff9050, 1.4]],
    library: [[-15.5, 1.8, 2.4, 0xffc070, 3.2], [-19, 2.4, 3, 0xffb060, 2.2], [-23, 2.4, -2, 0xffa050, 1.5]], passage: [[-27, 1.6, 1, 0xffa050, 1.8], [-32.5, 1.4, 1, 0xff9040, 1.2]], niche: [[-32.5, 1.4, 1, 0xff9040, 1.6], [-28, 1.6, 1, 0xffa050, 1.2]],
    gallery: [[12, 2.4, -6, 0xffb060, 2.4], [20, 2.4, -6, 0xffb060, 2.4], [27, 2.4, -6, 0xffb060, 2]], chambers: [[19.8, 1.8, -17.4, 0xffc070, 3.2], [29, 1.8, -12, 0xffb060, 2], [24, 3.6, -10, 0xffa060, 1.6]],
    storage: [[24, 2.6, 2, 0xffb060, 2.6], [19.5, 2, -2, 0xffa050, 1.2]] };
  function placeLights() {
    if (S.area === "inside") {
      const L2 = ROOM_LIGHTS[room] || ROOM_LIGHTS.hall; lights.forEach((l, i) => { const c = L2[i]; if (!c) { l.intensity = 0; return; } l.position.set(I.x + c[0], c[1], I.z + c[2]); l.color.setHex(c[3]); l.userData.base = c[4]; l.distance = 13; });
    } else {
      const sp = [[-3.5, 45, -125.4], [3.5, 45, -125.4], [0, 3.2, 3]]; lights.forEach((l, i) => { l.position.set(...sp[i]); l.color.setHex(0xff9a50); l.userData.base = i < 2 ? 3 : 2; l.distance = 16; });
    }
  }

  /* ---------------- ambience & music ---------------- */
  function startAmbience() {
    if (!audio.ctx || !S) return;
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    stopPad();
    if (S.area !== "inside") {
      audio.layer("wind", { kind: "pink", filter: "lowpass", freq: 520, gain: S.act >= 2 ? 0.08 : 0.045, lfoRate: 0.08, lfoDepth: 0.6 });
      audio.stopLayer("room"); audio.stopLayer("fire");
      audio._amb.push(audio.every(() => { const p = player.h.group.position; if (p.z < -50) return; for (let i = 0; i < 3 + (Math.random() * 3 | 0); i++) setTimeout(() => audio.blip(140 + Math.random() * 160, 0.012, "triangle"), i * 90); }, 1500, 4200));   // the murmur of the market
      audio._amb.push(audio.every(() => { const p = player.h.group.position; if (p.z < -50) return; for (let i = 0; i < 3; i++) setTimeout(() => audio.burst({ dur: 0.04, freq: 2400, q: 6, vol: 0.03, kind: "white", pan: 0.6 }), i * 420); }, 7000, 15000));   // the smithy's hammer
      audio._amb.push(audio.every(() => { const p = player.h.group.position; if (p.z > -40) return; audio.tone({ freq: 620, dur: 0.18, type: "sawtooth", vol: 0.014, slide: -260, pan: Math.random() * 2 - 1, wet: 0.6 }); setTimeout(() => audio.tone({ freq: 560, dur: 0.2, type: "sawtooth", vol: 0.012, slide: -240, wet: 0.6 }), 260); }, 5000, 12000));   // crows round the towers
      if (S.act === 1) audio._amb.push(audio.every(() => audio.chirp(3200 + Math.random() * 1000), 3000, 8000));
      else audio._amb.push(audio.every(() => audio.cricket(), 800, 2400));
    } else {
      audio.layer("wind", { kind: "brown", filter: "lowpass", freq: 220, gain: 0.03, lfoRate: 0.05, lfoDepth: 0.8 });
      audio.layer("room", { kind: "brown", filter: "lowpass", freq: 140, gain: 0.05 });
      audio.layer("fire", { kind: "brown", filter: "bandpass", freq: 900, q: 0.6, gain: 0, lfoRate: 0.9, lfoDepth: 0.7 });
      startPad();
      audio._amb.push(audio.every(() => { if (room === "hall") audio.burst({ dur: 0.05, freq: 1800 + Math.random() * 1500, q: 2, vol: 0.05, kind: "white", pan: (Math.random() - 0.5) * 0.4 }); }, 200, 900));   // the hall fire crackles
      audio._amb.push(audio.every(() => audio.tone({ freq: 90 + Math.random() * 40, dur: 0.9, type: "sawtooth", vol: 0.01, slide: -30, wet: 0.7 }), 9000, 20000));   // the old house creaks
    }
  }
  function startPad() {
    if (!audio.ctx || pad) return; const c = audio.ctx, out = c.createGain(); out.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700; out.connect(lp); lp.connect(audio.master); lp.connect(audio.verb);
    const oscs = [[73.4, 0.3], [110, 0.18], [146.8, 0.1], [174.6, 0.06]].map(([f, v]) => { const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.value = v; o.connect(g).connect(out); o.start(); return o; });
    out.gain.setTargetAtTime(0.05, c.currentTime, 3); pad = { out, lp, oscs };
  }
  function stopPad() { if (!pad || !audio.ctx) { pad = null; return; } const p = pad; pad = null; try { p.out.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.3); p.oscs.forEach(o => o.stop(audio.ctx.currentTime + 1.5)); } catch (e) { /* stopped */ } }
  function musicTick(dt) {   // a lute-like phrase now and then in the rooms; a beating dissonance near her door
    if (!audio.ctx || audio.muted || S.area !== "inside") return;
    musicT += dt; const beat = 0.62;
    while (musicT > beat) { musicT -= beat; const n = PHRASE[musicStep % PHRASE.length]; if (musicStep % 32 < 16 && n) { audio.tone({ freq: mtof(n), dur: 1.1, type: "triangle", vol: 0.022, attack: 0.004, wet: 0.6 }); audio.tone({ freq: mtof(n + 12), dur: 0.4, type: "sine", vol: 0.006, attack: 0.003, wet: 0.6 }); } musicStep++; }
    if (pad) { const near = room === "gallery" || room === "chambers" ? 1 : 0; pad.oscs[3].frequency.setTargetAtTime(near ? 155.6 : 174.6, audio.ctx.currentTime, 2); audio.setLayer("fire", room === "hall" ? 0.03 : 0, 1); }
  }
  const bellToll = (n, f = 220) => { for (let i = 0; i < n; i++) setTimeout(() => audio.bell(f, 0.06, -0.4), i * 1800); };
  const sting = () => { audio.bell(147, 0.08, 0); setTimeout(() => { audio.tone({ freq: 293.7, dur: 1.6, type: "triangle", vol: 0.03, wet: 0.7 }); audio.tone({ freq: 349.2, dur: 1.6, type: "triangle", vol: 0.025, wet: 0.7 }); audio.tone({ freq: 440, dur: 1.6, type: "triangle", vol: 0.02, wet: 0.7 }); }, 120); };
  const creak = () => { audio.tone({ freq: 160, dur: 0.9, type: "sawtooth", vol: 0.03, slide: -70, wet: 0.5 }); setTimeout(() => audio.burst({ dur: 0.25, freq: 200, q: 0.6, vol: 0.12, kind: "brown", filter: "lowpass", wet: 0.5 }), 700); };
  const paper = () => { for (let i = 0; i < 3; i++) setTimeout(() => audio.burst({ dur: 0.08, freq: 4000, q: 0.8, vol: 0.05, kind: "white" }), i * 70); };

  /* ---------------- input ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" });
    input.on((a, x) => {
      if (!running || disposed || revealing || revealOpen()) return;
      if (docEl) { if (a === "interact" || a === "pause") closeDoc(); return; }
      if (a === "pause") return togglePause();
      if (a === "mute") return toggleSound();
      if (paused) return;
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (!busy) tryInteract(); }
      if (a === "num" && talking && !busy) dlg.pickNum(x);
    });
    shell.bind({ pause: () => togglePause(), sound: () => toggleSound(), journal: () => { if (running && !paused && !docEl) toggleJournal(); } });
    shell.setSoundIcon(!audio.muted);
    host.addEventListener("pointerdown", onHostDown);
  }
  function onHostDown() { audio.resume(); }
  const toggleSound = () => { audio.setMuted(!audio.muted); shell.setSoundIcon(!audio.muted); };
  function togglePause() {
    if (!running) return;
    if (journalOpen) return toggleJournal();
    if (paused) { shell.resume(); paused = false; audio.duck(1); return; }
    paused = true; audio.duck(0.25);
    shell.pauseMenu({ onResume: () => { paused = false; audio.duck(1); }, onRestart: () => { paused = false; audio.duck(1); clear(ST.SAVE_KEY); shell.fade(true, 300).then(() => begin(null)); }, onExit: () => { persist(); dispose(); onExit(); }, onSound: toggleSound, soundOn: () => !audio.muted });
  }

  /* ---------------- HUD ---------------- */
  function hudShow(v) {
    if (!hud) {
      const ui = host.querySelector(".adv-ui");
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="bt-case"><span class="bt-ev" title="Evidence gathered">📜 <b>0</b> evidence</span><span class="bt-ln" title="Connections found">🔗 <b>0</b> connections</span></div>`;
      host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = "<kbd>E</kbd><span></span>"; ui.append(pr); hud.prompt = pr;
      pr.addEventListener("pointerdown", e => { e.preventDefault(); if (!busy && !talking && running && !paused) tryInteract(); });
    }
    hud.style.display = v ? "" : "none"; if (!v) { hud.prompt.hidden = true; lastPrompt = ""; }
  }
  function updateHud(pulse) {
    if (!hud || !S) return;
    hud.querySelector(".bt-ev b").textContent = ST.evidenceCount(S); hud.querySelector(".bt-ln b").textContent = ST.linkCount(S);
    if (pulse) { const e = hud.querySelector(pulse === "link" ? ".bt-ln" : ".bt-ev"); e.classList.remove("pulse"); void e.offsetWidth; e.classList.add("pulse"); }
  }

  /* ---------------- the journal: investigation board, evidence, codex, help ---------------- */
  function toggleJournal(tab) {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking && !cine; audio.duck(1); return; }
    journalOpen = true; input.enabled = false; audio.duck(0.5); boardSel = null; renderJournal(tab || "board");
  }
  function caseBar(label, c, total) {
    const okE = c.ev >= c.needEv, okL = c.links >= c.needLinks, okT = total == null || total.have >= total.need;
    return `<div class="bt-bar ${okE && okL && okT ? "ready" : ""}"><b>${label}</b><span>${c.needEv ? `evidence ${Math.min(c.ev, c.needEv)}/${c.needEv} · ` : ""}${total ? `all evidence ${Math.min(total.have, total.need)}/${total.need} · ` : ""}connections ${Math.min(c.links, c.needLinks)}/${c.needLinks}</span>${okE && okL && okT ? "<em>You could defend this conclusion</em>" : ""}</div>`;
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove(); journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["board", "Investigation"], ["journal", "Journal"], ["codex", "Codex"], ["help", "How to play"]]; let body = "";
    if (tab === "board") {
      const got = ST.EVIDENCE_ORDER.filter(id => S.clues[id]), cs = ST.caseState(S);
      body = `<p class="mut">Select one piece of evidence, then another that bears on it. If they are related you will see how: they <b>corroborate</b>, <b>contradict</b>, reveal a <b>motive</b>, or give <b>context</b>. Weigh how far each source can be trusted.</p>
        <div class="bt-bars">${caseBar("The case for the accusations", cs.acc)}${caseBar("Political and financial interests", cs.pol)}${caseBar("Doubts and contradictions", { ...cs.doubt, needEv: 0 }, { have: ST.evidenceCount(S), need: cs.doubt.needTotal })}</div>
        <div class="bt-grid">${got.length ? got.map(id => { const e = ST.EVIDENCE[id]; return `<button class="bt-card b-${e.basis} ${boardSel === id ? "sel" : ""}" data-ev="${id}"><span class="bt-k">${esc(e.kind)} · <i>${esc(ST.BASIS_TAG[e.basis])}</i></span><b>${esc(e.title)}</b><small>${esc(e.rel)}</small></button>`; }).join("") : "<p class=mut>No evidence yet. Talk to people and examine documents.</p>"}</div>
        <h4>Connections <small>${ST.linkCount(S)}</small></h4>` + (ST.linkCount(S) ? `<ul class="bt-links">${ST.LINKS.filter(l => S.links[l.id]).map(l => `<li class="t-${l.type}"><span>${ST.LINK_TYPE[l.type]}</span> <b>${esc(ST.EVIDENCE[l.a].title)}</b> + <b>${esc(ST.EVIDENCE[l.b].title)}</b><p>${esc(l.text)}</p></li>`).join("")}</ul>` : "<p class=mut>None yet.</p>")
        + `<div class="bt-read" hidden></div>`;
    } else if (tab === "journal") {
      const got = ST.EVIDENCE_ORDER.filter(id => S.clues[id]), it = Object.keys(S.items).filter(k => ITEMS[k]);
      body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p><h4>What you carry</h4><ul>${it.map(k => `<li>${ITEMS[k]}</li>`).join("")}</ul><h4>Evidence <small>${got.length} / ${ST.EVIDENCE_ORDER.length}</small></h4>`
        + (got.length ? got.map(id => { const e = ST.EVIDENCE[id]; return `<div class="cx bt-doc b-${e.basis}"><span class="tag">${esc(e.kind)} · ${esc(ST.BASIS_TAG[e.basis])} · ${esc(e.date)}</span><h5>${esc(e.title)}</h5><p>${esc(e.text)}</p><p class="mut"><b>Reliability:</b> ${esc(e.rel)}. <b>Found:</b> ${esc(e.where)}.</p></div>`; }).join("") : "<p class=mut>Nothing yet.</p>");
    } else if (tab === "codex") {
      const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]);
      body = `<p class="mut">What the records establish, what historians dispute, what is later legend — and what this game invents. ${got.length} / ${ids.length} entries.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${ST.KIND_TAG[c.kind]}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join("");
    } else body = `<ul><li><b>Move</b> with W A S D or the arrows (touch: drag on the left). <b>Shift</b> runs. Drag the mouse or the right side of the screen to turn the camera.</li><li><b>E</b> / <b>Space</b> talks and examines when a prompt appears; <b>1–4</b> or a tap picks an answer. Documents open in a reader: <b>E</b> or the button closes it.</li><li><b>Act I:</b> hear the village and the Palatine’s secretary. <b>Act II:</b> search the castle’s rooms; when you have four pieces of evidence the countess will receive you. <b>Act III:</b> investigate — gather evidence and connect it on the <b>Investigation</b> board. <b>Act IV:</b> she will send for you at night; then write your report at the library desk.</li><li>Your report can only defend a conclusion your evidence supports: the bars on the board show how close you are. You can always sign the report the Palatine prepared.</li><li>Progress is saved automatically; the title screen offers <b>Continue</b>. <b>Esc</b> pauses.</li></ul>`;
    journalEl.innerHTML = `<div class="adv-card jr bt-j"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => {
      const c = e.target.closest("[data-ev]"); if (c) { boardPick(c.dataset.ev); return; }
      const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else if (b.dataset.t) renderJournal(b.dataset.t);
    });
    host.querySelector(".adv-ui").append(journalEl);
  }
  function boardPick(id) {
    if (!boardSel) { boardSel = id; renderJournal("board"); showRead(id); return; }
    if (boardSel === id) { boardSel = null; renderJournal("board"); return; }
    const a = boardSel; boardSel = null; const r = tryConnect(a, id);
    renderJournal("board");
    const rd = journalEl.querySelector(".bt-read"); rd.hidden = false;
    rd.innerHTML = r ? `<p class="t-${r.link.type}"><span>${ST.LINK_TYPE[r.link.type]}${r.isNew ? " — new" : ""}</span> ${esc(r.link.text)}</p>` : `<p class="mut">“${esc(ST.EVIDENCE[a].title)}” and “${esc(ST.EVIDENCE[id].title)}” do not seem to bear on each other.</p>`;
    rd.scrollIntoView({ block: "nearest" });
  }
  function showRead(id) { const e = ST.EVIDENCE[id], rd = journalEl.querySelector(".bt-read"); rd.hidden = false; rd.innerHTML = `<p><b>${esc(e.title)}</b> <small>(${esc(e.date)})</small> — ${esc(e.text)}</p><p class="mut">Now select another piece to connect it with.</p>`; }
  function tryConnect(a, b) {
    const ev = [], r = ST.connect(S, a, b, ev);
    if (r && r.isNew) { shell.toast((r.link.type === "contradicts" ? "Contradiction found: " : "Connection found: ") + ST.EVIDENCE[r.link.a].title + " + " + ST.EVIDENCE[r.link.b].title, r.link.type === "contradicts" ? "bad" : "clue"); r.link.type === "contradicts" ? audio.tone({ freq: 233, dur: 0.6, type: "triangle", vol: 0.04, slide: -20, wet: 0.5 }) : audio.good(); updateHud("link"); shell.objective(ST.objective(S)); persist(); checkFinal(); }
    else if (!r) audio.click();
    return r;
  }

  /* ---------------- the document reader ---------------- */
  function showDoc(id) {
    const e = ST.EVIDENCE[id]; if (!e) return; closeDoc(true); paper();
    docEl = el("div", "adv-overlay bt-docview noinput");
    docEl.innerHTML = `<div class="bt-paper"><p class="bt-dk">${esc(e.kind)} · ${esc(e.date)}</p><h3>${esc(e.title)}</h3><p class="bt-txt">${esc(e.text)}</p>
      <p class="bt-meta"><span class="b-${e.basis}">${esc(ST.BASIS_TAG[e.basis])}</span> <b>Reliability:</b> ${esc(e.rel)}</p><div class="actions"><button class="primary" data-k="ok">Add to the case</button><button data-k="board">Open the board</button></div></div>`;
    docEl.addEventListener("click", ev => { const k = ev.target.closest("button")?.dataset.k; if (k === "ok") closeDoc(); else if (k === "board") { closeDoc(); toggleJournal("board"); } });
    host.querySelector(".adv-ui").append(docEl); input.enabled = false;
    setTimeout(() => { const b = docEl && docEl.querySelector("button.primary"); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function closeDoc(silent) { if (!docEl) return; docEl.remove(); docEl = null; if (!silent) { input.enabled = !talking && !cine && !journalOpen; const n = docQueue.shift(); if (n) setTimeout(() => showDoc(n), 250); } }

  /* ---------------- interaction ---------------- */
  function candidates() {
    const p = player.h.group.position, out = [];
    for (const id of ["secretary", "marta", "gergely", "sexton", "zuzana", "castellan", "ilka"]) {
      const n = npcs[id]; if (!n.vis) continue; const node = ST.talkNode(id, S); if (!node) continue;
      const d = Math.hypot(n.h.group.position.x - p.x, n.h.group.position.z - p.z); if (d < 3.2) out.push({ kind: "talk", id, d, node });
    }
    if (countess.group.visible) { const node = ST.talkNode("elizabeth", S), d = Math.hypot(countess.group.position.x - p.x, countess.group.position.z - p.z); if (node && d < 3.6) out.push({ kind: "talk", id: "elizabeth", d: d * 0.6, node }); }
    for (const id in OBJ_POS) { if (!ST.objectAvailable(id, S)) continue; const [[x, z], r] = OBJ_POS[id], d = Math.hypot(x - p.x, z - p.z); if (d < r) out.push({ kind: "obj", id, d: d * 0.9, node: ST.objectNode(id, S) }); }
    return out.sort((a, b) => a.d - b.d);
  }
  function tryInteract() {
    const c = candidates()[0]; if (!c) return false;
    if (c.id === "door_in") { enterPalace(); return true; }
    if (c.id === "door_out") { leavePalace(); return true; }
    if (c.id === "elizabeth" && c.node === "eliza_1") { firstMeeting(); return true; }
    converse(c.node, c.kind === "talk" ? c.id : null); return true;
  }
  function updatePrompt() {
    const c = running && !talking && !busy && !paused && !journalOpen && !docEl ? candidates()[0] : null;
    const txt = c ? ST.labelFor(c.id, S) : ""; if (txt === lastPrompt) return; lastPrompt = txt;
    hud.prompt.hidden = !c; hud.prompt.querySelector("span").textContent = txt; input.buttons.interact && input.buttons.interact.classList.toggle("ready", !!c);
  }

  /* ---------------- conversation flow ---------------- */
  async function converse(nodeId, speakerId) {
    if (busy || talking) return; talking = true; input.enabled = false; hud.prompt.hidden = true; lastPrompt = ""; stage.host.classList.add("in-dialogue");
    try { if (speakerId && npcs[speakerId]) npcs[speakerId].h.faceToward(player.h.group.position.x, player.h.group.position.z, 1); await present(D.start(nodeId)); } catch (e) { console.error(e); endTalk(); }
  }
  async function step(kind, i) { if (busy || !talking) return; try { await present(kind === "choose" ? D.choose(i) : D.advance()); } catch (e) { console.error(e); endTalk(); } }
  async function present(v) {
    busy = true;
    try {
      const ev = D.drainEvents(), hasToast = ev.some(e => e.t === "toast"), scene = ev.filter(e => e.t === "event" && SCENE_EVENTS.has(e.id));
      for (const e of ev) handleEvent(e, hasToast);
      if (scene.length) { dlg.hide(); cam.clearShot(); for (const e of scene) await sceneEvent(e.id); }
      if (S.ending && !endingStarted && !v) { await playEnding(); return; }
      if (!v) { endTalk(); return; }
      showView(v);
    } finally { busy = false; }
  }
  function speakerModel(id) { return id === "elizabeth" ? null : npcs[id] && npcs[id].h; }
  function showView(v) {
    const who = ST.WHO[v.who] || ST.WHO.narr; dlg.show(v, who, VOICE[v.who] || VOICE.narr); setShot(v.who);
    const h = speakerModel(v.who); if (h && v.who !== "you") { h.faceToward(player.h.group.position.x, player.h.group.position.z, 1); const r = Math.random(); h.gesture(r < 0.35 ? "nod" : r < 0.55 ? "shrug" : r < 0.7 ? "point" : "beg", 900); }
    if (v.who === "elizabeth") countess.gesture(["raise", "dismiss", "tilt"][(Math.random() * 3) | 0], 1500);
  }
  function setShot(who) {
    const p = player.h.group.position; let q = null, hh = 1.45;
    if (who === "elizabeth" && countess.group.visible) { q = countess.group.position; hh = 1.55; } else { const h = speakerModel(who); if (h && h.group.visible) q = h.group.position; }
    if (!q) { if (!holdShot) cam.clearShot(); return; }
    const portrait = stage.camera.aspect < 0.9, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, rx = -uz, rz = ux, isE = who === "elizabeth", back = (isE ? 2.3 : 2.9) + (portrait ? 1.4 : 0), side = (portrait ? 2.2 : 1.5) + (isE ? 0.5 : 0);
    let pos = null;
    for (const [b, sd] of [[back, side], [back, -side], [back * 0.55, side * 0.6], [1.1, -0.9]]) { const x = p.x - ux * b + rx * sd, z = p.z - uz * b + rz * sd; if (S.area === "inside" || segClear(p.x, p.z, x, z) >= 1) { pos = new Vector3(x, Math.max(groundH(p.x, p.z), p.y) + 1.95, z); break; } }
    if (!pos) pos = new Vector3(p.x - ux * 0.6, Math.max(groundH(p.x, p.z), p.y) + 2.1, p.z - uz * 0.6);
    clampToRoom(pos);
    cam.setShot({ pos, look: new Vector3(q.x * 0.8 + p.x * 0.2, q.y + hh * 0.95, q.z * 0.8 + p.z * 0.2), fov: who === "elizabeth" ? 42 : 46 });
  }
  function endTalk() {
    dlg.hide(); cam.clearShot(); holdShot = false; talking = false; input.enabled = !journalOpen && !cine && !docEl; stage.host.classList.remove("in-dialogue");
    countess.faceToward(player.h.group.position.x, player.h.group.position.z, 0.3);
    syncLocks(); updateHud(); shell.objective(ST.objective(S)); persist();
    if (docQueue.length && !docEl) { const n = docQueue.shift(); setTimeout(() => showDoc(n), 300); }
    checkFinal();
    const next = afterTalk.shift(); if (next) setTimeout(() => { if (!disposed && !talking && !busy) next(); }, 450);
  }
  function syncLocks() {
    const was = { ...wopt }; wopt.chambers = ST.chambersOpen(S) && S.act >= 2; wopt.store = !!S.items.storekey; wopt.passage = !!S.flags.passage_open;
    W.setLock("chambers", wopt.chambers); W.setLock("store", wopt.store);
    if (!was.chambers && wopt.chambers) { creak(); shell.toast("The castellan sends word: the countess will receive you. Her apartments are through the gallery.", "clue"); }
    if (!was.store && wopt.store) creak();
  }
  function checkFinal() { if (ST.finalReady(S) && !S.flags.summoned) { S.flags.summoned = true; afterTalk.push(summon); if (!talking && !busy) { const n = afterTalk.shift(); setTimeout(() => n && n(), 600); } } }
  function summon() {   // the castellan comes to find you, wherever you are, with a candle
    if (disposed || S.ending) return; if (journalOpen) toggleJournal(); if (docEl) closeDoc(true);
    const g = player.h.group.position, n = npcs.castellan, fx = Math.sin(player.h.group.rotation.y), fz = Math.cos(player.h.group.rotation.y);
    let best = null; for (const [a, r] of [[0, 1.7], [0.8, 1.6], [-0.8, 1.6], [1.6, 1.4], [-1.6, 1.4], [Math.PI, 1.6]]) { const x = g.x + (fx * Math.cos(a) - fz * Math.sin(a)) * r, z = g.z + (fz * Math.cos(a) + fx * Math.sin(a)) * r; if (walkable(x, z, wopt)) { best = [x, z]; break; } }
    best = best || [g.x + fx * 1.2, g.z + fz * 1.2]; place(n, best[0], best[1], [g.x, g.z]); setVis(n, true); creak();
    converse("summons", "castellan");
  }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "meter": if (e.k === "know" && e.d > 0) audio.good(); break;
      case "item": shell.toast("You now carry: " + (ITEMS[e.id] || e.id), "item"); audio.good(); break;
      case "clue": { const ev = ST.EVIDENCE[e.id]; if (!ev) break; shell.toast("New evidence: " + ev.title, "clue"); sting(); updateHud("ev"); if (DOC_KINDS.has(ev.kind)) docQueue.push(e.id); break; }
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
      case "event": if (e.id === "letter") foundLetter(); break;
    }
  }
  function foundLetter() {
    const f = loadObj(ST.FINDS_KEY); if (!f.letter) { f.letter = Date.now(); save(ST.FINDS_KEY, f); }
    let fresh = []; try { fresh = Archive.sync("find:bathory:letter"); } catch (e) { console.error(e); }
    if (fresh.length) afterTalk.push(() => { if (disposed) return; revealing = true; input.enabled = false;
      reveal(fresh, { onDone: () => { revealing = false; input.enabled = !talking && !cine && !journalOpen && !docEl; }, openArchive: () => { persist(); dispose(); onExit(); setTimeout(() => dispatchEvent(new CustomEvent("moe:open-archive")), 80); } }); });
  }

  /* ---------------- set pieces ---------------- */
  async function enterPalace() {
    await cinematic(async () => {
      const d = W.palaceDoor; cam.setShot({ pos: new Vector3(d.x + 3, d.y + 2.2, d.z + 6), look: new Vector3(d.x, d.y + 1.4, d.z), fov: 46 }); creak(); await tween(1.1); await shell.fade(true, 600);
      S.area = "inside"; syncWorld(true); const p = ix([0, -1.8]); placePlayer(p[0], p[1], Math.PI); cam.pitch = 0.1; cam.snap(); room = "hall"; placeLights();
      cam.setShot({ pos: new Vector3(I.x + 5.5, 5.5, I.z - 1), look: new Vector3(I.x, 1.4, I.z - 9), fov: 52 }); await shell.fade(false, 900); await tween(2.4); persist();
    });
    if (!S.seen.hall_intro) { S.seen.hall_intro = 1; shell.toast("The great hall of Csejte. Search the rooms for records (E).", "clue"); }
  }
  async function leavePalace() {
    await cinematic(async () => { creak(); await shell.fade(true, 600); S.area = "castle"; syncWorld(true); placePlayer(L.doorIn[0], L.doorIn[1] + 1.4, 0); placeLights(); await shell.fade(false, 800); persist(); });
  }
  async function firstMeeting() {
    await cinematic(async () => {
      const g = countess.group, w = ix(L.elizaWindow); g.position.set(w[0] - 1, 0, w[1]); g.rotation.y = Math.PI / 2;   // at the window, her back to you
      cam.setShot({ pos: new Vector3(I.x + 24.4, 2.0, I.z - 8.3), look: new Vector3(g.position.x, 1.5, g.position.z), fov: 40 }); cam.snap && cam.snap(); creak(); await tween(2.4);
      audio.tone({ freq: 146.8, dur: 3, type: "triangle", vol: 0.04, wet: 0.8 }); audio.tone({ freq: 155.6, dur: 3, type: "triangle", vol: 0.025, wet: 0.8 });
      await tween(1.8, k => { g.rotation.y = Math.PI / 2 - ease(k) * Math.PI; cam.setShot({ pos: new Vector3(I.x + 25.2 + k * 1.2, 1.85, I.z - 10.8 - k * 2.2), look: new Vector3(g.position.x, 1.55, g.position.z), fov: 40 - k * 6 }); });
      g.position.set(...ix(L.eliza).flatMap((v, i) => i === 0 ? [v, 0] : [v])); countess.faceToward(player.h.group.position.x, player.h.group.position.z, 1);
    });
    converse("eliza_1");
  }
  async function sceneEvent(id) {
    if (id === "act2") {
      await shell.fade(true, 900); S.area = "castle"; syncWorld(true); placePlayer(0, -105, Math.PI); placeLights(); bellToll(1, 196);
      await shell.fade(false, 1000);
      await cinematic(async () => { const t = 42; await tween(5, k => { const e = ease(k); cam.setShot({ pos: new Vector3(-6 + e * 8, t + 18 - e * 13, -88 - e * 14), look: new Vector3(0, t + 6 - e * 4, -126 + e * 4), fov: 54 - e * 6 }); }); });
      shell.toast("The upper castle of Csejte. The castellan is waiting.", "clue");
    } else if (id === "passage") {
      await cinematic(async () => { const p = ix([-22, 1]); holdShot = true; cam.setShot({ pos: new Vector3(p[0] + 2, 2, p[1] + 2.4), look: new Vector3(I.x - 25, 1.2, I.z + 1), fov: 46 }); creak();
        await tween(1.8, k => { secretK = ease(k); const m = W.doorLeaves.passage; m.rotation.y = secretK * 1.4; m.position.x = I.x - 25 - secretK * 0.6; }); wopt.passage = true; holdShot = false; });
    } else if (id === "act4") {
      await shell.fade(true, 900);
      W.setZone("surface"); setPhase("night", true); const t = 42; cam.setShot({ pos: new Vector3(-20, t + 4, -70), look: new Vector3(0, t + 10, -128), fov: 46 }); cam.snap(); bellToll(2, 165);
      await shell.fade(false, 900); await tween(3.4); await shell.fade(true, 700);
      W.setZone("inside"); S.area = "inside"; syncWorld(true); placeCountess(); const p = ix([21, -11.5]); placePlayer(p[0], p[1], Math.atan2(6.6, -4.9)); cam.pitch = 0.12; cam.snap(); room = "chambers"; placeLights(); cam.clearShot(); cam.snap();
      await shell.fade(false, 800); afterTalk.push(() => converse("eliza_final"));
    }
  }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    const outdoors = area => { S.area = area; W.setZone("surface"); for (const k of ["secretary", "marta", "gergely", "sexton", "zuzana"]) setVis(npcs[k], true); extras.forEach(e => setVis(e, true)); setVis(npcs.ilka, false); countess.group.visible = false; placeLights(); };
    endingStarted = true; winDim = 1; flameDim = 1; endWalk = 0; dlg.hide(); talking = true; input.enabled = false; hud.prompt.hidden = true; hudShow(false); bars.classList.add("on");
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id]; const found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    const t = 42, shot = async (dur, f) => { const tw = tween(dur, f); cam.snap(); await shell.fade(false, 900); await tw; };   // the closing shot starts in place, under the fade
    if (id === "monster") {   // the seal on the report; then the castle at night, her window, a candle that goes out
      paper(); audio.bell(110, 0.08); await tween(1.2);
      await shell.fade(true, 900); outdoors("castle"); setPhase("night", true); startAmbience(); stopPad();
      await shot(7, k => { const e = ease(k); cam.setShot({ pos: new Vector3(26 - e * 10, t + 22 - e * 6, -44 - e * 22), look: new Vector3(0, t + 7, -127), fov: 34 - e * 12 }); winDim = 1 - e * 0.92; });
    } else if (id === "conspiracy") {   // dawn over the road; the report rides away
      await shell.fade(true, 900); outdoors("village"); setPhase("dawn", true); startAmbience(); stopPad();
      await shot(7, k => { const e = ease(k); cam.setShot({ pos: new Vector3(14 - e * 10, 8 + e * 30, 30 - e * 50), look: new Vector3(0, 10 + e * 24, -60 - e * 50), fov: 52 }); });
    } else if (id === "unanswered") {   // the countess walking away down the gallery, past her own portrait
      S.area = "inside"; W.setZone("inside"); room = "gallery"; placeLights(); const g = countess.group; g.visible = true; const a = ix([12.5, -6]); g.position.set(a[0], 0, a[1]); g.rotation.y = Math.PI / 2; endWalk = 0.6;
      audio.tone({ freq: 146.8, dur: 4, type: "triangle", vol: 0.03, wet: 0.8 });
      await shell.fade(true, 700); await shot(8, k => { g.position.x = I.x + 12.5 + k * 15; cam.setShot({ pos: new Vector3(I.x + 9.8, 1.9, I.z - 5.2 - k * 0.5), look: new Vector3(g.position.x, 1.35, I.z - 6.1), fov: 46 - k * 8 }); flameDim = 1 - k * 0.65; }); endWalk = 0;
    } else {   // the Palatine's version: the village square in grey daylight, the castle above, a signature
      await shell.fade(true, 900); outdoors("village"); setPhase("afternoon", true); startAmbience(); stopPad();
      await shot(7, k => { const e = ease(k); const s = npcs.secretary.h.group.position; cam.setShot({ pos: new Vector3(s.x + 3 - e * 6, 2 + e * 22, s.z + 4 + e * 20), look: new Vector3(s.x * (1 - e), 1.5 + e * 40, s.z * (1 - e) + C[1] * e), fov: 50 }); });
    }
    await shell.fade(true, 1300); cam.clearShot(); bars.classList.remove("on");
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 4, cls: E.cls, adv: "bathory", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }

  /* ---------------- persistence ---------------- */
  function persist() { if (!S || !player || S.ending || endingStarted || !S.seen.start) return; const g = player.h.group; save(ST.SAVE_KEY, { v: 1, s: S, pos: [g.position.x, g.position.z, g.rotation.y] }); }

  /* ---------------- camera inside: stay within the current room ---------------- */
  function clampToRoom(v) {
    if (S.area !== "inside" || !room) return v; const r = ROOMS[room], m = 0.25;
    v.x = clamp(v.x, I.x + r[0] + m, I.x + r[1] - m); v.z = clamp(v.z, I.z + r[2] + m, I.z + r[3] - m); v.y = clamp(v.y, 0.6, r[4] - 0.35); return v;
  }

  /** outdoors: true where a conversation shot must not be placed (inside a house, beyond the walls of the upper castle).
   *  While walking the camera has no collisions (as in the other adventures): it is only kept above the ground. */
  function camBlocked(x, z) {
    for (const b of col.b) if (b.on && x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return true;
    return z < -101.5 && !walkable(x, z, {});
  }
  const segClear = (ax, az, bx, bz) => { const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25)); for (let i = 1; i <= n; i++) if (camBlocked(ax + (bx - ax) * i / n, az + (bz - az) * i / n)) return (i - 1.5) / n; return 1; };

  /** inside: shorten the camera arm so that it stays in the room (instead of sliding along the wall over the player's head) */
  function pullInRoom(p) {
    const r = ROOMS[room]; if (!r) return; const c = cam.pos, m = 0.3, dx = c.x - p.x, dz = c.z - p.z, x0 = I.x + r[0] + m, x1 = I.x + r[1] - m, z0 = I.z + r[2] + m, z1 = I.z + r[3] - m; let k = 1;
    if (dx > 1e-4 && c.x > x1) k = Math.min(k, (x1 - p.x) / dx); if (dx < -1e-4 && c.x < x0) k = Math.min(k, (x0 - p.x) / dx);
    if (dz > 1e-4 && c.z > z1) k = Math.min(k, (z1 - p.z) / dz); if (dz < -1e-4 && c.z < z0) k = Math.min(k, (z0 - p.z) / dz);
    if (k < 1) { k = Math.max(0.15, k); c.x = p.x + dx * k; c.z = p.z + dz * k; }
  }

  /* ---------------- main loop ---------------- */
  function tick(rawDt, t) {
    if (!running || disposed) return;
    if (paused) return;
    const dt = rawDt * timeScale;
    emaDt += (rawDt - emaDt) * 0.05; if (!degraded && emaDt > 0.05) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); } } else lowFrames = Math.max(0, lowFrames - 1);
    for (const a of anims) { a.t += dt; const k = Math.min(1, a.t / a.dur); try { a.f(k); } catch (e) { console.error(e); } if (k >= 1) { anims.delete(a); a.res(); } }
    dlg.tick(rawDt);
    const g = player.h.group, ins = S.area === "inside";
    if (!talking && !busy && !journalOpen && !docEl && input.enabled && !revealing) {
      const lk = input.takeLook(); cam.rotate(lk.dx, lk.dy); cam.yaw -= input.turn() * dt * 1.9;
      const mv = input.move(), run = input.running(), sp = (run ? 5.2 : 3.1) * (ins ? 0.8 : 1), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const vx = fx * mv.y + rx * mv.x, vz = fz * mv.y + rz * mv.x, m = Math.hypot(vx, vz), ox = g.position.x, oz = g.position.z;
      const nx = ox + (m > 0.05 ? vx / Math.max(1, m) * sp * dt : 0), nz = oz + (m > 0.05 ? vz / Math.max(1, m) * sp * dt : 0);
      if (walkable(nx, nz, wopt)) { g.position.x = nx; g.position.z = nz; } else if (walkable(nx, oz, wopt)) g.position.x = nx; else if (walkable(ox, nz, wopt)) g.position.z = nz;
      col.resolve(g.position, 0.34); if (!walkable(g.position.x, g.position.z, wopt)) { g.position.x = ox; g.position.z = oz; }
      if (m > 0.05) { let a = Math.atan2(vx, vz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += a * Math.min(1, dt * 12); stepT -= dt * sp; if (stepT < 0) { stepT = 1.5; audio.step(ins || g.position.z < -96 ? "stone" : Math.hypot(g.position.x, g.position.z - 3) < 10 ? "stone" : "grass", 0.035); } }
      g.position.y = groundH(g.position.x, g.position.z); player.h.update(dt, t, { speed: m > 0.05 ? sp * Math.min(1, m) : 0 });
    } else player.h.update(dt, t, { speed: 0 });
    const pp = g.position;
    if (!ins) { const a = surfArea(pp.z); if (a !== S.area && S.area !== "inside") { S.area = a; shell.objective(ST.objective(S)); } }
    if (ins) { const nr = roomAt(pp.x - I.x, pp.z - I.z, 0) || room; if (nr !== room) { room = nr; placeLights(); if (room === "chambers" && S.act === 2 && !S.flags.knock) { S.flags.knock = true; } } }
    // people
    for (const k in npcs) { const n = npcs[k]; if (!n.vis) continue; const gp = n.h.group.position, d = Math.hypot(gp.x - pp.x, gp.z - pp.z); n.h.update(dt, t, { speed: 0, lookAt: d < 9 ? { x: pp.x, y: pp.y + 1.5, z: pp.z } : null }); if (d < 4 && !talking) n.h.faceToward(pp.x, pp.z, Math.min(1, dt * 1.6)); if (n.label) { n.label.visible = d < 7 && !talking; if (n.label.visible) { const cd = Math.hypot(gp.x - cam.cam.position.x, gp.z - cam.cam.position.z), s = clamp(cd / 6, 0.45, 1.2); n.label.scale.set(1.9 * s, 0.4 * s, 1); } } }
    for (const e of extras) if (e.vis) e.h.update(dt, t, { speed: 0 });
    if (countess.group.visible) {
      let speed = endWalk;
      if (S.act === 3 && ins && !talking && !endingStarted) {   // in Act III she walks in her gallery, as she pleases
        elizaWalk += dt * 0.32; const u = (Math.sin(elizaWalk) + 1) / 2, x = I.x + 11.5 + u * 15, dir = Math.cos(elizaWalk); const gp = countess.group.position; speed = Math.abs(dir) * 0.6; gp.set(x, 0, I.z - 6); countess.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      const d = Math.hypot(countess.group.position.x - pp.x, countess.group.position.z - pp.z); countess.update(dt, t, { talk: talking && D.cur && D.cur.who === "elizabeth" ? 1 : 0, speed, lookAt: d < 8 ? pp : null }); countess.label.visible = d < 6 && !talking;
    }
    musicTick(dt);
    lights.forEach((l, i) => { l.intensity = (l.userData.base || 0) * (ins ? (0.85 + Math.sin(t * 9 + i * 2) * 0.08 + Math.sin(t * 21 + i) * 0.05) : (curLook.lamps || 0)); });
    W.update(dt, t, W.lookState || {});
    applyLook(dt);
    cam.dist += ((ins ? (room === "passage" || room === "niche" || room === "corrW" || room === "gallery" ? 2.6 : 3.6) : 5.2) - cam.dist) * Math.min(1, dt * 3);
    cam.update(rawDt, { x: pp.x, y: pp.y, z: pp.z });
    if (ins && !cam.shot) { pullInRoom(pp); clampToRoom(cam.pos); stage.camera.position.copy(cam.pos); stage.camera.lookAt(cam.look); }   // the camera never leaves the room you are in
    sky.follow(stage.camera);
    updatePrompt();
    saveTimer += rawDt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); };
  addEventListener("pagehide", onHide);
  function dispose() {
    if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide); host.removeEventListener("pointerdown", onHostDown);
    try { persist(); } catch (e) { /* ignore */ }
    try { stopPad(); stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ }
    anims.clear(); host.innerHTML = "";
  }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get cine() { return cine; }, get cines() { return cineCount; }, get phase() { return phase; }, get room() { return room; },
      get docOpen() { return !!docEl; }, get revealing() { return revealing || revealOpen(); }, get muted() { return audio.muted; }, get zone() { return W && (W.inside.visible ? "inside" : "surface"); }, get wopt() { return { ...wopt }; }, get secretK() { return secretK; },
      begin: s => begin(s), setTimeScale: v => { timeScale = v; },
      tp: (x, z) => { player.h.group.position.set(x, groundH(x, z), z); }, tpi: (x, z) => { const p = ix([x, z]); player.h.group.position.set(p[0], 0, p[1]); room = roomAt(x, z, 0) || room; placeLights(); },
      pos: () => [player.h.group.position.x, player.h.group.position.z], local: () => [player.h.group.position.x - I.x, player.h.group.position.z - I.z],
      near: () => candidates().map(c => c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), skip: () => dlg.skip(),
      closeDoc: () => closeDoc(), connect: (a, b) => tryConnect(a, b), board: () => { toggleJournal("board"); }, boardPick: id => boardPick(id), journalOpen: () => journalOpen, toggleJournal: () => toggleJournal(),
      canWalk: (lx, lz) => walkable(I.x + lx, I.z + lz, wopt), ending: () => S && S.ending, endingsFound, persist, stage: () => stage, patch: p => { Object.assign(S, p); syncWorld(true); },
      cam: (yaw, pitch) => { cam.yaw = yaw; cam.pitch = pitch; }, L, I,
    },
  };
}
