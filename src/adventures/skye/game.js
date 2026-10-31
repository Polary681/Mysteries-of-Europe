// THE GHOST PIANIST OF SKYE - first-person atmospheric adventure. Story rules: story.js, terrain & set pieces: world.js.
import { Color, HemisphereLight, DirectionalLight, PointLight, Vector3, Group, Mesh, CylinderGeometry, MeshStandardMaterial } from "three";
import { createStage } from "../../engine.js";
import { AudioBus } from "../../shared/audio.js";
import { createInput } from "../../shared/input.js";
import { createShell } from "../../shared/ui.js";
import { sceneSVG } from "../../ui/art.js";
import { load, save, clear, loadObj } from "../../shared/save.js";
import { el } from "../../common.js";
import { Colliders, makeSky, makeRain, glowSprite, lerp } from "../../shared/world.js";
import { Dialogue, clamp, restoreState, validPos } from "../../narrative/core.js";
import { createDialogueUI } from "../../narrative/dialogue-ui.js";
import * as ST from "./story.js";
import { buildHeadland, H, SITES, HOUSE } from "./world.js";

const LOOKS = {
  dusk: { top: 0x2b3a66, mid: 0x5a5a82, bot: 0xb87a66, fog: 0x4c4c64, fogD: 0.013, stars: 0.15, sunI: 1.3, hI: 1.25, rain: 0.28, wind: 0.07, sea: 0.1, amp: 0.2 },
  night: { top: 0x0e1530, mid: 0x1c2640, bot: 0x3a3e58, fog: 0x1e2438, fogD: 0.017, stars: 0.6, sunI: 1.1, hI: 1.05, rain: 0.55, wind: 0.11, sea: 0.14, amp: 0.35 },
  storm: { top: 0x080b18, mid: 0x141a2a, bot: 0x24283a, fog: 0x161b28, fogD: 0.023, stars: 0.1, sunI: 0.9, hI: 0.85, rain: 0.9, wind: 0.16, sea: 0.2, amp: 0.6 },
};
const OBJ = { board: [SITES.board, 3.0], f1: [[-13.6, 108.2], 2.9], f2: [[-23.8, 51.6], 3.3], f3: [[38, 8], 3.8], f4: [[SITES.cave[0] + 6.2, SITES.cave[1] + 0.8], 3.4], f5: [[-8, -27.4], 4.4], f6: [SITES.stand, 2.8], piano: [[-4.7, -84], 3.0], leave: [SITES.car, 3.8] };
const KEYMAP = { KeyA: 1, KeyS: 2, KeyD: 3, KeyF: 4, KeyG: 5, KeyH: 6, KeyJ: 7, KeyK: 8 };
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const wait = ms => new Promise(r => setTimeout(r, ms));

export function start(host, { onExit = () => {}, onText = null } = {}) {
  host.innerHTML = "";
  const view = el("div", "adv-view"); host.append(view);
  const shell = createShell(host, {
    title: "The Ghost Pianist of Skye", kicker: "Legend · Isle of Skye, Scotland · an original story", accent: "#93b6cb", accent2: "#b9a1d6", art: sceneSVG("skye"), journal: true,
    tagline: "A storm is coming in off the Atlantic, and a piano is playing in a house that has no roof.",
    note: "I could not find a documented ghost-pianist legend of Skye in folklore sources, so the legend card is treated as a creative starting point and this is an original story. Real history (the Highland Clearances, Gaelic song, “second sight”) is only background, and the codex (J) always says which is which.",
    controls: [["W A S D", "walk"], ["Shift", "run"], ["Mouse / drag", "look"], ["E / Space", "interact"], ["L (hold)", "listen"], ["J", "journal"], ["Esc", "pause"]],
  });
  const audio = new AudioBus();
  const endingsFound = () => loadObj(ST.ENDINGS_KEY);   // (a damaged record must not lose the ending just reached)
  let stage = null, input = null, dlg = null, W = null, sky = null, rain = null, D = null, S = null, hud = null, journalEl = null, pianoEl = null, run = null;
  let running = false, paused = false, busy = false, talking = false, journalOpen = false, pianoOpen = false, disposed = false, endingStarted = false, listening = false, degraded = false;
  const P = { x: 9, z: 95, y: 0, yaw: 0, pitch: 0, bob: 0 }; // player (feet)
  let focus = null, curLook = null, tgtLook = null, hemi, moon, lantern, listenK = 0, flash = 0, nextFlash = 25, thunderAt = -1, stepT = 0, saveTimer = 0, lastPrompt = "", near = null, emaDt = 0.016, lowFrames = 0, srcT = {}, houseT = 4, ghostK = 0, ghostBoost = 0, seaTarget = 0, amb = [], tgtU = 0, noteBusy = false;
  const col = new Colliders(), tv = new Vector3();

  /* ---------------- title ---------------- */
  const savedGame = () => { const s = load(ST.SAVE_KEY, null); return s && s.v === 1 && s.s && !s.s.ending ? s : null; };
  function showTitle() {
    running = false; shell.setRunning(false); shell.close();
    shell.title({ hasSave: !!savedGame(), extra: `<p class="found">Endings discovered: ${Object.keys(endingsFound()).length} / 4</p>`, onNew: () => begin(null), onContinue: () => begin(savedGame()), onText, onExit: () => { dispose(); onExit(); } });
  }

  /* ---------------- start / build ---------------- */
  async function begin(saved) {
    audio.init(); audio.resume(); shell.loading(0, "Walking out to the Point…"); await frame();
    if (!stage) {
      stage = createStage(view, { bg: 0x1e2438, fog: 0.015, fov: 72, far: 360, maxPR: 1.5 });
      if (!stage) { shell.close(); shell._show('<div class="adv-card small"><h3>3D not available</h3><p>Your browser or device does not support WebGL, so this adventure cannot run. You can still read the short text version of the legend.</p><div class="actions"><button class="primary" data-k="x">Back to the legends</button></div></div>').onclick = () => { dispose(); onExit(); }; return; }
      input = createInput(view, { pointerLock: true, lookSpeed: 0.0034 });
      dlg = createDialogueUI(host, { audio });
      sky = makeSky(); sky.mesh.scale.setScalar(0.8); stage.scene.add(sky.mesh); hemi = new HemisphereLight(0xa4b4e4, 0x5c5c64, 1.0); moon = new DirectionalLight(0xaec4f0, 0.9); moon.position.set(-30, 60, -40); stage.scene.add(hemi, moon);
      stage.scene.add(stage.camera);
      lantern = new PointLight(0xffc27a, 3.2, 26, 1.4); lantern.position.set(0.25, -0.2, -0.2); stage.camera.add(lantern);
      { const lg = new Group(), body = new Mesh(new CylinderGeometry(0.014, 0.018, 0.05, 6), new MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 1.2 })), gl = glowSprite("255,190,100", 0.16); gl.position.y = 0.0; lg.add(body, gl); lg.position.set(0.3, -0.3, -0.52); stage.camera.add(lg); }
      rain = makeRain({ count: 3200, size: 38, height: 24, speed: 26, slant: 0.22, len: 1.0, opacity: 0.3 }); stage.scene.add(rain.mesh);
      curLook = {}; tgtLook = {};
      wireInput(); W = buildHeadland(stage.scene, col, (f, m) => shell.loading(0.1 + f * 0.8, m)); await frame();
      stage.onFrame(tick);
    }
    shell.loading(0.95, "Lighting the lantern…"); await frame();
    S = saved ? restoreState(ST.initState(), saved.s) : ST.initState(); D = new Dialogue(ST.NODES, S); endingStarted = false; busy = false; talking = false; pianoOpen = false; focus = null; run = null; srcT = {}; houseT = 4;
    dlg.hide(); dlg.onAdvance(() => step("advance")); dlg.onChoose(i => step("choose", i));
    if (saved && validPos(saved.pos)) { P.x = saved.pos[0]; P.z = saved.pos[1]; P.yaw = saved.pos[2] || 0; } else { P.x = 6.4; P.z = 95.5; P.yaw = 0.0; }
    P.pitch = 0; W.seaLevel = S.tide ? 1.8 : 0; seaTarget = W.seaLevel; syncWorld(true); updateHud();
    shell.close(); shell.setRunning(true); shell.objective(ST.objective(S)); running = true; input.enabled = true; hudShow(true);
    audio.stopAllLayers(); startAmbience(); await shell.fade(false, 1000);
    if (!saved) shell.toast(input.touch ? "Hold the Listen button to hear the echoes. Drag on the right to look around." : "Hold L to listen. Click the scene to look around with the mouse.", "clue"); else shell.toast("Progress restored.");
  }

  /* ---------------- look & weather ---------------- */
  function lookFor(u) {
    const a = u < 0.5 ? LOOKS.dusk : LOOKS.night, b = u < 0.5 ? LOOKS.night : LOOKS.storm, k = u < 0.5 ? u * 2 : (u - 0.5) * 2, out = {};
    for (const key of ["top", "mid", "bot", "fog"]) out[key] = new Color(a[key]).lerp(new Color(b[key]), k);
    for (const key of ["fogD", "stars", "sunI", "hI", "rain", "wind", "sea", "amp"]) out[key] = lerp(a[key], b[key], k);
    return out;
  }
  function syncWorld(instant) {
    const n = ST.count(S), u = clamp((ST.outside(S) + (S.frag[6] ? 1 : 0) + (S.tide ? 1 : 0)) / 7, 0, 1); tgtU = u; tgtLook = lookFor(u);
    if (instant || !curLook.top) curLook = { ...tgtLook, top: tgtLook.top.clone(), mid: tgtLook.mid.clone(), bot: tgtLook.bot.clone(), fog: tgtLook.fog.clone() };
    for (let i = 1; i <= 6; i++) if (W.motes[i]) W.motes[i].visible = !S.frag[i];
    W.page.visible = !!S.frag[6]; W.candleFlame.visible = !!S.flags.lit_candle; if (S.flags.took_bottle) W.bottle.visible = false; seaTarget = S.tide ? 1.8 : 0; if (instant) W.seaLevel = seaTarget;
    shell.objective(ST.objective(S));
  }
  function applyLook(dt) {
    const k = 1 - Math.exp(-dt * 0.9), T = tgtLook, C = curLook; if (!T || !C.top) return;
    for (const key of ["top", "mid", "bot", "fog"]) C[key].lerp(T[key], k); for (const key of ["fogD", "stars", "sunI", "hI", "rain", "wind", "sea", "amp"]) C[key] += (T[key] - C[key]) * k;
    const f = flash;
    stage.scene.fog.color.copy(C.fog); stage.scene.fog.density = C.fogD * (degraded ? 1.3 : 1); stage.scene.background.copy(C.fog);
    hemi.intensity = C.hI + f * 2.2; moon.intensity = C.sunI + f * 1.5;
    sky.set({ top: C.top, mid: C.mid, bot: C.bot, stars: C.stars * (1 - f * 0.5), sun: 0, sunDir: new Vector3(-0.3, 0.6, -0.5), sunCol: 0x9ab4e8 });
    if (f > 0) { sky.u.uTop.value.lerp(new Color(0xbcc8ff), f * 0.7); sky.u.uMid.value.lerp(new Color(0xdde4ff), f * 0.7); }
    W.seaMat.color.copy(C.fog).lerp(new Color(0x0e3a4a), 0.55);
  }
  function startAmbience() {
    if (!audio.ctx) return;
    audio.layer("wind", { kind: "pink", filter: "lowpass", freq: 520, gain: 0.08, lfoRate: 0.09, lfoDepth: 0.55 });
    audio.layer("sea", { kind: "brown", filter: "lowpass", freq: 380, gain: 0.12, lfoRate: 0.13, lfoDepth: 0.6 });
    audio.layer("rain", { kind: "white", filter: "bandpass", freq: 2600, q: 0.5, gain: 0.03 });
    if (audio._amb) audio._amb.forEach(f => f()); audio._amb = [];
    audio._amb.push(audio.every(() => { if (Math.random() < 0.6) audio.burst({ dur: 1.4, freq: 220, q: 0.4, vol: 0.05, kind: "brown", filter: "lowpass", pan: Math.random() * 2 - 1, wet: 0.5 }); }, 5000, 12000)); // distant swell
  }

  /* ---------------- input ---------------- */
  function wireInput() {
    input.addButton("interact", "E", { cls: "big" }); input.addButton("listen", "👂", { hold: true, cls: "listen" });
    input.on((a, x) => {
      if (!running || disposed) return;
      if (a === "pause") return togglePause();
      if (a === "mute") return toggleSound();
      if (paused) return;
      if (a === "listen") { listening = !!x; return; }
      if (pianoOpen) { if (a === "key" && KEYMAP[x]) pressKey(KEYMAP[x]); return; }
      if (a === "journal") return toggleJournal();
      if (journalOpen) return;
      if (a === "interact") { if (talking) { if (!busy) dlg.press(); } else if (!busy) tryInteract(); }
      if (a === "num" && talking && !busy) dlg.pickNum(x);
    });
    shell.bind({ pause: () => togglePause(), sound: () => toggleSound(), journal: () => { if (running && !paused && !pianoOpen) toggleJournal(); } });
    host.addEventListener("pointerdown", () => audio.resume());
  }
  const toggleSound = () => { audio.setMuted(!audio.muted); shell.setSoundIcon(!audio.muted); };
  function togglePause() {
    if (!running) return;
    if (pianoOpen) return closePiano();
    if (journalOpen) return toggleJournal();
    if (paused) { shell.resume(); paused = false; audio.duck(1); return; }
    input.releaseLock(); paused = true; audio.duck(0.25);
    shell.pauseMenu({ onResume: () => { paused = false; audio.duck(1); }, onRestart: () => { paused = false; audio.duck(1); clear(ST.SAVE_KEY); shell.fade(true, 300).then(() => begin(null)); }, onExit: () => { persist(); dispose(); onExit(); }, onSound: toggleSound, soundOn: () => !audio.muted });
  }

  /* ---------------- HUD ---------------- */
  function hudShow(v) {
    if (!hud) {
      const ui = host.querySelector(".adv-ui");
      hud = el("div", "adv-hud noinput"); hud.innerHTML = `<div class="echoes" title="Echoes found"></div>`; host.querySelector(".adv-left").append(hud);
      const pr = el("div", "adv-prompt"); pr.hidden = true; pr.innerHTML = "<kbd>E</kbd><span></span>"; ui.append(pr); hud.prompt = pr; pr.addEventListener("pointerdown", e => { e.preventDefault(); if (!busy && !talking && running && !paused && !pianoOpen) tryInteract(); });
      const cr = el("div", "crosshair"); ui.append(cr); hud.cross = cr;
      const lb = el("div", "listen-bar"); lb.innerHTML = "<span>listening</span><i><u></u></i>"; ui.append(lb); hud.lbar = lb;
    }
    hud.style.display = v ? "" : "none"; hud.cross.style.display = v ? "" : "none"; if (!v) hud.prompt.hidden = true;
  }
  function updateHud() { if (!hud || !S) return; hud.querySelector(".echoes").innerHTML = [1, 2, 3, 4, 5, 6].map(i => `<b class="${S.frag[i] ? "on" : ""}">♪</b>`).join(""); }
  function toggleJournal() {
    if (journalOpen) { journalEl.remove(); journalOpen = false; input.enabled = !talking; audio.duck(1); return; }
    input.releaseLock(); journalOpen = true; input.enabled = false; audio.duck(0.5); renderJournal("journal");
  }
  function renderJournal(tab) {
    if (journalEl) journalEl.remove(); journalEl = el("div", "adv-overlay journal noinput");
    const tabs = [["journal", "Journal"], ["tune", "The tune"], ["codex", "Codex"], ["help", "How to play"]]; let body = "";
    if (tab === "journal") { const cl = Object.keys(S.clues); body = `<p class="obj"><b>Current goal</b> ${ST.objective(S)}</p><h4>What you have learned <small>${cl.length}</small></h4>` + (cl.length ? `<ul>${cl.map(c => `<li>${ST.CLUE_TEXT[c] || c}</li>`).join("")}</ul>` : "<p class=mut>Nothing yet. Hold L to listen, and follow the lights.</p>"); }
    else if (tab === "tune") { body = `<p class="mut">Each echo gives one phrase of the lament. At the piano, the keys are A S D F G H J K (or tap them).</p>` + ST.PHRASES.map((p, i) => `<div class="phr ${S.frag[i + 1] ? "on" : ""}"><b>${i + 1}</b>${S.frag[i + 1] ? p.map(k => `<kbd>${ST.KEYS[k - 1]}${k === 8 ? "′" : ""}</kbd>`).join("") : "<span class=mut>not found yet</span>"}</div>`).join("") + `<p class="mut">${S.frag[6] ? "The last page: the final note is yours to choose. A falls home, A′ rises." : ""}</p>`; }
    else if (tab === "codex") { const ids = Object.keys(ST.CODEX), got = ids.filter(i => S.notes[i]); body = `<p class="mut">What is real, and what is invented. ${got.length} / ${ids.length} entries found.</p>` + got.map(i => { const c = ST.CODEX[i]; return `<div class="cx ${c.kind}"><span class="tag">${c.kind === "historical" ? "Historical" : c.kind === "invented" ? "Invented for this game" : "Tradition / uncertain"}</span><h5>${c.title}</h5><p>${c.text}</p></div>`; }).join(""); }
    else body = `<ul><li><b>Listen</b>: hold <kbd>L</kbd> (or the ear button). Hidden echoes glow and a bar at the top shows which way to turn.</li><li><b>Explore</b> the Point: the pier, the ruined township, the standing stone, the sea cave and the chapel.</li><li><b>The house</b> at the end of the causeway has the piano. The tide will close the causeway behind you once you have found all five outside echoes.</li><li><b>You can leave</b> at the car whenever the causeway is open.</li></ul>`;
    journalEl.innerHTML = `<div class="adv-card jr"><div class="jtabs">${tabs.map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}<button class="x" data-t="x" aria-label="Close">✕</button></div><div class="jbody">${body}</div></div>`;
    journalEl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.t === "x") toggleJournal(); else renderJournal(b.dataset.t); });
    host.querySelector(".adv-ui").append(journalEl);
  }

  /* ---------------- interaction ---------------- */
  const fwd = () => ({ x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) });
  function candidates() {
    const out = [], f = fwd();
    for (const id in OBJ) {
      if (!ST.objectAvailable(id, S)) continue; if (id === "f6" && !S.tide && ST.outside(S) < 3 && false) continue;
      const [[x, z], r] = OBJ[id], dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > r) continue; const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (dot < 0.1 && d > 1.6) continue; out.push({ id, d, score: d - dot * 1.5, node: ST.objectNode(id, S) });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  function tryInteract() {
    const c = candidates()[0]; if (!c) return false;
    if (c.id === "piano" && ST.hasAll(S)) { openPiano(); return true; }
    converse(c.node); return true;
  }
  function updatePrompt() {
    const c = running && !talking && !busy && !paused && !journalOpen && !pianoOpen ? candidates()[0] : null; near = c; const txt = c ? ST.labelFor(c.id, S) : ""; if (txt === lastPrompt) return; lastPrompt = txt;
    hud.prompt.hidden = !c; hud.prompt.querySelector("span").textContent = txt; input.buttons.interact && input.buttons.interact.classList.toggle("ready", !!c);
  }

  /* ---------------- conversation flow ---------------- */
  async function converse(nodeId) { if (busy || talking) return; talking = true; input.enabled = false; input.releaseLock(); hud.prompt.hidden = true; lastPrompt = ""; try { await present(D.start(nodeId)); } catch (e) { console.error(e); endTalk(); } }
  async function step(kind, i) { if (busy || !talking) return; try { await present(kind === "choose" ? D.choose(i) : D.advance()); } catch (e) { console.error(e); endTalk(); } }
  async function present(v) {
    busy = true;
    try {
      const ev = D.drainEvents(), hasToast = ev.some(e => e.t === "toast"); let after = [];
      for (const e of ev) { if (e.t === "event") after.push(e); else handleEvent(e, hasToast); }
      for (const e of after) { if (e.id === "frag") onFrag(e.n); }
      if (after.some(e => e.id === "tide")) { dlg.hide(); await tideScene(); }
      if (S.ending && !endingStarted) { await playEnding(); return; }
      const resume = after.some(e => e.id === "resume_piano"), close = after.some(e => e.id === "close_piano");
      if (resume || close) { dlg.hide(); talking = false; if (resume) openPiano(true); else endTalk(); return; }
      if (!v) { endTalk(); return; }
      dlg.show(v, ST.WHO[v.who] || ST.WHO.narr, v.who === "ghost" ? { pitch: 330, kind: "sine" } : { pitch: 0 });
    } finally { busy = false; }
  }
  function endTalk() { dlg.hide(); talking = false; input.enabled = !journalOpen; syncWorld(); updateHud(); persist(); }
  function handleEvent(e, hasToast) {
    switch (e.t) {
      case "meter": shell.toast(`${{ trust: "Respect", susp: "Unease", know: "Knowledge" }[e.k]} ${e.d > 0 ? "+" : ""}${e.d}`, e.d > 0 ? "good" : "bad"); break;
      case "item": shell.toast("Picked up: " + ({ spoon: "Old wooden spoon", lantern: "Lantern" }[e.id] || e.id), "item"); break;
      case "clue": if (!hasToast) shell.toast("New entry in your journal (J).", "clue"); break;
      case "note": if (!hasToast) shell.toast("Codex updated (J).", "clue"); break;
      case "toast": shell.toast(e.text, "clue"); break;
    }
  }
  function onFrag(n) {
    updateHud(); syncWorld(); audio.good(); const p = ST.PHRASES[n - 1]; setTimeout(() => playPhrase(p, { vel: 0.55, pan: 0, ghost: true, gap: 380 }), 600);
    if (ST.count(S) === 2 || ST.count(S) === 4) setTimeout(() => audio.thunder(0.7), 1500);
  }
  async function tideScene() {
    await shell.fade(true, 800); P.x = 0; P.z = -70.5; P.yaw = Math.PI; focus = null; seaTarget = 1.8; syncWorld(); audio.thunder(1); await wait(500); await shell.fade(false, 1200);
  }

  /* ---------------- sound: ghost phrases ---------------- */
  function playPhrase(p, { vel = 0.5, pan = 0, ghost = true, gap = 520, wet = 0.8, press = false } = {}) {
    p.forEach((k, i) => setTimeout(() => { if (disposed) return; audio.piano(ST.FREQ[k - 1], { vel, dur: 2.6, pan, wet, ghost }); if (press) bumpKey(k - 1); }, i * gap));
  }
  function bumpKey(i) { const k = W.keys[i]; if (!k) return; k.position.y = 0.82; setTimeout(() => { k.position.y = 0.86; }, 220); }
  function updateSources(t) {
    const f = fwd(), r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
    for (const i of [1, 2, 3, 4, 5]) {
      if (S.frag[i]) continue; const [sx, sz] = W.sources[i], dx = sx - P.x, dz = sz - P.z, d = Math.hypot(dx, dz); if (srcT[i] == null) srcT[i] = t + 1 + Math.random() * 4; if (t < srcT[i]) continue;
      srcT[i] = t + 7 + Math.random() * 4; const at = clamp(1 - d / 75, 0, 1), vel = (0.1 + 0.55 * at * at) * (listenK > 0.5 ? 1.5 : 1); if (at < 0.06) continue; const pan = clamp((dx * r.x + dz * r.z) / (d || 1), -1, 1);
      playPhrase(ST.PHRASES[i - 1], { vel: Math.min(0.85, vel), pan, ghost: true, gap: 560, wet: 0.9 });
    }
    houseT -= 0; if (t > houseT) { houseT = t + 14 + Math.random() * 6; const hx = 0 - P.x, hz = -84 - P.z, d = Math.hypot(hx, hz), at = clamp(1 - d / 110, 0, 1); if (at > 0.04) { const found = [1, 2, 3, 4, 5, 6].filter(i => S.frag[i]), pick = found.length ? ST.PHRASES[found[(Math.random() * found.length) | 0] - 1] : [1, 3, 5, 3]; playPhrase(pick, { vel: 0.12 + 0.4 * at * at, pan: clamp((hx * r.x + hz * r.z) / (d || 1), -1, 1), ghost: true, gap: 700, wet: 0.95, press: d < 20 }); } }
  }

  /* ---------------- the piano ---------------- */
  function openPiano(keep) {
    if (pianoOpen) return; input.releaseLock(); pianoOpen = true; input.enabled = false; hud.prompt.hidden = true; if (!keep || !run) run = new ST.PianoRun(S.frag); focus = { x: -3.55, z: -83.7, yaw: Math.PI / 2, pitch: -0.4 };
    pianoEl = el("div", "piano-ui noinput"); pianoEl.innerHTML = `<div class="pn-top"><b>The lament</b><span class="pn-msg"></span><button data-a="mode" class="pn-b">Guided</button><button data-a="close" class="pn-b">Close</button></div><div class="pn-score">${ST.PHRASES.map((p, i) => `<div class="pn-ph" data-p="${i}"><b>${i + 1}</b>${p.map((k, j) => `<kbd data-j="${j}">${ST.KEYS[k - 1]}${k === 8 ? "′" : ""}</kbd>`).join("")}</div>`).join("")}</div><div class="pn-keys">${ST.KEYS.map((k, i) => `<button class="pk" data-k="${i + 1}"><span>${k}${i === 7 ? "′" : ""}</span><small>${"ASDFGHJK"[i]}</small></button>`).join("")}</div>`;
    host.querySelector(".adv-ui").append(pianoEl); pianoEl.dataset.guided = "1"; pianoMsg(S.frag[1] && run.p === 0 && run.i === 0 ? "Play the phrases in order. The lit key is next." : "Keep going.");
    pianoEl.addEventListener("pointerdown", e => { const b = e.target.closest("button"); if (!b) return; e.preventDefault(); if (b.dataset.k) pressKey(+b.dataset.k); else if (b.dataset.a === "close") closePiano(); else if (b.dataset.a === "mode") { const g = pianoEl.dataset.guided === "1" ? "0" : "1"; pianoEl.dataset.guided = g; b.textContent = g === "1" ? "Guided" : "From memory"; refreshPiano(); } });
    refreshPiano(); ghostBoost = 1;
  }
  function pianoMsg(t) { if (pianoEl) pianoEl.querySelector(".pn-msg").textContent = t; }
  function refreshPiano() {
    if (!pianoEl) return; const g = pianoEl.dataset.guided === "1";
    pianoEl.querySelectorAll(".pn-ph").forEach(ph => { const p = +ph.dataset.p; ph.classList.toggle("known", !!S.frag[p + 1]); ph.classList.toggle("cur", run.p === p); ph.classList.toggle("done", run.p > p); ph.querySelectorAll("kbd").forEach(k => { const j = +k.dataset.j; k.classList.toggle("ok", run.p > p || (run.p === p && run.i > j)); k.style.visibility = S.frag[p + 1] ? "" : "hidden"; }); });
    const exp = run.expected(); pianoEl.querySelectorAll(".pk").forEach(b => b.classList.toggle("next", g && exp === +b.dataset.k));
  }
  function pressKey(k) {
    if (!pianoOpen || !run || noteBusy) return; audio.piano(ST.FREQ[k - 1], { vel: 0.85, dur: 2.6, wet: 0.5 }); bumpKey(k - 1);
    const b = pianoEl.querySelector(`.pk[data-k="${k}"]`); if (b) { b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 160); }
    const r = run.press(k);
    if (r.blocked) { pianoMsg(run.p >= 6 ? "" : "You have not found this phrase yet. Keep exploring the Point."); refreshPiano(); return; }
    if (!r.ok) { S.perfect = false; audio.tone({ freq: 98, dur: 0.5, type: "sawtooth", vol: 0.06, slide: -20, wet: 0.4 }); ghostBoost = 2; pianoMsg("That is not right. The phrase starts again."); if (b) { b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 300); } refreshPiano(); return; }
    refreshPiano();
    if (r.phraseDone != null) {
      const p = r.phraseDone; pianoMsg(`Phrase ${p + 1} of 6. The house answers.`); ghostBoost = 1.5; setTimeout(() => { audio.piano(ST.FREQ[0], { vel: 0.3, dur: 3, ghost: true, wet: 0.9 }); audio.piano(ST.FREQ[2], { vel: 0.25, dur: 3, ghost: true, wet: 0.9 }); audio.piano(ST.FREQ[4], { vel: 0.22, dur: 3, ghost: true, wet: 0.9 }); }, 500);
      if (r.finished) { noteBusy = true; setTimeout(() => { noteBusy = false; closePiano(true); converse(r.alt ? "fin_other" : "fin_peace"); }, 1400); }
      else if (p === 4) { noteBusy = true; setTimeout(() => { noteBusy = false; closePiano(true); converse("fin_before_last"); }, 1300); }
    }
  }
  function closePiano(silent) { if (!pianoOpen) return; pianoOpen = false; if (pianoEl) { pianoEl.remove(); pianoEl = null; } focus = null; ghostBoost = 0; if (!silent) { input.enabled = !talking; } }

  /* ---------------- endings ---------------- */
  async function playEnding() {
    endingStarted = true; dlg.hide(); talking = true; input.enabled = false; hudShow(false); closePiano(true);
    const id = ST.defaultEnding(S), E = ST.ENDINGS[id], found = endingsFound(); found[id] = true; save(ST.ENDINGS_KEY, found); clear(ST.SAVE_KEY);
    ghostBoost = id === "leave" ? 0 : 2; if (id === "peace") { audio.piano(220, { vel: 0.5, dur: 5, wet: 0.9 }); setTimeout(() => audio.piano(110, { vel: 0.4, dur: 6, wet: 0.9 }), 700); } else if (id === "other") audio.piano(440, { vel: 0.6, dur: 6, wet: 0.9 }); else if (id === "stay") playPhrase(ST.PHRASES[0], { vel: 0.6, ghost: false, gap: 380 });
    await wait(3600); await shell.fade(true, 1400);
    shell.ending({ kicker: E.kicker, title: E.title, paragraphs: E.paragraphs(S), notes: E.notes, found: Object.keys(found).length, total: 4, cls: E.cls, adv: "skye", endingId: id, onReplay: () => { shell.close(); begin(null); }, onExit: () => { dispose(); onExit(); } });
    await shell.fade(false, 600);
  }
  function persist() { if (!S || S.ending || endingStarted) return; if (!ST.count(S) && !Object.keys(S.flags).length && !S.tide) return; save(ST.SAVE_KEY, { v: 1, s: S, pos: [P.x, P.z, P.yaw] }); }

  /* ---------------- main loop ---------------- */
  const walkable = (x, z) => H(x, z) > W.seaLevel + 0.16;
  const inHouse = () => P.x > HOUSE.x0 - 0.2 && P.x < HOUSE.x1 + 0.2 && P.z > HOUSE.z0 - 0.2 && P.z < HOUSE.z1 + 0.2, inRoof = () => P.x > HOUSE.x0 && P.x < 0.7 && P.z > HOUSE.z0 && P.z < HOUSE.z1;
  function tick(dt, t) {
    if (!running || disposed || paused) return;
    emaDt += (dt - emaDt) * 0.05; if (!degraded && emaDt > 0.05) { lowFrames++; if (lowFrames > 120) { degraded = true; stage.renderer.setPixelRatio(1); rain.setIntensity(Math.min(rain.intensity, 0.5)); } } else lowFrames = Math.max(0, lowFrames - 1);
    dlg.tick(dt);
    const cam = stage.camera;
    if (!talking && !busy && !journalOpen && !pianoOpen && input.enabled) {
      const lk = input.takeLook(); P.yaw -= lk.dx; P.pitch = clamp(P.pitch - lk.dy, -1.25, 1.25); P.yaw -= input.turn() * dt * 1.8;
      const mv = input.move(), run2 = input.running(), sp = run2 ? 4.2 : 2.5, f = fwd(), r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
      let vx = f.x * mv.y + r.x * mv.x, vz = f.z * mv.y + r.z * mv.x; const m = Math.hypot(vx, vz);
      if (m > 0.05) {
        vx /= Math.max(1, m); vz /= Math.max(1, m); const nx = P.x + vx * sp * dt, nz = P.z + vz * sp * dt, h0 = H(P.x, P.z), step2 = Math.hypot(nx - P.x, nz - P.z) || 1e-4;
        const ok = (x, z) => walkable(x, z) && (H(x, z) - h0) / step2 < 1.15; // water and cliffs block; the slope limit is ~49 degrees
        if (ok(nx, nz)) { P.x = nx; P.z = nz; } else if (ok(nx, P.z)) P.x = nx; else if (ok(P.x, nz)) P.z = nz;
        P.bob += dt * sp * 2.2; stepT -= dt * sp; if (stepT < 0) { stepT = 1.8; const h = H(P.x, P.z); audio.step(inHouse() ? "wood" : h < 0.9 ? "sand" : Math.abs(P.x) < 2.6 && P.z < -44 && P.z > -68 ? "stone" : "grass", 0.04); }
      }
      const q = { x: P.x, z: P.z }; col.resolve(q, 0.35); P.x = q.x; P.z = q.z;
    }
    if (focus) { P.x = lerp(P.x, focus.x, Math.min(1, dt * 3)); P.z = lerp(P.z, focus.z, Math.min(1, dt * 3)); let dy = focus.yaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, dt * 3); P.pitch = lerp(P.pitch, focus.pitch, Math.min(1, dt * 3)); }
    // tide closes behind the player when they cross toward the house with all five outside echoes
    if (!talking && !busy && ST.tideDue(S) && P.z < -58 && Math.abs(P.x) < 6) converse("tide_close");
    // listening
    listenK += ((listening && !talking && !pianoOpen ? 1 : 0) - listenK) * Math.min(1, dt * 4);
    view.style.filter = listenK > 0.02 ? `saturate(${1 - 0.6 * listenK}) contrast(${1 + 0.15 * listenK}) brightness(${1 - 0.08 * listenK})` : "";
    audio.setLayer("wind", (curLook.wind || 0.08) * (1 - 0.7 * listenK) * (inRoof() ? 0.35 : 1), 0.4); audio.setLayer("rain", ((curLook.rain || 0.3) * 0.12) * (inRoof() ? 0.3 : 1) * (1 - 0.6 * listenK), 0.5); audio.setLayer("sea", (curLook.sea || 0.1) * (1 - 0.5 * listenK) * (inHouse() ? 0.6 : 1), 0.6);
    // camera
    const ground = H(P.x, P.z); P.y = lerp(P.y, Math.max(ground, W.seaLevel - 0.1), Math.min(1, dt * 12)); const bob = Math.sin(P.bob) * 0.035;
    cam.position.set(P.x, P.y + 1.62 + bob, P.z); cam.rotation.order = "YXZ"; cam.rotation.set(P.pitch, P.yaw, 0);
    lantern.intensity = 2.9 + Math.sin(t * 9) * 0.15 + Math.random() * 0.12; sky.follow(cam);
    // weather
    const indoor = inRoof() ? 0.15 : 1; rain.setIntensity(Math.min(degraded ? 0.5 : 1, (curLook.rain || 0.3)) * indoor); rain.update(dt, cam);
    if (ST.count(S) >= 2 || S.tide) { nextFlash -= dt; if (nextFlash < 0) { nextFlash = 14 + Math.random() * 22; flash = 1; thunderAt = t + 0.4 + Math.random() * 2.4; } }
    if (flash > 0) flash = Math.max(0, flash - dt * 3.2) * (Math.random() < 0.15 ? 1.4 : 1); if (thunderAt > 0 && t > thunderAt) { thunderAt = -1; audio.thunder(0.5 + Math.random() * 0.5); }
    W.seaLevel += (seaTarget - W.seaLevel) * Math.min(1, dt * 0.6); W.updateSea(t, P.x, P.z, W.seaLevel, curLook.amp || 0.3);
    applyLook(dt);
    // listening visuals: motes and the ghost
    for (const i in W.motes) { const m = W.motes[i]; if (!m.visible) continue; const sx = m.position.x - P.x, sz = m.position.z - P.z, d = Math.hypot(sx, sz); const want = (i == 6 ? (ST.outside(S) >= 3 ? 1 : 0) : 1) * (listenK * 0.95 + (d < 14 ? 0.25 * (1 - d / 14) : 0)); m.material.opacity += (want - m.material.opacity) * Math.min(1, dt * 5); m.scale.setScalar(2.2 + Math.sin(t * 2.4 + +i) * 0.35); }
    const nearHouse = Math.hypot(P.x, P.z + 84) < 14, wantGhost = (nearHouse ? listenK * 0.38 : 0) + (pianoOpen ? 0.42 : 0) + ghostBoost * 0.12; ghostK += (wantGhost - ghostK) * Math.min(1, dt * 2.5); ghostBoost *= Math.pow(0.5, dt);
    W.ghostMat.opacity = Math.max(0, ghostK + Math.sin(t * 5) * 0.03 * ghostK); W.ghost.visible = W.ghostMat.opacity > 0.02; W.ghost.position.y = Math.sin(t * 1.3) * 0.03; W.ghostArms.forEach((a, i) => { a.rotation.x = Math.sin(t * 6 + i * 2) * 0.12 * (pianoOpen ? 1 : 0.3); });
    W.houseLight.intensity += ((inHouse() ? 1.3 + ghostK * 1.6 : nearHouse ? 0.5 + ghostK * 1.2 : 0) + (flash > 0 ? 0 : 0) - W.houseLight.intensity) * Math.min(1, dt * 2) + (Math.random() - 0.5) * 0.02; W.windowGlow.material.opacity += ((nearHouse ? 0.25 : ST.count(S) >= 1 ? 0.16 : 0.08) + ghostK * 0.5 - W.windowGlow.material.opacity) * Math.min(1, dt * 2);
    if (W.hearthGlow) W.hearthGlow.material.opacity = 0.14 + Math.sin(t * 3) * 0.04 + listenK * 0.2;
    // listening bar: direction to the nearest echo or goal
    { const target = listenTarget(); if (target && listenK > 0.05) { let a = Math.atan2(-(target[0] - P.x), -(target[1] - P.z)) - P.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); const u = clamp(a / 1.6, -1, 1); hud.lbar.style.opacity = listenK; hud.lbar.querySelector("u").style.left = 50 + u * 46 + "%"; hud.lbar.classList.toggle("ahead", Math.abs(a) < 0.25); } else hud.lbar.style.opacity = 0; }
    updateSources(t); updatePrompt();
    saveTimer += dt; if (saveTimer > 25) { saveTimer = 0; if (!talking) persist(); }
  }
  function listenTarget() {
    let best = null, bd = 1e9; const consider = (x, z) => { const d = Math.hypot(x - P.x, z - P.z); if (d < bd) { bd = d; best = [x, z]; } };
    for (const i of [1, 2, 3, 4, 5]) if (!S.frag[i]) consider(...W.sources[i]);
    if (!best && !S.tide) consider(0, -80); else if (!best) { if (!S.frag[6]) consider(...W.sources[6]); else consider(-4.7, -84); }
    if (ST.outside(S) >= 3 && !S.frag[6] && !best) consider(...W.sources[6]); return best;
  }

  /* ---------------- teardown ---------------- */
  const onHide = () => { if (!talking && S) persist(); }; addEventListener("pagehide", onHide);
  function dispose() { if (disposed) return; disposed = true; running = false; removeEventListener("pagehide", onHide); try { persist(); } catch (e) { /* ignore */ } try { view.style.filter = ""; stage && stage.dispose(); input && input.dispose(); dlg && dlg.dispose(); audio.dispose(); shell.dispose(); } catch (e) { /* ignore */ } host.innerHTML = ""; }

  showTitle();
  return {
    dispose,
    _t: {
      get S() { return S; }, get D() { return D; }, get running() { return running; }, get busy() { return busy; }, get talking() { return talking; }, get pianoOpen() { return pianoOpen; }, get listenK() { return listenK; }, get degraded() { return degraded; }, get seaLevel() { return W && W.seaLevel; },
      tp: (x, z) => { P.x = x; P.z = z; P.y = H(x, z); }, pos: () => [P.x, P.z, P.yaw], H, near: () => candidates().map(c => c.id), interact: () => tryInteract(), converse, press: () => dlg.press(), pick: i => dlg.pickNum(i + 1), view: () => D && D.view(), skip: () => dlg.skip(), dlgVisible: () => dlg.visible,
      key: k => pressKey(k), runState: () => run && { p: run.p, i: run.i, mistakes: run.mistakes }, openPiano: () => openPiano(), closePiano: () => closePiano(), look: (yaw, pitch) => { P.yaw = yaw; P.pitch = pitch || 0; }, listen: v => { listening = !!v; },
      toggleJournal, persist, ending: () => S && S.ending, endingsFound, patch: p => { Object.assign(S, p); syncWorld(); updateHud(); },
      giveFrag: n => { S.frag[n] = true; onFrag(n); }, jump: async id => { while (busy) await wait(50); talking = true; input.enabled = false; return present(D.start(id)); }, stage: () => stage,
    },
  };
}
