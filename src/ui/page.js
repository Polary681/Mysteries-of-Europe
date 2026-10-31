// Page-level polish: header state, scroll-reveal, section highlight and the sound controls.
import * as Amb from "./ambient.js";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initNav() {
  const nav = document.getElementById("nav"); if (!nav) return;
  const onScroll = () => nav.classList.toggle("solid", scrollY > 40); onScroll(); addEventListener("scroll", onScroll, { passive: true });
  const links = [...nav.querySelectorAll("nav a[href^='#']")], map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { links.forEach(a => a.removeAttribute("aria-current")); const a = map.get(e.target.id); if (a) a.setAttribute("aria-current", "true"); } }, { rootMargin: "-45% 0px -50% 0px" });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

export function initReveal() {
  const els = [...document.querySelectorAll(".rv")]; if (!els.length) return;
  if (reduce() || !("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
  els.forEach(e => io.observe(e));
}
/** staggered entrance for freshly built card grids */
export function staggerIn(container) {
  const cards = [...container.querySelectorAll(".cf")]; cards.forEach((c, i) => { c.style.setProperty("--d", (i % 6) * 90 + "ms"); c.classList.add("rv"); });
  initReveal();
}

export function initSound() {
  const b = document.getElementById("snd"), v = document.getElementById("vol"); if (!b || !v) return;
  v.value = Math.round(Amb.state().vol * 100);
  const paint = ({ on, vol }) => { b.setAttribute("aria-pressed", on); b.classList.toggle("on", on); b.querySelector(".snd-t").textContent = on ? "Sound on" : "Sound off"; b.setAttribute("aria-label", on ? "Ambient sound: on. Press to mute." : "Ambient sound: off. Press to turn on."); v.setAttribute("aria-valuetext", Math.round(vol * 100) + " percent"); };
  b.addEventListener("click", () => { Amb.toggle(); }); v.addEventListener("input", () => { Amb.setVolume(v.value / 100); if (!Amb.state().on && v.value > 0) { /* moving the slider never starts sound by itself */ } });
  Amb.onAmbient(paint); paint(Amb.state());
}
