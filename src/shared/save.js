// Progress storage: localStorage when available (survives between visits), in-memory otherwise (survives the session).
const mem = {};
export function load(key, def = null) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch (e) { /* private mode / blocked */ }
  return mem[key] !== undefined ? JSON.parse(mem[key]) : def;
}
export function save(key, val) {
  const s = JSON.stringify(val); mem[key] = s;
  try { localStorage.setItem(key, s); } catch (e) { /* ignore */ }
}
export function clear(key) { delete mem[key]; try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
/** a stored record that must be a plain object (a damaged value - an array, a number, a string - gives `def`) */
export function loadObj(key, def = {}) { const v = load(key, null); return v && typeof v === "object" && !Array.isArray(v) ? v : def; }
