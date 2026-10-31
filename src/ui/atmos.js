// ATMOSPHERE: interactive candles and floating dust, both pure CSS animation.
// Nothing runs while it is off screen: an ancestor gets .atmos-on only while it is in view (IntersectionObserver), and the
// CSS animations are paused otherwise. prefers-reduced-motion: flames stand still and the dust is not drawn at all.
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let io = null;
/** animate el's candles/dust only while el is (nearly) on screen */
export function watch(el) {
  if (!el || el._atmos) return; el._atmos = true;
  if (!("IntersectionObserver" in window)) { el.classList.add("atmos-on"); return; }
  io = io || new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("atmos-on", e.isIntersecting)), { rootMargin: "60px" });
  io.observe(el);
}

/** a small candle. Click (or Enter/Space) snuffs it with a wisp of smoke; again relights it. size: "" | "sm" */
export function candle({ size = "", height = 1 } = {}) {
  const b = document.createElement("button"); b.type = "button"; b.className = "candle" + (size ? " " + size : "");
  b.style.setProperty("--ch", height); b.style.setProperty("--cd", (Math.random() * -3).toFixed(2) + "s");
  b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", "Snuff the candle");
  b.innerHTML = `<span class="c-glow" aria-hidden="true"></span><span class="c-flame" aria-hidden="true"><i></i></span><span class="c-smoke" aria-hidden="true"></span><span class="c-wick" aria-hidden="true"></span><span class="c-body" aria-hidden="true"></span><span class="c-dish" aria-hidden="true"></span>`;
  b.addEventListener("click", () => {
    const out = !b.classList.contains("out"); b.classList.toggle("out", out); b.setAttribute("aria-pressed", out ? "true" : "false");
    b.setAttribute("aria-label", out ? "Light the candle" : "Snuff the candle");
    if (out && !reduce()) { b.classList.remove("smoking"); void b.offsetWidth; b.classList.add("smoking"); setTimeout(() => b.classList.remove("smoking"), 2600); }
  });
  return b;
}

/** a handful of motes drifting in el (absolute layer, no pointer events). n is halved on small screens */
export function dust(el, n = 14) {
  if (!el || el.querySelector(":scope > .dust")) return;
  const layer = document.createElement("div"); layer.className = "dust"; layer.setAttribute("aria-hidden", "true");
  const count = innerWidth < 700 ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const m = document.createElement("i"), r = Math.random;
    m.style.cssText = `left:${(r() * 96 + 2).toFixed(1)}%;top:${(r() * 86 + 6).toFixed(1)}%;--s:${(1 + r() * 2.2).toFixed(2)}px;--o:${(.18 + r() * .4).toFixed(2)};--dx:${(r() * 60 - 30).toFixed(0)}px;--dy:${(-30 - r() * 70).toFixed(0)}px;--t:${(16 + r() * 16).toFixed(1)}s;--d:${(-r() * 30).toFixed(1)}s`;
    layer.append(m);
  }
  el.prepend(layer); watch(el);
}
