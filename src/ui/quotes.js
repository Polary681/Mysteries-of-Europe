// RANDOM MYSTERIOUS QUOTES: a small, curated set of ORIGINAL lines (written for this project, attributed to nobody real).
// Shown on the landing page (rotating, while it is in view) and on the curtain that covers the entry into a legend.
// A "bag" kept in sessionStorage avoids repeats within a session until every line has been shown once.
export const QUOTES = [
  "Every map has an edge. The stories live just past it.",
  "Some doors are only locked from the inside of the tale.",
  "The forest does not forget a footstep. It only waits to give it back.",
  "Ink fades; a story told by the fire does not.",
  "What the chronicler could not explain, he wrote down twice.",
  "Listen at dusk: the bells you hear may not be ringing here.",
  "A legend is a truth that lost its way home.",
  "Never count the days under the mountain. They are counting you.",
  "The archive keeps what the world was too busy to remember.",
  "Every candle in this room has outlived the hand that lit it.",
  "Not every light in the trees belongs to a traveller.",
  "Old stories are patient. They wait for the right listener.",
  "Between two villages there is always a third that no one names.",
  "Close the book gently. Something inside is still awake.",
  "The tide keeps the tunes that the living have forgotten.",
  "A sealed letter is a promise that the past is not finished.",
];
const BAG = "moe.quotes.bag";
let mem = null;
const readBag = () => { try { const v = JSON.parse(sessionStorage.getItem(BAG)); if (Array.isArray(v)) return v; } catch (e) { /* blocked */ } return mem || []; };
const writeBag = b => { mem = b; try { sessionStorage.setItem(BAG, JSON.stringify(b)); } catch (e) { /* blocked */ } };
/** the next quote of this session (no repeats until every quote has been shown) */
export function nextQuote() {
  let b = readBag().filter(i => Number.isInteger(i) && i >= 0 && i < QUOTES.length);
  if (!b.length) { b = QUOTES.map((_, i) => i); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } }
  const i = b.shift(); writeBag(b); return QUOTES[i];
}

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** the rotating quote under the landing title. It changes only while the landing page is visible and the tab is shown. */
export function initHeroQuote(hero) {
  const host = hero && hero.querySelector(".hero-content"); if (!host) return;
  const q = document.createElement("p"); q.className = "hero-quote"; q.setAttribute("aria-live", "off");
  q.innerHTML = '<span class="hq-t"></span><span class="hq-a">— from the Archive’s marginalia</span>';
  host.append(q); const t = q.querySelector(".hq-t");
  const show = () => { t.textContent = "“" + nextQuote() + "”"; q.classList.add("on"); };
  let visible = true, timer = 0;
  const tick = () => {
    clearTimeout(timer); timer = setTimeout(() => {
      if (visible && !document.hidden && !reduce()) { q.classList.remove("on"); setTimeout(() => { show(); tick(); }, 900); } else tick();
    }, 16000);
  };
  // first quote once the intro titles have appeared
  setTimeout(() => { show(); tick(); }, hero.classList.contains("ready") || reduce() ? 300 : 3600);
  try { new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero); } catch (e) { /* old browser: keep rotating */ }
}
