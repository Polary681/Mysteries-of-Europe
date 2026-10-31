// The cinematic landing scene: a real-time 3D landscape (see hero3d.js), floating motes and a skippable intro.
// Without WebGL the hand-drawn parallax layers and CSS mist are shown instead.
import { heroLayers, logoMark } from "./art.js";
import { createHero3D } from "./hero3d.js";
import * as Archive from "../shared/archive.js";
import { reveal } from "./archive-ui.js";
import { sting, cue } from "./ambient.js";
import { openSkyChart, chartData } from "./skychart.js";
import { compass } from "../world/astro.js";
import { downloadPostcard } from "./postcard.js";
import { startTour } from "./tour.js";
import { autoTilt, setTilt, tiltNeedsPermission, tiltSupported, tiltState } from "../world/lantern.js";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const safe = (f, d) => { try { return f(); } catch (e) { return d; } };

/** a tileable, soft cloud strip painted once on a small canvas (cheap, no filters, no image file) */
function mistTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256; const g = c.getContext("2d"); if (!g) return "";
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {
    const x = r() * 1024, y = 70 + r() * 130, rad = 50 + r() * 110, a = .035 + r() * .07;
    for (const dx of [-1024, 0, 1024]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad); gr.addColorStop(0, `rgba(196,214,208,${a})`); gr.addColorStop(1, "rgba(196,214,208,0)"); g.fillStyle = gr; g.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2); }
  }
  return c.toDataURL("image/png");
}

export function initHero(hero) {
  if (!hero) return null;
  const drawLayers = () => { const L = heroLayers(); for (const k of ["sky", "far", "mid", "castle", "forest", "fore"]) { const el = hero.querySelector(".hl-" + k); if (el) el.innerHTML = L[k]; } };
  /* ---- a small caption for what the valley shows: the real sky of tonight, special nights, the finale ---- */
  const note = document.createElement("p"); note.className = "hero-almanac"; note.setAttribute("aria-live", "polite"); hero.append(note);
  // the caption opens a chart of tonight's sky (star names, Sun and Moon rise/set times)
  note.tabIndex = 0; note.setAttribute("role", "button"); note.title = "Open the sky chart";
  const chart = e => { e.stopPropagation(); e.preventDefault(); safe(() => openSkyChart(gl && gl.sky && gl.sky())); };
  note.addEventListener("click", chart); note.addEventListener("pointerdown", e => e.stopPropagation());
  note.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") chart(e); });
  const say = (txt, ms = 0, cls = "") => { note.textContent = txt; note.className = "hero-almanac on " + cls; if (ms) { clearTimeout(say.t); say.t = setTimeout(() => showSky(), ms); } };
  const showSky = () => { const s = gl && gl.sky && gl.sky(); if (!s) return; note.className = "hero-almanac on"; note.textContent = s.caption + (s.season ? ` · ${s.season.label}` : "") + (s.night ? ` · ${s.night.label}` : ""); note.title = (s.night ? s.night.note : "The real sky over the reference place, computed for this moment (Brocken, Harz Mountains, Germany).") + " Click for the sky chart."; };
  /* ---- the will-o'-the-wisp: a secret card for whoever catches one ---- */
  const onWisp = () => {
    const fresh = safe(() => Archive.recordSecret("wisp"), []);
    if (fresh.length) { setTimeout(() => safe(() => reveal(fresh, { openArchive: () => dispatchEvent(new CustomEvent("moe:open-archive")) })), 650); say("You caught a will-o\u2019-the-wisp.", 5200, "magic"); }
    else say("The wisp scatters into sparks. It is already in your Archive.", 4200, "magic");
  };
  const onFinale = () => { safe(sting); safe(() => cue("bell")); say("The Archive is complete. The castle remembers every story.", 9000, "finale"); };
  // everything rare the valley shows is announced on the window (the ambient sound and the Archivist's journal listen)
  const onEvent = (type, d) => { try { dispatchEvent(new CustomEvent("moe:valley", { detail: { type, ...d } })); } catch (e) { /* optional */ } };
  addEventListener("moe:journal", e => { const en = e.detail && e.detail.entry; if (en && !/^night:/.test(en.id)) say(`Noted in the Archivist\u2019s journal: ${en.title}.`, 4600, "magic"); });
  const noGL = /[?&]gl=0/.test(location.search);   // development aid: the drawn fallback instead of the 3D valley
  const make = () => safe(() => createHero3D(hero.querySelector(".hero-scene"), { reduce: reduce(), pointerHost: hero, onWisp, onFinale, onEvent, onFail: () => { hero.classList.remove("gl"); drawLayers(); note.remove(); } }), null);
  let cur = noGL ? null : make();
  // The valley steps aside while a 3D adventure is open: its WebGL context is released (two big 3D scenes at once
  // starve modest GPUs) and the valley is rebuilt quietly a moment after the adventure closes. Everything that
  // matters is persistent (the castle's windows, the Archive), so nothing is lost. `gl` stays the same object.
  const gl = cur ? new Proxy({}, { get: (_, k) => { const g = cur; if (!g) return k === "isReady" ? () => false : ["rig", "debug", "canvas"].includes(k) ? undefined : () => undefined; /* asleep: calls are ignored */ const v = g[k]; return typeof v === "function" ? v.bind(g) : v; } }) : null;
  if (cur) {
    let rebuild = 0;
    new MutationObserver(() => {
      const adv = document.body.classList.contains("adv-open");
      if (adv) { clearTimeout(rebuild); if (cur) { safe(() => cur.dispose()); cur = null; } }
      else if (!cur && !rebuild) rebuild = setTimeout(() => { rebuild = 0; if (!document.body.classList.contains("adv-open") && !cur) { cur = make(); if (cur) safe(() => cur.skipIntro()); } }, 1500);
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (window.MOE3D) window.MOE3D.hero = gl;   // the landing scene's API (stats, sky, camera rig for the navigation, debug)
  if (gl) { hero.classList.add("gl"); const wait = () => (gl.isReady() ? showSky() : setTimeout(wait, 400)); wait(); } else { drawLayers(); note.remove(); }
  /* ---- the guided tour: ?tour (or ?tour=loop) at load, or the button under the main buttons ---- */
  {
    const cta = hero.querySelector(".hero-cta"), tb = document.createElement("button"); tb.type = "button"; tb.className = "hero-tour"; tb.textContent = "▶ Guided tour";
    tb.title = "A hands-free tour of the site. Click or press any key to leave it.";
    tb.addEventListener("pointerdown", e => e.stopPropagation()); tb.addEventListener("click", e => { e.stopPropagation(); safe(() => startTour()); });
    if (cta) cta.after(tb); else hero.append(tb);
    const q = safe(() => new URLSearchParams(location.search).get("tour"), null);
    if (q !== null) { const t0 = performance.now(), go = () => { const ok = hero.classList.contains("ready") && window.MOE3D && window.MOE3D.navigator && (!gl || gl.isReady() || performance.now() - t0 > 15000); if (ok) setTimeout(() => safe(() => startTour({ loop: q === "loop" })), 800); else setTimeout(go, 300); }; setTimeout(go, 300); }
  }
  /* ---- a postcard of the valley as it is right now (PNG download) ---- */
  if (gl) {
    const pb = document.createElement("button"); pb.type = "button"; pb.className = "hero-postcard"; pb.innerHTML = '<span class="ic" aria-hidden="true">✉</span> <span class="tx">Postcard</span>'; pb.setAttribute("aria-label", "Postcard"); pb.title = "Download a postcard of the valley tonight (PNG)";
    pb.addEventListener("pointerdown", e => e.stopPropagation());
    pb.addEventListener("click", async e => { e.stopPropagation(); if (pb.disabled) return; pb.disabled = true; const n = await downloadPostcard(gl).catch(() => null); pb.disabled = false; say(n ? "Postcard saved: " + n : "The valley is still being built. Try again in a moment.", 4200); });
    // the small tools at the bottom left: the postcard and the look at the sky
    const tools = document.createElement("div"); tools.className = "hero-tools"; tools.append(pb); hero.append(tools);

    /* ---- LOOK UP: the view tilts from the valley to tonight's real Moon (or the stars, when the Moon is down) and back ---- */
    const gb = document.createElement("button"); gb.type = "button"; gb.className = "hero-gaze"; gb.setAttribute("aria-pressed", "false");
    // icon + words; on narrow phones only the icon shows (the tilt button shares the bottom row there)
    const label = (ic, tx) => { gb.innerHTML = `<span class="ic" aria-hidden="true">${ic}</span> <span class="tx">${tx}</span>`; gb.setAttribute("aria-label", tx); };
    const GB = () => label("☾", "Look at the sky"), GB_BACK = () => label("↓", "Back to the valley");
    GB(); gb.title = "Look up at tonight's real Moon and stars over the Brocken (the sky the valley shows is computed for this moment)";
    tools.append(gb);
    const marks = document.createElement("div"); marks.className = "sky-marks"; marks.setAttribute("aria-hidden", "true"); hero.append(marks);
    const escH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    let gazing = false, mt = 0;
    const drawMarks = () => {
      clearTimeout(mt); if (!gazing) { marks.innerHTML = ""; return; }
      const list = safe(() => gl.skyMarks(), []) || [], r = hero.getBoundingClientRect();
      // near the right edge the name goes on the left of its star, so it is never cut off
      marks.innerHTML = list.map(m => `<span class="sm ${m.kind}${m.x - r.left > r.width - (m.kind === "moon" ? 290 : 130) ? " l" : ""}" style="left:${(m.x - r.left).toFixed(0)}px;top:${(m.y - r.top).toFixed(0)}px">${escH(m.name)}</span>`).join("");
      mt = setTimeout(drawMarks, 120);
    };
    const skyLine = () => {
      const S = safe(() => gl.sky(), null); if (!S) return "";
      const m = S.astro.moon, at = S.caption.split(" · ")[1] || "";
      if (m.alt > 0) return `The real Moon over the Brocken${at ? ", " + at : ""}: ${m.name.toLowerCase()} (${Math.round(m.fraction * 100)}%), ${Math.round(m.alt)}° high in the ${compass(m.az)}${safe(() => gl.moonHidden(), false) ? `, still behind the mountains of the valley (it is ${m.az < 180 ? "rising" : "setting"})` : ", among tonight's stars"}.`;
      const d = safe(() => chartData(S), null), rise = d && d.moonEvents.find(e => e.type === "rise" && !e.before);
      return `The Moon is below the horizon${rise ? ` (it rises at ${rise.at})` : ""}. These are the real stars over the Brocken${at ? ", " + at : ""}.`;
    };
    const setGaze = on => {
      if (on === gazing) return; gazing = on;
      hero.classList.toggle("gazing", on); gb.setAttribute("aria-pressed", String(on)); if (on) GB_BACK(); else GB();
      if (on) { clearTimeout(say.t); note.textContent = skyLine(); note.className = "hero-almanac on gaze"; setTimeout(drawMarks, 400); }
      else { marks.innerHTML = ""; clearTimeout(mt); showSky(); }
    };
    const lookUp = on => {
      if (!gl.isReady()) { say("The valley is still being built. Try again in a moment.", 3200); return; }
      gl.onGaze(v => setGaze(v));                           // (re)attach: the valley is rebuilt after a 3D adventure
      const r = gl.lookUp(on); if (r && on) setGaze(true); else if (!on) setGaze(false); else say("Wait for the valley to settle, then look up again.", 3200);
    };
    gb.addEventListener("pointerdown", e => e.stopPropagation());
    gb.addEventListener("click", e => { e.stopPropagation(); lookUp(!gazing); });
    // back to the valley: a click or tap on the sky, Esc, the wheel, scrolling away
    hero.addEventListener("pointerdown", e => { if (gazing && !e.target.closest("button, a, .hero-almanac")) lookUp(false); });
    addEventListener("keydown", e => { if (gazing && e.key === "Escape") lookUp(false); });
    addEventListener("wheel", () => { if (gazing) lookUp(false); }, { passive: true });
    addEventListener("scroll", () => { if (gazing && scrollY > 40) lookUp(false); }, { passive: true });
    addEventListener("moe:nav", e => { if (gazing && e.detail && e.detail.type === "start") setGaze(false); });
    // a 3D adventure opening (deep link, the story box...) puts the valley to sleep: it comes back looking at the valley
    new MutationObserver(() => { if (gazing && document.body.classList.contains("adv-open")) setGaze(false); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  /* ---- phones: tilting the phone moves the lantern (Android: at once; iOS: after a tap on "Tilt", which asks permission) ---- */
  if (gl && !reduce()) {
    safe(autoTilt);
    if (safe(() => tiltSupported() && tiltNeedsPermission(), false)) {
      const tb = document.createElement("button"); tb.type = "button"; tb.className = "hero-tilt"; tb.setAttribute("aria-pressed", "false"); tb.textContent = "Tilt to move the lantern";
      tb.addEventListener("pointerdown", e => e.stopPropagation());
      tb.addEventListener("click", async e => {
        e.stopPropagation();
        if (tiltState().on) { setTilt(false); tb.setAttribute("aria-pressed", "false"); return; }
        let ok = false; try { ok = (await DeviceOrientationEvent.requestPermission()) === "granted"; } catch (err) { ok = false; }
        setTilt(ok); tb.setAttribute("aria-pressed", String(ok)); if (!ok) { tb.textContent = "Tilt not allowed"; setTimeout(() => { tb.textContent = "Tilt to move the lantern"; }, 2500); }
      });
      hero.append(tb);
    }
  }
  const tex = safe(mistTexture, ""); if (tex) hero.style.setProperty("--mist", `url(${tex})`);
  const logo = document.querySelector(".logo .mark"); if (logo) logo.innerHTML = logoMark();

  /* ---- intro: plays once per session, can be skipped (button, Esc, Enter, Space, click, scroll) ---- */
  const seen = safe(() => sessionStorage.getItem("moe.intro") === "1", false);
  const skipBtn = hero.querySelector(".hero-skip");
  const endIntro = () => { hero.classList.remove("intro"); hero.classList.add("ready"); safe(() => sessionStorage.setItem("moe.intro", "1")); if (skipBtn) skipBtn.hidden = true; removeEventListener("keydown", onKey); removeEventListener("wheel", endIntro); hero.removeEventListener("pointerdown", endIntro); clearTimeout(timer); if (gl) gl.skipIntro(); };
  const onKey = e => { if (["Escape", "Enter", " "].includes(e.key) && e.target === document.body) endIntro(); };
  let timer = 0;
  if (seen || reduce()) { hero.classList.add("ready"); if (skipBtn) skipBtn.hidden = true; }
  else {
    hero.classList.add("intro"); if (skipBtn) skipBtn.hidden = false;
    // the intro's camera move starts when the 3D valley is actually built (slow devices must not miss it)
    if (gl) { const t0 = performance.now(), go = () => { if (!hero.classList.contains("intro")) return; if (gl.isReady() || performance.now() - t0 > 9000) { gl.intro(); timer = setTimeout(endIntro, 4600); } else setTimeout(go, 120); }; go(); }
    else timer = setTimeout(endIntro, 4600);
    addEventListener("keydown", onKey); addEventListener("wheel", endIntro, { passive: true }); hero.addEventListener("pointerdown", endIntro);
    if (skipBtn) skipBtn.addEventListener("click", e => { e.stopPropagation(); endIntro(); });
  }

  /* ---- depth: layers move at different speeds with the scroll and (lightly) with the pointer ---- */
  const layers = [...hero.querySelectorAll("[data-k]")];
  let sy = 0, tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;
  const tick = () => {
    raf = 0; cx += (tx - cx) * .08; cy += (ty - cy) * .08;
    hero.style.setProperty("--sy", sy.toFixed(1) + "px"); hero.style.setProperty("--px", cx.toFixed(2)); hero.style.setProperty("--py", cy.toFixed(2));
    if (Math.abs(tx - cx) > .01 || Math.abs(ty - cy) > .01) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
  layers.forEach(l => l.style.setProperty("--k", l.dataset.k));
  if (!reduce()) {
    const toGl = () => { if (gl) gl.setView(tx, ty, sy / Math.max(1, hero.offsetHeight)); };
    addEventListener("scroll", () => { sy = Math.min(scrollY, hero.offsetHeight); kick(); toGl(); }, { passive: true });
    hero.addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; kick(); toGl(); });
    hero.addEventListener("pointerleave", () => { tx = ty = 0; kick(); toGl(); });
  }

  /* ---- motes: ~48 slow particles; paused when off-screen, hidden tab, or reduced motion; thinned out if the machine struggles ---- */
  const cv = hero.querySelector(".hero-fx"); let stopFx = () => {};
  if (cv && !reduce()) {
    const g = cv.getContext("2d"); let W = 0, H = 0, run = false, last = 0, slow = 0, n = 48;
    const P = []; const mk = () => ({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, s: Math.random() * 6.28, a: .12 + Math.random() * .4 });
    for (let i = 0; i < 70; i++) P.push(mk());
    const size = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    const frame = t => {
      if (!run) return; requestAnimationFrame(frame); const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
      if (dt > .034) { if (++slow > 30 && n > 16) { n -= 8; slow = 0; } } else slow = Math.max(0, slow - 1);
      g.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const p = P[i]; p.s += dt * (.4 + p.z); p.x += (-.006 - .004 * p.z) * dt * 1 + Math.sin(p.s) * .0004; p.y -= (.004 + .01 * p.z) * dt; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); } if (p.x < -.02) p.x = 1.02;
        const px = p.x * W, py = p.y * H, r = .6 + p.z * 1.5; g.globalAlpha = p.a * (.5 + .5 * Math.sin(p.s * 1.3)); g.fillStyle = "#dfe9df"; g.beginPath(); g.arc(px, py, r, 0, 6.283); g.fill();
      }
    };
    const set = () => { const want = visible && !document.hidden; if (want && !run) { run = true; last = performance.now(); requestAnimationFrame(frame); } else if (!want) run = false; };
    document.addEventListener("visibilitychange", set); stopFx = set;
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; hero.classList.toggle("off", !visible); stopFx(); }, { threshold: 0 }).observe(hero);
  stopFx();
  return { endIntro, gl };
}
