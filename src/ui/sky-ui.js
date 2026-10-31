// The page sky in the DOM: the fixed canvas behind the sections, the constellation labels, and the legend cards that
// summon their constellation (mouse hover, keyboard focus, or the small star button on touch screens).
import { createPageSky } from "../world/page-sky.js";
import { CONSTELLATIONS } from "../world/constellations.js";
import { compass } from "../world/astro.js";

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let sky = null;

export function initPageSky({ hero = null, cards = null } = {}) {
  if (sky) return sky;
  if (/[?&]pagesky=0/.test(location.search)) return null;   // development aid
  const cv = document.createElement("canvas"); cv.className = "page-sky"; cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const labels = {};
  for (const k in CONSTELLATIONS) {
    const C = CONSTELLATIONS[k], el = document.createElement("p"); el.className = "sky-label"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `${C.symbol}<small>${compass(C.az)} · towards ${C.place}</small>`; document.body.append(el); labels[k] = el;
  }
  const getSky = () => { try { const h = window.MOE3D && window.MOE3D.hero; return h && h.isReady && h.isReady() ? h.sky() : null; } catch (e) { return null; } };
  sky = createPageSky(cv, {
    reduce: reduce(), getSky,
    onLabel(pos) { for (const k in pos) { const p = pos[k], el = labels[k]; if (!p) { el.classList.remove("on"); continue; } el.style.left = p.x + "px"; el.style.top = p.y + "px"; el.classList.toggle("on", p.k > 0.6); } },
  });
  if (!sky) { cv.remove(); return null; }
  requestAnimationFrame(() => cv.classList.add("on"));
  // the landing scene covers the whole screen at the top of the page: no need to draw the sky behind it
  if (hero && "IntersectionObserver" in window) new IntersectionObserver(es => sky.setVisible(es[0].intersectionRatio < 0.98), { threshold: [0, 0.98, 1] }).observe(hero);
  // once the 3D sky is ready, follow the exact same night (same time override, same special night)
  const sync = () => { if (getSky()) sky.refresh(); else setTimeout(sync, 800); }; sync();
  if (cards) bindCards(cards);
  return sky;
}

/** legend cards: hover / focus / the star button show the legend's constellation; other cards step back */
export function bindCards(container) {
  const show = (card, on) => {
    const k = card.dataset.legend; if (!sky || !CONSTELLATIONS[k]) return;
    if (on) { sky.show(k); container.classList.add("sky-focus"); card.classList.add("sky-on"); }
    else { sky.hide(k); card.classList.remove("sky-on"); if (!container.querySelector(".sky-on")) container.classList.remove("sky-focus"); }
    const b = card.querySelector(".cf-star"); if (b) b.setAttribute("aria-pressed", on ? "true" : "false");
  };
  container.querySelectorAll(".legend-card,.card[data-legend]").forEach(card => {
    const k = card.dataset.legend; if (!CONSTELLATIONS[k]) return;
    card.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show(card, true); });
    card.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") show(card, false); });
    card.addEventListener("focus", () => show(card, true)); card.addEventListener("blur", () => show(card, false));
    // touch: a small star button toggles the constellation without opening the legend
    const b = document.createElement("span"); b.className = "cf-star"; b.setAttribute("role", "button"); b.setAttribute("tabindex", "-1");
    b.setAttribute("aria-label", `Show the constellation of this legend in the sky (${CONSTELLATIONS[k].symbol})`); b.setAttribute("aria-pressed", "false"); b.textContent = "✦";
    b.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); const on = !card.classList.contains("sky-on"); container.querySelectorAll(".sky-on").forEach(c => c !== card && show(c, false)); show(card, on); });
    b.addEventListener("pointerdown", e => e.stopPropagation());
    card.style.position = card.style.position || ""; card.append(b);
  });
  // a tap anywhere else puts the sky back to rest
  document.addEventListener("pointerdown", e => { if (!e.target.closest || !e.target.closest(".legend-card")) container.querySelectorAll(".sky-on").forEach(c => show(c, false)); }, { passive: true });
}
export const pageSky = () => sky;
