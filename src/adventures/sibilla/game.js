// THE SIBYL OF THE APENNINES - third-person narrative adventure in four acts: the village (Montemonaco at dusk), the
// mountain (the night climb, the fairies' dance), the kingdom (the bridge, the beating doors, the crystal door, the
// enchanted cavern where days run away) and the queen. Story rules: story.js; scenery: world.js; characters: models.js.
// Reuses the shared stage, shell, input, dialogue UI, chase camera, low-poly humans, saves and the Archive.
import { Color, HemisphereLight, DirectionalLight, PointLight, Vector3, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Object3D } from "three";
import { createStage } from "../../engine.js";
import { AudioBus } from "../../shared/audio.js";
import { createInput } from "../../shared/input.js";
import { createShell } from "../../shared/ui.js";
import { sceneSVG } from "../../ui/art.js";
import { load, save, clear, loadObj } from "../../shared/save.js";
import { el, sfx } from "../../common.js";
import { Colliders, makeSky, makeHuman, makeShadow, nameLabel, glowSprite, ChaseCam } from "../../shared/world.js";
import { Dialogue, clamp, restoreState, validPos } from "../../narrative/core.js";
import { createDialogueUI } from "../../narrative/dialogue-ui.js";
import * as Archive from "../../shared/archive.js";
import { reveal, revealOpen } from "../../ui/archive-ui.js";
import * as ST from "./story.js";
import { buildWorld, groundH, walkable, L, K, kx } from "./world.js";
import { makeFairy, makeSibyl, dressPlayer } from "./models.js";

const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const ease = t => t * t * (3 - 2 * t);
const LOOKS = {
  dusk:    { top: 0x27365e, mid: 0xb4786a, bot: 0xf2b072, fog: 0xc89a82, fogD: 0.0085, sunC: 0xffb070, sunI: 1.7, hS: 0xa8b4d8, hG: 0x5a4630, hI: 0.8, stars: 0.15, sun: [-0.85, 0.16, 0.25], lamps: 0.7, night: 0, ranges: 0xb8a6a8, win: 0.65, mist: 0.8 },
  night:   { top: 0x050a1c, mid: 0x13224a, bot: 0x34486e, fog: 0x1c2a48, fogD: 0.0095, sunC: 0xb4c8ff, sunI: 1.15, hS: 0x7a90c8, hG: 0x22242e, hI: 0.9, stars: 1, sun: [0.35, 0.7, -0.55], lamps: 1, night: 1, ranges: 0x4a5670, win: 1, mist: 1.2 },
  dawn:    { top: 0x3a4c86, mid: 0xd89a9a, bot: 0xffd2a2, fog: 0xd4aea6, fogD: 0.009, sunC: 0xffc090, sunI: 1.4, hS: 0xb0b8e0, hG: 0x5a4a40, hI: 0.85, stars: 0, sun: [0.9, 0.12, -0.25], lamps: 0.2, night: 0.2, ranges: 0xd0b4b4, win: 0.3, mist: 1 },
  winter:  { top: 0x7aa0d0, mid: 0xd8e4f0, bot: 0xf4f6fa, fog: 0xdde4ee, fogD: 0.014, sunC: 0xfff2e0, sunI: 1.5, hS: 0xe0e8ff, hG: 0x8a8a90, hI: 1.0, stars: 0, sun: [0.4, 0.5, 0.6], lamps: 0, night: 0, ranges: 0xe8eef6, win: 0.2, mist: 0.6 },
  kingdom: { top: 0x04030a, mid: 0x140c2a, bot: 0x3a1c50, fog: 0x121c3c, fogD: 0.0105, sunC: 0xffd8b0, sunI: 0.55, hS: 0x9aa8f0, hG: 0x4a2a50, hI: 1.15, stars: 0.7 },
  throne:  { top: 0x06040c, mid: 0x1c1028, bot: 0x4a2a3a, fog: 0x201634, fogD: 0.0095, sunC: 0xffd090, sunI: 0.8, hS: 0xe0c090, hG: 0x4a2a50, hI: 1.2, stars: 0.5 },
};
const VOICE = { lasale: { pitch: 190, kind: "triangle" }, priest: { pitch: 150, kind: "sawtooth" }, shepherd: { pitch: 140, kind: "triangle" }, singer: { pitch: 260, kind: "square" }, vittoria: { pitch: 280, kind: "triangle" },
  fairy: { pitch: 520, kind: "sine" }, porter: { pitch: 330, kind: "sine" }, knight: { pitch: 120, kind: "triangle" }, sibyl: { pitch: 210, kind: "sine" }, narr: { pitch: 0 }, you: { pitch: 0 } };
const ITEMS = { medallion: "Half of a bronze medallion", notebook: "La Sale’s notebook", thread: "Vittoria’s red thread" };
const SCENE_EVENTS = new Set(["act2", "act3", "act4", "guided", "fairies_leave"]);
const OBJ_POS = {
  gate: [L.gate, 4.2], cross: [L.cross, 3.2], stazzo: [L.stazzo, 4.8], shrine: [L.shrine, 5.2], mouth: [[L.mouth[0], L.mouth[1] + 1.2], 3.4],
  feast: [kx(L.feast), 3.6], bench: [kx(L.bench), 2.8], window: [kx([L.window[0] + 3.2, L.window[1]]), 4.6], pool: [kx(L.pool), 7.6], throne: [kx([0, -104.5]), 3.4],
};
// the saltarello: an original tune in D dorian, leaping 6/8 (one value = one eighth)
const TUNE = [62, 0, 69, 67, 65, 64, 65, 67, 69, 0, 72, 69, 67, 65, 64, 62, 64, 65, 67, 0, 65, 64, 62, 60, 62, 0, 69, 67, 65, 64, 62, 0];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "The Sibyl of the Apennines", kicker: "Legend · Monte Sibilla, the Marche, Italy · 1420", accent: "#c9a0dc", accent2: "#e8c87a", art: sceneSVG("sibilla"), journal: true,
    tagline: "A foundling, a village under the mountain, and a queen who knows every answer — for a price.",
    note: "A third-person adventure in four acts, after the medieval legend of the Sibilla Appenninica as told by Andrea da Barberino (“Il Guerrin Meschino”, c. 1410) and Antoine de La Sale (“Le Paradis de la reine Sibylle”), and by the folklore of the Sibillini. The codex (J) says what is history, what is literature, what is folklore and what this game invents. Four endings.",
    controls: [["W A S D", "move"], ["Shift", "run"], ["Mouse drag / ← →", "camera"], ["E / Space", "interact"], ["1-4", "choose"], ["J", "journal"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  { // respect the site's sound settings: the header volume (moe.ambient.v1) and the mini-games' mute
    const amb = load("moe.ambient.v1", null), vol = amb && typeof amb.vol === "number" ? amb.vol : 0.4;
    audio.level = 0.35 + 0.65 * Math.sqrt(clamp(vol, 0, 1)); if (vol <= 0.001 || sfx.muted) audio.muted = true;
  }
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, W = null, cam = null, sky = null, moon = null, D = null, S = null, player = null, dress = null, hud = null, journalEl = null, bars = null, snow = null;
  let running = false, paused = false, busy = false, talking = false, journalOpen = false, disposed = false, endingStarted = false, degraded = false, cine = 0, revealing = false, timeScale = 1;
  let phase = "dusk", curLook = {}, tgtLook = {}, hemi, sun, lights = [], stepT = 0, saveTimer = 0, lastPrompt = "", emaDt = 0.016, lowFrames = 0, afterTalk = [], doorT = 0, doorK = 0, gust = 0, gustT = 4, crystalK = 0, musicVol = 0, musicT = 0, musicStep = 0, drone = null, shake = 0;
  const npcs = {}, fairies = [], extras = [], col = new Colliders(), anims = new Set(), tmpV = new Vector3();
  let holdShot = false, sibyl = null, fairyMode = "meadow";   // meadow | lead | gone | hall | dawn

  /* ---------------- game-time animation (pauses with the game, scales in tests) ---------------- */
  const tween = (dur, f = () => {}) => new Promise(res => { const a = { t: 0, dur: Math.max(0.001, dur), f, res }; anims.add(a); f(0); });
  async function cinematic(fn) {
    cine++; busy = true; input.enabled = false; hudShow(false); bars.classList.add("on");
    try { await fn(); } catch (e) { console.error(e); }
    finally { cine = Math.max(0, cine - 1); if (!cine) { bars.classList.remove("on"); busy = false; cam.clearShot(); if (!talking) { input.enabled = !journalOpen; hudShow(true); } } }
  }

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && !s.s.ending && s.s.act >= 1 && s.s.seen && s.s.seen.start ? s : null; };
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    shell.title({ hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${Object.keys(endingsFound()).length} / 4</p>`, onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); } });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume(); shell.loading(0, "Climbing the Aso valley…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0xc89a82, fog: 0.009, fov: 58, far: 760, maxPR: 1.5 });
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: false });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(1.5); stage.scene.add(sky.mesh);
      moon = glowSprite("220,230,255", 26); moon.material.opacity = 0; stage.scene.add(moon); const disk = glowSprite("245,248,255", 5); moon.add(disk); disk.scale.setScalar(0.22); moon.userData.disk = disk;
      hemi = new HemisphereLight(0xa8b4d8, 0x5a4630, 0.8); sun = new DirectionalLight(0xffb070, 1.7); stage.scene.add(hemi, sun, sun.target);
      for (let i = 0; i < 3; i++) { const pl = new PointLight(0xffc070, 0, 22, 1.6); stage.scene.add(pl); lights.push(pl); }
      bars = el("div", "adv-letterbox noinput"); host.querySelector(".adv-ui").append(bars);
      cam = new ChaseCam(stage.camera, { dist: 5.4, height: 1.7, minPitch: -0.32, maxPitch: 0.8 }); cam.groundAt = groundH;
      wireInput();
      let tier = 1; try { const gl = stage.renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"); const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); tier = /swiftshader|llvmpipe|software/i.test(name) ? 0 : matchMedia("(pointer: coarse)").matches ? 1 : 2; } catch (e) { /* unknown GPU */ }
      W = buildWorld(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.75, m), tier); await frame();
      shell.loading(0.88, "Gathering the village…"); await frame();
      buildPeople();
      { const n = 900, g = new BufferGeometry(), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 60; p[i * 3 + 1] = Math.random() * 30; p[i * 3 + 2] = (Math.random() - 0.5) * 60; } g.setAttribute("position", new Float32BufferAttribute(p, 3)); snow = new Points(g, new PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false })); snow.visible = false; stage.scene.add(snow); }
      stage.onFrame(tick);
    }
    shell.loading(0.96, "Lighting the lamps…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false; cine = 0; anims.clear(); afterTalk = []; crystalK = S.act >= 3 && S.stage !== "bridge" && S.stage !== "doors" && S.stage !== "door" ? 1 : 0;
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i)); snow.visible = false; W.serpents.userData.on = 0; W.leaves.count = 0; W.dresses.forEach(d => { d.visible = false; }); W.fairyRoad.material.opacity = 0.35;
    if (saved && validPos(saved.pos)) placePlayer(saved.pos[0], saved.pos[1], saved.pos[2] || 0); else placePlayer(L.start[0], L.start[1], Math.PI);
    syncWorld(true);
    shell.close(); shell.setRunning(true); running = true; input.enabled = true; hudShow(true); updateHud(); shell.objective(ST.objective(S));
    audio.stopAllLayers(); startAmbience(); await shell.fade(false, 1000);
    if (!saved) { bellToll(3); converse("start"); } else shell.toast("Progress restored. Welcome back.");
  }
  function placePlayer(x, z, yaw) { player.h.group.position.set(x, groundH(x, z), z); player.h.group.rotation.y = yaw; cam.yaw = yaw + Math.PI; cam.pitch = 0.16; cam.snap(); }

  /* ---------------- people ---------------- */
  function buildPeople() {
    const mk = (id, o, name = ST.WHO[id] && ST.WHO[id].name) => {
      const h = makeHuman(o); h.group.add(makeShadow(0.55, 0.9)); stage.scene.add(h.group);
      const label = name ? nameLabel(name) : null; if (label) { label.position.y = (o.scale || 1) * 2.05; h.group.add(label); label.visible = false; }
      return { id, h, label, vis: true };
    };
    player = mk("you", { cloth: 0x4a5a6a, cloth2: 0x2a2620, hair: 0x2a1c14, scale: 1 }, null); dress = dressPlayer(player.h);
    npcs.lasale = mk("lasale", { cloth: 0x2a3a7a, cloth2: 0xc9a24a, hair: 0x4a3020, hat: "cap", beard: true, scale: 1.04 });
    npcs.priest = mk("priest", { cloth: 0x1c1a1e, cloth2: 0x101012, robe: true, hair: 0x9a9a9a, scale: 1.0 });
    npcs.shepherd = mk("shepherd", { cloth: 0x6a5232, cloth2: 0x3a2c1c, hair: 0xd8d8d8, beard: true, hood: true, scale: 0.96 });
    npcs.singer = mk("singer", { cloth: 0x9a2a2a, cloth2: 0xd8b040, hair: 0x2a1c10, stripes: true, hat: "cap", scale: 1.0 });
    npcs.vittoria = mk("vittoria", { cloth: 0x4a5a3a, cloth2: 0x2e3a24, robe: true, hair: 0x8a8a8a, hat: "coif", longHair: true, scale: 0.94 });
    npcs.porter = mk("porter", { skin: 0xead8c8, cloth: 0x6a6a7a, cloth2: 0x4a4a58, robe: true, hair: 0x3a2a20, longHair: true, scale: 0.97, emissive: 0x141018 });
    npcs.knight = mk("knight", { cloth: 0x6a6a70, cloth2: 0x8a3a2a, hair: 0x9a7a4a, beard: true, scale: 1.06 });
    const med = glowSprite("255,200,120", 0.35); med.position.set(0, 1.25, 0.2); npcs.porter.h.body.add(med);
    const lan = glowSprite("255,210,150", 1.6); lan.position.set(0.32, 0.85, 0.2); npcs.porter.h.body.add(lan); npcs.porter.h.arms[1].rotation.x = -0.6;
    const singerBoard = glowSprite("255,200,120", 1.4); singerBoard.position.set(0.6, 1.8, -0.3); npcs.singer.h.group.add(singerBoard);
    [[-1.2, 4.6, 0x8a4a3a, true], [2.2, 11.5, 0x5a6a4a, false], [-18, 6, 0x7a6a4a, true], [17.5, 9.5, 0x4a5a6a, false], [7.2, -20, 0x6a4a3a, true]].forEach(([x, z, c, fem], i) => {
      const e = mk("villager", { cloth: c, cloth2: 0x3a2c1a, hair: [0x3a2a1a, 0x6a4a2a, 0xa08040][i % 3], hat: fem ? "coif" : (i % 2 ? "cap" : null), longHair: fem, robe: fem, scale: 0.9 + (i % 3) * 0.05 }, null);
      e.home = [x, z]; extras.push(e);
    });
    for (let i = 0; i < 6; i++) { const f = makeFairy(i); stage.scene.add(f.h.group); fairies.push(f); }
    sibyl = makeSibyl(); stage.scene.add(sibyl.group);
  }
  function setVis(n, v) { n.vis = v; n.h.group.visible = v; }
  function place(n, x, z, face) { n.h.group.position.set(x, groundH(x, z), z); if (face) n.h.faceToward(face[0], face[1], 1); }
  /** put the world and its people in the state the story says (start, load, act change) */
  function syncWorld(instant) {
    const zone = S.area === "kingdom" ? "kingdom" : "surface"; W.setZone(zone);
    const vil = S.act === 1;
    for (const k of ["lasale", "priest", "shepherd", "singer", "vittoria"]) { const p = L.npc[k]; place(npcs[k], p[0], p[1], [0, 8]); setVis(npcs[k], vil); }
    npcs.lasale.h.faceToward(0, -200, 1); npcs.shepherd.h.faceToward(0, -60, 1); npcs.singer.h.faceToward(-2, 10, 1);
    extras.forEach(e => { place(e, e.home[0], e.home[1], [0, 8]); setVis(e, vil); });
    const kin = S.area === "kingdom";
    place(npcs.porter, ...kx(S.stage === "door" || S.stage === "bridge" || S.stage === "doors" ? L.porter : [2.6, -48.5]), [K.x, K.z]); setVis(npcs.porter, kin && S.act === 3);
    place(npcs.knight, ...kx(L.knight), kx(L.lake)); setVis(npcs.knight, kin && S.act === 3);
    const sb = kx(L.throne); sibyl.group.position.set(sb[0], 1.2, sb[1] + 1.0); sibyl.group.rotation.y = 0; sibyl.group.visible = kin; sibyl.setSeat(0.25);
    W.doors.forEach(d => { d.visible = true; }); W.crystalDoor.material.opacity = crystalK ? 0 : 0.55; W.crystalDoor.visible = !crystalK;
    fairyMode = S.act === 2 && !S.flags.met_fairies ? "meadow" : S.act === 3 ? "hall" : "gone";
    layoutFairies();
    W.feastFood.forEach(m => { m.visible = true; }); W.setDays(S.day);
    dress.thread.visible = !!S.items.thread;
    if (!endingStarted) setPhase(phaseFor(), instant);
    shell.objective(ST.objective(S)); updateHud();
  }
  function layoutFairies() {
    const c = fairyMode === "hall" ? kx(L.dancers) : L.meadow;
    fairies.forEach((f, i) => { const a = i / fairies.length * Math.PI * 2, x = c[0] + Math.cos(a) * 3, z = c[1] + Math.sin(a) * 3; place({ h: f.h }, x, z); f.home = { a, c }; f.h.group.visible = fairyMode === "meadow" || fairyMode === "hall"; });
  }
  const phaseFor = () => S.area === "village" ? "dusk" : S.area === "mountain" ? "night" : (S.act >= 4 ? "throne" : "kingdom");
  function setPhase(name, instant) {
    phase = name; const t = LOOKS[name], C = c => new Color(c);
    tgtLook = { fog: C(t.fog), sunC: C(t.sunC), hS: C(t.hS), hG: C(t.hG), fogD: t.fogD, sunI: t.sunI, hI: t.hI, top: C(t.top ?? 0), mid: C(t.mid ?? 0), bot: C(t.bot ?? 0), stars: t.stars || 0, lamps: t.lamps || 0, night: t.night || 0, win: t.win || 0, mist: t.mist || 1, ranges: C(t.ranges ?? 0xffffff), sun: new Vector3(...(t.sun || [0.3, 0.6, 0.3])).normalize(), sky: t.top != null ? 1 : 0 };
    if (instant || !curLook.fog) curLook = Object.fromEntries(Object.entries(tgtLook).map(([k, v]) => [k, v && v.clone ? v.clone() : v]));
  }
  const winCol = new Color(), fogTint = new Color(0x3a1a4a);
  function applyLook(dt) {
    const k = 1 - Math.exp(-dt * 1.2), T = tgtLook, C = curLook; if (!T.fog) return;
    for (const key of ["fog", "sunC", "hS", "hG", "top", "mid", "bot", "ranges", "sun"]) C[key].lerp(T[key], k);
    for (const key of ["fogD", "sunI", "hI", "stars", "lamps", "night", "win", "mist", "sky"]) C[key] += (T[key] - C[key]) * k;
    const ench = S ? clamp(S.susp / 10, 0, 1) : 0, kin = S && S.area === "kingdom";
    stage.scene.fog.color.copy(C.fog); if (kin) stage.scene.fog.color.lerp(fogTint, ench * 0.45);
    stage.scene.fog.density = C.fogD * (degraded ? 1.25 : 1); stage.scene.background.copy(stage.scene.fog.color);
    hemi.color.copy(C.hS); hemi.groundColor.copy(C.hG); hemi.intensity = C.hI * (kin ? 1 + ench * 0.35 : 1); sun.color.copy(C.sunC); sun.intensity = C.sunI;
    sun.position.copy(C.sun).multiplyScalar(80).add(player.h.group.position); sun.target.position.copy(player.h.group.position);
    sky.set({ top: C.top, mid: C.mid, bot: C.bot, stars: C.stars, sun: kin || phase === "night" ? 0 : 1, sunDir: C.sun, sunCol: C.sunC });
    if (!kin) { W.ranges.material.color.copy(C.ranges); W.fairyRoad.material.color.copy(C.ranges).multiplyScalar(1.4); }
    moon.material.opacity = kin ? 0 : C.night * 0.55; moon.userData.disk.material.opacity = kin ? 0 : C.night;
    W.winLitMat.color.set(0x3a2a18).lerp(winCol.set(0xffc46a), clamp(C.win, 0, 1));
    W.lookState = { lamps: C.lamps, night: C.night, mist: C.mist, ench };
    // the point lights: lamps in the village, the meadow's glow, the kingdom's gold/teal/rose
    if (kin) { const t = kx(L.throne), d = kx(L.dancers), lk = kx(L.lake); lights[0].position.set(t[0], 5, t[1] + 2); lights[0].color.set(0xffc870); lights[0].intensity = 3.2 + (S.act >= 4 ? 2 : 0); lights[0].distance = 30;
      lights[1].position.set(d[0], 4, d[1]); lights[1].color.set(0xd8a0ff); lights[1].intensity = 2.4; lights[1].distance = 26; lights[2].position.set(lk[0] - 10, 3, lk[1] + 8); lights[2].color.set(0x60e0ff); lights[2].intensity = 2.2 + ench * 2; lights[2].distance = 34; }
    else { lights[0].position.copy(W.gateLamp); lights[0].color.set(0xffa050); lights[0].intensity = 2.6 * C.lamps; lights[0].distance = 18; lights[1].position.set(0.5, groundH(0, 8) + 3.2, 8.5); lights[1].color.set(0xffb060); lights[1].intensity = 3 * C.lamps; lights[1].distance = 22;
      const m = L.meadow; lights[2].position.set(m[0], groundH(m[0], m[1]) + 2.5, m[1]); lights[2].color.set(0xd8c0ff); lights[2].intensity = fairyMode === "meadow" && S.area === "mountain" ? 3 : 0; lights[2].distance = 20; }
  }

  /* ---------------- ambience & music (WebAudio only) ---------------- */
  function startAmbience() {
    if (!audio.ctx) return;
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    stopDrone();
    if (!S || S.area !== "kingdom") {
      const night = S && S.area === "mountain";
      audio.layer("wind", { kind: "pink", filter: "lowpass", freq: night ? 520 : 420, gain: night ? 0.09 : 0.045, lfoRate: 0.09, lfoDepth: 0.6 });
      audio.layer("leaves", { kind: "white", filter: "bandpass", freq: 3000, q: 0.5, gain: night ? 0.007 : 0.004, lfoRate: 0.17, lfoDepth: 0.8 });
      if (!night) {
        audio._amb.push(audio.every(() => audio.chirp(3800 + Math.random() * 1200), 1800, 5200));                                                      // swifts over the roofs
        audio._amb.push(audio.every(() => { const p = Math.random() * 1.6 - 0.8; for (let i = 0; i < 3; i++) setTimeout(() => audio.tone({ freq: 1320 + Math.random() * 180, dur: 0.25, type: "triangle", vol: 0.008, pan: p, wet: 0.5 }), i * 160 + Math.random() * 80); }, 5000, 11000));   // sheep bells
      } else {
        audio._amb.push(audio.every(() => audio.cricket(), 600, 1900));
        audio._amb.push(audio.every(() => { const p = Math.random() * 2 - 1; audio.tone({ freq: 430, dur: 0.35, type: "sine", vol: 0.02, slide: -60, pan: p, wet: 0.8 }); setTimeout(() => audio.tone({ freq: 380, dur: 0.6, type: "sine", vol: 0.017, slide: -40, pan: p, wet: 0.8 }), 420); }, 9000, 20000));   // a tawny owl
      }
    } else {
      audio.layer("wind", { kind: "brown", filter: "lowpass", freq: 260, gain: S.stage === "bridge" ? 0.16 : 0.035, lfoRate: 0.06, lfoDepth: 0.7 });
      audio.layer("gust", { kind: "pink", filter: "bandpass", freq: 700, q: 0.7, gain: S.stage === "bridge" ? 0.06 : 0, lfoRate: 0.21, lfoDepth: 0.9 });
      audio.stopLayer("leaves");
      startDrone();
      audio._amb.push(audio.every(() => { if (S.stage === "kingdom" || S.act >= 4) audio.bell([1046, 1318, 1568, 1760, 2093][(Math.random() * 5) | 0], 0.012, Math.random() * 1.6 - 0.8); }, 1400, 4200));   // crystals ringing
      audio._amb.push(audio.every(() => { if (S.stage !== "bridge") audio.burst({ dur: 0.05, freq: 3000, q: 4, vol: 0.02, kind: "white", pan: Math.random() * 2 - 1, wet: 0.9 }); }, 1500, 3800));   // water dripping
    }
  }
  function startDrone() {
    if (!audio.ctx || drone) return; const c = audio.ctx, out = c.createGain(); out.gain.value = 0; out.connect(audio.master); out.connect(audio.verb);
    const oscs = [[55, "sine", 0.5], [82.6, "sine", 0.35], [110.3, "triangle", 0.12], [164.4, "sine", 0.08]].map(([f, t, v]) => { const o = c.createOscillator(), g = c.createGain(); o.type = t; o.frequency.value = f; g.gain.value = v; o.connect(g).connect(out); o.start(); return o; });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.03; lfo.connect(lg).connect(out.gain); lfo.start();
    out.gain.setTargetAtTime(0.06, c.currentTime, 2.5); drone = { out, oscs: [...oscs, lfo] };
  }
  function stopDrone() { if (!drone || !audio.ctx) { drone = null; return; } const d = drone; drone = null; try { d.out.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.4); d.oscs.forEach(o => o.stop(audio.ctx.currentTime + 2)); } catch (e) { /* stopped */ } }
  function musicTick(dt) {   // the fairies' saltarello: louder as you near the meadow (or the hall)
    if (!audio.ctx || audio.muted || musicVol < 0.01) return;
    musicT += dt; const beat = 0.155;
    while (musicT > beat) {
      musicT -= beat; const n = TUNE[musicStep % TUNE.length], bar = (musicStep % 6 === 0);
      if (n) audio.tone({ freq: mtof(n + 12), dur: 0.2, type: "triangle", vol: 0.05 * musicVol, attack: 0.008, wet: 0.35 });
      if (bar) { audio.tone({ freq: mtof(50), dur: 0.9, type: "sawtooth", vol: 0.012 * musicVol, attack: 0.05, wet: 0.4 }); audio.burst({ dur: 0.06, freq: 220, q: 0.8, vol: 0.09 * musicVol, kind: "brown" }); }
      else if (musicStep % 3 === 0) audio.burst({ dur: 0.03, freq: 5200, q: 2, vol: 0.03 * musicVol, kind: "white" });   // tambourine
      musicStep++;
    }
  }
  const bellToll = (n, f = 196) => { for (let i = 0; i < n; i++) setTimeout(() => audio.bell(f, 0.08, 0.3), i * 1700); };
  const chime = () => { audio.bell(1046, 0.05, 0); setTimeout(() => audio.bell(1568, 0.04, 0.2), 180); };
  const thud = (v = 1) => { audio.tone({ freq: 48, dur: 0.6, type: "sine", vol: 0.25 * v, slide: -16 }); audio.burst({ dur: 0.4, freq: 140, q: 0.5, vol: 0.18 * v, kind: "brown", filter: "lowpass", wet: 0.6 }); };

  /* ---------------- input & controls ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" });
    input.on((a, x) => {
      if (!running || disposed || revealing || revealOpen()) return;
      if (a === "pause") return togglePause();
      if (a === "mute") return toggleSound();
      if (paused) return;
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (!busy) tryInteract(); }
      if (a === "num" && talking && !busy) dlg.pickNum(x);
    });
    shell.bind({ pause: () => togglePause(), sound: () => toggleSound(), journal: () => { if (running && !paused) toggleJournal(); } });
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

  /* ---------------- HUD & journal ---------------- */
  function hudShow(v) {
    if (!hud) {
      const ui = host.querySelector(".adv-ui");
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="meters"><div class="m" data-m="know" title="What you have learned about the mountain"><b>Lore</b><i><u></u></i></div><div class="m" data-m="susp" title="How deeply the mountain holds you"><b>Enchantment</b><i><u></u></i></div></div><div class="sib-day" hidden><span></span><i><u></u></i></div>`;
      host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = "<kbd>E</kbd><span></span>"; ui.append(pr); hud.prompt = pr;
      pr.addEventListener("pointerdown", e => { e.preventDefault(); if (!busy && !talking && running && !paused) tryInteract(); });
    }
    hud.style.display = v ? "" : "none"; if (!v) { hud.prompt.hidden = true; lastPrompt = ""; }
  }
  function updateHud(pulse) {
    if (!hud || !S) return;
    const set = (k, v, max) => { const m = hud.querySelector(`[data-m=${k}]`); m.querySelector("u").style.width = Math.round(clamp(v / max, 0, 1) * 100) + "%"; m.title = `${k === "know" ? "Lore" : "Enchantment"}: ${v} / ${max}`; if (pulse === k) { m.classList.remove("pulse"); void m.offsetWidth; m.classList.add("pulse"); } };
    set("know", S.know, 20); set("susp", S.susp, 10); hud.querySelector('[data-m=susp]').style.display = S.act >= 2 || S.susp > 0 ? "" : "none";
    const d = hud.querySelector(".sib-day"); d.hidden = S.area !== "kingdom"; d.querySelector("span").textContent = ST.dayText(S);
    d.classList.toggle("blind", !S.items.thread); d.classList.toggle("late", ST.pastLimit(S)); d.querySelector("u").style.width = S.items.thread ? Math.round(clamp(S.day / ST.DAY_LIMIT, 0, 1) * 100) + "%" : "0%";
  }
  function toggleJournal() {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking && !cine; audio.duck(1); return; }
    journalOpen = true; input.enabled = false; audio.duck(0.5); renderJournal("journal");
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove(); journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["journal", "Journal"], ["codex", "Codex"], ["help", "How to play"]]; let body = "";
    if (tab === "journal") {
      const cl = Object.keys(S.clues).filter(c => ST.CLUE_TEXT[c]), it = Object.keys(S.items).filter(k => ITEMS[k]);
      body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p>` + (S.area === "kingdom" ? `<p class="mut"><b>${ST.dayText(S)}.</b> ${S.items.thread ? "Vittoria’s thread tightens a little every day. Past the 330th, the way home is closed." : "Without something to count them, the days here slip away unseen."}</p>` : "")
        + `<h4>What you carry</h4><ul>${it.map(k => `<li>${ITEMS[k]}</li>`).join("")}</ul><h4>What you have learned <small>${cl.length}</small></h4>` + (cl.length ? `<ul>${cl.map(c => `<li>${ST.CLUE_TEXT[c]}</li>`).join("")}</ul>` : "<p class=mut>Nothing yet. Talk to people and look at things.</p>")
        + `<p class="mut">Lore ${S.know}/20 · Enchantment ${S.susp}/10. Lore opens better questions; enchantment makes the days run faster below the mountain.</p>`;
    } else if (tab === "codex") {
      const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]);
      body = `<p class="mut">What is history, what is literature, what is folklore — and what this game invents. ${got.length} / ${ids.length} entries found.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${ST.KIND_TAG[c.kind]}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join("");
    } else body = `<ul><li><b>Move</b> with W A S D or the arrows (on a touch screen: drag on the left). <b>Shift</b> runs. Drag the mouse (or the right side of the screen) to turn the camera.</li><li><b>E</b> or <b>Space</b> talks to people and examines things when a prompt appears. In conversations, pick an answer with <b>1–4</b>, a click or a tap.</li><li><b>Act I:</b> ask the people of Montemonaco about the mountain. What they tell you opens choices later.</li><li><b>Act II:</b> climb the trail at night. The fairies will test your courtesy and what you know.</li><li><b>Act III:</b> below the mountain, every pleasure costs days, and enchantment makes them run faster. Past the 330th day you cannot leave. Vittoria’s red thread counts them for you.</li><li><b>Act IV:</b> the queen will ask why you came. What you learned and what you carry decide what you can answer.</li><li>Progress is saved automatically; the title screen offers <b>Continue</b>. <b>Esc</b> pauses.</li></ul>`;
    journalEl.innerHTML = `<div class="adv-card jr"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else renderJournal(b.dataset.t); });
    host.querySelector(".adv-ui").append(journalEl);
  }

  /* ---------------- interaction ---------------- */
  function candidates() {
    const p = player.h.group.position, out = [];
    for (const id of ["lasale", "priest", "shepherd", "singer", "vittoria", "porter", "knight"]) {
      const n = npcs[id]; if (!n.vis) continue; const node = ST.talkNode(id, S); if (!node) continue;
      const d = Math.hypot(n.h.group.position.x - p.x, n.h.group.position.z - p.z); if (d < 3.3) out.push({ kind: "talk", id, d, node });
    }
    if (fairyMode === "hall" && S.act === 3 && S.stage === "kingdom") { const c = kx(L.dancers), d = Math.hypot(c[0] - p.x, c[1] - p.z); if (d < 8.5 && !S.flags.k_dance && !S.flags.k_watch) out.push({ kind: "talk", id: "fairy", d: d * 0.5, node: "dancers" }); }
    if (S.act === 4 && sibyl.group.visible) { const d = Math.hypot(sibyl.group.position.x - p.x, sibyl.group.position.z - p.z); if (d < 6 && !S.ending) out.push({ kind: "talk", id: "sibyl", d, node: "sibyl_1" }); }
    for (const id in OBJ_POS) { if (!ST.objectAvailable(id, S)) continue; const [[x, z], r] = OBJ_POS[id], d = Math.hypot(x - p.x, z - p.z); if (d < r) out.push({ kind: "obj", id, d: d * 0.8, node: ST.objectNode(id, S) }); }
    return out.sort((a, b) => a.d - b.d);
  }
  function tryInteract() { const c = candidates()[0]; if (!c) return false; converse(c.node, c.kind === "talk" ? c.id : null); return true; }
  function updatePrompt() {
    const c = running && !talking && !busy && !paused && !journalOpen ? candidates()[0] : null;
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
  function speakerModel(id) { return id === "fairy" ? fairies[0] && fairies[0].h : id === "sibyl" ? null : npcs[id] && npcs[id].h; }
  function showView(v) {
    const who = ST.WHO[v.who] || ST.WHO.narr; dlg.show(v, who, VOICE[v.who] || VOICE.narr); setShot(v.who);
    const h = speakerModel(v.who); if (h && v.who !== "you") { h.faceToward(player.h.group.position.x, player.h.group.position.z, 1); const r = Math.random(); h.gesture(r < 0.35 ? "nod" : r < 0.55 ? "shrug" : r < 0.7 ? "point" : "beg", 900); }
    if (v.who === "sibyl") sibyl.gesture(Math.random() < 0.5 ? "offer" : "rise", 1600);
  }
  function setShot(who) {
    const p = player.h.group.position;
    let q = null, hh = 1.45;
    if (who === "sibyl" && sibyl.group.visible) { q = sibyl.group.position; hh = 2.4; }
    else { const h = speakerModel(who); if (h && h.group.visible) q = h.group.position; }
    if (!q) { if (!holdShot) cam.clearShot(); return; }
    const portrait = stage.camera.aspect < 0.9;   // on a phone held upright, stand further back and to the side so the speaker is not hidden
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, rx = -uz, rz = ux, back = (who === "sibyl" ? 4.6 : 3.2) + (portrait ? 1.6 : 0), side = portrait ? 2.6 : 1.7;
    cam.setShot({ pos: new Vector3(p.x - ux * back + rx * side, Math.max(groundH(p.x, p.z), p.y) + (who === "sibyl" ? 2.0 : 2.1), p.z - uz * back + rz * side), look: new Vector3(q.x * 0.8 + p.x * 0.2, q.y + hh * (who === "sibyl" ? 0.95 : 0.92), q.z * 0.8 + p.z * 0.2), fov: who === "sibyl" ? 44 : 46 });
  }
  function endTalk() {
    dlg.hide(); cam.clearShot(); holdShot = false; talking = false; input.enabled = !journalOpen && !cine; stage.host.classList.remove("in-dialogue");
    W.serpents.userData.on = 0; W.dresses.forEach(d => { d.visible = false; });
    updateHud(); shell.objective(ST.objective(S)); persist();
    if (ST.readyForQueen(S)) afterTalk.push(() => summons());
    const next = afterTalk.shift(); if (next) setTimeout(() => { if (!disposed && !talking && !busy) next(); }, 400);
  }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "meter": { const name = e.k === "know" ? "Lore" : e.k === "susp" ? "Enchantment" : "Trust"; shell.toast(`${name} ${e.d > 0 ? "+" : ""}${e.d}`, e.k === "susp" ? "bad" : "good"); updateHud(e.k); if (e.k === "know" && e.d > 0) chime(); else if (e.k === "susp") audio.bad(); break; }
      case "rel": break;
      case "item": shell.toast("You now carry: " + (ITEMS[e.id] || e.id), "item"); audio.good(); dress.thread.visible = !!S.items.thread; break;
      case "clue": if (!hasToast) shell.toast("Written in your journal (J).", "clue"); break;
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
      case "days": daysPassed(e); break;
      case "event":
        if (e.id === "notebook") foundNotebook();
        else if (e.id === "crystal") openCrystal();
        else if (e.id === "serpents") { W.dresses.forEach(d => { d.visible = true; }); tween(2.2, k => { W.serpents.userData.on = ease(k); }); audio.burst({ dur: 2.5, freq: 900, q: 0.4, vol: 0.05, kind: "pink", wet: 0.8 }); holdShot = true; const p = kx(L.pool); cam.setShot({ pos: new Vector3(p[0] - 6, 2.4, p[1] + 6), look: new Vector3(p[0], -1, p[1]), fov: 46 }); }
        else if (e.id === "feast") { W.feastFood.forEach((m, i) => setTimeout(() => { m.visible = false; setTimeout(() => { m.visible = true; }, 1600); }, i * 90)); }
        break;
    }
  }
  function daysPassed(e) {
    updateHud(); W.setDays(e.to);
    if (S.items.thread) shell.toast(`The thread tightens: ${e.d} days have passed (day ${e.to}).`, e.to > ST.DAY_LIMIT ? "bad" : "clue");
    else if (e.d > 20) shell.toast("You have the strange feeling that a great deal of time has passed.", "clue");
    if (e.from <= ST.DAY_LIMIT && e.to > ST.DAY_LIMIT) { setTimeout(() => { shell.toast(S.items.thread ? "The thread at your wrist has closed into a ring." : "Somewhere, a door closes without a sound.", "bad"); bellToll(1, 98); }, 1200); }
    const hud2 = hud && hud.querySelector(".sib-day"); if (hud2) { hud2.classList.remove("pulse"); void hud2.offsetWidth; hud2.classList.add("pulse"); }
  }
  function foundNotebook() {
    const f = loadObj(ST.FINDS_KEY); if (!f.notebook) { f.notebook = Date.now(); save(ST.FINDS_KEY, f); }
    let fresh = []; try { fresh = Archive.sync("find:sibilla:notebook"); } catch (e) { console.error(e); }
    if (fresh.length) setTimeout(() => {   // the Archive's cinematic reveal, mid-game: the scene pauses under it
      if (disposed) return; revealing = true; input.enabled = false;
      reveal(fresh, { onDone: () => { revealing = false; input.enabled = !talking && !cine && !journalOpen; }, openArchive: () => { persist(); dispose(); onExit(); setTimeout(() => dispatchEvent(new CustomEvent("moe:open-archive")), 80); } });
    }, 900);
  }
  function openCrystal() {
    audio.bell(1568, 0.06); setTimeout(() => audio.bell(2093, 0.05), 200);
    tween(1.6, k => { crystalK = ease(k); W.crystalDoor.material.opacity = 0.55 * (1 - crystalK); W.crystalDoor.scale.y = 1 - crystalK * 0.98; W.crystalDoor.position.y = crystalK * 2.2; if (k >= 1) W.crystalDoor.visible = false; });
    setTimeout(() => { if (!disposed) { startAmbience(); place(npcs.porter, ...kx([2.6, -48.5]), [K.x, K.z]); } }, 1700);
  }

  /* ---------------- set pieces ---------------- */
  async function sceneEvent(id) {
    if (id === "act2") {
      await shell.fade(true, 900); S.area = "mountain"; syncWorld(true); placePlayer(L.trailStart[0], L.trailStart[1], Math.PI); startAmbience(); bellToll(1, 262);
      await shell.fade(false, 1200); afterTalk.push(() => converse("act2_start"));
    } else if (id === "fairies_leave") {
      await cinematic(async () => { fairyMode = "flee"; chime(); await tween(2.4); fairyMode = "gone"; fairies.forEach(f => { f.h.group.visible = false; }); });
    } else if (id === "guided") {
      await cinematic(async () => {
        fairyMode = "lead"; const p0 = player.h.group.position.clone();
        cam.setShot({ pos: new Vector3(p0.x + 6, p0.y + 3, p0.z + 7), look: new Vector3(p0.x - 4, p0.y + 4, p0.z - 14), fov: 50 });
        await tween(2.6); await shell.fade(true, 900);
        placePlayer(L.mouth[0] + 1.5, L.mouth[1] + 9, Math.PI); fairyMode = "gone"; fairies.forEach(f => { f.h.group.visible = false; });
        cam.snap(); await shell.fade(false, 1200); shell.toast(S.clues.cup ? "You do not remember the climb. Your feet remember dancing." : "The dancers leave you at the foot of the crown, and are gone.", "clue");
      });
    } else if (id === "act3") {
      await cinematic(async () => {
        const m = L.mouth; cam.setShot({ pos: new Vector3(m[0] + 2, groundH(m[0], m[1] + 3) + 1.6, m[1] + 4.5), look: new Vector3(m[0], groundH(m[0], m[1]) + 0.8, m[1] - 1), fov: 44 });
        await tween(1.4); audio.burst({ dur: 2.2, freq: 300, q: 0.5, vol: 0.14, kind: "brown", wet: 0.5 }); await shell.fade(true, 1400);
        S.area = "kingdom"; syncWorld(true); const e = kx(L.kEntry); placePlayer(e[0], e[1], Math.PI); cam.dist = 3.8; startAmbience();
        await new Promise(r => setTimeout(r, 400)); await shell.fade(false, 1600);
      });
      afterTalk.push(() => converse("k_enter"));
    } else if (id === "act4") {
      await shell.fade(true, 900);
      const t = kx(L.throne); placePlayer(t[0], t[1] + 7.5, 0); setPhase("throne"); sibyl.group.visible = true; setVis(npcs.porter, true); place(npcs.porter, t[0] + 5, t[1] + 3, [t[0], t[1]]);
      fairies.forEach((f, i) => { f.h.group.visible = true; const a = -0.9 + i * 0.36; place({ h: f.h }, t[0] + Math.sin(a) * 6.2, t[1] + 1.5 + Math.cos(a) * 2.5, [t[0], t[1] + 7]); }); fairyMode = "court";
      cam.setShot({ pos: new Vector3(t[0] + 2.5, 2.8, t[1] + 12), look: new Vector3(t[0], 3, t[1]), fov: 46 }); startAmbience();
      await shell.fade(false, 1400); await tween(2.2); cam.clearShot();
      afterTalk.push(() => converse("sibyl_1"));
    }
  }
  async function summons() {
    if (S.flags.summoned) return; bellToll(1, 330);
    await cinematic(async () => { const t = kx(L.throne); cam.setShot({ pos: new Vector3(t[0] + 8, 6, t[1] + 26), look: new Vector3(t[0], 4, t[1]), fov: 50 }); lights[0].intensity = 8; await tween(3); });
    converse("summons");
  }
  async function fairyEncounter() {
    S.flags.met_fairies_seen = true;
    await cinematic(async () => {
      const m = L.meadow, y = groundH(m[0], m[1]); musicVol = 1;
      cam.setShot({ pos: new Vector3(m[0] - 9, y + 2.6, m[1] + 8), look: new Vector3(m[0], y + 1.3, m[1]), fov: 44 }); await tween(3.2);
      fairies[0].h.group.position.set(m[0] - 3.4, y, m[1] + 2.2); fairies[0].h.faceToward(player.h.group.position.x, player.h.group.position.z, 1);
    });
    converse("fairy_1", null);
  }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    endingStarted = true; dlg.hide(); talking = true; input.enabled = false; hud.prompt.hidden = true; hudShow(false); bars.classList.add("on");
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id]; const found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    const p = player.h.group.position;
    if (id === "dance") {
      setPhase("dawn"); fairyMode = "dawn"; musicVol = 0.6; audio.tone({ freq: 880, dur: 1.2, type: "sawtooth", vol: 0.03, slide: 400, wet: 0.6 });
      const m = L.meadow, y = groundH(m[0], m[1]);
      await tween(6.5, k => { cam.setShot({ pos: new Vector3(m[0] - 12 - k * 4, y + 3 + k * 3, m[1] + 10), look: new Vector3(m[0] + 30 * k, y + 4 + k * 10, m[1] - 10 * k), fov: 48 }); W.fairyRoad.material.opacity = 0.35 + 0.6 * ease(k); musicVol = 0.6 * (1 - k); });
    } else if (id === "return") {
      if (ST.knowsMother(S)) {
        const d = kx([0, -46.5]); placePlayer(d[0] - 0.6, d[1], Math.PI); place(npcs.porter, d[0] + 0.7, d[1] - 0.6, [d[0] - 0.6, d[1]]); setVis(npcs.porter, true);
        cam.setShot({ pos: new Vector3(d[0] + 3.5, 1.9, d[1] - 4), look: new Vector3(d[0], 1.3, d[1]), fov: 42 }); npcs.porter.h.gesture("beg", 2000); audio.bell(784, 0.05);
        await tween(3.6);
      }
      await shell.fade(true, 1300);
      S.area = "mountain"; W.setZone("surface"); stopDrone(); audio.stopLayer("gust"); setPhase("winter", true); fairies.forEach(f => { f.h.group.visible = false; }); sibyl.group.visible = false; setVis(npcs.porter, false); setVis(npcs.knight, false);
      placePlayer(L.mouth[0], L.mouth[1] + 2, Math.PI); snow.visible = true; startAmbience(); audio.setLayer("wind", 0.12, 2);
      await shell.fade(false, 1600);
      await tween(7, k => { const q = player.h.group.position; cam.setShot({ pos: new Vector3(q.x + 4 + k * 10, q.y + 2 + k * 9, q.z + 5 + k * 16), look: new Vector3(q.x, q.y + 1 + k * 2, q.z - 2 + k * 30), fov: 52 }); });
    } else if (id === "knowledge") {
      const c = sibyl.group.position; W.leaves.count = 70; audio.bell(523, 0.06); setTimeout(() => audio.bell(659, 0.05), 400);
      const o = new Object3D();
      await tween(7, k => {
        for (let i = 0; i < 70; i++) { const a = i * 2.4 + k * 6 * (0.6 + (i % 5) * 0.1), r = 1 + i * 0.07 + k * 2, yy = 0.5 + (i % 10) * 0.45 + Math.sin(k * 8 + i) * 0.3; o.position.set(c.x + Math.cos(a) * r, yy + k * 2, c.z + 2 + Math.sin(a) * r); o.rotation.set(a, k * 5 + i, 0.3); o.scale.setScalar(1); o.updateMatrix(); W.leaves.setMatrixAt(i, o.matrix); }
        W.leaves.instanceMatrix.needsUpdate = true;
        cam.setShot({ pos: new Vector3(c.x + Math.sin(k * 1.4) * 9, 2.6 + k * 2, c.z + 3 + Math.cos(k * 1.4) * 9), look: new Vector3(c.x, 2.6, c.z), fov: 48 });
      });
    } else {   // kingdom
      fairyMode = "circle"; musicVol = 0.8; audio.bell(392, 0.06);
      await tween(7, k => { const q = player.h.group.position; cam.setShot({ pos: new Vector3(q.x + 6 - k * 3, q.y + 3 + k * 16, q.z + 8 - k * 4), look: new Vector3(q.x, q.y + 1 + k * 18, q.z - k * 6), fov: 52 }); lights[2].intensity = 3 + k * 6; });
      musicVol = 0;
    }
    await shell.fade(true, 1300); cam.clearShot(); bars.classList.remove("on"); musicVol = 0; snow.visible = false; W.leaves.count = 0;
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 4, cls: E.cls, adv: "sibilla", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }

  /* ---------------- persistence ---------------- */
  function persist() { if (!S || !player || S.ending || endingStarted || !S.seen.start) return; const g = player.h.group; save(ST.SAVE_KEY, { v: 1, s: S, pos: [g.position.x, g.position.z, g.rotation.y] }); }

  /* ---------------- main loop ---------------- */
  const wopt = { doorsOpen: false, crystalOpen: false };
  function tick(rawDt, t) {
    if (!running || disposed) return;
    if (paused) return;
    const dt = rawDt * timeScale;
    emaDt += (rawDt - emaDt) * 0.05; if (!degraded && emaDt > 0.05) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); } } else lowFrames = Math.max(0, lowFrames - 1);
    for (const a of anims) { a.t += dt; const k = Math.min(1, a.t / a.dur); try { a.f(k); } catch (e) { console.error(e); } if (k >= 1) { anims.delete(a); a.res(); } }
    dlg.tick(rawDt);
    const g = player.h.group, kin = S.area === "kingdom", lz = g.position.z - K.z;
    // the bronze doors beat: open ~1.5 s in every 3.4 s
    doorT += dt; const ph = (doorT % 3.4) / 3.4, want = ph > 0.18 && ph < 0.62 ? 1 : 0, was = doorK; doorK += (want - doorK) * Math.min(1, dt * (want ? 3.2 : 9));
    if (kin) { W.doors[0].rotation.y = doorK * 1.35; W.doors[1].rotation.y = -doorK * 1.35; if (was > 0.25 && doorK <= 0.25 && Math.abs(lz + 34) < 18) { thud(clamp(1 - Math.abs(lz + 34) / 18, 0.2, 1)); shake = 0.25; } }
    wopt.doorsOpen = doorK > 0.6; wopt.crystalOpen = crystalK > 0.5;
    if (!talking && !busy && !journalOpen && input.enabled && !revealing) {
      const lk = input.takeLook(); cam.rotate(lk.dx, lk.dy); cam.yaw -= input.turn() * dt * 1.9;
      const mv = input.move(), run = input.running(), sp = (run ? 5.6 : 3.3) * (kin && S.stage === "bridge" ? 0.75 : 1), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      let vx = fx * mv.y + rx * mv.x, vz = fz * mv.y + rz * mv.x; const m = Math.hypot(vx, vz);
      // the wind on the bridge pushes you sideways
      if (kin && S.stage === "bridge") { gustT -= dt; if (gustT < 0) { gustT = 3 + Math.random() * 3; gust = (Math.random() < 0.5 ? -1 : 1) * 1.6; audio.burst({ dur: 1.4, freq: 600, q: 0.5, vol: 0.12, kind: "pink", filter: "bandpass", pan: gust > 0 ? 0.7 : -0.7 }); } gust *= Math.exp(-dt * 1.2); }
      const ox = g.position.x, oz = g.position.z;
      let nx = ox + (m > 0.05 ? vx / Math.max(1, m) * sp * dt : 0) + (kin && S.stage === "bridge" ? gust * dt : 0), nz = oz + (m > 0.05 ? vz / Math.max(1, m) * sp * dt : 0);
      if (walkable(nx, nz, wopt)) { g.position.x = nx; g.position.z = nz; } else if (walkable(nx, oz, wopt)) g.position.x = nx; else if (walkable(ox, nz, wopt)) g.position.z = nz;
      col.resolve(g.position, 0.36); if (!walkable(g.position.x, g.position.z, wopt)) { g.position.x = ox; g.position.z = oz; }
      // a door slamming while you stand in it throws you back
      if (kin && doorK < 0.3 && lz < -33 && lz > -35.2 && S.stage === "doors") { g.position.z = K.z - 32.2; thud(0.6); shell.toast("The bronze doors throw you back. Wait for them to open, then run.", "bad"); shake = 0.4; }
      if (m > 0.05) { let a = Math.atan2(vx, vz) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += a * Math.min(1, dt * 12); stepT -= dt * sp; if (stepT < 0) { stepT = 1.5; audio.step(kin ? "stone" : S.area === "village" ? (Math.hypot(g.position.x, g.position.z - 8) < 10 ? "stone" : "grass") : "grass", 0.03); } }
      g.position.y = groundH(g.position.x, g.position.z); player.h.update(dt, t, { speed: m > 0.05 ? sp * Math.min(1, m) : 0 });
    } else player.h.update(dt, t, { speed: 0 });
    const pp = g.position;
    // story triggers by place
    if (!talking && !busy && running && !S.ending) {
      if (S.act === 2 && !S.flags.met_fairies && !S.flags.met_fairies_seen && Math.hypot(pp.x - L.meadow[0], pp.z - L.meadow[1]) < 15) fairyEncounter();
      else if (kin && S.stage === "bridge" && lz < -31.6) { S.stage = "doors"; shell.objective(ST.objective(S)); converse("doors_seen"); startAmbience(); }
      else if (kin && S.stage === "doors" && lz < -35.4) { S.stage = "door"; shell.objective(ST.objective(S)); shell.toast("You are through. Behind you the doors boom shut.", "clue"); persist(); }
    }
    // npcs & extras
    for (const k in npcs) { const n = npcs[k]; if (!n.vis) continue; const gp = n.h.group.position, d = Math.hypot(gp.x - pp.x, gp.z - pp.z); n.h.update(dt, t, { speed: 0, lookAt: d < 9 ? { x: pp.x, y: pp.y + 1.5, z: pp.z } : null }); if (d < 4 && !talking && k !== "knight") n.h.faceToward(pp.x, pp.z, Math.min(1, dt * 1.6)); if (n.label) { n.label.visible = d < 7.5 && !talking; if (n.label.visible) { const cd = Math.hypot(gp.x - cam.cam.position.x, gp.z - cam.cam.position.z), s = clamp(cd / 6, 0.45, 1.2); n.label.scale.set(1.9 * s, 0.4 * s, 1); } } }
    for (const e of extras) if (e.vis) e.h.update(dt, t, { speed: 0 });
    updateFairies(dt, t, pp);
    if (sibyl.group.visible) sibyl.update(dt, t, { talk: talking && D.cur && D.cur.who === "sibyl" ? 1 : 0, lookAt: pp });
    // the fairies' music: by the meadow at night, in the hall below
    let mTarget = 0;
    if (S.area === "mountain" && fairyMode === "meadow") mTarget = clamp(1 - Math.hypot(pp.x - L.meadow[0], pp.z - L.meadow[1]) / 70, 0, 1);
    else if (kin && fairyMode === "hall" && S.stage === "kingdom") mTarget = clamp(1 - Math.hypot(pp.x - kx(L.dancers)[0], pp.z - kx(L.dancers)[1]) / 45, 0, 1) * 0.7;
    if (!endingStarted && fairyMode !== "flee" && fairyMode !== "lead") musicVol += (mTarget - musicVol) * Math.min(1, dt * 0.8);
    musicTick(dt);
    if (snow.visible) { const sp2 = snow.geometry.attributes.position; for (let i = 0; i < sp2.count; i++) { let y = sp2.getY(i) - dt * 2.2; if (y < 0) y += 30; sp2.setY(i, y); } sp2.needsUpdate = true; snow.position.set(pp.x, pp.y - 4, pp.z); }
    W.update(dt, t, W.lookState || {});
    applyLook(dt);
    cam.dist += ((kin && (S.stage === "bridge" || S.stage === "doors" || S.stage === "door") ? 3.8 : kin ? 5.2 : S.area === "village" ? 5.0 : 5.6) - cam.dist) * Math.min(1, dt * 2);
    cam.update(rawDt, { x: pp.x, y: pp.y, z: pp.z });
    if (shake > 0) { shake = Math.max(0, shake - dt); stage.camera.position.x += (Math.random() - 0.5) * shake * 0.4; stage.camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
    sky.follow(stage.camera); moon.position.copy(stage.camera.position).add(tmpV.set(160, 210, -320));
    updatePrompt();
    saveTimer += rawDt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }
  function updateFairies(dt, t, pp) {
    if (fairyMode === "meadow" || fairyMode === "hall" || fairyMode === "circle" || fairyMode === "court") {
      const c = fairyMode === "circle" ? [pp.x, pp.z] : fairyMode === "hall" ? kx(L.dancers) : fairyMode === "court" ? null : L.meadow;
      fairies.forEach((f, i) => {
        if (!f.h.group.visible) return;
        if (c && !(talking && i === 0 && fairyMode === "meadow")) { const a = f.home.a + t * (fairyMode === "hall" ? 0.35 : 0.6), r = (fairyMode === "circle" ? 2.4 : 3.2) + Math.sin(t * 1.3 + i) * 0.4, x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r; f.h.group.position.set(x, groundH(x, z), z); f.h.group.rotation.y = a + Math.PI + Math.sin(t * 2 + i) * 0.6; }
        f.h.update(dt, t, { speed: 0 }); f.dance(dt, t, talking && i === 0 && fairyMode === "meadow" ? 0.3 : fairyMode === "court" ? 0.15 : 1);
      });
    } else if (fairyMode === "flee" || fairyMode === "lead" || fairyMode === "dawn") {
      fairies.forEach((f, i) => { if (!f.h.group.visible) return; const gp = f.h.group.position, tx = fairyMode === "dawn" ? 60 + i * 4 : L.mouth[0], tz = fairyMode === "dawn" ? -150 - i * 6 : L.mouth[1], dx = tx - gp.x, dz = tz - gp.z, d = Math.hypot(dx, dz) || 1, sp = fairyMode === "lead" ? 5 : 11; gp.x += dx / d * sp * dt; gp.z += dz / d * sp * dt; gp.y = groundH(gp.x, gp.z) + (fairyMode === "dawn" ? Math.min(30, (60 - d) * 0.1) : 0); f.h.group.rotation.y = Math.atan2(dx, dz); f.h.update(dt, t, { speed: sp }); f.dance(dt, t * 2, 0.6); f.glow.material.opacity = 0.6; });
    }
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); };
  addEventListener("pagehide", onHide);
  function dispose() {
    if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide); host.removeEventListener("pointerdown", onHostDown);
    try { persist(); } catch (e) { /* ignore */ }
    try { stopDrone(); stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ }
    anims.clear(); host.innerHTML = "";
  }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get cine() { return cine; }, get phase() { return phase; }, get degraded() { return degraded; },
      get fairyMode() { return fairyMode; }, get doorK() { return doorK; }, get crystalK() { return crystalK; }, get music() { return musicVol; }, get serpents() { return W && W.serpents.userData.on; }, get zone() { return W && (W.kingdom.visible ? "kingdom" : "surface"); },
      get revealing() { return revealing || revealOpen(); }, get muted() { return audio.muted; },
      begin: s => begin(s), setTimeScale: v => { timeScale = v; }, cam: (yaw, pitch) => { cam.yaw = yaw; cam.pitch = pitch; }, endNow: id => { S.ending = id; talking = true; return playEnding(); }, canWalk: (lx, lz) => walkable(K.x + lx, K.z + lz, wopt),
      tp: (x, z) => { player.h.group.position.set(x, groundH(x, z), z); }, tpk: (x, z) => { const p = kx([x, z]); player.h.group.position.set(p[0], groundH(p[0], p[1]), p[1]); },
      pos: () => [player.h.group.position.x, player.h.group.position.z], local: () => [player.h.group.position.x - K.x, player.h.group.position.z - K.z],
      L, K, near: () => candidates().map(c => c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), skip: () => dlg.skip(),
      dlgText: () => dlg.root.querySelector(".dlg-text").textContent, ending: () => S && S.ending, endingsFound, toggleJournal, persist, stage: () => stage,
      patch: p => { Object.assign(S, p); syncWorld(true); },
      wait: ms => new Promise(r => setTimeout(r, ms)),
    },
  };
}
