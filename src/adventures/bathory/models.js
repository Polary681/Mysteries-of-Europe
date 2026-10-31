// ELIZABETH BÁTHORY — the countess as a believable noblewoman of early seventeenth-century Hungary: black velvet gown over a
// burgundy front panel with gold braid, puffed sleeves, a white standing lace collar, pearls in her dark hair and at her throat.
// No supernatural features. She stands, turns, walks (the gown sways) and gestures.
import { Group, Mesh, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, ConeGeometry, SphereGeometry, BoxGeometry, LatheGeometry, TorusGeometry, Vector2, DoubleSide } from "three";
import { makeShadow, makeHuman } from "../../shared/world.js";

export function makeCountess() {
  const g = new Group(), body = new Group(); g.add(body);
  const velvet = new MeshStandardMaterial({ color: 0x141014, roughness: 0.85, metalness: 0.05, flatShading: true });
  const burg = new MeshStandardMaterial({ color: 0x5a1420, roughness: 0.7, flatShading: true });
  const gold = new MeshStandardMaterial({ color: 0xb8963e, roughness: 0.35, metalness: 0.75, emissive: 0x1a1004, flatShading: true });
  const lace = new MeshLambertMaterial({ color: 0xf0eadc, side: DoubleSide, flatShading: true }), skin = new MeshLambertMaterial({ color: 0xe8d6c6, flatShading: true });
  const hairM = new MeshLambertMaterial({ color: 0x1e140e, flatShading: true }), pearl = new MeshLambertMaterial({ color: 0xf6f2ea, emissive: 0x1a1a18 });
  // skirt: a full bell over a farthingale
  const prof = []; for (let k = 0; k <= 10; k++) { const t = k / 10; prof.push(new Vector2(0.58 - t * 0.38 - Math.sin(t * Math.PI) * 0.02, t * 1.02)); }
  const skirt = new Mesh(new LatheGeometry(prof, 16), velvet); body.add(skirt);
  const panel = new Mesh(new BoxGeometry(0.34, 1.0, 0.04), burg); panel.position.set(0, 0.5, 0.42); panel.rotation.x = -0.36; body.add(panel);
  for (let k = 0; k < 5; k++) { const b = new Mesh(new BoxGeometry(0.36 - k * 0.04, 0.025, 0.05), gold); b.position.set(0, 0.12 + k * 0.2, 0.44 - k * 0.07); b.rotation.x = -0.36; body.add(b); }
  const hem = new Mesh(new TorusGeometry(0.57, 0.025, 4, 20), gold); hem.rotation.x = Math.PI / 2; hem.position.y = 0.04; body.add(hem);
  // bodice, stomacher, sleeves
  const bod = new Mesh(new CylinderGeometry(0.17, 0.21, 0.5, 10), velvet); bod.position.y = 1.26; body.add(bod);
  const stom = new Mesh(new ConeGeometry(0.1, 0.46, 4), burg); stom.rotation.x = Math.PI; stom.position.set(0, 1.25, 0.15); stom.scale.z = 0.4; body.add(stom);
  for (let k = 0; k < 3; k++) { const p = new Mesh(new SphereGeometry(0.018, 6, 4), pearl); p.position.set(0, 1.4 - k * 0.12, 0.2); body.add(p); }
  const belt = new Mesh(new TorusGeometry(0.2, 0.02, 4, 14), gold); belt.rotation.x = Math.PI / 2; belt.position.y = 1.03; body.add(belt);
  const arms = [-1, 1].map(s => { const p = new Group(); p.position.set(s * 0.22, 1.46, 0); const puff = new Mesh(new SphereGeometry(0.11, 8, 6), velvet); puff.scale.set(1, 1.2, 1); puff.position.y = -0.08;
    const sl = new Mesh(new CylinderGeometry(0.06, 0.075, 0.48, 7), velvet); sl.position.y = -0.38; const cuff = new Mesh(new CylinderGeometry(0.075, 0.05, 0.06, 8), lace); cuff.position.y = -0.62;
    const hand = new Mesh(new SphereGeometry(0.05, 7, 5), skin); hand.position.y = -0.68; p.add(puff, sl, cuff, hand); body.add(p); return p; });
  // the standing lace collar (a flared ring behind the neck)
  const collar = new Mesh(new CylinderGeometry(0.2, 0.09, 0.16, 18, 1, true, Math.PI * 0.75, Math.PI * 1.5), lace); collar.position.set(0, 1.6, -0.02); collar.rotation.y = 0; body.add(collar);
  const ruffle = new Mesh(new TorusGeometry(0.1, 0.025, 4, 16), lace); ruffle.rotation.x = Math.PI / 2; ruffle.position.y = 1.53; body.add(ruffle);
  const neck = new Mesh(new CylinderGeometry(0.05, 0.06, 0.1, 8), skin); neck.position.y = 1.56; body.add(neck);
  const neckl = new Mesh(new TorusGeometry(0.08, 0.012, 4, 16), pearl); neckl.rotation.x = Math.PI / 2 - 0.3; neckl.position.set(0, 1.52, 0.03); body.add(neckl);
  const head = new Group(); head.position.y = 1.62; body.add(head);
  const face = new Mesh(new SphereGeometry(0.12, 12, 10), skin); face.scale.set(0.88, 1.1, 0.92); face.position.y = 0.1; head.add(face);
  const eyeM = new MeshBasicMaterial({ color: 0x1a120c }); for (const s of [-1, 1]) { const e = new Mesh(new SphereGeometry(0.014, 6, 4), eyeM); e.position.set(s * 0.04, 0.12, 0.105); head.add(e); }
  const brow = new Mesh(new BoxGeometry(0.1, 0.008, 0.01), eyeM); brow.position.set(0, 0.155, 0.11); head.add(brow);
  const lips = new Mesh(new BoxGeometry(0.035, 0.008, 0.01), new MeshBasicMaterial({ color: 0x7a3a3a })); lips.position.set(0, 0.05, 0.112); head.add(lips);
  const hair = new Mesh(new SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, 1.75), hairM); hair.position.y = 0.12; hair.rotation.x = -0.15; head.add(hair);
  const bun = new Mesh(new SphereGeometry(0.075, 8, 6), hairM); bun.position.set(0, 0.14, -0.12); head.add(bun);
  // a pearl-studded cap (married women's headdress) on the back of the head
  const cap = new Mesh(new SphereGeometry(0.135, 12, 6, 0, Math.PI * 2, 0, 1.1), burg); cap.position.set(0, 0.15, -0.03); cap.rotation.x = -0.55; head.add(cap);
  for (let k = 0; k < 12; k++) { const a = -Math.PI * 0.9 + k / 11 * Math.PI * 1.8, p = new Mesh(new SphereGeometry(0.012, 5, 4), pearl); p.position.set(Math.sin(a) * 0.12, 0.2 + Math.cos(a) * 0.03, -0.03 + Math.cos(a) * 0.075); head.add(p); }
  g.add(makeShadow(0.7, 0.8));
  const st = { gest: null, walk: 0, ph: 0 };
  return {
    group: g, body, head, arms,
    update(dt, t, { talk = 0, speed = 0, lookAt = null } = {}) {
      st.ph += dt * (2 + speed * 3); st.walk += (Math.min(1, speed) - st.walk) * Math.min(1, dt * 5);
      const w = st.walk; skirt.rotation.z = Math.sin(st.ph * 2) * 0.03 * w; skirt.scale.set(1 + Math.sin(st.ph * 2) * 0.02 * w, 1, 1);
      body.position.y = Math.abs(Math.sin(st.ph * 2)) * 0.015 * w + Math.sin(t * 1.1) * 0.004;
      bod.scale.set(1, 1 + Math.sin(t * 1.4) * 0.012, 1);   // breathing
      arms[0].rotation.x = -0.25 - Math.sin(t * 0.9) * 0.03; arms[1].rotation.x = -0.25 - Math.max(0, Math.sin(t * 1.3)) * 0.35 * talk; arms[0].rotation.z = 0.12; arms[1].rotation.z = -0.12 - talk * 0.1;
      let ty = 0; if (lookAt) { let a = Math.atan2(lookAt.x - g.position.x, lookAt.z - g.position.z) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); ty = Math.max(-0.9, Math.min(0.9, a)); }
      head.rotation.y += (ty - head.rotation.y) * Math.min(1, dt * 3); head.rotation.x = Math.sin(t * 0.6) * 0.02 + talk * Math.sin(t * 2.3) * 0.03;
      if (st.gest) { const k = (performance.now() - st.gest.t0) / st.gest.dur; if (k >= 1) st.gest = null; else { const e = Math.sin(k * Math.PI);
        if (st.gest.type === "raise") arms[1].rotation.x = -1.3 * e; else if (st.gest.type === "dismiss") { arms[1].rotation.x = -0.9 * e; arms[1].rotation.z = -0.6 * e; } else if (st.gest.type === "tilt") head.rotation.z = 0.15 * e; } }
    },
    gesture(type, dur = 1400) { st.gest = { type, t0: performance.now(), dur }; },
    faceToward(x, z, k = 1) { let a = Math.atan2(x - g.position.x, z - g.position.z) - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); g.rotation.y += a * k; },
  };
}

/** the clerk: a black coat with a white collar, a satchel of papers */
export function dressClerk(h) {
  const collar = new Mesh(new CylinderGeometry(0.17, 0.13, 0.06, 12), new MeshLambertMaterial({ color: 0xece6d8 })); collar.position.y = 1.38; h.body.add(collar);
  const bag = new Mesh(new BoxGeometry(0.3, 0.24, 0.1), new MeshLambertMaterial({ color: 0x5a3e24, flatShading: true })); bag.position.set(-0.26, 0.92, 0.08); bag.rotation.z = -0.2; h.body.add(bag);
  const roll = new Mesh(new CylinderGeometry(0.025, 0.025, 0.3, 6), new MeshLambertMaterial({ color: 0xe8dcc0 })); roll.position.set(-0.26, 1.06, 0.1); roll.rotation.z = Math.PI / 2 - 0.2; h.body.add(roll);
  return { collar, bag };
}
export { makeHuman };
