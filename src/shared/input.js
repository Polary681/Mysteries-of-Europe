// Unified input for the 3D adventures: keyboard, mouse-drag look (+ optional pointer lock), touch joystick and on-screen buttons.
import { el } from "../common.js";

const ACTIONS = {
  KeyE: "interact", Space: "interact", Enter: "interact", NumpadEnter: "interact",
  KeyJ: "journal", Tab: "journal", Escape: "pause", KeyP: "pause", KeyM: "mute", KeyH: "hint",
};
const isUI = t => t && t.closest && t.closest("button,input,.panel,.dlg,.keys,.adv-overlay,.journal,.noinput");

export function createInput(host, { pointerLock = false, lookSpeed = 0.0042 } = {}) {
  const keys = new Set(), listeners = new Set();
  let look = { dx: 0, dy: 0 }, joy = { x: 0, y: 0 }, enabled = true, locked = false, touchSeen = false, lastEsc = -1e9;
  const fire = (a, extra) => listeners.forEach(f => f(a, extra));

  /* ----- keyboard ----- */
  const kd = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!host.isConnected || host.closest("[hidden]")) return;
    const code = e.code;
    if (/^(Arrow|Space|Tab)/.test(code)) e.preventDefault();
    if (e.repeat) { if (code === "KeyL") return; }
    keys.add(code); if (code === "Escape") lastEsc = performance.now();
    const a = ACTIONS[code]; if (a && !e.repeat) fire(a);
    if (code === "KeyL" && !e.repeat) fire("listen", true);
    if (/^(Digit|Numpad)[1-9]$/.test(code) && !e.repeat) fire("num", +code.slice(-1));
    if (!e.repeat) fire("key", code);
  };
  const ku = e => { keys.delete(e.code); if (e.code === "KeyL") fire("listen", false); fire("keyup", e.code); };
  const blur = () => { keys.clear(); joy = { x: 0, y: 0 }; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);

  /* ----- pointer: mouse drag look, touch joystick (left) + look (right) ----- */
  const touch = el("div", "tctl"); touch.innerHTML = '<div class="joy-base"><i></i></div>';
  const joyBase = touch.firstChild, joyKnob = joyBase.firstChild; host.append(touch);
  if (matchMedia("(pointer:coarse)").matches || "ontouchstart" in window) { touchSeen = true; host.classList.add("touch"); }
  let drag = null, jp = null, jo = null;
  const pd = e => {
    if (isUI(e.target)) return;
    const r = host.getBoundingClientRect();
    if (e.pointerType === "touch") {
      touchSeen = true; host.classList.add("touch");
      if (e.clientX - r.left < r.width * 0.45 && jp == null) { jp = e.pointerId; jo = [e.clientX, e.clientY]; joyBase.style.display = "block"; touch.classList.add("used"); joyBase.style.left = e.clientX - r.left - 55 + "px"; joyBase.style.top = e.clientY - r.top - 55 + "px"; return; }
    }
    if (pointerLock && e.pointerType === "mouse" && !locked && host.requestPointerLock) { try { host.requestPointerLock(); } catch (er) { /* fall back to drag */ } }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const pm = e => {
    if (e.pointerId === jp) {
      let dx = e.clientX - jo[0], dy = e.clientY - jo[1]; const l = Math.hypot(dx, dy), m = 52; if (l > m) { dx = dx / l * m; dy = dy / l * m; }
      joy = { x: dx / m, y: -dy / m }; joyKnob.style.transform = `translate(${dx}px,${dy}px)`; return;
    }
    if (locked) return; // handled by mousemove below
    if (drag && drag.id === e.pointerId) { look.dx += (e.clientX - drag.x) * lookSpeed * (e.pointerType === "touch" ? 1.25 : 1); look.dy += (e.clientY - drag.y) * lookSpeed * (e.pointerType === "touch" ? 1.25 : 1); drag.x = e.clientX; drag.y = e.clientY; }
  };
  const pu = e => {
    if (e.pointerId === jp) { jp = null; joy = { x: 0, y: 0 }; joyBase.style.display = "none"; joyKnob.style.transform = ""; }
    if (drag && drag.id === e.pointerId) drag = null;
  };
  const mm = e => { if (locked) { look.dx += e.movementX * lookSpeed; look.dy += e.movementY * lookSpeed; } };
  const plc = () => { const was = locked; locked = document.pointerLockElement === host; if (was && !locked && performance.now() - lastEsc > 400) fire("pause"); };
  host.addEventListener("pointerdown", pd); window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu); window.addEventListener("pointercancel", pu);
  document.addEventListener("mousemove", mm); document.addEventListener("pointerlockchange", plc);

  /* ----- on-screen buttons (touch) ----- */
  const btns = el("div", "tbtns"); host.append(btns);
  const buttons = {};
  const addButton = (id, label, { hold = false, cls = "" } = {}) => {
    const b = el("button", "tbtn " + cls, label); b.type = "button"; b.dataset.id = id; btns.append(b); buttons[id] = b;
    const down = e => { e.preventDefault(); e.stopPropagation(); b.classList.add("on"); fire(id, hold ? true : undefined); if (hold) fire("listen", true); };
    const up = e => { e.preventDefault(); b.classList.remove("on"); if (hold) { fire(id, false); fire("listen", false); } };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    return b;
  };

  const api = {
    get enabled() { return enabled; }, set enabled(v) { enabled = v; if (!v) { look = { dx: 0, dy: 0 }; } },
    get locked() { return locked; }, get touch() { return touchSeen || matchMedia("(pointer:coarse)").matches; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    held: code => keys.has(code),
    move() { // x = strafe right, y = forward
      if (!enabled) return { x: 0, y: 0 };
      let x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0) + joy.x, y = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) + joy.y;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } return { x, y };
    },
    turn() { return enabled ? (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0) : 0; },
    running() { return keys.has("ShiftLeft") || keys.has("ShiftRight") || Math.hypot(joy.x, joy.y) > 0.92; },
    takeLook() { const l = look; look = { dx: 0, dy: 0 }; return enabled ? l : { dx: 0, dy: 0 }; },
    addButton, buttons,
    releaseLock() { lastEsc = performance.now(); if (document.pointerLockElement) document.exitPointerLock(); },
    dispose() {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur);
      host.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); window.removeEventListener("pointercancel", pu);
      document.removeEventListener("mousemove", mm); document.removeEventListener("pointerlockchange", plc);
      if (document.pointerLockElement) document.exitPointerLock(); touch.remove(); btns.remove(); listeners.clear();
    },
  };
  return api;
}
