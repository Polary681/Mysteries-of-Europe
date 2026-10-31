// Game shell: title screen, loading, HUD buttons, objective, toasts, pause menu and ending screen (shared by the adventures).
import { el, keyClick, keyHeldSince } from "../common.js";
import * as Archive from "./archive.js";
import { reveal } from "../ui/archive-ui.js";
import { esc } from "../ui/cards.js";
import { nextQuote } from "../ui/quotes.js";

export function createShell(host, cfg) {
  const root = el("div", "adv-ui"); root.style.setProperty("--acc", cfg.accent || "#b4c9a8"); root.style.setProperty("--acc2", cfg.accent2 || "#8a6bb0");
  root.innerHTML = `<div class="adv-top"><div class="adv-left"><div class="adv-obj" aria-live="polite"><b>Objective</b><span></span></div></div>
    <div class="adv-btns">${cfg.journal ? '<button class="abtn" data-a="journal" title="Journal (J)" aria-label="Journal">📖</button>' : ""}
    <button class="abtn" data-a="sound" title="Sound (M)" aria-label="Toggle sound">🔊</button>
    <button class="abtn" data-a="pause" title="Pause (Esc)" aria-label="Pause">⏸</button></div></div><div class="adv-toasts"></div><div class="adv-fade"></div>`;
  host.append(root);
  const objEl = root.querySelector(".adv-obj span"), toasts = root.querySelector(".adv-toasts"), top = root.querySelector(".adv-top");
  const fadeEl = root.querySelector(".adv-fade");
  let overlay = null, paused = false, running = false;
  const api = {
    root, get paused() { return paused; }, get running() { return running; },
    setRunning(v) { running = v; top.style.display = v ? "" : "none"; },
    objective(t) { objEl.textContent = t; objEl.parentElement.classList.remove("flash"); void objEl.offsetWidth; objEl.parentElement.classList.add("flash"); },
    toast(text, kind = "") {
      const t = el("div", "toast2 " + kind); t.textContent = text; toasts.append(t); while (toasts.children.length > 3) toasts.firstChild.remove();
      setTimeout(() => t.classList.add("out"), 3800); setTimeout(() => t.remove(), 4400);
    },
    // fade the whole view to black (v=true) or back (v=false); resolves when finished
    fade(v, ms = 700) { fadeEl.style.transition = `opacity ${ms}ms ease`; fadeEl.style.opacity = v ? "1" : "0"; return new Promise(r => setTimeout(r, ms + 20)); },
    close() { if (overlay) { overlay.remove(); overlay = null; } },
    _show(html, cls) {
      api.close(); overlay = el("div", "adv-overlay " + (cls || ""), html); root.append(overlay); const b = overlay.querySelector("button"); if (b) setTimeout(() => b.focus({ preventScroll: true }), 30);
      // a Space/Enter still held from reading the last line must not press the button that has just appeared
      const t0 = performance.now(), o = overlay; o.addEventListener("click", e => { if (keyClick(e) && keyHeldSince(t0)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
      return o;
    },
    onButton: null,

    title({ hasSave, onNew, onContinue, onText, onExit, extra = "" }) {
      api.setRunning(false);
      const o = api._show(`<div class="adv-card">${cfg.art ? `<div class="banner" aria-hidden="true">${cfg.art}</div>` : ""}<p class="kicker">${cfg.kicker}</p><h2>${cfg.title}</h2><p class="lead">${cfg.tagline}</p>
        <div class="note">${cfg.note}</div>
        <div class="ctl">${cfg.controls.map(([k, v]) => `<span><kbd>${k}</kbd> ${v}</span>`).join("")}</div>${extra}
        <div class="actions">${hasSave ? '<button class="primary" data-k="cont">Continue</button>' : ""}<button class="${hasSave ? "" : "primary"}" data-k="new">${hasSave ? "New adventure" : "Begin the adventure"}</button>
        ${onText ? '<button data-k="text">Short text version</button>' : ""}<button data-k="exit">Back to the legends</button></div></div>`, "adv-title");
      o.addEventListener("click", e => {
        const k = e.target.closest("button")?.dataset.k; if (!k) return;
        if (k === "cont") onContinue(); else if (k === "new") onNew(); else if (k === "text") onText(); else if (k === "exit") onExit();
      });
      return o;
    },
    loading(frac, msg) {
      if (!overlay || !overlay.classList.contains("adv-loading")) api._show(`<div class="adv-card small"><h3>${cfg.title}</h3><div class="bar"><i></i></div><p class="msg"></p><p class="adv-quote"></p></div>`, "adv-loading");
      { const q = overlay.querySelector(".adv-quote"); if (q && !q.textContent) { try { q.textContent = "“" + nextQuote() + "”"; } catch (e) { /* optional */ } } }
      overlay.querySelector(".bar i").style.width = Math.round(frac * 100) + "%"; overlay.querySelector(".msg").textContent = msg || "";
    },
    pauseMenu({ onResume, onRestart, onExit, onSound, soundOn }) {
      if (paused) return; paused = true;
      const o = api._show(`<div class="adv-card small"><h3>Paused</h3><div class="actions col">
        <button class="primary" data-k="res">Resume</button><button data-k="snd">${soundOn() ? "🔊 Sound: on" : "🔇 Sound: off"}</button>
        <button data-k="rst">Restart the adventure</button><button data-k="exit">Exit to the legends</button></div></div>`, "adv-pause");
      o.addEventListener("click", e => {
        const k = e.target.closest("button")?.dataset.k; if (!k) return;
        if (k === "res") { api.resume(); onResume(); }
        else if (k === "snd") { onSound(); e.target.closest("button").textContent = soundOn() ? "🔊 Sound: on" : "🔇 Sound: off"; }
        else if (k === "rst") { if (confirm("Restart from the beginning? Your saved progress for this adventure will be erased (discovered endings are kept).")) { api.resume(); onRestart(); } }
        else if (k === "exit") { paused = false; onExit(); }
      });
    },
    resume() { paused = false; api.close(); },
    ending({ kicker, title, paragraphs, notes = [], found, total, onReplay, onExit, cls = "", adv = null, endingId = null }) {
      api.setRunning(false);
      // collectible relic: the adventure has ALREADY written this ending to its own save; the Archive re-checks that record before unlocking anything
      let fresh = [], relic = null;
      if (adv) { try { fresh = Archive.recordEnding(adv, endingId); relic = Archive.cardForEnding(adv, endingId); } catch (e) { console.error(e); } }
      const isNew = !!(relic && fresh.some(c => c.id === relic.id)), extra = fresh.filter(c => !relic || c.id !== relic.id);
      const relicHTML = relic && Archive.isUnlocked(relic.id) ? `<div class="relic-note ${isNew ? "is-new" : ""}"><span class="rn-k">${isNew ? "Relic recovered" : "Relic already in your Archive"}</span><b>${esc(relic.name)}</b>${extra.length ? `<em>…and ${extra.map(c => esc(c.name)).join(", ")}</em>` : ""}<button data-k="arch">View the Archive</button></div>` : "";
      const o = api._show(`<div class="adv-card end ${cls}"><p class="kicker">${kicker}</p><h2></h2><div class="story"></div>${notes.length ? '<div class="note"></div>' : ""}${relicHTML}
        <p class="found"></p><div class="actions"><button class="primary" data-k="again">Play again</button><button data-k="exit">Back to the legends</button></div></div>`, "adv-end");
      o.querySelector("h2").textContent = title; const st = o.querySelector(".story");
      paragraphs.forEach(p => { const e = el("p"); e.textContent = p; st.append(e); });
      if (notes.length) { const n = o.querySelector(".note"); notes.forEach(p => { const e = el("p"); e.textContent = p; n.append(e); }); }
      o.querySelector(".found").textContent = `Endings discovered: ${found} / ${total}`;
      const goArchive = () => { onExit(); setTimeout(() => dispatchEvent(new CustomEvent("moe:open-archive")), 80); };
      o.addEventListener("click", e => { const k = e.target.closest("button")?.dataset.k; if (k === "again") onReplay(); else if (k === "exit") onExit(); else if (k === "arch") goArchive(); });
      if (fresh.length) setTimeout(() => { if (o.isConnected) reveal(fresh, { openArchive: goArchive, onDone: () => { const b = o.querySelector("button.primary"); if (b && o.isConnected) b.focus({ preventScroll: true }); } }); }, 1600);
    },
    // wire the top-right buttons
    bind(handlers) { root.addEventListener("click", e => { const b = e.target.closest(".abtn"); if (b && handlers[b.dataset.a]) handlers[b.dataset.a](b); }); },
    setSoundIcon(on) { const b = root.querySelector('[data-a="sound"]'); if (b) b.textContent = on ? "🔊" : "🔇"; },
    dispose() { root.remove(); },
  };
  api.setRunning(false);
  return api;
}
