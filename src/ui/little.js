// v11.2 — small comforts (all optional, each part fails on its own):
//   a reading-progress thread under the nav, a "back to the top" lantern, a welcome-back note,
//   "read aloud" for the short tales (Web Speech, if the browser has it), the next special night in the footer,
//   and two shortcuts: R = random legend, T = back to the top.
import * as Archive from "../shared/archive.js";
import { NIGHTS } from "./more.js";

const $ = (s, r = document) => r.querySelector(s);
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const guard = f => { try { f(); } catch (e) { console.error(e); } };
const VKEY = "moe.visits.v1";
const busy = t => (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) || ($("#adv") && !$("#adv").hidden) || document.querySelector("dialog[open]");
const toTop = () => scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" });

/* ---------- reading progress + back to the top ---------- */
function initScroll() {
  const bar = document.createElement("div"); bar.className = "lt-progress"; bar.setAttribute("aria-hidden", "true");
  const up = document.createElement("button"); up.type = "button"; up.className = "lt-top"; up.title = "Back to the top (T)";
  up.setAttribute("aria-label", "Back to the top"); up.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/></svg>`;
  up.onclick = toTop; document.body.append(bar, up);
  let raf = 0;
  const paint = () => { raf = 0; const h = document.documentElement.scrollHeight - innerHeight, y = scrollY;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`; up.classList.toggle("on", y > innerHeight * .9); };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  addEventListener("resize", paint); paint();
}

/* ---------- welcome back ---------- */
export function visitNote(prev, now = Date.now()) {
  if (!prev || !prev.last) return null;
  const days = Math.floor((now - prev.last) / 864e5); if (days < 1) return null;
  const when = days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`;
  return `Welcome back, traveller. Your last visit was ${when}; this is visit number ${(prev.n || 1) + 1}.`;
}
function initWelcome() {
  let prev = null; try { prev = JSON.parse(localStorage.getItem(VKEY) || "null"); } catch (e) { /* blocked storage */ }
  const msg = visitNote(prev);
  try { localStorage.setItem(VKEY, JSON.stringify({ n: (prev && prev.n || 0) + (msg || !prev ? 1 : 0), last: Date.now() })); } catch (e) { /* ignore */ }
  if (!msg) return;
  const t = document.createElement("div"); t.className = "lt-toast"; t.setAttribute("role", "status");
  t.innerHTML = `<span>✦ ${msg}</span><button type="button" aria-label="Dismiss">✕</button>`;
  const bye = () => { t.classList.remove("on"); setTimeout(() => t.remove(), 600); };
  t.querySelector("button").onclick = bye; document.body.append(t);
  setTimeout(() => t.classList.add("on"), 1800); setTimeout(bye, 11000);
}

/* ---------- read the short tale aloud ---------- */
function initReadAloud() {
  const S = window.speechSynthesis, dlg = $("#story"); if (!S || !window.SpeechSynthesisUtterance || !dlg) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "lt-say"; b.setAttribute("aria-pressed", "false");
  const label = on => { b.textContent = on ? "■ Stop reading" : "▶ Read aloud"; b.setAttribute("aria-pressed", String(on)); };
  const stop = () => { S.cancel(); label(false); };
  b.onclick = () => {
    if (S.speaking) return stop();
    const txt = [$("#st-title"), $("#st-text")].map(e => e && e.textContent.trim()).filter(Boolean).join(". ");
    if (!txt) return;
    const u = new SpeechSynthesisUtterance(txt); u.lang = "en-GB"; u.rate = .92; u.pitch = .9;
    const v = S.getVoices().find(v => /^en-GB/i.test(v.lang)) || S.getVoices().find(v => /^en/i.test(v.lang)); if (v) u.voice = v;
    u.onend = u.onerror = () => label(false); S.cancel(); S.speak(u); label(true);
  };
  label(false); const t = $("#st-text"); t && t.after(b);
  dlg.addEventListener("close", stop);
  // a new page of the tale stops the old voice
  if (t) new MutationObserver(() => { if (S.speaking) stop(); }).observe(t, { childList: true, characterData: true, subtree: true });
}

/* ---------- the next special night ---------- */
export function nextNight(d = new Date()) {
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let best = null;
  for (const [md, [name]] of Object.entries(NIGHTS)) {
    const [m, day] = md.split("-").map(Number);
    let t = new Date(today.getFullYear(), m - 1, day); if (t < today) t = new Date(today.getFullYear() + 1, m - 1, day);
    const n = Math.round((t - today) / 864e5); if (!best || n < best.days) best = { name, days: n };
  }
  return best;
}
function initNextNight() {
  const f = $("footer"), n = nextNight(); if (!f || !n) return;
  const p = document.createElement("p"); p.className = "lt-next";
  p.innerHTML = n.days === 0 ? `✦ Tonight is <b>${n.name}</b>.` : `✦ Next uncanny night: <b>${n.name}</b>, ${n.days === 1 ? "tomorrow" : `in ${n.days} days`}.`;
  const g = f.querySelector(".gfx"); g ? g.before(p) : f.append(p);
}

/* ---------- shortcuts ---------- */
function initShortcuts() {
  addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || busy(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === "t") { e.preventDefault(); toTop(); }
    else if (k === "r") { const keys = Archive.LEGEND_ORDER; e.preventDefault(); try { window.openLegend(keys[Math.random() * keys.length | 0]); } catch (er) { /* not ready */ } }
  });
}

export function initLittle() { [initScroll, initWelcome, initReadAloud, initNextNight, initShortcuts].forEach(guard); }
