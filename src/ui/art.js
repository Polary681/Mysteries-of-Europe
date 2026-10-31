// Procedural artwork (pure functions that return SVG strings). No image files, no network, no licences to track.
// Everything is deterministic (seeded), so a card always looks the same.
//   heroLayers()          -> the cinematic landscape of the landing page, split in parallax layers (viewBox 1600x900)
//   sceneSVG(key)         -> a 400x300 "plate" for each legend: woolpit | hoia | skye | babayaga | sibilla | bathory
//   relicArt(card)        -> 400x300 artwork of a relic (legend palette + engraved emblem)
//   sealedArt(legend)     -> the sealed silhouette shown while a card is locked
//   logoMark()            -> the compass-rose mark used in the header

const IVORY = "#e9e1cb";
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const n1 = v => Math.round(v * 10) / 10;
const pts = a => a.map(p => n1(p[0]) + "," + n1(p[1])).join(" L");

/** midpoint-displacement ridge line across [0..W] */
function ridge(r, W, base, amp, rough = 0.55, pow = 7) {
  const N = 1 << pow, ys = new Array(N + 1).fill(0); ys[0] = (r() - .5) * amp; ys[N] = (r() - .5) * amp;
  let d = amp, s = N;
  while (s > 1) { for (let i = s / 2; i < N; i += s) ys[i] = (ys[i - s / 2] + ys[i + s / 2]) / 2 + (r() - .5) * d; d *= rough; s /= 2; }
  return ys.map((y, i) => [i * W / N, base - y]);
}
const closed = (a, W, H) => `M0,${H} L${pts(a)} L${W},${H}Z`;

/** a ragged conifer; returns a path "M..Z" */
function pine(x, base, h, w, r) {
  const tiers = Math.max(5, Math.min(13, Math.round(h / 15))) + ((r() * 2) | 0), top = base - h, L = [[x, top]], R = [];
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers, y = top + h * t, o = (w * (0.16 + 0.84 * t) / 2) * (0.88 + r() * .24), inner = o * (0.42 + r() * .16), yy = y - (h / tiers) * (0.5 + r() * .12);
    L.push([x - inner, yy], [x - o, y + h * .012]); R.push([x + o, y + h * .012], [x + inner, yy]);
  }
  L.push([x - w * .035, base], [x + w * .035, base]); R.reverse();
  return "M" + pts(L.concat(R)) + "Z";
}
function treeRow(r, x0, x1, base, hMin, hMax, step, wRatio = .42, jitter = 0) {
  let d = ""; for (let x = x0; x < x1; x += step * (0.6 + r() * .8)) { const h = hMin + r() * (hMax - hMin); d += pine(x, base + (r() - .5) * jitter, h, h * wRatio, r); } return d;
}
/** a bare, twisted tree: trunk + recursive branches, drawn as strokes */
function bareTree(r, x, y, len, ang, wid, depth) {
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len, bend = (r() - .5) * len * .5;
  let s = `<path d="M${n1(x)},${n1(y)} Q${n1((x + x2) / 2 + bend)},${n1((y + y2) / 2)} ${n1(x2)},${n1(y2)}" stroke-width="${n1(wid)}"/>`;
  if (depth > 0) for (let i = 0, k = 2 + (r() * 1.4 | 0); i < k; i++) s += bareTree(r, x2, y2, len * (.62 + r() * .18), ang + (r() - .5) * 1.5 + (i ? .25 : -.25), wid * .66, depth - 1);
  return s;
}
const defs = (id, body) => `<defs>${body.replace(/ID/g, id)}</defs>`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
const rg = (id, stops, cx = .5, cy = .5, rr = .5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${rr}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
let uid = 0; const U = p => p + (++uid);

/* =====================================================================================  HERO  */
/** jagged alpine range: a few dominant, asymmetric peaks joined by fractal slopes */
function range(r, W, base, peakH, count, rough = .55) {
  const peaks = []; for (let i = 0; i < count; i++) peaks.push({ x: (i + .15 + r() * .7) * W / count, h: peakH * (.4 + r() * .6), l: .8 + r() * .5, rr: .8 + r() * .5 });
  const N = 256, noise = ridge(r, W, 0, peakH * .5, rough, 8), out = [];
  for (let i = 0; i <= N; i++) {
    const x = i * W / N; let h = 0;
    for (const q of peaks) { const d = (x - q.x) / (W / count * (x < q.x ? q.l : q.rr)); h = Math.max(h, q.h * Math.max(0, 1 - Math.pow(Math.abs(d), 1.15))); }
    const k = Math.min(1, h / (peakH * .25) + .25);              // noise grows with height so valleys stay calm
    out.push([x, base - h - noise[Math.round(i / N * (noise.length - 1))][1] * -1.1 * k]);
  }
  return out;
}
/** darker facets on the right-hand (shadow) side of each peak: gives the silhouettes volume */
function facets(a) {
  let d = "";
  for (let i = 3; i < a.length - 3; i++) {
    const y = a[i][1]; if (!(y < a[i - 1][1] && y <= a[i + 1][1] && y < a[i - 3][1] - 8 && y < a[i + 3][1] - 8)) continue;
    let j = i; while (j < a.length - 1 && a[j + 1][1] >= a[j][1] - .5) j++;      // walk down the right slope to the valley
    if (j - i < 5) continue;
    const mx = a[i][0] + (a[j][0] - a[i][0]) * .12, my = a[i][1] + (a[j][1] - a[i][1]) * .72;
    d += `M${pts([a[i], ...a.slice(i + 1, j + 1), [mx, my + 20], [mx - 4, (a[i][1] + my) / 2]])}Z`;
  }
  return d;
}
export function heroLayers() {
  const W = 1600, H = 900, r = rng(20261028), id = U("h"), svg = (body, d = "") => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${d}${body}</svg>`;
  /* sky + moon + stars */
  let stars = ""; for (let i = 0; i < 120; i++) { const y = r() * 470, a = (0.18 + r() * .6) * (1 - y / 560); stars += `<circle cx="${n1(r() * W)}" cy="${n1(y)}" r="${n1(.45 + r() * 1.05)}" fill="#dfe8e4" opacity="${n1(a * 100) / 100}"/>`; }
  const streak = (x, y, rx, ry, o) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id}-c)" opacity="${o}"/>`;
  const sky = svg(`<rect width="${W}" height="${H}" fill="url(#${id}-s)"/><ellipse cx="800" cy="700" rx="1000" ry="330" fill="url(#${id}-g)"/>${stars}
    <circle cx="1210" cy="210" r="300" fill="url(#${id}-m)"/><circle cx="1210" cy="210" r="42" fill="#eef1e6"/>
    <g fill="#8aa09b" opacity=".1"><circle cx="1196" cy="200" r="10"/><circle cx="1224" cy="224" r="7"/><circle cx="1222" cy="190" r="5"/></g>
    ${streak(1130, 226, 380, 20, .5)}${streak(1330, 180, 300, 15, .4)}${streak(860, 300, 460, 24, .45)}${streak(1450, 290, 300, 18, .4)}${streak(560, 190, 340, 14, .28)}`,
    defs(id, lg("ID-s", [[0, "#04070a"], [.42, "#0b151a"], [.72, "#1c2d33"], [1, "#4a6265"]]) + rg("ID-m", [[0, "#dfe9e1", .5], [.16, "#b7cac6", .2], [1, "#7c9a9a", 0]]) + rg("ID-g", [[0, "#9bbab2", .3], [1, "#9bbab2", 0]], .5, 1, .6) + rg("ID-c", [[0, "#a9bdb8", .55], [1, "#a9bdb8", 0]])));

  /* three ranges, lighter (and bluer) with distance */
  const A = range(r, W, 640, 470, 5, .55), B = range(r, W, 700, 360, 7, .5), C = range(r, W, 770, 250, 9, .5);
  const rim = (a, c, o) => `<path d="M${pts(a)}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const farSvg = svg(`<path d="${closed(A, W, H)}" fill="url(#${id}-a)"/><path d="${facets(A)}" fill="#071014" opacity=".34"/>${rim(A, "#a9c4c2", .3)}<path d="${closed(B, W, H)}" fill="url(#${id}-b)"/><path d="${facets(B)}" fill="#050b0e" opacity=".36"/>${rim(B, "#8fb0b0", .18)}`,
    defs(id, lg("ID-a", [[0, "#4b646a"], [.6, "#2b3f45"], [1, "#1d2d33"]]) + lg("ID-b", [[0, "#34494f"], [1, "#182529"]])));
  const midSvg = svg(`<path d="${closed(C, W, H)}" fill="url(#${id}-b)"/><path d="${facets(C)}" fill="#04090b" opacity=".4"/>${rim(C, "#86a6a6", .14)}<path d="${treeRow(r, 0, W, 800, 26, 64, 15, .42, 50)}" fill="#142126" opacity=".92"/>`,
    defs(id, lg("ID-b", [[0, "#22353a"], [1, "#101b1f"]])));

  /* castle on a crag. Kept right of centre (cx=1000) so portrait crops still show it */
  const cx = 1010, plat = 548, crag = [[cx - 330, 800], [cx - 250, 700], [cx - 190, 640], [cx - 170, 596], [cx - 150, plat + 12], [cx - 118, plat + 4], [cx + 20, plat - 2], [cx + 120, plat + 6], [cx + 160, plat + 20], [cx + 176, 612], [cx + 230, 668], [cx + 300, 740], [cx + 380, 800]];
  const castle = [
    // low curtain wall, ruined on the right
    "M-150,0 L-150,-46 L-138,-46 L-138,-54 L-126,-54 L-126,-46 L-112,-46 L-112,-60 L-60,-60 L-60,0Z",
    "M40,0 L40,-52 L58,-52 L60,-66 L74,-66 L76,-58 L100,-58 L104,-44 L120,-46 L124,-30 L150,-26 L150,0Z",
    // left round tower with a conical roof
    "M-146,-46 L-146,-132 L-152,-132 L-124,-176 L-96,-132 L-102,-132 L-102,-46Z",
    // keep: crenellated, top broken on the right
    "M-62,0 L-62,-168 L-62,-176 L-50,-176 L-50,-168 L-38,-168 L-38,-176 L-26,-176 L-26,-168 L-14,-168 L-14,-176 L-2,-176 L-2,-166 L6,-158 L10,-168 L22,-162 L28,-146 L40,-0Z",
    // slender tower: broken spire
    "M64,-52 L64,-186 L58,-186 L84,-238 L92,-224 L98,-232 L104,-186 L98,-186 L98,-52Z",
  ].join(" ");
  const win = (x, y, w = 7, h = 14) => `<path d="M${x},${y} v${-h + w / 2} a${w / 2},${w / 2} 0 0 1 ${w},0 v${h - w / 2}z" fill="#f6d596"/><circle cx="${x + w / 2}" cy="${y - h / 2}" r="26" fill="url(#${id}-w)"/>`;
  const castleSvg = svg(`<ellipse cx="${cx}" cy="470" rx="420" ry="250" fill="url(#${id}-h)"/>
    <path d="${closed(C.map(([x, y]) => [x, y + 70]), W, H)}" fill="#0f1a1e"/>
    <path d="M${pts(crag)} L${cx + 380},900 L${cx - 330},900Z" fill="#0a1214"/><path d="M${pts(crag.slice(3, 10))}" fill="none" stroke="#8fb0b0" stroke-opacity=".12" stroke-width="1.4"/>
    <g transform="translate(${cx} ${plat}) scale(1.12)"><path d="${castle}" fill="#0a1214"/><path d="${castle}" fill="none" stroke="#9db9b6" stroke-opacity=".14" stroke-width="1.3"/>
      ${win(-38, -108)}${win(-18, -108, 6, 12)}${win(-30, -64, 6, 12)}${win(76, -112, 6, 13)}${win(-128, -78, 6, 12)}</g>`,
    defs(id, rg("ID-w", [[0, "#f4c77d", .42], [1, "#f4c77d", 0]]) + rg("ID-h", [[0, "#9bbab2", .17], [1, "#9bbab2", 0]])));

  /* forest band + framing trees */
  const forest = treeRow(r, -40, W + 40, 830, 80, 230, 22, .4, 50);
  const forestSvg = svg(`<path d="${forest}" fill="#070d0f"/><rect x="0" y="800" width="${W}" height="140" fill="#070d0f"/>`);
  const left = treeRow(r, -60, 300, 930, 560, 860, 120, .34, 20), right = treeRow(r, 1320, 1680, 930, 480, 780, 130, .34, 20);
  const foreSvg = svg(`<path d="${left}" fill="#030607"/><path d="${right}" fill="#030607"/><path d="M0,900 L0,860 L${pts(ridge(r, W, 880, 30, .5, 6))} L${W},900Z" fill="#030607"/>`);
  return { sky, far: farSvg, mid: midSvg, castle: castleSvg, forest: forestSvg, fore: foreSvg };
}

/* =====================================================================================  LEGEND SCENES  */
const PAL = {
  woolpit: { top: "#1f2e2c", bot: "#6b8176", glow: "#9cba84", ground: "#10170f" },
  hoia: { top: "#15142a", bot: "#46405f", glow: "#a08ac0", ground: "#090b0b" },
  skye: { top: "#141f2a", bot: "#6a8394", glow: "#93b6cb", ground: "#0a0f13" },
  babayaga: { top: "#0d1024", bot: "#7a4a3a", glow: "#e39a3b", ground: "#0b0806" },
  sibilla: { top: "#120e26", bot: "#6a4a78", glow: "#c9a0dc", ground: "#0b0910" },
  bathory: { top: "#0e0a10", bot: "#5a2a32", glow: "#c9a24e", ground: "#0a0708" },
};
const vignette = id => `<rect width="400" height="300" fill="url(#${id}-v)"/>`;
const vigDef = id => rg(id + "-v", [[.55, "#000", 0], [1, "#000", .62]]);

function woolpit() {
  const r = rng(1066), id = U("w"), P = PAL.woolpit;
  const hedge = ridge(r, 400, 176, 9, .6, 6), field = `M0,300 L0,176 L400,176 L400,300Z`;
  let stubble = ""; for (let i = -12; i <= 12; i++) stubble += `M200,176 L${200 + i * 62},300 `;
  const house = (x, w, h, lit) => `<path d="M${x},176 v${-h} l${w / 2},${-h * .55} l${w / 2},${h * .55} v${h}z" fill="#0d140f"/>${lit ? `<rect x="${x + w * .4}" y="${176 - h * .55}" width="3" height="4" fill="#f2cf8f"/>` : ""}`;
  const pit = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#050805"/><path d="M${x - rx},${y} a${rx},${ry} 0 0 1 ${rx * 2},0" fill="none" stroke="#7d9777" stroke-opacity=".35" stroke-width="1.4"/>`;
  const tree = bareTree(r, 34, 300, 74, .06, 4.4, 4);
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [1, P.bot]]) + lg("ID-f", [[0, "#3a4733"], [1, "#0d130c"]]) + rg("ID-g", [[0, P.glow, .55], [1, P.glow, 0]]) + rg("ID-m", [[0, "#e7ecdf", .6], [1, "#e7ecdf", 0]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/><circle cx="302" cy="58" r="44" fill="url(#${id}-m)"/><circle cx="302" cy="58" r="12" fill="#eef0e4"/>
    <g fill="#c2cdc5" opacity=".13"><ellipse cx="260" cy="70" rx="96" ry="5"/><ellipse cx="120" cy="40" rx="80" ry="4"/></g>
    <path d="${closed(hedge, 400, 190)}" fill="#18231b"/>
    <g>${house(96, 26, 12, 1)}${house(126, 22, 10)}${house(214, 30, 13, 1)}${house(250, 22, 9)}
      <path d="M166,176 v-44 h12 v44z M164,132 l8,-34 l8,34z" fill="#0a110c"/><path d="M146,176 v-14 h32 v14z" fill="#0a110c"/><rect x="171" y="146" width="2.4" height="5" fill="#f2cf8f"/></g>
    <path d="${field}" fill="url(#${id}-f)"/><path d="${stubble}" stroke="#a7b78b" stroke-opacity=".12" stroke-width="1" fill="none"/>
    <rect x="0" y="168" width="400" height="26" fill="#cfd8cf" opacity=".12"/>
    <ellipse cx="130" cy="256" rx="120" ry="38" fill="url(#${id}-g)"/>${pit(118, 262, 54, 13)}${pit(300, 236, 36, 9)}
    <g fill="#04080a"><circle cx="158" cy="245" r="2.4"/><path d="M155.5,260 v-12 q2.5,-3 5,0 v12z"/><circle cx="167" cy="247" r="2"/><path d="M165,260 v-10 q2,-2.6 4,0 v10z"/></g>
    <g fill="#9cba84" opacity=".5"><circle cx="158" cy="245" r="3.8" opacity=".25"/><circle cx="167" cy="247" r="3.4" opacity=".25"/></g>
    <g stroke="#050806" fill="none" stroke-linecap="round">${tree}</g>${vignette(id)}</svg>`;
}
function hoia() {
  const r = rng(1968), id = U("o"), P = PAL.hoia;
  let far = "", mid = "";
  far = treeRow(r, -10, 410, 176, 26, 54, 12, .4, 8); mid = treeRow(r, -10, 410, 196, 44, 92, 17, .4, 8);
  const trunk = (x0, lean) => { let d = `M${x0},300 C${x0 + lean},250 ${x0 - lean * .9},206 ${x0 + lean * .5},150 S${x0 - lean * .4},84 ${x0 + lean * 1.2},30`; return `<path d="${d}" stroke-width="9" fill="none"/><path d="M${x0 + lean * .5},158 q${lean * .8},-16 ${lean * 1.6},-12 M${x0 - lean * .35},118 q${-lean * .9},-12 ${-lean * 1.8},-4" stroke-width="3.6" fill="none"/>`; };
  const orbs = [[140, 150, 3], [236, 128, 2.4], [286, 168, 2], [190, 100, 1.6]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s * 6}" fill="url(#${id}-o)"/><circle cx="${x}" cy="${y}" r="${s}" fill="#e4f0f2"/>`).join("");
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [1, P.bot]]) + rg("ID-o", [[0, "#bfe4ea", .6], [1, "#bfe4ea", 0]]) + rg("ID-g", [[0, "#c7c0d6", .5], [1, "#c7c0d6", 0]]) + rg("ID-m", [[0, "#e6e2ef", .45], [1, "#e6e2ef", 0]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/><circle cx="92" cy="52" r="36" fill="url(#${id}-m)"/><circle cx="92" cy="52" r="9" fill="#ebe8f2"/>
    <path d="${far}" fill="#25233b"/><rect x="0" y="150" width="400" height="40" fill="#b9b3cf" opacity=".1"/><path d="${mid}" fill="#14132a"/><rect x="0" y="176" width="400" height="30" fill="#b9b3cf" opacity=".1"/>
    <path d="M0,300 L0,196 L400,196 L400,300Z" fill="#0b0c0f"/>
    <ellipse cx="200" cy="232" rx="118" ry="24" fill="#2a2b32"/><ellipse cx="200" cy="230" rx="100" ry="19" fill="#3a3a44"/><ellipse cx="200" cy="228" rx="76" ry="13" fill="#45444f" opacity=".7"/>
    <ellipse cx="200" cy="226" rx="150" ry="34" fill="url(#${id}-g)"/>
    ${orbs}
    <g stroke="#040507" stroke-linecap="round" fill="none">${trunk(28, 22)}${trunk(70, -16)}${trunk(352, -20)}${trunk(388, 18)}</g>
    <rect x="0" y="238" width="400" height="62" fill="#0b0c0f" opacity=".5"/>${vignette(id)}</svg>`;
}
function skye() {
  const r = rng(1703), id = U("s"), P = PAL.skye;
  const cuillin = ridge(r, 400, 168, 54, .66, 7), cliff = ridge(r, 220, 0, 14, .6, 6).map(([x, y]) => [180 + x, 190 + y * .6 - Math.max(0, (x - 40) / 180) * 0]);
  let rain = ""; for (let i = 0; i < 46; i++) { const x = r() * 400, y = r() * 220; rain += `M${n1(x)},${n1(y)} l-5,15 `; }
  let waves = ""; for (let i = 0; i < 38; i++) { const y = 186 + r() * 100, x = r() * 380, l = 8 + r() * 26 * ((y - 180) / 100); waves += `M${n1(x)},${n1(y)} h${n1(l)} `; }
  const headland = `M150,300 L160,240 C196,214 238,190 282,182 L330,178 C360,176 382,172 400,168 L400,300Z`;
  const house = `<g transform="translate(300 180)"><path d="M0,0 v-22 h4 v-6 h5 v6 h28 v-6 h5 v6 h6 v22z" fill="#06090c"/><path d="M-2,-22 l22,-12 M42,-22 l-20,-12 M4,-22 l9,-10 M36,-22 l-6,-9" stroke="#06090c" stroke-width="1.6"/><path d="M26,0 v-11 a4,4 0 0 1 8,0 v11z" fill="#f2cf8f"/><circle cx="30" cy="-8" r="16" fill="url(#${id}-w)"/><rect x="-6" y="-2" width="56" height="4" fill="#06090c"/></g>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [1, P.bot]]) + lg("ID-t", [[0, "#2a3b49"], [1, "#0a1117"]]) + rg("ID-w", [[0, "#f4c77d", .55], [1, "#f4c77d", 0]]) + rg("ID-m", [[0, "#e4ecee", .55], [1, "#e4ecee", 0]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/><circle cx="76" cy="66" r="46" fill="url(#${id}-m)"/><circle cx="76" cy="66" r="11" fill="#eaf0f0"/>
    <g fill="#10171e" opacity=".66"><ellipse cx="86" cy="62" rx="120" ry="11"/><ellipse cx="300" cy="44" rx="130" ry="13"/><ellipse cx="220" cy="98" rx="150" ry="12"/></g>
    <g fill="#a8bac4" opacity=".12"><ellipse cx="60" cy="76" rx="70" ry="4"/><ellipse cx="320" cy="70" rx="90" ry="4"/></g>
    <path d="${closed(cuillin, 400, 190)}" fill="#1c2833"/><rect x="0" y="168" width="400" height="30" fill="#b6c8d2" opacity=".1"/>
    <rect x="0" y="186" width="400" height="114" fill="url(#${id}-t)"/><path d="${waves}" stroke="#a9bfcb" stroke-opacity=".16" stroke-width="1" fill="none"/>
    <g stroke="#cfe0e8" stroke-opacity=".22" stroke-width="1.6"><path d="M76,194 h10 M72,200 h18 M70,208 h22 M74,216 h14 M68,226 h24"/></g>
    <path d="M52,186 l4,-34 l5,34z M30,188 l3,-22 l4,22z" fill="#0c1319"/><path d="${headland}" fill="#070b0e"/>${house}
    <path d="M180,300 q40,-16 100,-4 t120,-6 v10z" fill="#d7e3e8" opacity=".12"/><path d="${rain}" stroke="#bcd0da" stroke-opacity=".12" stroke-width=".8"/>${vignette(id)}</svg>`;
}
function babayaga() {
  const r = rng(1855), id = U("b"), P = PAL.babayaga;
  // a birch: white trunk with dark marks, a few golden leaves
  const birch = (x, base, h, w) => { let marks = ""; for (let y = base - 10; y > base - h; y -= 7 + r() * 9) marks += `<path d="M${n1(x - w / 2)},${n1(y)} h${n1(w * (0.4 + r() * 0.6))}" stroke="#141010" stroke-width="${n1(1 + r() * 1.6)}"/>`;
    let leaves = ""; for (let i = 0; i < 16; i++) leaves += `<circle cx="${n1(x + (r() - .5) * h * .5)}" cy="${n1(base - h * (.55 + r() * .45))}" r="${n1(3 + r() * 5)}" fill="${["#c98a1c", "#e0b040", "#a8701a"][i % 3]}" opacity="${n1(.5 + r() * .4)}"/>`;
    return `${leaves}<path d="M${x - w / 2},${base} L${x - w * .3},${base - h} L${x + w * .3},${base - h} L${x + w / 2},${base}z" fill="#d9d4c6"/>${marks}`; };
  let fence = ""; for (let i = 0; i < 15; i++) { const x = 34 + i * 24 + (r() - .5) * 4, y = 236 + Math.sin(i * .5) * 2, hh = 26 + r() * 6;
    fence += `<path d="M${n1(x - 1.6)},${y} v${-hh} h3.2 v${hh}z" fill="#cbbf9f"/><ellipse cx="${n1(x)}" cy="${n1(y - hh - 5)}" rx="5.2" ry="5.8" fill="#d9cdb0"/><rect x="${n1(x - 3.4)}" y="${n1(y - hh - 1.4)}" width="6.8" height="3" rx="1" fill="#cfc2a4"/>`
      + `<circle cx="${n1(x - 2)}" cy="${n1(y - hh - 5)}" r="1.5" fill="#ffb030"/><circle cx="${n1(x + 2)}" cy="${n1(y - hh - 5)}" r="1.5" fill="#ffb030"/><circle cx="${n1(x)}" cy="${n1(y - hh - 5)}" r="9" fill="url(#${id}-e)"/>`; }
  fence += `<path d="M20,224 H380 M20,212 H380" stroke="#bfb393" stroke-width="2" opacity=".75"/>`;
  // the hut: logs, a steep roof, two glowing windows, and the chicken legs
  let logs = ""; for (let i = 0; i < 8; i++) logs += `<path d="M150,${120 + i * 7.2} h100" stroke="#2a1a0e" stroke-width="1.4" opacity=".7"/>`;
  const leg = (x, flip) => { const f = flip ? -1 : 1; return `<path d="M${x},176 q${8 * f},20 ${2 * f},34 q${-14 * f},10 ${-6 * f},34" stroke="#c9a64e" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M${x - 9},176 q${4 * f},22 ${11 * f},12 l${-2 * f},-12z" fill="#5a3a26"/>`
    + `<path d="M${x + -4 * f},244 l-14,6 M${x - 4 * f},244 l2,9 M${x - 4 * f},244 l16,5 M${x - 4 * f},244 l${6 * f},-6" stroke="#c9a64e" stroke-width="3.2" stroke-linecap="round"/>`; };
  const hut = `${leg(178, false)}${leg(222, true)}<path d="M142,178 h116 v-62 h-116z" fill="#5c3b22"/>${logs}<path d="M132,118 L200,72 L268,118z" fill="#2c2a20"/><path d="M200,72 v-10 l7,-4" stroke="#2c2a20" stroke-width="3" fill="none"/>
    <rect x="160" y="132" width="20" height="18" fill="#ffb35c"/><rect x="220" y="132" width="20" height="18" fill="#ffb35c"/><path d="M156,129 h28 l-14,-8z M216,129 h28 l-14,-8z" fill="#b2443a"/><rect x="190" y="142" width="20" height="34" fill="#2e2015"/>
    <path d="M178,60 q-6,-16 6,-26 q-12,-8 -2,-22" stroke="#9a9aa4" stroke-width="5" fill="none" opacity=".25"/><circle cx="170" cy="141" r="26" fill="url(#${id}-w)"/><circle cx="230" cy="141" r="26" fill="url(#${id}-w)"/>`;
  const mortar = `<g transform="translate(318 66) rotate(-14)"><path d="M-9,0 h18 l-3,14 h-12z" fill="#2a1a10"/><circle cx="0" cy="-6" r="4" fill="#1a1210"/><path d="M-3,-10 l-6,-6 M4,-8 l14,-22" stroke="#1a1210" stroke-width="2"/><path d="M-9,10 l-22,10 l2,-6 l-2,-6z" fill="#1a1210"/></g>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [.62, "#3a2a46"], [1, P.bot]]) + rg("ID-m", [[0, "#efe6c8", .55], [1, "#efe6c8", 0]]) + rg("ID-e", [[0, "#ffb030", .55], [1, "#ffb030", 0]]) + rg("ID-w", [[0, "#ffb35c", .45], [1, "#ffb35c", 0]]) + lg("ID-g", [[0, "#1a120c"], [1, "#050403"]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/><circle cx="96" cy="58" r="40" fill="url(#${id}-m)"/><circle cx="96" cy="58" r="10" fill="#f2ead2"/>${mortar}
    <path d="${treeRow(r, -10, 410, 196, 40, 90, 15, .36, 8)}" fill="#120f18"/><rect x="0" y="170" width="400" height="34" fill="#c9a07a" opacity=".07"/>
    <path d="M0,300 L0,204 L400,204 L400,300Z" fill="url(#${id}-g)"/>
    ${hut}${fence}
    ${birch(20, 300, 280, 14)}${birch(58, 300, 250, 10)}${birch(356, 300, 270, 13)}${birch(390, 300, 240, 9)}
    <rect x="0" y="262" width="400" height="38" fill="#050403" opacity=".55"/>${vignette(id)}</svg>`;
}
function sibilla() {
  const r = rng(1420), id = U("s"), P = PAL.sibilla;
  let stars = ""; for (let i = 0; i < 70; i++) { const y = r() * 150; stars += `<circle cx="${n1(r() * 400)}" cy="${n1(y)}" r="${n1(.3 + r() * .8)}" fill="#efe6ff" opacity="${n1((.25 + r() * .6) * (1 - y / 190) * 100) / 100}"/>`; }
  // far ranges of the Sibillini, and Monte Vettore with the pale scar of the Fairies' Road
  const far = ridge(r, 400, 168, 46, .5, 6), mid = ridge(r, 400, 196, 30, .55, 6);
  const road = `<path d="M262,150 Q300,138 338,118" stroke="#e6dcf4" stroke-width="1.6" fill="none" opacity=".45" stroke-dasharray="5 3"/>`;
  // Monte Sibilla: a broad mountain with its crown of rock, and the warm glow of the cave below it
  const mtn = "M60,232 L110,176 L140,150 L160,128 L176,112 L192,104 L214,104 L230,112 L246,130 L268,152 L300,180 L346,232Z";
  let crown = ""; for (let i = 0; i < 13; i++) { const x = 172 + i * 4.2 + (r() - .5) * 1.5, h = 6 + r() * 9; crown += `<path d="M${n1(x - 2)},${n1(110 - Math.abs(i - 6) * .6)} L${n1(x - 1)},${n1(102 - h)} L${n1(x + 1.4)},${n1(103 - h * .9)} L${n1(x + 2.2)},${n1(110 - Math.abs(i - 6) * .6)}Z" fill="#cfc7dc" opacity=".9"/>`; }
  const cave = `<ellipse cx="203" cy="120" rx="4.5" ry="2.6" fill="#1a0a14"/><circle cx="203" cy="120" r="20" fill="url(#${id}-c)"/>`;
  // the village on its spur: houses with low roofs and lit windows, the bell tower
  let vil = ""; const hx = [24, 38, 50, 64, 78, 92, 104]; hx.forEach((x, i) => { const w = 12 + r() * 6, h = 10 + r() * 8, y = 252 - (i % 3) * 3; vil += `<path d="M${x},${y} v${-h} l${w / 2},-4 l${w / 2},4 v${h}z" fill="#1c1622"/><path d="M${x - 1},${y - h} l${w / 2 + 1},-4.6 l${w / 2 + 1},4.6" stroke="#6a3a2e" stroke-width="1.6" fill="none"/>`; if (i % 2 === 0) vil += `<rect x="${n1(x + w * .3)}" y="${n1(y - h * .6)}" width="2.4" height="3" fill="#ffc46a"/>`; if (i % 3 === 1) vil += `<rect x="${n1(x + w * .65)}" y="${n1(y - h * .4)}" width="2.4" height="3" fill="#ffc46a"/>`; });
  vil += `<path d="M70,250 v-36 l4,-6 l4,6 v36z" fill="#1c1622"/><rect x="72.6" y="219" width="2.8" height="4" fill="#0a0810"/>`;
  // the fairies dancing in a ring on the meadow, gowns lit by the moon, hooves just showing
  let ring = ""; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .4, x = 292 + Math.cos(a) * 26, y = 246 + Math.sin(a) * 7, s = .9 + Math.sin(a) * .12;
    ring += `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s)})"><circle cx="0" cy="-17" r="2.6" fill="#f0e6f4"/><path d="M-1.6,-14 L-7,0 L7,0 L1.6,-14z" fill="#ece2f6" opacity=".92"/><path d="M-2,-12 l-6,-6 M2,-12 l6,-7" stroke="#ece2f6" stroke-width="1.2"/><path d="M-2,0 l-.6,2.4 M2,0 l.6,2.4" stroke="#1a1014" stroke-width="1.4"/></g>`; }
  const glowRing = `<ellipse cx="292" cy="248" rx="44" ry="14" fill="url(#${id}-f)"/>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [.55, "#2c2048"], [1, P.bot]]) + rg("ID-m", [[0, "#f4ecff", .55], [1, "#f4ecff", 0]]) + rg("ID-c", [[0, "#ffb0c8", .7], [1, "#ffb0c8", 0]]) + rg("ID-f", [[0, "#d8b8ff", .45], [1, "#d8b8ff", 0]]) + lg("ID-g", [[0, "#1e1828"], [1, P.ground]]) + lg("ID-k", [[0, "#5a4a70"], [1, "#1e1830"]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/>${stars}<circle cx="320" cy="56" r="44" fill="url(#${id}-m)"/><circle cx="320" cy="56" r="11" fill="#f6f0ff"/>
    <path d="${closed(far, 400, 300)}" fill="#3a2e52" opacity=".85"/>${road}<path d="${closed(mid, 400, 300)}" fill="#2a2140"/>
    <path d="${mtn}" fill="url(#${id}-k)"/><path d="M176,112 L192,104 L214,104 L230,112" stroke="#e8e0f4" stroke-opacity=".35" stroke-width="1.2" fill="none"/>${crown}${cave}
    <path d="M203,124 q-10,30 6,52 q-14,24 4,56" stroke="#d8c8b0" stroke-width="1.2" fill="none" opacity=".35" stroke-dasharray="3 3"/>
    <path d="M0,300 L0,236 Q80,226 160,240 T400,232 L400,300Z" fill="url(#${id}-g)"/>${glowRing}${ring}${vil}
    <rect x="0" y="268" width="400" height="32" fill="#050408" opacity=".5"/>${vignette(id)}</svg>`;
}
function bathory() {
  const r = rng(1611), id = U("b"), P = PAL.bathory;
  let stars = ""; for (let i = 0; i < 40; i++) { const y = r() * 110; stars += `<circle cx="${n1(r() * 400)}" cy="${n1(y)}" r="${n1(.3 + r() * .6)}" fill="#f2e6d0" opacity="${n1((.2 + r() * .5) * (1 - y / 130) * 100) / 100}"/>`; }
  // the Little Carpathians at dusk, the castle hill, and Csejte castle on its crest: curtain walls, the horseshoe keep, the palace
  const far = ridge(r, 400, 176, 28, .5, 6);
  const hill = "M70,250 C110,226 132,170 168,150 C186,140 214,138 232,148 C268,168 296,224 340,250Z";
  const castle = `<g fill="#120c10"><path d="M160,152 v-14 h6 v-4 h4 v4 h6 v-6 h4 v6 h10 v-10 h4 v10 h8 v-4 h4 v4 h12 v-8 h4 v8 h6 v18z"/>
    <path d="M196,136 v-26 a10,10 0 0 1 20,0 v26z"/><path d="M194,110 h24 v-4 h-3 v3 h-3 v-3 h-3 v3 h-3 v-3 h-3 v3 h-3 v-3 h-3 v3 h-3 v-3 h-3z"/>
    <path d="M222,140 v-14 l8,-7 l8,7 v14z"/><path d="M166,142 v-12 l5,-5 l5,5 v12z"/></g>
    <rect x="203.6" y="118" width="2.6" height="5" fill="#ffc46a"/><rect x="228" y="129" width="2" height="3.4" fill="#ffb45a" opacity=".85"/><circle cx="205" cy="120.5" r="9" fill="url(#${id}-c)"/>`;
  // the road winding up through the vineyards
  const road = `<path d="M196,250 q30,-14 6,-30 q-24,-16 10,-30 q22,-10 0,-24" stroke="#c8a878" stroke-width="1.3" fill="none" opacity=".35" stroke-dasharray="3 3"/>`;
  let vines = ""; for (let k = 0; k < 9; k++) vines += `<path d="M${90 + k * 4},${246 - k * 5} q40,-6 ${80 - k * 5},-2" stroke="#2a1c1a" stroke-width="1" fill="none" opacity=".7"/>`;
  // the village: steep roofs, the church tower, a few warm windows
  let vil = ""; const hx = [10, 30, 52, 74, 300, 322, 344, 366, 386]; hx.forEach((x, i) => { const w = 16 + r() * 6, h = 10 + r() * 6, y = 274 - (i % 2) * 3;
    vil += `<path d="M${x},${y} v${-h} l${w / 2},${-w * .55} l${w / 2},${w * .55} v${h}z" fill="#150f12"/>`; if (i % 2 === 0) vil += `<rect x="${n1(x + w * .35)}" y="${n1(y - h * .65)}" width="2.6" height="3.2" fill="#ffbf66"/>`; });
  vil += `<path d="M104,276 v-40 l5,-12 l5,12 v40z" fill="#150f12"/><path d="M109,224 v-6" stroke="#150f12" stroke-width="1.4"/>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [.5, "#2e1620"], [.85, P.bot], [1, "#a86048"]]) + rg("ID-c", [[0, "#ffc46a", .55], [1, "#ffc46a", 0]]) + rg("ID-h", [[0, "#d88a5a", .35], [1, "#d88a5a", 0]]) + lg("ID-k", [[0, "#3a2628"], [1, "#160e10"]]) + lg("ID-g", [[0, "#1a1214"], [1, P.ground]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/>${stars}<ellipse cx="300" cy="196" rx="150" ry="40" fill="url(#${id}-h)"/>
    <path d="${closed(far, 400, 300)}" fill="#24161c" opacity=".9"/>
    <path d="${hill}" fill="url(#${id}-k)"/>${vines}${road}${castle}
    <path d="M0,300 L0,262 Q100,250 200,258 T400,254 L400,300Z" fill="url(#${id}-g)"/>${vil}
    <path d="M318,40 q10,-4 18,0 M330,52 q8,-3 14,0 M346,36 q7,-3 12,0" stroke="#0a0608" stroke-width="1.2" fill="none" opacity=".7"/>
    <rect x="0" y="276" width="400" height="24" fill="#050304" opacity=".5"/>${vignette(id)}</svg>`;
}
const SCENES = { woolpit, hoia, skye, babayaga, sibilla, bathory };
export const sceneSVG = key => (SCENES[key] ? SCENES[key]() : "");

/* =====================================================================================  EMBLEMS  */
// drawn in a 100x100 box with an engraved, single-weight line style
const EMB = {
  ledger: `<path d="M26 20h42a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H26z"/><path d="M26 20v66M74 28v50M71 30v46" opacity=".5"/><path d="M26 54h48"/><rect x="46" y="48" width="12" height="12" rx="2"/><path d="M34 32h26M34 38h18" opacity=".6"/>`,
  bowl: `<path d="M18 52h64c0 20-14 32-32 32S18 72 18 52z"/><ellipse cx="50" cy="52" rx="32" ry="7"/><ellipse cx="38" cy="44" rx="5.5" ry="3.2" transform="rotate(-24 38 44)"/><ellipse cx="53" cy="41" rx="5.5" ry="3.2" transform="rotate(14 53 41)"/><ellipse cx="64" cy="46" rx="5.5" ry="3.2" transform="rotate(-10 64 46)"/><path d="M34 64q8 6 16 6M52 66q6 2 12 0" opacity=".5"/>`,
  bell: `<path d="M50 20c-14 0-22 11-22 26v14c0 5-4 8-9 12h62c-5-4-9-7-9-12V46c0-15-8-26-22-26z"/><circle cx="50" cy="14" r="4"/><path d="M43 76a7 7 0 0 0 14 0"/><path d="M17 44q-6 12 0 24M83 44q6 12 0 24M9 40q-9 16 0 32M91 40q9 16 0 32" opacity=".5"/>`,
  font: `<path d="M24 46h52c0 14-11 22-26 22S24 60 24 46z"/><ellipse cx="50" cy="46" rx="26" ry="5.5"/><path d="M42 68v12h16V68M30 86h40"/><path d="M50 14c-5 8-8 12-8 16a8 8 0 0 0 16 0c0-4-3-8-8-16z"/><path d="M36 38q14 6 28 0" opacity=".5"/>`,
  margin: `<path d="M28 16h38l8 8v60H28z"/><path d="M66 16v8h8"/><path d="M36 30h24M36 38h24M36 46h14M36 54h24M36 62h18" opacity=".6"/><path d="M80 34l2.6 6 6 2.6-6 2.6L80 51l-2.6-5.8-6-2.6 6-2.6z"/><path d="M84 52l10 14" opacity=".5"/>`,
  ink: `<path d="M31 52h38v26a6 6 0 0 1-6 6H37a6 6 0 0 1-6-6z"/><path d="M39 52v-8h22v8"/><path d="M58 44L86 10c-16 0-30 10-34 26 7 3 13 1 18-4 5-5 14-12 16-22z" transform="translate(-4 2)"/><path d="M52 58h16M52 66h16" opacity=".5"/>`,
  bar: `<path d="M16 36h68M16 44h68M16 52h68M16 60h68M16 68h68"/><path d="M68 36v32" /><path d="M76 36v32" stroke-width="5"/><ellipse cx="42" cy="52" rx="7" ry="5" transform="rotate(-18 42 52)"/><path d="M34 24a8 8 0 0 1 16 0M42 17v-5" opacity=".6"/>`,
  highnote: `<path d="M16 58h68M16 66h68M16 74h68M16 82h68" opacity=".55"/><ellipse cx="54" cy="40" rx="7" ry="5" transform="rotate(-18 54 40)"/><path d="M60.6 38V12q12 4 10 18M44 40h20"/><path d="M28 24l7 4M78 22l-6 5M50 8v5" opacity=".6"/>`,
  score: `<path d="M26 14h48v72H26z"/><path d="M33 26h34M33 32h34M33 38h34" opacity=".55"/><path d="M26 58q6.4-5 12.8 0t12.8 0 12.8 0 9.6 -2.4M26 68q6.4-5 12.8 0t12.8 0 12.8 0 9.6-2.4" opacity=".85"/><ellipse cx="40" cy="48" rx="3.4" ry="5" opacity=".7"/><ellipse cx="55" cy="46" rx="3.4" ry="5" opacity=".7"/>`,
  notes4: `<ellipse cx="22" cy="34" rx="6" ry="4.4" transform="rotate(-20 22 34)"/><path d="M27.6 32V12"/><ellipse cx="42" cy="44" rx="6" ry="4.4" transform="rotate(-20 42 44)"/><path d="M47.6 42V22"/><ellipse cx="62" cy="56" rx="6" ry="4.4" transform="rotate(-20 62 56)"/><path d="M67.6 54V34"/><ellipse cx="82" cy="70" rx="6" ry="4.4" transform="rotate(-20 82 70)"/><path d="M87.6 68V48"/><path d="M14 80q30 8 72 4" stroke-dasharray="2 5" opacity=".5"/>`,
  watch: `<circle cx="50" cy="56" r="29"/><circle cx="50" cy="56" r="23" opacity=".5"/><path d="M45 27h10v-7H45z"/><circle cx="50" cy="13" r="6"/><path d="M50 56V37M50 56l14 8"/><circle cx="50" cy="56" r="2.2"/><path d="M50 30v4M50 78v4M24 56h4M72 56h4M32 38l3 3M68 38l-3 3M32 74l3-3M68 74l-3-3" opacity=".6"/><path d="M24 40a30 30 0 0 1 8-9" opacity=".5"/>`,
  negative: `<path d="M14 30h72v40H14z"/><path d="M14 36h72M14 64h72" opacity=".55"/><path d="M19 32v2M27 32v2M35 32v2M43 32v2M51 32v2M59 32v2M67 32v2M75 32v2M83 32v2M19 66v2M27 66v2M35 66v2M43 66v2M51 66v2M59 66v2M67 66v2M75 66v2M83 66v2" opacity=".7"/><path d="M30 40h40v20H30z"/><path d="M32 58c4-5 6-3 8-7 2 4 5 2 7 6M52 58c3-6 6-4 8-8 2 4 4 3 8 8" opacity=".75"/><ellipse cx="50" cy="45" rx="6" ry="2" opacity=".9"/><path d="M38 20l4 6M62 20l-4 6M50 16v8" opacity=".45"/><path d="M14 78h72" opacity=".4" stroke-dasharray="2 4"/>`,
  tally: `<path d="M22 84L74 18"/><path d="M26 86L78 20" opacity=".5"/><path d="M30 74l6 3M35 68l6 3M40 61l6 3M45 55l6 3M50 49l6 3M55 42l6 3M60 36l6 3M65 30l6 3"/><path d="M68 25l7 4" stroke-width="3"/><path d="M74 18q6-4 6 2" opacity=".7"/><path d="M14 90q10-4 20 0t20 0 20 0 14 0" opacity=".45"/><ellipse cx="22" cy="90" rx="1.6" ry="1" opacity=".6"/><ellipse cx="80" cy="90" rx="1.6" ry="1" opacity=".6"/>`,
  skull: `<ellipse cx="50" cy="40" rx="22" ry="24"/><path d="M36,58 v10 h28 v-10"/><path d="M42,68 v-6 M50,68 v-6 M58,68 v-6" opacity=".7"/><circle cx="41" cy="40" r="6"/><circle cx="59" cy="40" r="6"/><circle cx="41" cy="40" r="1.8"/><circle cx="59" cy="40" r="1.8"/><path d="M50,48 l-3,6 h6z"/><path d="M50,70 v24"/><path d="M33,24 q-6,-8 0,-14 M67,24 q6,-8 0,-14" opacity=".5"/>`,
  comb: `<path d="M18,34 h50 v12 h-50z"/><path d="M22,46 v20 M28,46 v20 M34,46 v20 M40,46 v18 M46,46 v20 M52,46 v14 M58,46 v20 M64,46 v20" opacity=".85"/><path d="M58,62 q14,8 28,0 q-14,-10 -28,0z" opacity=".6"/><path d="M14,76 q18,-8 36,0 t36,0" opacity=".7"/><path d="M14,86 q18,-8 36,0 t36,0" opacity=".5"/>`,
  mortar: `<path d="M30,44 h40 l-6,40 h-28z"/><path d="M30,44 q20,8 40,0" opacity=".6"/><path d="M33,58 h34 M35,72 h30" opacity=".5"/><path d="M58,46 L82,12"/><circle cx="83" cy="10" r="4"/><path d="M28,80 L10,92 M28,80 L12,86 M28,80 L14,96" opacity=".7"/>`,
  doll: `<circle cx="50" cy="26" r="11"/><path d="M39,24 q11,-14 22,0" opacity=".7"/><path d="M38,40 q12,-6 24,0 l8,46 h-40z"/><path d="M38,48 l-10,14 M62,48 l10,14"/><circle cx="46" cy="26" r="1.4"/><circle cx="54" cy="26" r="1.4"/><path d="M47,31 q3,2 6,0" opacity=".7"/><path d="M36,62 h28 M34,74 h32" opacity=".5"/>`,
  notebook: `<path d="M28 18h40a6 6 0 0 1 6 6v58H34a6 6 0 0 1-6-6z"/><path d="M28 76a6 6 0 0 1 6-6h40"/><path d="M38 30h26M38 37h26M38 44h16" opacity=".6"/><path d="M60 52l14 -26 4 2 -12 26z"/><path d="M60 52l-2 6 5-4" opacity=".7"/>`,
  ribbon: `<path d="M50 30c-10-14-30-10-26 2 3 9 18 8 26-2zM50 30c10-14 30-10 26 2-3 9-18 8-26-2z"/><circle cx="50" cy="30" r="4"/><path d="M47 33c-4 16-14 30-24 48l9-2 3 9c8-18 12-34 15-52M53 33c4 16 14 30 24 48l-9-2-3 9c-8-18-12-34-15-52" opacity=".85"/>`,
  hourglass: `<path d="M30 16h40M30 84h40"/><path d="M34 16c0 18 12 24 16 34-4 10-16 16-16 34M66 16c0 18-12 24-16 34 4 10 16 16 16 34"/><path d="M42 74q8-6 16 0" opacity=".6"/><path d="M50 50v-14M46 30l4-6 4 6" opacity=".85"/><circle cx="50" cy="40" r="1.4"/>`,
  leaf: `<path d="M50 86C22 70 20 34 52 14c26 22 22 58-2 72z"/><path d="M50 86c2-24 2-48 2-72" opacity=".7"/><path d="M51 34l-12 8M51 46l-14 9M51 58l-12 9M52 40l11-6M52 52l13-7M52 64l10-6" opacity=".5"/><path d="M50 86l-6 8" />`,
  rose: `<circle cx="50" cy="34" r="16"/><path d="M50 22c-6 6-6 14 0 18 6-4 6-12 0-18zM40 30c4 8 12 10 18 6M60 30c-4 8-12 10-18 6" opacity=".7"/><path d="M50 50v38"/><path d="M50 64c-8-6-16-4-18 2 8 2 14 2 18-2zM50 74c8-6 16-4 18 2-8 2-14 2-18-2z" opacity=".8"/><path d="M47 58l-4 2M53 80l4 2" opacity=".6"/>`,
  crown: `<path d="M20 70l6-36 14 18 10-24 10 24 14-18 6 36z"/><path d="M20 78h60"/><circle cx="26" cy="32" r="3"/><circle cx="50" cy="26" r="3"/><circle cx="74" cy="32" r="3"/><path d="M34 62h32" opacity=".5"/>`,
  sibseal: `<circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="31" opacity=".6"/><path d="M24 66l14-20 8 6 6-16 8 16 6-6 10 20z"/><path d="M40 40l2-6 3 4 5-8 5 8 3-4 2 6" opacity=".85"/><path d="M46 66v-8a4 4 0 0 1 8 0v8" /><path d="M24 70h52" opacity=".6"/>`,
  letter: `<path d="M22 28h56v44H22z"/><path d="M22 28l28 22 28-22" opacity=".7"/><path d="M30 60h18M30 66h26" opacity=".5"/><circle cx="64" cy="62" r="7"/><path d="M60 62h8M64 58v8" opacity=".7"/><path d="M60 69l-3 8M68 69l3 8" opacity=".7"/>`,
  roll: `<path d="M30 18h40v64H30z"/><ellipse cx="50" cy="18" rx="22" ry="5"/><ellipse cx="50" cy="82" rx="22" ry="5"/><path d="M36 30h28M36 36h28M36 42h20M36 48h28M36 54h24M36 60h28M36 66h18" opacity=".55"/><circle cx="62" cy="72" r="5"/><path d="M60 76l-3 8M64 76l3 8" opacity=".7"/>`,
  coin: `<circle cx="44" cy="48" r="26"/><circle cx="44" cy="48" r="21" opacity=".55"/><path d="M34 56l4-16 6 10 6-10 4 16" /><path d="M36 30l3 4M52 30l-3 4" opacity=".6"/><path d="M66 66h22v20H66z" opacity=".85"/><path d="M70 72h14M70 78h10" opacity=".55"/>`,
  portrait: `<path d="M24 14h52v72H24z"/><path d="M30 20h40v60H30z" opacity=".55"/><ellipse cx="50" cy="42" rx="8" ry="10"/><path d="M38 56q12-6 24 0" /><path d="M36 80q2-18 14-22 12 4 14 22"/><path d="M44 32q6-6 12 0" opacity=".6"/><path d="M50 58v10" opacity=".5"/>`,
  sealed: `<path d="M24 18h44l8 8v58H24z"/><path d="M68 18v8h8"/><path d="M32 30h30M32 38h30M32 46h22M32 54h28" opacity=".55"/><circle cx="56" cy="70" r="10"/><circle cx="56" cy="70" r="6" opacity=".6"/><path d="M50 79l-4 9M62 79l4 9"/><path d="M30 76q6-4 12 0" opacity=".6"/>`,
  teeth: `<circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="31" opacity=".6"/><path d="M26 64q24 14 48 0" /><path d="M30 38l38-4v6l-38 2zM30 48l38-4v6l-38 2zM30 58l38-4v6l-38 2z"/><path d="M68 34q6 9 0 26" opacity=".6"/><path d="M40 22h20" opacity=".5"/>`,
  trees: `<path d="M24 88c-6-20 8-34 0-58"/><path d="M50 88c6-22-8-36 2-66"/><path d="M76 88c-8-18 6-32-2-52"/><path d="M24 58q-8-6-12-4M52 44q10-8 16-6M74 62q8-4 12-1" opacity=".7"/><ellipse cx="41" cy="46" rx="2.2" ry="1.4"/><ellipse cx="47.5" cy="46" rx="2.2" ry="1.4"/><path d="M14 90h72" opacity=".5"/>`,
  wisp: `<path d="M50 22c-9 12-14 22-14 31a14 14 0 0 0 28 0c0-9-5-19-14-31z"/><path d="M50 40c-4 6-6 10-6 14a6 6 0 0 0 12 0c0-4-2-8-6-14z" opacity=".7"/><path d="M50 82q-12 4-20 0M50 90q10 2 16-2" opacity=".45"/><circle cx="24" cy="30" r="1.6"/><circle cx="78" cy="24" r="1.3"/><circle cx="82" cy="58" r="1.6"/><circle cx="18" cy="62" r="1.2"/><path d="M14 46q6-4 10 0M76 44q6-3 10 1" opacity=".5"/>`,
  seal: (() => { let p = ""; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, b = a + Math.PI / 8; p += `M50 50 L${n1(50 + 34 * Math.sin(a))} ${n1(50 - 34 * Math.cos(a))} L${n1(50 + 9 * Math.sin(b))} ${n1(50 - 9 * Math.cos(b))}Z`; } return `<circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="31" opacity=".6"/><path d="${p}" fill="${IVORY}" fill-opacity=".14"/><circle cx="50" cy="50" r="4"/>`; })(),
};
export const emblem = key => EMB[key] || "";

const EMBLEM_PAL = { woolpit: PAL.woolpit, hoia: PAL.hoia, skye: PAL.skye, babayaga: PAL.babayaga, sibilla: PAL.sibilla, bathory: PAL.bathory, all: { top: "#1a1424", bot: "#4a3c63", glow: "#8e74b5", ground: "#0a0a0d" }, secret: { top: "#06130f", bot: "#123a33", glow: "#7fc8b8", ground: "#030807" } };
export function relicArt(card) {
  const P = EMBLEM_PAL[card.legend] || EMBLEM_PAL.all, id = U("r"), r = rng(card.no * 977);
  let dust = ""; for (let i = 0; i < 26; i++) dust += `<circle cx="${n1(r() * 400)}" cy="${n1(r() * 300)}" r="${n1(.5 + r() * 1.3)}" fill="${P.glow}" opacity="${n1(.2 + r() * .45)}"/>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, lg("ID-s", [[0, P.top], [1, P.bot]], 0, 1) + rg("ID-g", [[0, P.glow, .5], [1, P.glow, 0]]) + vigDef(id))}
    <rect width="400" height="300" fill="url(#${id}-s)"/>${dust}<ellipse cx="200" cy="150" rx="170" ry="130" fill="url(#${id}-g)"/>
    <g opacity=".9" stroke="${IVORY}" stroke-opacity=".16" fill="none"><circle cx="200" cy="150" r="104"/><circle cx="200" cy="150" r="96" stroke-dasharray="1 5"/></g>
    <g transform="translate(110 60) scale(1.8)" fill="none" stroke="${IVORY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${emblem(card.symbol)}</g>
    <path d="M0,300 L0,262 Q100,250 200,262 T400,258 V300Z" fill="#000" opacity=".35"/>${vignette(id)}</svg>`;
}
export function cardArt(card) {
  if (card.symbol && card.symbol.startsWith("scene-")) return sceneSVG(card.symbol.slice(6));
  return relicArt(card);
}
export function sealedArt(legend) {
  const P = EMBLEM_PAL[legend] || EMBLEM_PAL.all, id = U("x");
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(id, rg("ID-g", [[0, P.glow, .22], [1, P.glow, 0]]) + rg("ID-w", [[0, "#5a4578"], [1, "#2b2140"]], .38, .35, .75))}
    <rect width="400" height="300" fill="#0c0f10"/><ellipse cx="200" cy="150" rx="190" ry="140" fill="url(#${id}-g)"/>
    <g stroke="${IVORY}" stroke-opacity=".1" fill="none"><path d="M0,40 h400 M0,260 h400 M60,0 v300 M340,0 v300"/><path d="M0,0 L400,300 M400,0 L0,300" stroke-opacity=".05"/></g>
    <g transform="translate(150 100)"><circle cx="50" cy="50" r="42" fill="url(#${id}-w)"/><circle cx="50" cy="50" r="42" fill="none" stroke="#a48ccc" stroke-opacity=".35" stroke-width="1.5"/><circle cx="50" cy="50" r="32" fill="none" stroke="#000" stroke-opacity=".35"/>
      <g fill="none" stroke="#c7b6e6" stroke-opacity=".55" stroke-width="2" stroke-linecap="round">${emblem("seal").replace(/stroke-width="5"/g, "")}</g></g></svg>`;
}
export function logoMark() {
  return `<svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="11.5" opacity=".5"/><path d="M20 3v8M20 29v8M3 20h8M29 20h8" opacity=".7"/><path d="M20 9l3.2 8.8L32 20l-8.8 3.2L20 32l-3.2-8.8L8 20l8.8-3.2z" fill="currentColor" fill-opacity=".18"/></svg>`;
}
