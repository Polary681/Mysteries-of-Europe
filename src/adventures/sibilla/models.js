// THE SIBYL OF THE APENNINES - procedural characters: the Sibyl (tall, ancient, crowned, veiled), her ladies (long skirts over
// goat's hooves that show only when they spin), and the dressing of the low-poly humans shared with the other adventures.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, CylinderGeometry, ConeGeometry, SphereGeometry, BoxGeometry, LatheGeometry, PlaneGeometry, TorusGeometry, Vector2, DoubleSide} from "three";
import { makeHuman, makeShadow, glowSprite } from "../../shared/world.js";

/** one of the Sibyl's ladies: makeHuman in a long gown, a glow, and two small hooves under the hem */
export function makeFairy(i = 0) {
  const pal = [[0xece6f4, 0xc8b8e0], [0xf2e4ea, 0xd8b0c4], [0xe4ecf4, 0xb0c4dc], [0xf4ecdc, 0xd8c498]][i % 4];
  const h = makeHuman({ skin: 0xf0dccc, cloth: pal[0], cloth2: pal[1], hair: [0x2a1a14, 0x8a5a2a, 0xd8c080, 0x1a1418][i % 4], robe: true, longHair: true, scale: 0.98 + (i % 3) * 0.03, emissive: 0x2a1a24 });
  h.group.add(makeShadow(0.5, 0.6));
  const hoofM = new MeshLambertMaterial({ color: 0x1a1210 }), hooves = [];
  for (const s of [-1, 1]) { const f = new Group(); const a = new Mesh(new CylinderGeometry(0.05, 0.07, 0.16, 6), new MeshLambertMaterial({ color: 0x8a6a50 })); a.position.y = 0.12; const b = new Mesh(new BoxGeometry(0.11, 0.07, 0.13), hoofM); b.position.set(0, 0.035, 0.02); f.add(a, b); f.position.set(s * 0.11, 0, 0.12); h.body.add(f); hooves.push(f); }
  const hem = new Mesh(new CylinderGeometry(0.42, 0.5, 0.18, 12, 1, true), new MeshLambertMaterial({ color: pal[1], side: DoubleSide })); hem.position.y = 0.14; h.body.add(hem);
  const glow = glowSprite("235,215,255", 2.4); glow.position.y = 1.1; glow.material.opacity = 0.35; h.group.add(glow);
  const f = { h, hooves, hem, glow, spin: 0, ph: i * 1.3,
    /** dancing: the gown lifts with the spin and shows the hooves */
    dance(dt, t, k = 1) {
      f.spin = k; const lift = Math.max(0, Math.sin(t * 5 + f.ph)) * 0.16 * k;
      hem.position.y = 0.14 + lift; hem.scale.setScalar(1 + lift * 1.4);
      hooves.forEach((q, j) => { q.position.y = Math.max(0, Math.sin(t * 10 + f.ph + j * Math.PI)) * 0.12 * k; });
      h.arms[0].rotation.x = -1.2 * k + Math.sin(t * 5 + f.ph) * 0.3; h.arms[1].rotation.x = -2.3 * k; h.arms[0].rotation.z = 0.4 * k; h.body.position.y = Math.abs(Math.sin(t * 5 + f.ph)) * 0.12 * k;
    },
  };
  return f;
}

/** the Sibyl: tall, in layered robes of dusk-blue and gold, silver hair to the floor, a crown of thin rays, a veil */
export function makeSibyl() {
  const g = new Group(), body = new Group(); g.add(body);
  const robeM = new MeshStandardMaterial({ color: 0x1e2244, roughness: 0.6, metalness: 0.2, emissive: 0x0a0a1a, flatShading: true });
  const goldM = new MeshStandardMaterial({ color: 0xd8b060, roughness: 0.3, metalness: 0.8, emissive: 0x3a2808, flatShading: true });
  const skinM = new MeshLambertMaterial({ color: 0xe8dcd0, emissive: 0x1a1418, flatShading: true }), hairM = new MeshLambertMaterial({ color: 0xd8d8e0, emissive: 0x202028, flatShading: true });
  // gown: a lathe that flares to a train
  const prof = []; for (let k = 0; k <= 10; k++) { const y = k / 10 * 1.5; prof.push(new Vector2(0.62 - Math.pow(k / 10, 0.7) * 0.42 + (k === 0 ? 0.12 : 0), y)); }
  const gown = new Mesh(new LatheGeometry(prof, 14), robeM); body.add(gown);
  const train = new Mesh(new ConeGeometry(0.9, 0.1, 14, 1, true, Math.PI * 0.15, Math.PI * 0.7), robeM); train.position.set(0, 0.05, -0.4); body.add(train);
  for (let k = 0; k < 3; k++) { const band = new Mesh(new TorusGeometry(0.62 - k * 0.14, 0.02, 4, 18), goldM); band.rotation.x = Math.PI / 2; band.position.y = 0.06 + k * 0.42; body.add(band); }
  const torso = new Mesh(new CylinderGeometry(0.17, 0.21, 0.6, 10), robeM); torso.position.y = 1.75; body.add(torso);
  const mantle = new Mesh(new ConeGeometry(0.62, 1.7, 14, 1, true, Math.PI * 0.6, Math.PI * 1.8), new MeshStandardMaterial({ color: 0x3a2a5a, roughness: 0.7, side: DoubleSide, emissive: 0x0c0818, flatShading: true }));
  mantle.position.set(0, 1.15, -0.05); body.add(mantle);
  const collar = new Mesh(new TorusGeometry(0.2, 0.05, 5, 14), goldM); collar.rotation.x = Math.PI / 2; collar.position.y = 2.05; body.add(collar);
  const arms = [-1, 1].map(s => { const p = new Group(); p.position.set(s * 0.24, 2.0, 0); const a = new Mesh(new CylinderGeometry(0.07, 0.11, 0.7, 7), robeM); a.position.y = -0.34; const sl = new Mesh(new ConeGeometry(0.17, 0.4, 8, 1, true), robeM); sl.position.y = -0.62; const hd = new Mesh(new SphereGeometry(0.06, 7, 5), skinM); hd.position.y = -0.78; p.add(a, sl, hd); body.add(p); return p; });
  const head = new Group(); head.position.y = 2.22; body.add(head);
  const face = new Mesh(new SphereGeometry(0.15, 12, 10), skinM); face.scale.set(0.92, 1.12, 0.95); face.position.y = 0.1; head.add(face);
  const eyeM = new MeshBasicMaterial({ color: 0xb8d8ff }); for (const s of [-1, 1]) { const e = new Mesh(new SphereGeometry(0.018, 6, 4), eyeM); e.position.set(s * 0.05, 0.13, 0.135); head.add(e); }
  const hair = new Mesh(new SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, 1.9), hairM); hair.position.y = 0.12; hair.rotation.x = -0.2; head.add(hair);
  const tresses = new Mesh(new BoxGeometry(0.3, 1.9, 0.08), hairM); tresses.position.set(0, -0.78, -0.13); head.add(tresses);
  const crown = new Group(); crown.position.y = 0.28; head.add(crown);
  const circ = new Mesh(new TorusGeometry(0.15, 0.02, 4, 16), goldM); circ.rotation.x = Math.PI / 2; crown.add(circ);
  for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, ray = new Mesh(new ConeGeometry(0.015, 0.18 + (k % 2) * 0.16, 4), goldM); ray.position.set(Math.sin(a) * 0.15, 0.1 + (k % 2) * 0.08, Math.cos(a) * 0.15); ray.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); crown.add(ray); }
  const veil = new Mesh(new PlaneGeometry(0.62, 1.6), new MeshBasicMaterial({ color: 0xd8e0ff, transparent: true, opacity: 0.18, side: DoubleSide, depthWrite: false })); veil.position.set(0, -0.6, -0.2); head.add(veil);
  const halo = glowSprite("255,220,160", 4.5); halo.position.y = 2.4; halo.material.opacity = 0.45; g.add(halo);
  g.add(makeShadow(0.9, 0.7));
  const st = { gest: null, seat: 1 };
  return {
    group: g, body, head, arms, crown, halo, veil,
    /** seat 1 = sitting on the throne, 0 = standing */
    update(dt, t, { talk = 0, lookAt = null } = {}) {
      const s = st.seat; body.position.y = -s * 0.55 + Math.sin(t * 0.8) * 0.01; body.scale.y = 1 - s * 0.04;
      gown.scale.set(1 + s * 0.12, 1 - s * 0.25, 1 + s * 0.3);
      head.rotation.x = Math.sin(t * 0.5) * 0.03 + (lookAt ? -0.06 : 0); head.rotation.z = Math.sin(t * 0.37) * 0.02;
      arms[0].rotation.x = -0.3 - s * 0.6 + Math.sin(t * 1.7) * 0.08 * talk; arms[1].rotation.x = -0.3 - s * 0.6 - Math.max(0, Math.sin(t * 1.1)) * 0.5 * talk; arms[1].rotation.z = -0.15 * talk;
      crown.rotation.y += dt * 0.15; halo.material.opacity = 0.35 + Math.sin(t * 1.2) * 0.08 + talk * 0.1;
      if (st.gest) { const k = (performance.now() - st.gest.t0) / st.gest.dur; if (k >= 1) st.gest = null; else { const e = Math.sin(k * Math.PI); if (st.gest.type === "offer") arms[1].rotation.x = -1.4 * e; if (st.gest.type === "rise") arms[0].rotation.x = arms[1].rotation.x = -0.9 * e; } }
    },
    setSeat(v) { st.seat = v; }, get seat() { return st.seat; },
    gesture(type, dur = 1400) { st.gest = { type, t0: performance.now(), dur }; },
  };
}

/** the travelling cloak and satchel on the player's low-poly body */
export function dressPlayer(h) {
  const cloak = new Mesh(new ConeGeometry(0.42, 1.1, 10, 1, true, Math.PI * 0.75, Math.PI * 1.5), new MeshLambertMaterial({ color: 0x3e4a5a, side: DoubleSide, flatShading: true }));
  cloak.position.set(0, 0.98, -0.02); h.body.add(cloak);
  const bag = new Mesh(new BoxGeometry(0.28, 0.24, 0.12), new MeshLambertMaterial({ color: 0x6a4a2a, flatShading: true })); bag.position.set(0.24, 0.92, 0.1); bag.rotation.z = 0.2; h.body.add(bag);
  const thread = new Mesh(new TorusGeometry(0.06, 0.012, 4, 10), new MeshBasicMaterial({ color: 0xc0202a })); thread.position.y = -0.48; thread.rotation.x = Math.PI / 2; h.arms[0].add(thread); thread.visible = false;
  return { cloak, bag, thread };
}
