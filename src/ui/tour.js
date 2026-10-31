// THE GUIDED TOUR: a hands-free presentation of the site (for a screen at an event, or a first look). It walks through the
// cinematic navigation by itself: the valley -> the flight to the map -> the legends and their constellations -> the
// Archive -> back to the valley for a preview of the castle's finale, with a caption for each stop.
// Start: index.html?tour (or ?tour=loop to repeat it), or the "Guided tour" button in the landing scene.
// Any click, tap, key or wheel leaves the tour at once; nothing is saved, nothing is unlocked.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STEPS = [
  { at: "#intro", text: "Below a castle lies a valley under the real night sky: the stars and the Moon are where they are tonight over the Brocken.", hold: 7000 },
  { at: "#mappe", text: "Every legend has its place on the map of Europe.", hold: 6500 },
  { at: "#leggende", text: "Six legends, six 3D adventures: the Green Children of Woolpit, the Hoia Baciu Forest, the Ghost Pianist of Skye, Baba Yaga’s Hut, the Sibyl of the Apennines and Elizabeth Báthory, the Blood Countess.", hold: 5600, sky: ["woolpit", "hoia", "skye", "babayaga", "sibilla", "bathory"] },
  { at: "#archivio", text: "Reach an ending and you recover a relic. The Archive keeps every one, and the Archivist’s journal notes what you saw in the valley.", hold: 7500 },
  { at: "#intro", text: "Every relic lights a window of the castle. Recover them all, and the whole castle answers.", hold: 11000, finale: true },
  { at: null, text: "Your turn: click anywhere to begin.", hold: 6000 },
];

let active = null;
export const tourActive = () => !!active;

export function startTour({ loop = false } = {}) {
  if (active) return active;
  const N = window.MOE3D && window.MOE3D.navigator, hero = () => window.MOE3D && window.MOE3D.hero, sky = () => window.MOE3D && window.MOE3D.ui && window.MOE3D.ui.pageSky && window.MOE3D.ui.pageSky();
  if (!N) return null;
  const cap = document.createElement("div"); cap.className = "tour-cap"; cap.setAttribute("role", "status"); cap.setAttribute("aria-live", "polite");
  cap.innerHTML = `<span class="tour-k">Guided tour</span><p></p><small>Click, tap or press any key to leave the tour</small><i class="tour-bar"><u></u></i>`;
  document.body.append(cap); document.documentElement.classList.add("touring");
  const state = { stop: false, step: -1 };
  const end = e => {
    if (state.stop) return; state.stop = true;
    if (e && e.type !== "tour-end") { e.stopPropagation(); if (e.type !== "wheel" && e.cancelable) e.preventDefault(); }
    for (const t of ["pointerdown", "keydown", "wheel", "touchstart"]) removeEventListener(t, end, true);
    cap.classList.add("out"); setTimeout(() => cap.remove(), 600); document.documentElement.classList.remove("touring");
    try { const s = sky(); s && s.hideAll(); } catch (err) { /* optional */ }
    active = null;
  };
  // the tour starts on a real gesture (the button) or at load: wait a moment so that this very click does not end it
  setTimeout(() => { if (!state.stop) for (const t of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(t, end, { capture: true, passive: false }); }, 400);
  const say = (t, ms) => { cap.querySelector("p").textContent = t; const u = cap.querySelector(".tour-bar u"); u.style.transition = "none"; u.style.width = "0%"; void u.offsetWidth; u.style.transition = `width ${ms}ms linear`; u.style.width = "100%"; cap.classList.add("on"); };
  const idle = async () => { await sleep(150); for (let i = 0; i < 1200 && N.busy && !state.stop; i++) await sleep(100); };
  const wait = async ms => { const t0 = performance.now(); while (!state.stop && performance.now() - t0 < ms) await sleep(100); };
  (async () => {
    do {
      for (let i = 0; i < STEPS.length && !state.stop; i++) {
        const s = STEPS[i]; state.step = i;
        if (s.at) { cap.classList.remove("on"); await N.go(s.at); await idle(); }
        if (state.stop) break;
        say(s.text, s.hold + (s.sky ? s.sky.length * 1600 : 0));
        if (s.sky) { const ps = sky(); for (const k of s.sky) { if (state.stop) break; try { ps && ps.hideAll(); ps && ps.show(k); } catch (e) { /* optional */ } await wait(1600); } try { ps && ps.hideAll(); } catch (e) { /* optional */ } }
        if (s.finale) { try { const h = hero(); h && h.debug && h.debug.previewFinale(); } catch (e) { /* optional */ } }
        await wait(s.hold);
      }
    } while (loop && !state.stop);
    if (!state.stop) end({ type: "tour-end" });
  })();
  active = { stop: () => end({ type: "tour-end" }), state };
  return active;
}
