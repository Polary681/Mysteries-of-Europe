// CINEMATIC NAVIGATION — the central system.
//
// The site is one page with sections (#intro, #prologo, #mappe, #leggende, #archivio, #giochi) and overlays (a legend:
// text story or 3D adventure; an Archive card in the inspector). This module owns how you MOVE between them:
//   - one state machine: idle -> running(transition) -> idle. Only one transition at a time; a new request while one
//     runs makes the current one finish at once (skip) and is then served (only the latest request is kept).
//   - routes live in the URL hash, so the browser's Back/Forward buttons work and every place has an address:
//       #mappe  #leggende ...      a section
//       #legend/woolpit            a legend open (story or adventure)
//       #card/hoia-time            an Archive card in the inspector
//     Moving pushes a history entry (with the scroll position of the place you left, restored when you come back).
//   - each move picks a transition designed for that path (see transitions.js): the flight from the valley into the
//     map and back, the ascent into the night sky and the descent from it, chapter passages through the mist, the
//     portal into a legend and back into its card or map pin, the Archive card lifting into the inspector and back.
//   - errors never trap the visitor: if a transition throws, its overlays are removed, the destination is shown
//     directly and the navigation goes on.
//   - prefers-reduced-motion: every move becomes a short cross-fade.
// The page keeps its own logic (main.js): it lends the navigator a small `host` adapter (open/close a legend, scroll...).
import { createRun } from "./timeline.js";
import { TRANSITIONS, pickTransition } from "./transitions.js";

export const SECTIONS = ["intro", "prologo", "mappe", "leggende", "archivio", "giochi"];
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPEED = (() => { try { const v = +new URLSearchParams(location.search).get("navspeed"); return v > 0 ? v : 1; } catch (e) { return 1; } })();   // ?navspeed=0.25 slows every journey (to study it)

export function parseHash(hash) {
  const h = String(hash || "").replace(/^#/, "");
  if (!h) return { type: "section", id: "intro" };
  let m = /^legend\/([\w-]+)$/.exec(h); if (m) return { type: "legend", id: m[1] };
  m = /^card\/([\w-]+)$/.exec(h); if (m) return { type: "card", id: m[1] };
  if (SECTIONS.includes(h)) return { type: "section", id: h };
  return null;   // some other anchor: not ours
}
export const routeHash = r => (r.type === "section" ? "#" + r.id : `#${r.type}/${r.id}`);
const same = (a, b) => a && b && a.type === b.type && a.id === b.id;

export function createNavigator(host) {
  let busy = false, run = null, pending = null, overlay = null, origin = null, lastSection = null;
  const listeners = new Set(), log = [];
  const emit = (type, detail) => { listeners.forEach(f => { try { f(type, detail); } catch (e) { /* ignore */ } }); try { dispatchEvent(new CustomEvent("moe:nav", { detail: { type, ...detail } })); } catch (e) { /* ignore */ } };

  /** where the visitor is right now (overlay first, else the section under the middle of the screen) */
  const current = () => overlay || { type: "section", id: host.currentSection() };

  async function perform(to, opts) {
    const from = current();
    if (same(from, to) && !opts.force) return;
    // a legend/card opened from somewhere else: leave the overlay first (without its own transition), then move
    if (from.type !== "section" && to.type !== "section") { await perform({ type: "section", id: lastSection || host.currentSection() }, { ...opts, quick: true }); }
    const f = current();
    const name = reduce() ? "fade" : pickTransition(f, to, { hasHero: host.heroReady(), quick: opts.quick, origin: opts.origin });
    const T = /[?&]trans=none/.test(location.search) ? async c => { await c.swap(); } : (TRANSITIONS[name] || TRANSITIONS.passage);
    run = createRun({ speed: (opts.quick ? 1.6 : 1) * SPEED * (host.lowPower && host.lowPower() ? 1.3 : 1) });   // shorter journeys on the low quality level
    busy = true; document.documentElement.classList.add("nav-busy");
    const dir = to.type === "section" && f.type === "section" ? Math.sign(SECTIONS.indexOf(to.id) - SECTIONS.indexOf(f.id)) || 1 : 1;
    const ctx = { run, host, from: f, to, dir, origin: opts.origin || (to.type === "section" ? null : origin), scrollY: opts.scrollY, nav: api, name };
    const t0 = performance.now(); emit("start", { from: f, to, name });
    let swapped = false; ctx.swap = async () => { if (swapped) return; swapped = true; await applyRoute(to, ctx); };
    try { await T(ctx); await ctx.swap(); }
    catch (err) { console.error("[nav] transition failed, showing the destination directly:", err); run.skip(); try { await ctx.swap(); } catch (e) { console.error(e); } }
    finally {
      run.dispose(); run = null; busy = false; document.documentElement.classList.remove("nav-busy");
      log.push({ name, from: routeHash(f), to: routeHash(to), ms: Math.round(performance.now() - t0) }); if (log.length > 30) log.shift();
      emit("end", { from: f, to, name });
    }
  }
  /** make the route true (the instant part of a transition: scroll, open/close the overlay) */
  async function applyRoute(to, ctx) {
    if (to.type === "section") {
      if (overlay && overlay.type === "legend") { host.closeLegend(); }
      if (overlay && overlay.type === "card") { host.closeCard(true); }
      overlay = null; origin = null;
      host.scrollTo(ctx.scrollY != null ? ctx.scrollY : host.sectionY(to.id));
      lastSection = to.id;
    } else if (to.type === "legend") {
      lastSection = host.currentSection(); origin = ctx.origin || host.legendOrigin(to.id);
      overlay = to; await host.openLegend(to.id, ctx);
    } else if (to.type === "card") {
      lastSection = host.currentSection(); origin = ctx.origin || host.cardElement(to.id);
      overlay = to; host.openCard(to.id, origin);
    }
  }

  let backPending = null, backResolve = null;
  const historyBack = () => { backPending = new Promise(r => { backResolve = r; setTimeout(r, 1200); }); history.back(); };
  async function go(target, opts = {}) {
    const to = typeof target === "string" ? parseHash(target) : target;
    if (!to) return;
    if (backPending && !opts.fromHistory) { await backPending; backPending = null; }   // a Back in flight must land before we push
    if (busy) { pending = [to, opts]; if (run) run.skip(); return; }
    // history: remember where we were (scroll), then add the new place
    if (!opts.fromHistory && opts.push !== false) {
      try {
        const st = history.state && history.state.moe ? history.state : { moe: 1, route: routeHash(current()) };
        history.replaceState({ ...st, scrollY: scrollY }, "", location.href);
        if (routeHash(to) !== location.hash || !location.hash) history.pushState({ moe: 1, route: routeHash(to), scrollY: null }, "", routeHash(to));
      } catch (e) { /* file:// in some browsers: history still works for hashes */ }
    }
    await perform(to, opts);
    if (pending) { const [t, o] = pending; pending = null; await go(t, o); }
  }

  /** the overlay was closed by its own UI (close button, Esc, end of an adventure): go back to where it was opened */
  function closeOverlay({ already = false } = {}) {
    if (!overlay) return;
    const st = history.state;
    if (st && st.moe && st.route === routeHash(overlay)) { if (already) { skipNextClose = true; overlay = null; origin = null; } historyBack(); }
    else if (already) { overlay = null; origin = null; }
    else go({ type: "section", id: lastSection || host.currentSection() }, { push: false });
  }
  let skipNextClose = false;
  addEventListener("popstate", e => {
    if (backResolve) { const r = backResolve; backResolve = null; r(); }
    const to = parseHash(location.hash); if (!to) return;
    const sy = e.state && e.state.moe ? e.state.scrollY : null;
    if (skipNextClose && to.type === "section") { skipNextClose = false; overlay = null; origin = null; return; }
    if (to.type === "section" && overlay && to.id === lastSection) { go(to, { fromHistory: true, scrollY: sy }); return; }
    go(to, { fromHistory: true, scrollY: sy });
  });
  // keyboard / click skip for long journeys
  addEventListener("keydown", e => { if (busy && run && ["Escape", "Enter", " "].includes(e.key)) { run.skip(); } }, true);

  const api = {
    go, closeOverlay,
    back: () => historyBack(),
    skip: () => run && run.skip(),
    get busy() { return busy; },
    get overlay() { return overlay; },
    current,
    on: fn => (listeners.add(fn), () => listeners.delete(fn)),
    log: () => log.slice(),
    /** a route is reflected without a transition (deep links at load) */
    adopt(route) { if (route.type !== "section") { overlay = route; } },
    setOverlay(r) { overlay = r; },
  };
  try { if (!history.state || !history.state.moe) history.replaceState({ moe: 1, route: location.hash || "#intro", scrollY: null }, "", location.href); } catch (e) { /* ignore */ }
  return api;
}
