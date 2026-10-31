// Line-art plates for A European Bestiary (inline SVG, no files): the same drawn, single-stroke language as the Archive's
// emblems (src/ui/art.js). Colours come from CSS (currentColor + --ink-glow), so the plates follow the page palette.
const S = (body, extra = "") => `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;
const ground = `<path d="M10 104h100" opacity=".35"/><path d="M18 109h30M64 109h38" opacity=".2"/>`;
const moon = (x, y, r = 8) => `<path d="M${x} ${y - r}a${r} ${r} 0 1 0 ${r * .9} ${r * 1.45}a${r * .8} ${r * .8} 0 0 1-${r * .9}-${r * 1.45}z" class="ba-glow"/>`;
const PLATES = {
  babayaga: () => S(`${moon(96, 22)}<path d="M30 54L60 30l30 24"/><path d="M36 50v28h48V50"/><path d="M54 78V62h12v16"/><path d="M42 58h7v7h-7zM71 58h7v7h-7z" class="ba-glow"/>
    <path d="M48 78l-4 14 6 10"/><path d="M50 102l-8 3M50 102l2 6M50 102l7 1"/><path d="M72 78l5 13-6 11"/><path d="M71 102l-7 2M71 102l1 7M71 102l8 0"/>
    <path d="M24 44l-6-4M26 38l-4-6M96 44l6-4" opacity=".5"/>${ground}`),
  leshy: () => S(`<path d="M52 104c2-20-2-36 0-56M68 104c-2-20 2-36 0-56"/><path d="M52 48c-10-6-14-16-14-28M52 40c-6-2-12-2-18 2M68 48c10-6 14-16 14-28M68 40c6-2 12-2 18 2M60 46V22M60 30l-7-8M60 30l7-8"/>
    <circle cx="55" cy="62" r="2.4" class="ba-eye"/><circle cx="65" cy="62" r="2.4" class="ba-eye"/><path d="M54 74c4 3 8 3 12 0" opacity=".7"/><path d="M56 80c-1 8-6 14-12 18M64 80c1 8 6 14 12 18M60 82v14" opacity=".55"/>
    <path d="M18 104c2-14 0-26 4-40M98 104c-2-12 0-22-4-34" opacity=".35"/>${ground}`),
  fate: () => S(`${moon(24, 22, 7)}<circle cx="60" cy="28" r="7"/><path d="M60 35v14"/><path d="M60 40c-8-4-14-12-16-20M60 40c8-4 14-12 18-18"/><path d="M52 50h16l14 40H38z"/>
    <path d="M44 74c6 3 26 3 32 0M41 84c8 3 30 3 38 0" opacity=".5"/><path d="M54 90l-2 10h6l1-4 1 4h6l-2-10" class="ba-glow"/><path d="M58 100v-4" opacity=".6"/>
    <path d="M18 98c10-6 18-6 26 0M76 98c8-6 18-6 26 0" opacity=".35"/>${ground}`),
  wisp: () => S(`<path d="M60 26c-8 10-12 19-12 27a12 12 0 0 0 24 0c0-8-4-17-12-27z" class="ba-glow"/><path d="M60 42c-3 4-5 8-5 11a5 5 0 0 0 10 0c0-3-2-7-5-11z"/>
    <circle cx="30" cy="48" r="2.5" class="ba-glow"/><circle cx="88" cy="40" r="2" class="ba-glow"/><circle cx="94" cy="64" r="1.6" class="ba-glow"/>
    <path d="M20 104c0-14 2-22 4-30M26 104c0-10 4-18 8-22M92 104c0-12-2-20-6-28M98 104c0-8 2-14 4-18"/><path d="M14 92c14-4 26-4 40 0s26 4 52 0" opacity=".45"/><path d="M24 98c10-2 20-2 30 0" opacity=".3"/>${ground}`),
  fairfolk: () => S(`<path d="M14 100c8-30 30-46 46-46s38 16 46 46"/><path d="M50 100V84a10 10 0 0 1 20 0v16" class="ba-glow"/><circle cx="60" cy="88" r="1.4"/>
    <path d="M24 92c0-3 2-5 4-5s4 2 4 5zM88 92c0-3 2-5 4-5s4 2 4 5zM34 74c0-3 2-5 4-5s4 2 4 5zM80 74c0-3 2-5 4-5s4 2 4 5z" opacity=".7"/>
    <path d="M28 92v4M92 92v4M38 74v4M84 74v4" opacity=".7"/><path d="M30 26l1.5 3 3 .5-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.5zM86 18l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" class="ba-glow"/>${ground}`),
  blackshuck: () => S(`<path d="M24 98L27 76C29 68 35 64 43 64H73C79 64 83 60 85 54L87 46 93 40 95 46 98 42 100 50C102 56 100 62 94 66L92 76 94 98H89L86 80 81 79 80 98H75L73 80H42L38 98H33V82L30 83 29 98z" class="ba-dark"/><path d="M27 72c-8-1-14-6-14-16"/>
    <circle cx="95" cy="50" r="2.1" class="ba-eye"/><path d="M14 30l6 10-4 2 8 14" class="ba-glow" opacity=".7"/>${ground}`),
  eachuisge: () => S(`<path d="M50 96l2-26c-4-16 2-30 14-38l4-10 4 9c12 3 20 13 22 25 1 5-2 8-6 7l-10-4c-6 4-8 10-8 18v19"/>
    <path d="M66 32c-6 6-10 14-10 24M70 34c-4 8-6 16-6 26M74 36c-2 8-2 16 0 24" opacity=".55"/><circle cx="82" cy="40" r="2" class="ba-eye"/>
    <path d="M10 96c8-5 14-5 20 0s14 5 20 0M70 96c8-5 14-5 20 0s14 5 20 0M18 106c8-4 14-4 20 0s14 4 20 0 14-4 20 0 14 4 20 0"/>`),
  strigoi: () => S(`${moon(94, 22)}<path d="M42 104V58a18 18 0 0 1 36 0v46"/><path d="M60 62v24M52 70h16"/>
    <path d="M24 92c-6 0-9-5-7-10 1-4 5-6 7-10 2 4 6 6 7 10 2 5-1 10-7 10z" class="ba-glow"/><path d="M24 72v-6c2-2 4-3 6-3M22 80c1 4 1 8 2 12M26 80c-1 4-1 8-2 12" opacity=".6"/>
    <path d="M86 104v-18h12v18M92 82v-6M88 80h8" opacity=".6"/>${ground}`),
  upir: () => S(`<path d="M46 20l28 0 10 22-10 62H46l-10-62z"/><path d="M60 40v34M50 52h20"/>
    <path d="M18 34c4-4 8-4 12 0 2-3 5-4 8-2-3 1-5 4-6 7-4-3-10-3-14-5zM88 26c4-4 8-4 12 0 2-3 5-4 8-2-3 1-5 4-6 7-4-3-10-3-14-5z" class="ba-dark" opacity=".8"/>
    <path d="M20 104v-14h8v14M96 104v-10h6v10" opacity=".5"/>${ground}`),
  banshee: () => S(`<circle cx="60" cy="34" r="10"/><path d="M50 34c-6 14-8 34-14 52M54 42c-4 16-4 32-8 48M70 34c6 14 8 34 14 52M66 42c4 16 4 32 8 48"/>
    <path d="M56 37q4 3 8 0" opacity=".7"/><path d="M60 48v42M48 90h24"/><path d="M76 54h14v6H76zM78 60v6M82 60v6M86 60v6" class="ba-glow"/>
    <path d="M14 100c10-4 20-4 30 0s20 4 32 0 22-4 30 0" opacity=".35"/>`),
  brocken: () => S(`<circle cx="76" cy="28" r="12" class="ba-glow"/><path d="M58 40l38-20M88 22l8 4M88 22l4-6" opacity=".9"/>
    <path d="M8 96l30-40 12 10 14-24 18 26 10-8 20 36"/><path d="M50 66c0 0 4-2 6 0" opacity=".4"/>
    <ellipse cx="34" cy="84" rx="9" ry="11" opacity=".5"/><ellipse cx="34" cy="84" rx="14" ry="16" opacity=".3"/><path d="M34 78v10M31 82h6" />${ground}`),
};
export const beastArt = id => (PLATES[id] ? PLATES[id]() : "");
