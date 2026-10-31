// QUALITY LEVELS for everything that lives in the landing scene and in the page sky.
//   0 = low (essentials, keeps the atmosphere), 1 = medium (fewer particles, lights and details), 2 = high (all effects).
// Chosen from the GPU and the device; the visitor can override it (footer selector, saved), or ?quality=low|medium|high.
import { load, save } from "../shared/save.js";

export const KEY = "moe.quality.v1";
export const NAMES = ["low", "medium", "high"];
const param = () => { try { return new URLSearchParams(location.search).get("quality"); } catch (e) { return null; } };

/** "auto" | "low" | "medium" | "high" */
export function preference() {
  const p = param(); if (p && (p === "auto" || NAMES.includes(p))) return p;
  const s = load(KEY, null); return s && (s === "auto" || NAMES.includes(s)) ? s : "auto";
}
export function setPreference(v) { save(KEY, v === "auto" || NAMES.includes(v) ? v : "auto"); }

/** automatic level from the renderer (software GL -> low), the pointer and the machine */
export function autoTier(renderer) {
  let soft = false;
  try {
    const gl = renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { /* unknown GPU */ }
  if (soft) return 0;
  const coarse = matchMedia("(pointer: coarse)").matches, cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  return coarse || cores <= 4 || mem <= 4 ? 1 : 2;
}
export function pickTier(renderer) {
  const p = preference();
  return p === "auto" ? autoTier(renderer) : NAMES.indexOf(p);
}

/** what each level turns on for the new systems (the landscape itself keeps its own table in hero3d.js) */
export const FEATURES = [
  { reflScale: 0.25, reflEvery: 6, reflTrees: false, crows: 3, wisps: 1, wispLight: false, lanternLight: true, presences: true, fires: 3, skyFps: 12, skyMag: 4.6, flight: true },
  { reflScale: 0.34, reflEvery: 2, reflTrees: false, crows: 5, wisps: 2, wispLight: true, lanternLight: true, presences: true, fires: 6, skyFps: 20, skyMag: 5.0, flight: true },
  { reflScale: 0.5, reflEvery: 1, reflTrees: true, crows: 7, wisps: 2, wispLight: true, lanternLight: true, presences: true, fires: 8, skyFps: 30, skyMag: 5.3, flight: true },
];
/** a tier for pages without a renderer (page sky): from the saved preference, or from the device */
export function domTier() {
  const p = preference(); if (p !== "auto") return NAMES.indexOf(p);
  const coarse = matchMedia("(pointer: coarse)").matches, cores = navigator.hardwareConcurrency || 4;
  return coarse || cores <= 4 ? 1 : 2;
}
