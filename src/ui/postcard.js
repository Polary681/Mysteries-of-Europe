// THE POSTCARD: a PNG of the valley as it looks right now, with the date, the Moon's phase and how many relics the visitor
// has recovered. Made entirely in the browser (a 2D canvas over one frame of the 3D valley) and downloaded as a file.
import * as Archive from "../shared/archive.js";
import * as Journal from "../shared/journal.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const W = 1500, H = 1000;

/** draws the postcard on a new canvas; `gl` is the landing scene (hero3d) API. Returns the canvas, or null without the 3D valley. */
export async function drawPostcard(gl) {
  if (!gl || !gl.isReady || !gl.isReady()) return null;
  try { await Promise.all(["900 60px Cinzel", "700 30px Cinzel", "400 30px Outfit", "italic 400 34px Cormorant"].map(f => document.fonts.load(f))); } catch (e) { /* fallback fonts */ }
  const sz = gl.size(), shot = document.createElement("canvas"); shot.width = sz.w; shot.height = sz.h;
  if (!gl.snapshot(shot)) return null;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  // the valley, cover-fitted
  const k = Math.max(W / sz.w, H / sz.h), dw = sz.w * k, dh = sz.h * k; g.drawImage(shot, (W - dw) / 2, (H - dh) / 2, dw, dh);
  // vignette and a band for the text
  let gr = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, H * 0.95); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(0, H * 0.68, 0, H); gr.addColorStop(0, "rgba(4,6,8,0)"); gr.addColorStop(1, "rgba(4,6,8,.88)"); g.fillStyle = gr; g.fillRect(0, H * 0.6, W, H * 0.4);
  gr = g.createLinearGradient(0, 0, 0, H * 0.3); gr.addColorStop(0, "rgba(4,6,8,.7)"); gr.addColorStop(1, "rgba(4,6,8,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.3);
  // the frame
  g.strokeStyle = "rgba(233,225,203,.55)"; g.lineWidth = 2; g.strokeRect(30, 30, W - 60, H - 60); g.strokeStyle = "rgba(233,225,203,.2)"; g.strokeRect(40, 40, W - 80, H - 80);
  // title
  const ivory = "#e9e1cb", mut = "rgba(233,225,203,.72)";
  g.fillStyle = ivory; g.font = "900 60px Cinzel, serif"; g.textBaseline = "alphabetic"; g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 18; g.fillText("MYSTERIES OF EUROPE", 84, 134);
  g.font = "italic 400 34px Cormorant, Georgia, serif"; g.fillStyle = mut; g.fillText("Greetings from the valley below the castle", 88, 182); g.shadowBlur = 0;
  // the facts
  const sky = gl.sky ? gl.sky() : null, lp = sky && sky.local, moon = sky && sky.astro && sky.astro.moon, p = Archive.progress(), j = Journal.progress();
  const date = lp ? `${lp.d} ${MONTHS[lp.m - 1]} ${lp.y} · ${lp.hhmm}` : new Date().toDateString();
  const col = (x, label, value, sub) => { g.fillStyle = "rgba(214,192,126,.9)"; g.font = "600 19px Outfit, sans-serif"; g.fillText(label.toUpperCase().split("").join(String.fromCharCode(8202)), x, H - 168); g.fillStyle = ivory; g.font = "700 34px Cinzel, serif"; g.fillText(value, x, H - 122); if (sub) { g.fillStyle = mut; g.font = "400 21px Outfit, sans-serif"; g.fillText(sub, x, H - 88); } };
  col(88, "The night", date, sky ? `${sky.ref ? sky.ref.name : ""}${sky.season ? " · " + sky.season.label : ""}${sky.night ? " · " + sky.night.label : ""}` : "");
  if (moon) { drawMoon(g, 640, H - 140, 30, moon.fraction, moon.waxing); col(690, "The Moon", `${Math.round(moon.fraction * 100)}% lit`, moon.name); }
  col(1060, "The Archive", `${p.relicsUnlocked} / ${p.relics} relics`, `${j.seen} of ${j.total} sightings in the journal`);
  // a stamp
  g.save(); g.translate(W - 210, 70); g.strokeStyle = "rgba(233,225,203,.6)"; g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeRect(0, 0, 124, 150); g.setLineDash([]);
  g.fillStyle = "rgba(10,14,18,.6)"; g.fillRect(8, 8, 108, 134); if (moon) drawMoon(g, 62, 62, 26, moon.fraction, moon.waxing);
  g.fillStyle = mut; g.font = "700 15px Cinzel, serif"; g.textAlign = "center"; g.fillText("M · O · E", 62, 124); g.restore();
  return c;
}
function drawMoon(g, x, y, r, f, waxing) {
  g.save(); g.translate(x, y); g.fillStyle = "rgba(20,24,30,.95)"; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
  g.rotate(waxing ? 0 : Math.PI); g.fillStyle = "#ecebe0"; g.shadowColor = "rgba(236,235,224,.6)"; g.shadowBlur = 14; g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); g.ellipse(0, 0, Math.abs(2 * f - 1) * r + 0.01, r, 0, Math.PI / 2, -Math.PI / 2, f < 0.5); g.fill(); g.restore();
}
/** draws and downloads the postcard; returns the file name (or null) */
export async function downloadPostcard(gl) {
  const c = await drawPostcard(gl); if (!c) return null;
  const sky = gl.sky && gl.sky(), lp = sky && sky.local, name = `mysteries-of-europe-postcard-${lp ? `${lp.y}-${String(lp.m).padStart(2, "0")}-${String(lp.d).padStart(2, "0")}` : "valley"}.png`;
  const blob = await new Promise(r => c.toBlob(r, "image/png")); if (!blob) return null;
  const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}
