// Cinematic curtain: a fade-through-dark with the legend title, used when entering a legend and when leaving an adventure.
// Never blocks for long: it covers the screen in ~450 ms, then lets the caller swap the view and release it. Any key or click releases it at once.
import { nextQuote } from "./quotes.js";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let cur = null;
/** @returns {Promise<{release:()=>void}>} resolves once the screen is covered (swap the view now, then call release()) */
export function curtain({ kicker = "", title = "", sub = "", color = "#b4c9a8" } = {}) {
  if (cur) { cur.el.remove(); cur = null; }
  const el = document.createElement("div"); el.className = "curtain"; el.style.setProperty("--cc", color); el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="ct-in">${kicker ? `<p class="ct-k">${kicker}</p>` : ""}${title ? `<p class="ct-t">${title}</p>` : ""}${sub ? `<p class="ct-s">${sub}</p>` : ""}<span class="ct-line"></span>${title ? `<p class="ct-q">“${nextQuote()}”</p>` : ""}</div>`;
  document.body.append(el); const me = { el };  cur = me;
  const fast = reduce();
  return new Promise(res => {
    let released = false, minHold = 0;
    const release = () => {
      if (released) return; released = true; removeEventListener("keydown", skip, true); removeEventListener("pointerdown", skip, true);
      const go = () => { el.classList.add("out"); setTimeout(() => { el.remove(); if (cur === me) cur = null; }, fast ? 0 : 520); };
      const wait = Math.max(0, minHold - performance.now()); wait ? setTimeout(go, wait) : go();
    };
    const skip = () => { minHold = 0; release(); };
    addEventListener("keydown", skip, true); addEventListener("pointerdown", skip, true);
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => { el.style.pointerEvents = "none"; minHold = performance.now() + (fast ? 0 : (title ? 900 : 250)); res({ release }); }, fast ? 0 : 460);
  });
}
