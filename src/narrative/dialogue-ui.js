// Dialogue box shown on top of the live 3D scene: speaker, typewriter text, numbered choices, keyboard + touch friendly.
import { el, keyClick } from "../common.js";

export function createDialogueUI(host, { audio = null } = {}) {
  const root = el("div", "dlg noinput"); root.hidden = true;
  root.innerHTML = `<div class="dlg-name"></div><div class="dlg-text" aria-live="polite"></div><div class="dlg-hint"></div><div class="dlg-choices"></div><div class="dlg-next" aria-hidden="true">▼</div>`;
  host.append(root);
  const nameEl = root.querySelector(".dlg-name"), textEl = root.querySelector(".dlg-text"), hintEl = root.querySelector(".dlg-hint"), choicesEl = root.querySelector(".dlg-choices"), nextEl = root.querySelector(".dlg-next");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let full = "", shown = 0, typing = false, view = null, voice = null, acc = 0, blipAcc = 0, cb = { advance: null, choose: null };
  // Keyboard safety for the choices. The first choice gets the focus (for keyboard and screen-reader users), but Space and
  // Enter are also the "interact / next line" keys: pressed to read on, they used to activate that focused button, so the
  // first answer was taken by accident, every time, with no chance to pick another. Now a choice is taken by a click or
  // tap (or a screen reader), by its number key (1-4), or by Space/Enter only AFTER the player has moved to a choice on
  // purpose with the arrow keys.
  let armed = false, autoFocus = false, choicesAt = 0;
  const api = {
    root, get visible() { return !root.hidden; }, get typing() { return typing; },
    onAdvance(f) { cb.advance = f; }, onChoose(f) { cb.choose = f; },
    // who: {name, role, style}; voice: {pitch, kind}
    show(v, who, vc) {
      view = v; voice = vc || { pitch: 220, kind: "triangle" }; root.hidden = false; root.classList.toggle("narr", !who || who.style === "narr");
      root.classList.toggle("garbled", !!v.garbled);
      nameEl.textContent = who && who.name ? who.name + (who.role ? " · " + who.role : "") : ""; nameEl.hidden = !who || !who.name;
      full = v.text; shown = reduce ? full.length : 0; typing = !reduce; acc = 0; textEl.textContent = reduce ? full : "";
      hintEl.textContent = v.hint ? "You catch a few words: " + v.hint : (v.garbled ? "You cannot understand what they are saying." : ""); hintEl.hidden = !hintEl.textContent;
      choicesEl.innerHTML = ""; nextEl.style.display = "none"; if (!typing) api._finish();
    },
    _finish() {
      typing = false; shown = full.length; textEl.textContent = full;
      if (!view) return;
      if (view.choices.length) {
        choicesEl.innerHTML = "";
        armed = false; choicesAt = performance.now();
        view.choices.forEach((c, i) => { const b = el("button", "dlg-c"); b.type = "button"; b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`; b.lastChild.textContent = c.label;
          b.onclick = e => {
            e.stopPropagation();
            // a click made by Space/Enter never picks here (those keys read on; a deliberate pick by keyboard goes through
            // the keydown handler below, after ↑/↓). Mouse, touch, screen readers and the number keys are unaffected.
            if (keyClick(e)) { e.preventDefault(); return; }
            api.pick(i);
          };
          choicesEl.append(b); });
        const f = choicesEl.querySelector("button"); if (f) { autoFocus = true; f.focus({ preventScroll: true }); autoFocus = false; }
      } else nextEl.style.display = "block";
    },
    skip() { if (typing) { api._finish(); return true; } return false; },
    // interact key / click on the text: finish typing, or advance when there is nothing to choose
    press() {
      if (!api.visible || !view) return;
      if (api.skip()) return;
      if (!view.choices.length && cb.advance) cb.advance();
    },
    pick(i) { if (!api.visible || !view || typing) { if (typing) api.skip(); return; } if (view.choices[i] && cb.choose) { audio && audio.click(); cb.choose(i); } },
    pickNum(n) { api.pick(n - 1); },
    hide() { root.hidden = true; view = null; typing = false; choicesEl.innerHTML = ""; },
    tick(dt) {
      if (!typing) return; acc += dt * 58; const n = Math.min(full.length, Math.floor(acc));
      if (n > shown) {
        const slice = full.slice(shown, n); shown = n; textEl.textContent = full.slice(0, shown);
        blipAcc += slice.length; if (audio && voice.pitch && blipAcc >= 3 && !/\s/.test(slice.slice(-1))) { blipAcc = 0; audio.blip(voice.pitch, 0.022, voice.kind); }
        if (/[.!?…]/.test(slice.slice(-1))) acc -= 6; // short pause after sentences
      }
      if (shown >= full.length) api._finish();
    },
    dispose() { root.remove(); },
  };
  root.addEventListener("click", e => { if (e.target.closest("button")) return; api.press(); });
  // moving between the choices (arrows, Tab, a screen reader) arms them: from then on Space/Enter take the focused one
  choicesEl.addEventListener("focusin", () => { if (!autoFocus) armed = true; });
  choicesEl.addEventListener("keydown", e => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const bs = [...choicesEl.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
      e.preventDefault(); e.stopPropagation();   // never the browser's own activation (it would ignore the rules above)
      if (i >= 0 && armed && performance.now() - choicesAt > 400) api.pick(i);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const bs = [...choicesEl.querySelectorAll("button")], i = bs.indexOf(document.activeElement); if (!bs.length) return;
    e.preventDefault(); e.stopPropagation(); armed = true;
    bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus({ preventScroll: true });
  });
  return api;
}
