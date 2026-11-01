// v11 — small additions: short map tales, random legend / legend of the day, special nights, keyboard help (?),
// progress tools (export / import / start over), sources, and THE SIBYL'S ORACLE (a three-card reading).
import * as Archive from "../shared/archive.js";
import { BESTIARY } from "../shared/lore.js";
import { sceneSVG, logoMark } from "./art.js";
import { beastArt } from "./bestiary-art.js";
import { esc } from "./cards.js";

const $ = (s, r = document) => r.querySelector(s);
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const openLeg = (k, o) => { try { window.openLegend(k, o); } catch (e) { /* main.js not ready */ } };
const SIGN = '<p class="mx-sign">— A.</p>';

function dialog(cls, html) {
  const d = document.createElement("dialog"); d.className = "mx " + cls;
  d.innerHTML = `<div class="mx-box"><button type="button" class="close mx-x" aria-label="Close">✕</button>${html}</div>`;
  d.querySelector(".mx-x").onclick = () => d.close();
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
  d.addEventListener("close", () => d.remove());
  document.body.append(d); d.showModal(); return d;
}

/* ---------- SHORT TALES on the map (countries without an adventure) ---------- */
const TALES = {
  PL: { t: "The Wawel Dragon", p: "Kraków · Poland", i: "W", src: "First written down by Wincenty Kadłubek in his <i>Chronica Polonorum</i> (c. 1200), where King Krak’s sons kill the dragon; the shoemaker version appears in Marcin Bielski’s chronicle (16th century).", x: [
    "In a cave beneath Wawel Hill, above the river Vistula, there lived a dragon. Every week the people of Kraków left cattle and sheep at its door, and when the flocks ran out, the dragon asked for worse.",
    "King Krak promised his daughter to whoever could kill it. Knights came in shining armour and did not come back. Then a shoemaker’s apprentice, Skuba, sewed a lamb’s skin around a bellyful of sulphur and left it at the mouth of the cave.",
    "The dragon swallowed it whole. The sulphur burned inside it, so it drank from the Vistula, and drank, and drank, until it burst. Skuba married the princess.",
    "The cave, the Smocza Jama, can still be visited. At its exit a bronze dragon breathes real fire every few minutes."] },
  DE: { t: "The Pied Piper of Hamelin", p: "Hamelin, Lower Saxony · Germany", i: "H", src: "The oldest record was a church window in Hamelin (c. 1300, now lost) mentioning 130 children lost in 1284; the Lüneburg manuscript (c. 1440–50) tells it in words. The rats were only added in the 16th century. The Brothers Grimm included it in <i>Deutsche Sagen</i> (1816).", x: [
    "In 1284 a stranger in a coat of many colours walked into Hamelin and offered, for a price, to free the town of its rats. He played a tune on his pipe, and every rat came out of the walls and followed him into the river Weser, where they drowned.",
    "The townspeople refused to pay.",
    "On the feast of Saints John and Paul he came back, dressed as a hunter, and played again. This time the children followed: a hundred and thirty of them, out of the gate and into a mountain that closed behind them. Only two stayed behind, one lame and one blind.",
    "To this day, in Hamelin’s Bungelosenstraße, the street where the children were last seen, no music may be played."] },
  IS: { t: "The Hidden People", p: "Across Iceland", i: "H", src: "Hundreds of tales of the <i>huldufólk</i> were collected by Jón Árnason in <i>Íslenzkar þjóðsögur og æfintýri</i> (1862–64), including the story of Hildur the elf queen.", x: [
    "The <i>huldufólk</i>, the hidden people, live inside rocks and hills. They look like us, dress in old-fashioned clothes, keep sheep and go to church. Most people never see them; some leave a candle burning in the window on New Year’s Eve, the night they move house.",
    "One tale tells of a farm where, every Christmas Eve, the man left at home to guard it was found mad or dead the next morning. At last a shepherd pretended to sleep, and saw the housekeeper, Hildur, slip away to a great feast under the earth. She was an elf queen, cursed to live among people.",
    "The belief is not only in old books. In Iceland, road builders have changed their plans when locals warned that a rock in the way was home to elves."] },
};
function openTale(code) {
  const t = TALES[code]; if (!t) return;
  dialog("mx-tale", `<p class="st-kicker">${t.p} · a short tale</p><h3>${t.t}</h3>${t.x.map(p => `<p>${p}</p>`).join("")}<p class="mx-src"><b>Where it comes from.</b> ${t.src}</p>${SIGN}`);
}
function initTales() {
  addEventListener("moe:select", e => {
    const code = e.detail && e.detail.country, t = TALES[code], pv = $("#preview"); if (!t || !pv) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "mini mx-mini";
    b.innerHTML = `<span class="mini-art mx-ini" aria-hidden="true">${t.i}</span><span><b>${t.t}</b><small>Read the short tale</small></span>`;
    b.onclick = () => openTale(code); pv.append(b);
  });
}

/* ---------- RANDOM LEGEND / LEGEND OF THE DAY ---------- */
function initRandom() {
  const sub = $("#leggende .sub"); if (!sub) return;
  const keys = Archive.LEGEND_ORDER, d = new Date(), day = Math.floor((d - d.getTimezoneOffset() * 6e4) / 864e5), k = keys[day % keys.length];
  const row = document.createElement("div"); row.className = "mx-row rv";
  row.innerHTML = `<button type="button" class="btn btn-ghost mx-rand">⚄ Random legend</button><span class="mx-day">Legend of the day: <a href="#legend/${k}">${esc(Archive.LEGENDS[k].title)}</a></span>`;
  row.querySelector(".mx-rand").onclick = e => openLeg(keys[Math.random() * keys.length | 0], e.currentTarget);
  sub.after(row);
}

/* ---------- SPECIAL NIGHTS (real date; test with ?date=10-31) ---------- */
export const NIGHTS = {
  "10-31": ["Samhain · All Hallows’ Eve", "In the old Celtic year, summer ends tonight and the dead walk close to the living. Leave a light in the window."],
  "11-1": ["All Saints · the night after Samhain", "The veil is closing again. Whatever crossed over last night has until dawn to find its way back."],
  "11-2": ["All Souls’ Day", "Across Europe, candles are lit on the graves tonight. The Archive lights one too."],
  "4-30": ["Walpurgis Night", "Tonight, says German folklore, the witches ride to the Brocken in the Harz. Bonfires keep them away."],
  "6-23": ["St John’s Eve", "The shortest night. They say the fern blooms only now, and whoever finds the flower understands the speech of animals."],
};
function initNights() {
  const q = new URLSearchParams(location.search).get("date"), d = new Date();
  const n = NIGHTS[q || `${d.getMonth() + 1}-${d.getDate()}`], host = $(".hero-content"); if (!n || !host) return;
  document.documentElement.classList.add("mx-night");
  const p = document.createElement("p"); p.className = "mx-nightpill"; p.innerHTML = `<b>✦ ${n[0]}</b><span>${n[1]}</span>`;
  host.prepend(p);
}

/* ---------- KEYBOARD HELP ---------- */
const KEYS = [["Anywhere", [["?", "Show this list"], ["Esc", "Close a window or leave a legend"], ["Tab", "Move between links and buttons"]]],
  ["Legends & Archive", [["R", "Open a random legend"], ["T", "Back to the top"], ["B", "Bookmark the focused legend card"], ["← →", "Turn the pages of the Traveller’s Journal"]]],
  ["3D adventures", [["W A S D / arrows", "Move (Shift to run)"], ["E / Space", "Interact, talk, next line"], ["1–4", "Choose an answer"], ["J / Tab", "Journal, codex and hints"], ["L (hold)", "Listen (Skye)"], ["M", "Mute"], ["Esc", "Pause"]]]];
function openKeys() {
  if ($("dialog.mx-keys")) return;
  dialog("mx-keys", `<p class="st-kicker">The Archive’s</p><h3>Keyboard shortcuts</h3>${KEYS.map(([h, l]) => `<h4>${h}</h4><dl>${l.map(([k, v]) => `<div><dt>${k.split(" / ").map(x => `<kbd>${x}</kbd>`).join(" / ")}</dt><dd>${v}</dd></div>`).join("")}</dl>`).join("")}`);
}
function initKeys() {
  addEventListener("keydown", e => {
    if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const adv = $("#adv"); if (adv && !adv.hidden) return;
    if (document.querySelector("dialog[open]:not(.mx-keys)")) return;
    e.preventDefault(); openKeys();
  });
}

/* ---------- PROGRESS: export / import / start over ---------- */
const KEEP = ["moe.quality.v1", "moe.ambient.v1"];  // preferences survive "start over"
const moeKeys = () => { const r = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("moe.")) r.push(k); } } catch (e) { /* blocked */ } return r; };
function exportSave() {
  const data = {}; moeKeys().forEach(k => { data[k] = localStorage.getItem(k); });
  const blob = new Blob([JSON.stringify({ app: "mysteries-of-europe", v: 1, at: new Date().toISOString(), data }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mysteries-of-europe-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importSave(file) {
  const r = new FileReader();
  r.onload = () => {
    let j; try { j = JSON.parse(r.result); } catch (e) { j = null; }
    if (!j || j.app !== "mysteries-of-europe" || !j.data || typeof j.data !== "object") { alert("This file is not a Mysteries of Europe save."); return; }
    if (!confirm("Load this save? Your current progress in this browser will be replaced.")) return;
    try { moeKeys().forEach(k => localStorage.removeItem(k)); Object.entries(j.data).forEach(([k, v]) => { if (k.startsWith("moe.") && typeof v === "string") localStorage.setItem(k, v); }); } catch (e) { alert("The browser blocked saving."); return; }
    location.reload();
  };
  r.readAsText(file);
}
function startOver() {
  if (!confirm("Start over? Every ending, relic, bookmark and journal page saved in this browser will be erased. (Tip: export your progress first.)")) return;
  try { moeKeys().filter(k => !KEEP.includes(k)).forEach(k => localStorage.removeItem(k)); sessionStorage.removeItem("moe.intro"); } catch (e) { /* blocked */ }
  location.href = location.pathname;
}

/* ---------- SOURCES ---------- */
const SOURCES = [
  ["The Green Children of Woolpit", "William of Newburgh, <i>Historia rerum Anglicarum</i> (c. 1198) and Ralph of Coggeshall, <i>Chronicon Anglicanum</i> (c. 1220s): the two medieval chronicles that report the children."],
  ["The Hoia Baciu Forest", "Reports from the 1960s–70s: the photographs of biologist Alexandru Sift and the 1968 “UFO” photograph by Emil Barnea. No scientific study has confirmed anything unusual; the strange shapes of the trees are attributed to wind and soil."],
  ["The Ghost Pianist of the Isle of Skye", "An original story written for this project, inspired by the ghost lore of the Hebrides and by the oral tradition collected in Scotland (e.g. the School of Scottish Studies’ <i>Tobar an Dualchais</i> archive)."],
  ["Baba Yaga’s Hut", "Alexander Afanasyev, <i>Narodnye russkie skazki</i> (Russian Fairy Tales, 1855–1863), especially “Vasilisa the Beautiful”; Ivan Bilibin’s illustrations (1899–1900)."],
  ["The Sibyl of the Apennines", "Andrea da Barberino, <i>Guerrin Meschino</i> (c. 1410) and Antoine de la Sale, <i>Le Paradis de la reine Sibylle</i> (1430s), who visited Monte Sibilla himself."],
  ["Elizabeth Báthory", "The testimonies of the 1610–1611 investigation ordered by the Palatine György Thurzó. The famous blood baths first appear in László Turóczi’s <i>Tragica Historia</i> (1729), more than a century later. Modern studies: Tony Thorne, <i>Countess Dracula</i> (1997); Kimberly L. Craft, <i>Infamous Lady</i> (2009)."],
  ["Short tales & Bestiary", "Wincenty Kadłubek, <i>Chronica Polonorum</i>; the Brothers Grimm, <i>Deutsche Sagen</i> (1816); Jón Árnason, <i>Íslenzkar þjóðsögur og æfintýri</i> (1862–64); Katharine Briggs, <i>A Dictionary of Fairies</i> (1976)."],
  ["Data", "Borders: Natural Earth (public domain). Stars: Yale Bright Star Catalogue. 3D: three.js."]];
function openSources() {
  dialog("mx-sources", `<p class="st-kicker">Where the stories come from</p><h3>Sources & further reading</h3><dl>${SOURCES.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("")}</dl><p class="mx-src">Folklore, history and invention are kept apart on every case file: the Archive marks each legend as historical, folklore, mixed or invented.</p>${SIGN}`);
}

function initFooter() {
  const f = $("footer"); if (!f) return;
  const p = document.createElement("p"); p.className = "mx-tools";
  p.innerHTML = `<button type="button" data-a="src">Sources</button> · <button type="button" data-a="keys">Keyboard shortcuts <kbd>?</kbd></button> · <span>Your progress:</span> <button type="button" data-a="exp">Export</button> <button type="button" data-a="imp">Import</button> <button type="button" data-a="reset" class="mx-danger">Start over</button><input type="file" accept="application/json,.json" hidden>`;
  const inp = p.querySelector("input");
  inp.onchange = () => { if (inp.files[0]) importSave(inp.files[0]); inp.value = ""; };
  p.onclick = e => { const a = e.target.closest("button") && e.target.closest("button").dataset.a;
    ({ src: openSources, keys: openKeys, exp: exportSave, imp: () => inp.click(), reset: startOver })[a]?.(); };
  const g = f.querySelector(".gfx"); g ? g.before(p) : f.append(p);
}

/* ---------- THE SIBYL'S ORACLE ---------- */
const MEAN = {
  "L:woolpit": ["A stranger arrives speaking a language nobody knows. Welcome what is different: it may be the one who stays.", "Green fading to ordinary. A gift is lost when you try to make it like everything else."],
  "L:hoia": ["A clearing where nothing grows: a pause you need. Stand still and the path will show itself.", "Lost hours among the trees. Count your time before someone else does."],
  "L:skye": ["A tune that keeps playing after the player has gone. Something unfinished asks to be finished.", "Silence in an empty house. Stop waiting for an answer that will not come."],
  "L:babayaga": ["The hut turns to face you. A hard test, fairly given: be polite, work, ask only the right questions.", "Running with a comb and a towel. You can escape, but not by looking back."],
  "L:sibilla": ["A door in the mountain and a queen who promises everything. Desire, and its price.", "A red thread tightening on the wrist. Leave before the year is up."],
  "L:bathory": ["A truth buried under centuries of rumour. Do not believe the loudest version of a story.", "Power that devours. Something kept behind walls wants to be said aloud."],
  "B:babayaga": ["The old woman of the forest: wisdom that frightens because it is honest.", "Skulls on the fence. A warning already ignored once."],
  "B:leshy": ["The master of the forest leads you in circles. Turn your coat inside out: change how you look at it.", "Lost, and shouting about it. The forest only answers silence."],
  "B:fate": ["Dancers with hidden hooves. Charm hides something, and one night’s feast may cost a lifetime.", "Dawn breaks the dance. Leave the party while you still can."],
  "B:wisp": ["A light over the marsh: a hope worth following, carefully.", "A false light. What glows ahead is not a lantern."],
  "B:fairfolk": ["The Good Neighbours: courtesy pays. Keep your promises, and the milk on the step.", "A changeling in the cradle: something familiar has been swapped."],
  "B:blackshuck": ["A black dog walking beside you: a protector who frightens.", "Eyes like coals in the church door: the storm you saw coming."],
  "B:eachuisge": ["A beautiful horse by the loch: an offer too good to be true. Do not climb on.", "Stuck to the saddle. Let go of what is dragging you under."],
  "B:strigoi": ["Something that will not rest: an old matter returns. Finish it this time.", "A restless sleeper: your own worry walks at night."],
  "B:upir": ["The village revenant: a past that feeds on the present.", "The grave opened, the fear named. Seen clearly, it weakens."],
  "B:banshee": ["A keening in the night: news is coming. Listen; it concerns someone you love.", "A comb on the path. Do not pick up what was left as a warning."],
  "B:brocken": ["Witches gathering on the mountain: call your people, the season is changing.", "The Brocken spectre: a giant in the mist that is only your own shadow."],
};
const POS = ["What was", "What is", "What will be"];
const CLOSE = ["Three cards upright. The mountain is open to you, traveller. For now.", "One card stands on its head. Mind it: it is the one that will matter.", "Two cards reversed. Go back the way you came, and go slowly.", "All three upside down. Even I would not walk into this year without a lantern."];
const deck = () => [
  ...Archive.LEGEND_ORDER.map(k => ({ id: "L:" + k, name: Archive.LEGENDS[k].title, art: () => sceneSVG(k), c: Archive.LEGENDS[k].color, leg: k, known: ["completed", "mastered"].includes(Archive.legendStatus(k).state) })),
  ...BESTIARY.filter(b => MEAN["B:" + b.id]).map(b => ({ id: "B:" + b.id, name: b.name, art: () => beastArt(b.id), c: "#d6c07e", leg: ((b.links || []).find(l => l.legend) || {}).legend })),
];
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let actx = null;
function chime(i) {
  const s = $("#snd"); if (!s || s.getAttribute("aria-pressed") !== "true") return;
  try { actx = actx || new AudioContext(); const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = [523.25, 659.25, 783.99][i] || 440; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1.7); } catch (e) { /* no audio */ }
}
function initOracle() {
  const host = $("#oracle"); if (!host) return;
  host.innerHTML = `<form class="or-ask"><input type="text" maxlength="120" placeholder="Your question (optional) — the Sibyl answers each question once a day" aria-label="Your question for the Sibyl"><button class="btn btn-primary" type="submit">Draw three cards</button></form>
    <div class="or-table"><div class="or-deck" aria-hidden="true">${"<i></i>".repeat(4)}</div><div class="or-slots"></div></div><div class="or-read" aria-live="polite"></div>`;
  const form = host.querySelector("form"), slots = host.querySelector(".or-slots"), read = host.querySelector(".or-read"), btn = form.querySelector("button");
  let busy = false;
  form.onsubmit = e => {
    e.preventDefault(); if (busy) return; busy = true; btn.disabled = true;
    const q = form.querySelector("input").value.trim().toLowerCase(), now = new Date();
    const R = q ? rng(hash(q + "|" + now.toDateString())) : Math.random;
    const d = deck(); for (let i = d.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
    const pick = d.slice(0, 3).map(c => ({ ...c, rev: R() < .33 }));
    read.innerHTML = ""; host.classList.add("shuffling");
    slots.innerHTML = pick.map((c, i) => `<div class="or-card${c.id[0] === "B" ? " beast" : ""}${c.rev ? " rev" : ""}${c.known ? " known" : ""}" style="--cc:${c.c};--i:${i}"><div class="or-in">
      <div class="or-face or-back">${logoMark()}</div>
      <div class="or-face or-front"><span class="or-pos">${POS[i]}</span><div class="or-art">${c.art()}</div><b>${esc(c.name)}</b>${c.rev ? "<small>reversed</small>" : ""}${c.known ? '<em class="or-known">Known to you</em>' : ""}</div></div></div>`).join("");
    const fast = reduce(), cards = [...slots.children], T0 = fast ? 0 : 900, DT = fast ? 0 : 750;
    setTimeout(() => host.classList.remove("shuffling"), T0);
    cards.forEach((el, i) => setTimeout(() => { el.classList.add("flip"); chime(i); }, T0 + 250 + i * DT));
    setTimeout(() => {
      const nrev = pick.filter(c => c.rev).length, lines = pick.map((c, i) => `${POS[i]} — ${c.name}${c.rev ? " (reversed)" : ""}: ${MEAN[c.id][c.rev ? 1 : 0]}`);
      read.innerHTML = `<ol>${pick.map((c, i) => `<li style="--cc:${c.c}"><span class="or-pos">${POS[i]}</span><b>${esc(c.name)}${c.rev ? " <small>reversed</small>" : ""}</b><p>${esc(MEAN[c.id][c.rev ? 1 : 0])}</p>${c.leg ? `<button type="button" class="or-go" data-k="${c.leg}">${c.known ? "Walk this road again" : "Follow this thread"} → ${esc(Archive.LEGENDS[c.leg].title)}</button>` : ""}</li>`).join("")}</ol>
        <p class="or-close">“${CLOSE[nrev]}”${pick.some(c => c.known) ? " You have walked one of these roads before; the card remembers you." : ""}</p><p class="mx-sign">— the Sibyl, under the mountain</p>
        <p class="or-acts"><button type="button" class="btn btn-ghost or-copy">Copy the prophecy</button> <button type="button" class="btn btn-ghost or-again">Shuffle again</button></p>`;
      read.querySelectorAll(".or-go").forEach(b => b.onclick = () => openLeg(b.dataset.k, b));
      read.querySelector(".or-again").onclick = () => { form.querySelector("input").value = ""; form.requestSubmit(); };
      read.querySelector(".or-copy").onclick = e => { const txt = `The Sibyl’s Oracle${q ? ` — “${form.querySelector("input").value.trim()}”` : ""}\n\n${lines.join("\n\n")}\n\n“${CLOSE[nrev]}”\n— Mysteries of Europe`;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { e.target.textContent = "Copied ✓"; }, () => { e.target.textContent = "Copy not allowed here"; }); };
      busy = false; btn.disabled = false; btn.textContent = "Draw again";
    }, T0 + 250 + 2 * DT + (fast ? 0 : 700));
  };
}

const guard = f => { try { f(); } catch (e) { console.warn("[more]", e); } };
export function initMore() { [initTales, initRandom, initNights, initKeys, initFooter, initOracle].forEach(guard); }
export { openSources, openKeys };
