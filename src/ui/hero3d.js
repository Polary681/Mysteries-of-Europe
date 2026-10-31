// The landing scene, rendered in real time with three.js: a moonlit valley, a castle on a crag, a conifer forest,
// layered valley mist and a night sky. Everything is procedural (no image or model files) and deterministic.
//
//   createHero3D(host, { reduce, onFail }) -> { setView(px, py, scroll), intro(), skipIntro(), stats(), dispose() } | null (no WebGL)
//
// Pipeline: scene (HDR, MSAA, depth texture) -> height fog + valley mist (depth based) -> bloom -> tone map, grade, grain.
// Quality follows the device (3 tiers) and the frame time (dynamic resolution). The shadow map is drawn once.
import {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, OrthographicCamera, Mesh, InstancedMesh, Group, Object3D,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, DirectionalLight, HemisphereLight, PointLight, Color, Vector3, Matrix4,
  CanvasTexture, DepthTexture, UnsignedIntType, HalfFloatType, UnsignedByteType, SRGBColorSpace, DoubleSide, BackSide, PCFSoftShadowMap, Vector4,
  NoToneMapping, LinearMipmapLinearFilter, LinearFilter, Points, AdditiveBlending, Vector2, Quaternion,
} from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, noise2, fbm, smooth, lerp } from "../shared/world.js";

import { clamp, DEG, C, CAM_UP, cragR, H, forestDensity, slopeY, LAKE, lakeR } from "../world/terrain.js";
import { pickTier, FEATURES, NAMES as QNAMES } from "../world/quality.js";
import { tonight, valleyAzimuth, enuToWorld } from "../world/sky.js";
import { norm360, NAMED_STARS } from "../world/astro.js";
import { createStars, eqToWorldMatrix } from "../world/celestial.js";
import { createLake, LAYER_NOREFL } from "../world/lake.js";
import { createLantern } from "../world/lantern.js";
import { createWisps } from "../world/wisps.js";
import { createPresences } from "../world/presences.js";
import { createCastleProgress } from "../world/castle-progress.js";
const LIGHT_DIR = new Vector3(Math.sin(86 * DEG) * Math.cos(30 * DEG), Math.sin(30 * DEG), -Math.cos(86 * DEG) * Math.cos(30 * DEG)).normalize();

import { GLSL_NOISE, GLSL_BUMP, GLSL_CLOUDS } from "../world/glsl.js";

/** inject code into a MeshStandardMaterial / MeshBasicMaterial (world position + normal available as vW / vWN) */
function patch(mat, key, o) {
  mat.customProgramCacheKey = () => "hero3d-" + key;
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, o.uniforms || {});
    const std = /normal_fragment_maps/.test(s.fragmentShader);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;\n${o.vDecl || ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${o.vBegin || ""}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>
        { vec4 _w = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          _w = instanceMatrix * _w;
        #endif
          _w = modelMatrix * _w; vW = _w.xyz;
          vec3 _n = ${std ? "objectNormal" : "vec3(0.,1.,0.)"};
        #ifdef USE_INSTANCING
          _n = mat3(instanceMatrix) * _n;
        #endif
          vWN = normalize(mat3(modelMatrix) * _n); }
        ${o.vMain || ""}`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;\n${GLSL_NOISE}\n${std ? GLSL_BUMP : ""}\n${o.fDecl || ""}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${o.fColor || ""}`);
    if (std) s.fragmentShader = s.fragmentShader
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${o.fRough || ""}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${o.fNormal || ""}`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${o.fAO || ""}`);
    if (o.uniforms) mat.userData.shader = s;
  };
  return mat;
}

/* =====================================================================================  TEXTURES (canvas, painted once) */
/** foliage atlas: [0,.5] a spruce branch seen from above, [.5,.8] hanging twigs, [.8,1] bark */
function foliageAtlas(size) {
  const W = size, Hh = size, c = document.createElement("canvas"); c.width = W; c.height = Hh;
  const g = c.getContext("2d"), r = rng(911), s = W / 512;
  const green = (k = 1) => { const l = (0.6 + r() * 0.4) * k; return `rgb(${Math.round(44 * l + r() * 8)},${Math.round(56 * l + r() * 9)},${Math.round(42 * l + r() * 6)})`; };
  g.lineCap = "round";
  /** a frond: a solid needle mass along a twig (so mip-mapping keeps it opaque) with a fringe of single needles */
  const frond = (x0, y0, ang, len, nl) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, N = 14, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = nl * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95))) * (1 - 0.45 * t) * (0.85 + r() * 0.3);
      const x = x0 + ca * len * t, y = y0 + sa * len * t; L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
    }
    g.fillStyle = green(0.72); g.beginPath(); g.moveTo(x0, y0); L.forEach(p => g.lineTo(p[0], p[1])); R.reverse().forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.fill();
    const steps = Math.max(6, Math.round(len / (3.2 * s)));
    for (let i = 0; i < steps; i++) {
      const t = i / steps, x = x0 + ca * len * t, y = y0 + sa * len * t, ln = nl * (1.15 - 0.5 * t);
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        const a = ang + side * (0.65 + r() * 0.55), l2 = ln * (0.7 + r() * 0.45);
        g.strokeStyle = green(t > 0.82 ? 1.15 : 0.85 + r() * 0.3); g.lineWidth = (1.6 + r()) * s;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l2, y + Math.sin(a) * l2); g.stroke();
      }
    }
    g.strokeStyle = "rgb(40,32,23)"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ca * len, y0 + sa * len); g.stroke();
  };
  // --- a branch (seen from above): main axis left -> right, twigs alternating on both sides
  const cy = Hh * 0.5, mainLen = W * 0.47;
  for (let i = 0; i < 12; i++) {
    const t = 0.06 + i / 12 * 0.86, x = mainLen * t, side = i % 2 ? 1 : -1, len = (1 - t * 0.65) * Hh * 0.4 * (0.8 + r() * 0.35);
    frond(x, cy, side * (0.6 + r() * 0.3), len, 13 * s * (1 - t * 0.4));
  }
  frond(0, cy, 0, mainLen, 16 * s);
  // --- hanging twigs (seen from the side): a curtain of drooping shoots
  for (let i = 0; i < 6; i++) {
    const x = W * 0.5 + W * 0.3 * (0.1 + i / 6 * 0.82), len = Hh * (0.6 + r() * 0.35);
    frond(x, 0, Math.PI / 2 + (r() - 0.5) * 0.15, len, 12 * s);
  }
  // --- bark
  const bx = W * 0.8; g.fillStyle = "rgb(46,38,31)"; g.fillRect(bx, 0, W - bx, Hh);
  for (let i = 0; i < 260; i++) { const x = bx + r() * (W - bx), y = r() * Hh, l = 6 + r() * 30; g.strokeStyle = r() < 0.5 ? "rgba(20,16,12,.7)" : "rgba(88,80,70,.35)"; g.lineWidth = (1 + r() * 2) * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l * s); g.stroke(); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter;
  return t;
}
/** an arched mullioned window (white = glass, alpha outside) */
function windowTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(6, 128); g.lineTo(6, 40); g.quadraticCurveTo(6, 4, 32, 2); g.quadraticCurveTo(58, 4, 58, 40); g.lineTo(58, 128); g.closePath(); g.fill();
  const gr = g.createRadialGradient(32, 80, 4, 32, 80, 70); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(150,150,150,1)");
  g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.fillStyle = "rgba(20,20,20,1)"; g.fillRect(29, 10, 6, 118); g.fillRect(6, 62, 52, 5);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/* =====================================================================================  TERRAIN
   A polar grid centred on the camera: vertices are spread evenly in screen space, dense in the foreground and
   sparse towards the mountains, so the whole landscape is one mesh with "free" level of detail. */
function buildTerrain(dTheta) {
  const a0 = -1.52, a1 = 1.52, r0 = 7, r1 = 7600;   // wide enough to look down on the valley from above (camera flights)
  const cols = Math.ceil((a1 - a0) / dTheta) + 1, rows = Math.ceil(Math.log(r1 / r0) / dTheta) + 1;
  const n = cols * rows, pos = new Float32Array(n * 3), hts = new Float32Array(n);
  for (let i = 0; i < rows; i++) {
    const r = Math.min(r1, r0 * Math.exp(i * dTheta));
    for (let j = 0; j < cols; j++) {
      const a = a0 + j * dTheta, x = Math.sin(a) * r, z = -Math.cos(a) * r, h = H(x, z), k = i * cols + j;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; hts[k] = h;
    }
  }
  const idx = new Uint32Array((rows - 1) * (cols - 1) * 6); let q = 0;
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setIndex(new BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // per-vertex sky occlusion (concavity) and forest cover
  const nrm = g.attributes.normal.array, ao = new Float32Array(n), forest = new Float32Array(n), K = 3;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const k = i * cols + j; let sum = 0, cnt = 0;
    for (const [di, dj] of [[K, 0], [-K, 0], [0, K], [0, -K], [K, K], [-K, -K]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= rows || jj >= cols) continue; sum += hts[ii * cols + jj]; cnt++; }
    const r = r0 * Math.exp(i * dTheta), cav = (sum / cnt - hts[k]) / Math.max(1, r * dTheta * K);
    ao[k] = clamp(1 - cav * 1.8, 0.35, 1);
    forest[k] = forestDensity(pos[k * 3], pos[k * 3 + 2], hts[k], nrm[k * 3 + 1]);
  }
  g.setAttribute("aAO", new Float32BufferAttribute(ao, 1));
  g.setAttribute("aForest", new Float32BufferAttribute(forest, 1));
  g.computeBoundingSphere();
  return g;
}

// the season's look (sky.js SEASONS), shared by the terrain, the spruces (and so their baked impostors) and the roofs
const SEASON_U = { uSnow: { value: 0 }, uGreen: { value: 0 }, uBrown: { value: 0 } };
const SEASON_DECL = "uniform float uSnow, uGreen, uBrown;";
function terrainMaterial(rockOnly) {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  if (rockOnly) m.defines = { ROCK_ONLY: "" };
  return patch(m, rockOnly ? "rock" : "terrain", {
    uniforms: SEASON_U,
    vDecl: "attribute float aAO; attribute float aForest; varying float vAO; varying float vForest;",
    vMain: rockOnly ? "vAO = 1.; vForest = 0.;" : "vAO = aAO; vForest = aForest;",
    fDecl: "varying float vAO; varying float vForest; float bumpH; float rockM; float snowM;" + SEASON_DECL,
    fColor: /* glsl */`
      float slope = 1. - clamp(vWN.y, 0., 1.);
      float camD = length(vW - cameraPosition);
      float pxm = length(fwidth(vW));                                            // metres per pixel: fade detail we cannot resolve
      float n1 = fbmAA(vW.xz * .012, pxm * .012);
      float n2 = mix(vnoise(vW.xz * .11), .5, smoothstep(.2, .5, pxm * .11));
      float n3 = mix(vnoise(vW.xz * .9 + vW.y * .3), .5, smoothstep(.2, .5, pxm * .9));
      float strata = fbmAA(vec2(vW.y * .23 + n1 * 4., (vW.x + vW.z) * .018), pxm * .23);
      strata = mix(.5, strata, .75);
    #ifdef ROCK_ONLY
      rockM = 1.;
    #else
      rockM = smoothstep(.24, .42, slope + (n1 - .5) * .22);
    #endif
      vec3 grass = mix(vec3(.026,.036,.020), vec3(.048,.054,.028), n2) * (.8 + .4 * n3);
      grass = mix(grass, vec3(.05,.042,.03), smoothstep(.56,.76,n1) * .8);              // dry grass, bracken
      grass *= .7 + .6 * fbmAA(vW.xz * .045 + 2., pxm * .045);                            // tussocks, wet hollows
      grass *= mix(vec3(1.), vec3(.8, 1.32, .76), uGreen);                                  // spring: fresh green
      grass = mix(grass, grass * vec3(1.6, 1.02, .5) + vec3(.012, .005, 0.), uBrown * smoothstep(.25, .7, n2 + .15));   // autumn: brown bracken
      vec3 floorC = vec3(.024,.021,.016) * (.8 + .4 * n3);                               // needle litter
      float fo = vForest;
      vec3 canopy = vec3(.018,.026,.018) * (.55 + .9 * vnoise(vW.xz * .07));             // far forest seen as texture
      grass = mix(grass, mix(floorC, canopy, smoothstep(250., 900., camD)), fo);
      vec3 rock = mix(vec3(.06,.059,.056), vec3(.14,.133,.122), strata) * (.72 + .5 * n3);
      rock = mix(rock, rock * vec3(.75,.9,.62), smoothstep(.5,.85,n2) * .55);              // lichen
      snowM = smoothstep(430. - uSnow * 140., 560. - uSnow * 140., vW.y + n1 * 170.) * (1. - smoothstep(.42, .72, slope));
      snowM = max(snowM, uSnow * (1. - smoothstep(.22, .5, slope)) * smoothstep(.3, .62, n2 * .55 + n1 * .65) * (1. - fo * .6));   // winter: snow on the meadows, patchy under the trees
      vec3 col = mix(grass, rock, rockM);
      col = mix(col, vec3(.6,.64,.7) * (.85 + .15 * n2), snowM);
      diffuseColor.rgb = col;
      float fadeB = 1. - smoothstep(60., 1200., camD);
      float rv = mix(vnoise3(vW * vec3(.09, .3, .09)), .5, smoothstep(.2, .5, pxm * .3));      // stains, run-off and lichen on rock
      diffuseColor.rgb *= mix(1., (.45 + .7 * rv), rockM);
    #ifdef ROCK_ONLY
      diffuseColor.rgb *= vec3(.8, .82, .74);
    #endif
      bumpH = (rockM * (strata * .7 + n3 * .45) + (1. - rockM) * n3 * .22) * (1. - snowM * .7)
            + fbmAA(vW.xz * .05 + vW.y * .03, pxm * .05 * 2.) * 5. * smoothstep(150., 900., camD)
            + fbmAA(vW.xz * .016 + vW.y * .01, pxm * .016 * 2.) * 20. * smoothstep(250., 1400., camD);   // macro relief far away`,
    fRough: "roughnessFactor = mix(mix(.95, .82, rockM), .55, snowM);",
    fNormal: "normal = bumpN(normal, bumpH * 1.2);",
    fAO: "reflectedLight.indirectDiffuse *= vAO; reflectedLight.directDiffuse *= mix(1., vAO, .5);",
  });
}

/* =====================================================================================  TREES */
/** a spruce/fir of height 1 (non-indexed): trunk + whorls of crossed branch cards. Normals point out of the crown. */
function spruceGeometry(seed, { tiers = 18, per = 6, R = 0.3, shape = 1, droop = 0.35, segs = 2 } = {}) {
  const r = rng(seed), P = [], N = [], U = [], Cc = [];
  const push = (p, n, u, v, ao) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); U.push(u, v); Cc.push(ao, ao, ao); };
  const crownN = (p, R0) => new Vector3(p.x, (p.y - 0.45) * 0.55 + 0.32 * R0, p.z).normalize();
  // trunk
  const TS = 6, tr0 = 0.014, tr1 = 0.002;
  for (let s = 0; s < TS; s++) {
    const a0 = s / TS * Math.PI * 2, a1 = (s + 1) / TS * Math.PI * 2;
    const v = (a, y) => { const rr = lerp(tr0, tr1, y); return new Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); };
    const quad = [v(a0, 0), v(a1, 0), v(a1, 0.86), v(a0, 0.86)], nn = [a0, a1, a1, a0].map(a => new Vector3(Math.cos(a), 0, Math.sin(a)));
    const uu = [0.81 + s / TS * 0.17, 0.81 + (s + 1) / TS * 0.17];
    [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(i => push(quad[i], nn[i], i === 0 || i === 3 ? uu[0] : uu[1], quad[i].y, 0.55 + 0.4 * quad[i].y)));
  }
  const up = new Vector3(0, 1, 0);
  const card = (base, dir, side, L, W, curl, region, aoIn, aoOut) => {
    // a card bent downwards along its length; region 0 = branch (u 0..0.5, v 0..1 across), 1 = hanging (u .5..0.8, v down)
    const rowsV = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, c = base.clone().addScaledVector(dir, L * t); c.y -= L * curl * t * t;
      rowsV.push([c.clone().addScaledVector(side, region ? 0 : -W / 2), c.clone().addScaledVector(side, region ? W : W / 2), t]);
    }
    for (let k = 0; k < segs; k++) {
      const [a, b, ta] = rowsV[k], [c, d, tb] = rowsV[k + 1];
      const uv = (t, s2) => region ? [0.5 + 0.3 * t, 1 - s2] : [0.5 * t, s2];
      const verts = [[a, ta, 0], [b, ta, 1], [d, tb, 1], [c, tb, 0]];
      [[0, 1, 2], [0, 2, 3]].forEach(tri => tri.forEach(i => { const [p, t, s2] = verts[i], [u, v] = uv(t, s2); push(p, crownN(p, R), u, v, lerp(aoIn, aoOut, t)); }));
    }
  };
  const y0 = 0.1;
  for (let t = 0; t < tiers; t++) {
    const yt = y0 + (1 - y0) * Math.pow(t / tiers, 0.92) * 0.97, Ry = R * Math.pow(1 - yt, shape) + 0.028;
    const nb = Math.max(3, Math.round(per * (1 - yt * 0.45))), off = r() * 6.28;
    for (let b = 0; b < nb; b++) {
      const phi = off + b / nb * Math.PI * 2 + (r() - 0.5) * 0.6, L = Ry * (0.78 + r() * 0.4), dr = droop * (0.5 + 0.8 * (1 - yt)) * (0.7 + r() * 0.6);
      const dir = new Vector3(Math.cos(phi) * Math.cos(dr), -Math.sin(dr), Math.sin(phi) * Math.cos(dr));
      const base = new Vector3(Math.cos(phi) * 0.008, yt + (r() - 0.5) * 0.02, Math.sin(phi) * 0.008);
      const side = new Vector3().crossVectors(dir, up).normalize().applyAxisAngle(dir, (r() - 0.5) * 0.9);
      const ao0 = 0.28 + 0.3 * yt, ao1 = 0.75 + 0.25 * yt;
      card(base, dir, side, L, L * 0.74 + 0.02, 0.18 + 0.15 * r(), 0, ao0, ao1);
      const hang = new Vector3(0, -1, 0).addScaledVector(dir, 0.15).normalize();
      card(base.clone().addScaledVector(dir, L * 0.1), dir, hang, L * 0.95, L * 0.5 + 0.02, 0.2, 1, ao0, ao1 * 0.92);
    }
  }
  return mk(P, N, U, Cc);
}
/** a dead, twisted broadleaf (bark only) */
function deadTreeGeometry(seed) {
  const r = rng(seed), P = [], N = [], U = [], Cc = [];
  const limb = (a, b, ra, rb, ao) => {
    const dir = b.clone().sub(a).normalize(), s1 = new Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize(), s2 = new Vector3().crossVectors(dir, s1);
    const S = 5;
    for (let s = 0; s < S; s++) {
      const q = [s, s + 1].map(i => { const t = i / S * Math.PI * 2; return s1.clone().multiplyScalar(Math.cos(t)).addScaledVector(s2, Math.sin(t)); });
      const pts = [a.clone().addScaledVector(q[0], ra), a.clone().addScaledVector(q[1], ra), b.clone().addScaledVector(q[1], rb), b.clone().addScaledVector(q[0], rb)];
      const ns = [q[0], q[1], q[1], q[0]];
      [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(i => { P.push(pts[i].x, pts[i].y, pts[i].z); N.push(ns[i].x, ns[i].y, ns[i].z); U.push(0.82 + (i === 1 || i === 2 ? 0.15 : 0), i > 1 ? 1 : 0); Cc.push(ao, ao, ao); }));
    }
  };
  const grow = (a, dir, len, rad, depth) => {
    let p = a.clone(), d = dir.clone();
    const segN = 3;
    for (let i = 0; i < segN; i++) {
      d.add(new Vector3((r() - 0.5) * 0.5, 0.06, (r() - 0.5) * 0.5)).normalize();
      const q = p.clone().addScaledVector(d, len / segN), r1 = rad * (1 - (i + 1) / segN * 0.45);
      limb(p, q, rad * (1 - i / segN * 0.45), r1, 0.5 + 0.12 * depth);
      if (depth < 3 && i > 0) {
        const nb = depth === 0 ? 2 : 1 + (r() < 0.6 ? 1 : 0);
        for (let k = 0; k < nb; k++) {
          const nd = d.clone().applyAxisAngle(new Vector3(0, 1, 0), r() * 6.28).add(new Vector3(0, 0.15, 0));
          nd.x += (r() - 0.5) * 1.2; nd.z += (r() - 0.5) * 1.2; nd.normalize();
          grow(q, nd, len * (0.5 + r() * 0.15), r1 * 0.62, depth + 1);
        }
      }
      p = q;
    }
  };
  grow(new Vector3(0, 0, 0), new Vector3(0, 1, 0), 0.6, 0.03, 0);
  return mk(P, N, U, Cc);
}
function mk(P, N, U, Cc) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(P, 3)); g.setAttribute("normal", new Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new Float32BufferAttribute(U, 2)); if (Cc) g.setAttribute("color", new Float32BufferAttribute(Cc, 3));
  g.computeBoundingSphere(); return g;
}
function foliageMaterial(atlas, a2c, timeU) {
  const m = new MeshStandardMaterial({ map: atlas, alphaTest: a2c ? 0.32 : 0.45, alphaToCoverage: a2c, side: DoubleSide, vertexColors: true, roughness: 0.88, metalness: 0 });
  return patch(m, "foliage" + (a2c ? "A" : ""), {
    uniforms: { uTime: timeU, ...SEASON_U },
    vDecl: "uniform float uTime;",
    vBegin: /* glsl */`
    #ifdef USE_INSTANCING
      float _ph = instanceMatrix[3].x * .045 + instanceMatrix[3].z * .037;
      float _k = position.y * position.y;
      transformed.x += (sin(uTime * .8 + _ph) * .011 + sin(uTime * 2.3 + _ph * 3.) * .003) * _k;
      transformed.z += cos(uTime * .6 + _ph * 1.3) * .008 * _k;
    #endif`,
    fDecl: SEASON_DECL,
    fColor: "diffuseColor.rgb *= vec3(.66, .74, .66) * mix(vec3(1.), vec3(.92, 1.12, .9), uGreen); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.5, .53, .6), uSnow * smoothstep(.45, .92, vWN.y) * .55);",
    fNormal: "normal = normalize(vNormal);",           // keep the crown normal on both faces (soft, volumetric shading)
  });
}

/* =====================================================================================  CASTLE */
/** metric UVs (metres) so the stone and slate patterns keep a real scale on every element */
function metricBox(w, h, d) {
  const g = new BoxGeometry(w, h, d); const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + h / 2, z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, x, z); else if (ax > 0.5) uv.setXY(i, z, y); else uv.setXY(i, x, y);
  }
  return g.translate(0, h / 2, 0);   // base at y = 0
}
function metricCyl(rt, rb, h, seg, open = false) {
  const g = new CylinderGeometry(rt, rb, h, seg, Math.max(1, Math.round(h / 6)), open); const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + h / 2, z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5 && Math.abs(n.getX(i)) + Math.abs(n.getZ(i)) < 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, Math.atan2(x, z) * (rt + rb) / 2, y);
  }
  return g.translate(0, h / 2, 0);
}
function metricCone(rad, h, seg) {
  const g = new ConeGeometry(rad, h, seg, 3, true); const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + h / 2, z = p.getZ(i); uv.setXY(i, Math.atan2(x, z) * rad * 0.7, y * 1.15); }
  return g.translate(0, h / 2, 0);
}
/** gable roof (slopes) + the two stone gable triangles */
function gable(w, L, hr, over = 0.6) {
  const hw = w / 2 + over, hl = L / 2 + over, slope = Math.hypot(hw, hr);
  const roof = [], ru = [], stone = [], su = [];
  for (const s of [-1, 1]) {   // two slopes; v runs along the slope (metres), u along the ridge
    const a = [s * hw, 0, -hl], b = [s * hw, 0, hl], c = [0, hr, hl], d = [0, hr, -hl];
    const tri = s < 0 ? [a, b, c, a, c, d] : [b, a, d, b, d, c];
    tri.forEach(p => { roof.push(...p); ru.push(p[2], (p[1] / hr) * slope); });
  }
  for (const e of [-1, 1]) {
    const z = e * L / 2, t = e > 0 ? [[-w / 2, 0, z], [w / 2, 0, z], [0, hr - 0.4, z]] : [[w / 2, 0, z], [-w / 2, 0, z], [0, hr - 0.4, z]];
    t.forEach(p => { stone.push(...p); su.push(p[0], p[1]); });
  }
  const gr = new BufferGeometry(); gr.setAttribute("position", new Float32BufferAttribute(roof, 3)); gr.setAttribute("uv", new Float32BufferAttribute(ru, 2)); gr.computeVertexNormals();
  const gs = new BufferGeometry(); gs.setAttribute("position", new Float32BufferAttribute(stone, 3)); gs.setAttribute("uv", new Float32BufferAttribute(su, 2)); gs.computeVertexNormals();
  return { roof: gr, stone: gs };
}
function place(g, x, y, z, ry = 0, tint = 1) {
  g = g.index ? g.toNonIndexed() : g;
  if (ry) g.rotateY(ry); g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = tint; c[i * 3 + 1] = tint * 0.99; c[i * 3 + 2] = tint * 0.97; }
  g.setAttribute("color", new Float32BufferAttribute(c, 3));
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) g.deleteAttribute(k);
  return g;
}
function buildCastle(timeU, lowDetail, A) {   // A: shared anomaly uniforms of the lake (reflection pass)
  const stone = [], roofs = [], wins = [];   // wins: [x, y, z, ny(rot), w, h, lit 0..1 (or -1 = gate), role (an Archive window) or undefined]
  const DOWN = 22, r = rng(4242), seg = lowDetail ? 16 : 28;
  const wall = [[-34, 2], [-26, -18], [-4, -25], [19, -22], [35, -4], [31, 14], [12, 24], [-12, 24], [-28, 16]];
  const cx = wall.reduce((s, p) => s + p[0], 0) / wall.length, cz = wall.reduce((s, p) => s + p[1], 0) / wall.length;
  const WH = 11, WT = 2.6;
  const merlon = (x, y, z, ry) => stone.push(place(metricBox(1.25, 1.5, 0.75), x, y, z, ry, 0.85 + r() * 0.3));
  // curtain walls with merlons on the outer edge
  for (let i = 0; i < wall.length; i++) {
    const [ax, az] = wall[i], [bx, bz] = wall[(i + 1) % wall.length], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    stone.push(place(metricBox(WT, WH + DOWN, L), mx, -DOWN, mz, ang, 0.8 + r() * 0.3));
    let ox = -(bz - az) / L, oz = (bx - ax) / L; if ((mx - cx) * ox + (mz - cz) * oz < 0) { ox = -ox; oz = -oz; }
    const nm = Math.floor(L / 2.5);
    for (let k = 1; k < nm; k++) { const t = k / nm; merlon(ax + (bx - ax) * t + ox * (WT / 2 - 0.38), WH, az + (bz - az) * t + oz * (WT / 2 - 0.38), ang); }
    wall[i].out = [ox, oz];
    if (i === 7) { // the gate, between the two gate towers
      wins.push([mx + ox * (WT / 2 + 0.06), 0, mz + oz * (WT / 2 + 0.06), Math.atan2(ox, oz), 3.6, 5.2, -1]);
      wins.push([mx + ox * (WT / 2 + 0.06), 6.4, mz + oz * (WT / 2 + 0.06), Math.atan2(ox, oz), 0.7, 1.3, 0.85]);
    }
  }
  // towers: [index, radius, height, roof: 1 cone / 0 crenellated]
  const towers = [[0, 4.2, 20, 1], [1, 4.6, 17, 0], [2, 3.8, 18, 1], [3, 5.2, 23, 1], [4, 4.3, 19, 1], [5, 4.6, 16, 0], [6, 3.4, 15, 0], [7, 3.7, 17.5, 1], [8, 3.7, 17.5, 1]];
  const toCamL = new Vector3(-C.x, 0, -C.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), -C.rot);
  for (const [i, rad, h, cone] of towers) {
    const [x, z] = wall[i], tint = 0.9 + r() * 0.14;
    stone.push(place(metricCyl(rad * 0.97, rad * 1.08, h + DOWN, seg), x, -DOWN, z, 0, tint));
    if (cone) {
      stone.push(place(metricCyl(rad + 0.35, rad + 0.35, 1.0, seg), x, h - 1.0, z, 0, tint));                    // cornice
      roofs.push(place(metricCone(rad + 0.9, rad * 2.5 + 3, seg), x, h, z));
      roofs.push(place(metricCyl(0.05, 0.12, 2.2, 4), x, h + rad * 2.5 + 2.6, z));                            // finial
    } else {
      stone.push(place(metricCyl(rad + 0.7, rad + 0.55, 1.8, seg), x, h - 1.8, z, 0, tint));                     // machicolation band
      const nc = Math.round(rad * 2.2);
      for (let k = 0; k < nc; k++) { const a = k / nc * Math.PI * 2; stone.push(place(metricBox(0.55, 1.4, 0.7), x + Math.sin(a) * (rad + 0.35), h - 3.2, z + Math.cos(a) * (rad + 0.35), a, tint * 0.95)); }
      const nm = Math.round((rad + 0.5) * Math.PI * 2 / 2.4);
      for (let k = 0; k < nm; k++) { const a = (k + 0.5) / nm * Math.PI * 2; merlon(x + Math.sin(a) * (rad + 0.25), h, z + Math.cos(a) * (rad + 0.25), a); }
    }
    // arrow slits and the odd lit window, on the side seen from the valley
    const fa = Math.atan2(toCamL.x, toCamL.z) + (r() - 0.5) * 0.9;
    for (const y of [6, 11.5]) if (y < h - 3) wins.push([x + Math.sin(fa) * (rad * 1.02 + 0.03), y, z + Math.cos(fa) * (rad * 1.02 + 0.03), fa, 0.35, 1.5, 0, i === 3 && y === 11.5 ? "secret-wisp" : undefined]);
    if (i === 4 || i === 0) wins.push([x + Math.sin(fa + 0.5) * (rad + 0.05), h - 6, z + Math.cos(fa + 0.5) * (rad + 0.05), fa + 0.5, 0.8, 1.5, 0.9]);
  }
  const box = (x, z, w, d, h, tint) => stone.push(place(metricBox(w, h + DOWN, d), x, -DOWN, z, 0, tint));
  const faceWins = (x, z, w, d, rows, cols, litSet, wW = 0.85, wH = 1.7, roles = {}) => {   // windows on the +z face and the -x face
    let n = 0;
    for (const [face, fx, fz, ry, span] of [["z", x, z + d / 2 + 0.05, 0, w], ["x", x - w / 2 - 0.05, z, -Math.PI / 2, d]]) {
      const nc = face === "z" ? cols : Math.max(1, Math.round(cols * d / w));
      for (const y of rows) for (let k = 0; k < nc; k++) {
        const t = (k + 0.5) / nc - 0.5, px = face === "z" ? fx + t * span * 0.8 : fx, pz = face === "z" ? fz : fz + t * span * 0.8;
        const lv = litSet.includes(n) ? 0.6 + r() * 0.5 : 0; wins.push([px, y, pz, ry, wW, wH, roles[n] ? 0 : lv, roles[n]]); n++;
      }
    }
  };
  // keep (donjon) with a steep pyramid roof and four bartizans
  const kx = 12, kz = -6, kw = 12, kh = 32;
  box(kx, kz, kw, kw, kh, 0.96);
  stone.push(place(metricBox(kw + 0.8, 1.0, kw + 0.8), kx, kh - 1, kz, 0, 0.9));
  { const g = metricCone(kw * 0.74, 12.5, 4); g.rotateY(Math.PI / 4); roofs.push(place(g, kx, kh, kz)); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = kx + sx * (kw / 2 + 0.4), bz = kz + sz * (kw / 2 + 0.4);
    stone.push(place(metricCyl(1.55, 1.2, 5, 12), bx, kh - 5.5, bz, 0, 0.93));
    { const cg = metricCone(1.5, 1.6, 12); cg.rotateX(Math.PI); stone.push(place(cg, bx, kh - 5.5, bz, 0, 0.9)); }   // corbel
    roofs.push(place(metricCone(2.0, 5, 12), bx, kh - 0.5, bz));
  }
  // the keep's windows belong to the Archive: Skye at the top, Woolpit in the middle floors, Hoia below them
  faceWins(kx, kz, kw, kw, [9, 15, 21, 26.5], 2, [9], 0.85, 1.7, {
    6: "skye-peace", 7: "skye-other", 14: "skye-stay", 15: "skye-leave",
    4: "woolpit-servant", 5: "woolpit-both", 12: "woolpit-bells", 13: "woolpit-font", 2: "woolpit-omen", 3: "woolpit-ink",
    10: "hoia-time", 11: "hoia-watching", 0: "hoia-negative", 1: "hoia-tally" });
  // palas (great hall) with a gable roof and chimneys
  const px = -12, pz = -10, pw = 22, pd = 9, ph = 15;
  box(px, pz, pw, pd, ph, 0.9);
  { const { roof, stone: gs } = gable(pd, pw, 7.5); roof.rotateY(Math.PI / 2); gs.rotateY(Math.PI / 2); roofs.push(place(roof, px, ph, pz)); stone.push(place(gs, px, ph, pz, 0, 0.9)); }
  stone.push(place(metricBox(1.3, 8.5, 1.3), px - 6, ph + 1, pz - 1.5, 0, 0.85), place(metricBox(1.3, 9, 1.3), px + 5, ph + 1, pz - 1.5, 0, 0.85));
  faceWins(px, pz, pw, pd, [5.5, 10.5], 6, [1, 3, 4, 13], 1.0, 2.3, { 7: "legend:woolpit", 9: "legend:hoia", 11: "legend:skye", 5: "legend:babayaga", 8: "legend:sibilla", 10: "legend:bathory" });   // completed legends light the great hall
  // chapel with a slender spire
  const chx = 14, chz = 11, cw = 7, cd = 13, chh = 9.5;
  box(chx, chz, cw, cd, chh, 1.0);
  { const { roof, stone: gs } = gable(cw, cd, 6.2); roofs.push(place(roof, chx, chh, chz)); stone.push(place(gs, chx, chh, chz, 0, 1.0)); }
  stone.push(place(metricBox(2.2, 3.4, 2.2), chx, chh + 3.2, chz + cd / 2 - 1.6, 0, 1.0));
  // the belfry openings: the Archivist's Seal
  wins.push([chx, chh + 3.6, chz + cd / 2 - 1.6 + 1.15, 0, 0.75, 1.9, 0, "seal-archivist"], [chx - 1.15, chh + 3.6, chz + cd / 2 - 1.6, -Math.PI / 2, 0.75, 1.9, 0, "seal-archivist"]);
  { const g = metricCone(1.75, 8, 4); g.rotateY(Math.PI / 4); roofs.push(place(g, chx, chh + 6.6, chz + cd / 2 - 1.6)); }
  wins.push([chx, 2.4, chz + cd / 2 + 0.05, 0, 1.5, 4.2, 1.15]);                                           // the big lancet window
  for (const t of [-0.3, 0, 0.3]) wins.push([chx - cw / 2 - 0.05, 2.6, chz + t * cd, -Math.PI / 2, 0.8, 3, t === 0 ? 0.7 : 0]);
  // a lodging house against the west wall
  const hx = -18, hz = 9; box(hx, hz, 11, 7, 8, 0.88);
  { const { roof, stone: gs } = gable(7, 11, 5); roof.rotateY(Math.PI / 2); gs.rotateY(Math.PI / 2); roofs.push(place(roof, hx, 8, hz)); stone.push(place(gs, hx, 8, hz, 0, 0.88)); }
  faceWins(hx, hz, 11, 7, [4.5], 3, [1], 0.8, 1.4, { 0: "babayaga-lantern", 2: "babayaga-flight", 3: "babayaga-stay", 4: "babayaga-leave" });   // Baba Yaga's relics: the lodging house
  // the Sibyl's tower (v8): a slender round tower behind the great hall and the keep; its six windows, stacked in a spiral on
  // the side seen from the valley, belong to the Sibilla adventure (her seal at the top)
  {
    const sx = 2.5, sz = -17.5, srad = 2.3, sh = 27;
    stone.push(place(metricCyl(srad * 0.97, srad * 1.06, sh + DOWN, seg), sx, -DOWN, sz, 0, 0.94));
    stone.push(place(metricCyl(srad + 0.3, srad + 0.3, 0.8, seg), sx, sh - 0.8, sz, 0, 0.92));
    roofs.push(place(metricCone(srad + 0.7, srad * 2.8 + 3, seg), sx, sh, sz));
    const fa = Math.atan2(toCamL.x, toCamL.z);
    ["sibilla-notebook", "sibilla-dance", "sibilla-return", "sibilla-knowledge", "sibilla-kingdom", "sibilla-seal"].forEach((role, k) => {
      const a = fa + (k % 2 ? 0.32 : -0.32), y = 9 + k * 2.9;
      wins.push([sx + Math.sin(a) * (srad * 1.02 + 0.03), y, sz + Math.cos(a) * (srad * 1.02 + 0.03), a, 0.55, 1.5, 0, role]);
    });
  }
  // the Countess's watchtower (v9): a square tower with a steep dark spire on the west side of the ward; its six windows, in two
  // columns on the side seen from the valley, belong to the Báthory adventure (the family seal at the top)
  {
    const wx = -21, wz = 0, ww = 3.6, wh = 21;
    box(wx, wz, ww, ww, wh, 0.86);
    stone.push(place(metricBox(ww + 0.6, 0.7, ww + 0.6), wx, wh - 0.7, wz, 0, 0.84));
    { const g = metricCone((ww + 0.8) * 0.72, 8.5, 4); g.rotateY(Math.PI / 4); roofs.push(place(g, wx, wh, wz)); }
    const fa = Math.atan2(toCamL.x, toCamL.z), nx = Math.sin(fa), nz = Math.cos(fa), tx = nz, tz = -nx, off = ww / 2 + 0.06;
    ["bathory-letter", "bathory-monster", "bathory-conspiracy", "bathory-unanswered", "bathory-palatine", "bathory-seal"].forEach((role, k) => {
      const col = k === 5 ? 0 : (k % 2 ? 0.7 : -0.7), y = 7 + Math.floor(k / 2) * 3.4 + (k === 5 ? 0.6 : 0);
      wins.push([wx + nx * off + tx * col, y, wz + nz * off + tz * col, fa, 0.5, 1.4, 0, role]);
    });
  }
  // ---- meshes
  const sg = mergeGeometries(stone.map(g => { if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
  const rg = mergeGeometries(roofs.map(g => { if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
  const stoneMat = patch(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, vertexColors: true }), "stone", {
    uniforms: { uBaseY: { value: C.T }, uRefl: A.uRefl, uRuin: A.uRuin },
    vDecl: "varying vec2 vMUv;", vMain: "vMUv = uv;",
    fDecl: "varying vec2 vMUv; uniform float uBaseY, uRefl, uRuin; float bumpH; float emberK;",
    fColor: /* glsl */`
      // the lake's lie: in the reflection the castle can be a ruin (broken walls, gaping holes, scorched stone)
      float ruinK = uRefl * uRuin; emberK = 0.;
      if (ruinK > 0.) {
        float hgt = vW.y - uBaseY, rn = fbm2(vW.xz * .16 + vW.y * .11) + fbm2(vW.xy * .3 - vW.z * .07) * .35;
        float thr = ruinK * (.24 + smoothstep(0., 22., hgt) * .42);   // a jagged shell is left standing (v9 erased almost all of it)
        if (rn - .12 < thr) discard;
        // embers glow along the broken edges (in the dark water the holes alone could not be seen)
        emberK = ruinK * (1. - smoothstep(0., .07, rn - .12 - thr)) * (.75 + .25 * sin(vW.y * 3. + vW.x * 2.));
      }
      vec2 st = vMUv;
      float rowH = .5, row = floor(st.y / rowH), bw = 1.0 + hash12(vec2(row, 11.)) * .6;
      float u = st.x / bw + hash12(vec2(row, 3.7)), col = floor(u);
      vec2 f = vec2(fract(u) * bw, fract(st.y / rowH) * rowH);
      float edge = min(min(f.x, bw - f.x), min(f.y, rowH - f.y));
      float px = max(length(fwidth(st)), 1e-4);
      float vis = 1. - smoothstep(.05, .2, px);
      float mortar = (1. - smoothstep(.02, .045 + px, edge)) * vis;
      float bv = hash12(vec2(col, row) + 7.13);
      float n = fbmAA(st * vec2(.8, 1.6), px * 1.6);
      vec3 stoneC = vec3(.165,.155,.138) * (.72 + .5 * mix(.5, bv, vis) + .35 * (n - .5));
      stoneC *= mix(1., .5, mortar);
      float streak = vnoise(vec2(st.x * 2.4, st.y * .1)), patchy = fbmAA(st * .12 + 9., px * .12);
      stoneC *= mix(.62, 1.08, mix(streak, .6, smoothstep(.15, .5, px)));              // rain streaks
      stoneC *= .5 + 1. * patchy;                                                   // repairs, soot, weathering
      stoneC *= vec3(1.06, 1.0, .9);                                               // warm limestone
      stoneC *= 1. - .3 * smoothstep(.55, .9, vnoise(vec2(st.x * .7, st.y * .05 + 3.)));   // long dark runs under the merlons
      float base = 1. - smoothstep(uBaseY - 3., uBaseY + 8., vW.y);
      float moss = smoothstep(.5, .78, fbmAA(st * .35 + 3., px * .35)) * (.25 + .75 * base);
      stoneC = mix(stoneC, vec3(.035,.045,.025), moss * .7);
      stoneC *= mix(1., .6, base * .6);                                           // damp, darker foot of the walls
      stoneC = mix(stoneC, stoneC * vec3(.35, .3, .27), ruinK);                    // scorched
      diffuseColor.rgb *= stoneC;
      bumpH = (smoothstep(0., .06, edge) * .05 * vis + n * .04 + streak * .02);`,
    fRough: "roughnessFactor = .92;",
    fNormal: "normal = bumpN(normal, bumpH);",
    fAO: "reflectedLight.indirectDiffuse *= mix(.55, 1., smoothstep(uBaseY - 4., uBaseY + 10., vW.y)); totalEmissiveRadiance += vec3(3.6, .78, .14) * emberK;",
  });
  const roofMat = patch(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0, side: DoubleSide }), "slate", {
    uniforms: { uRefl: A.uRefl, uRuin: A.uRuin, ...SEASON_U },
    vDecl: "varying vec2 vMUv;", vMain: "vMUv = uv;",
    fDecl: "varying vec2 vMUv; float bumpH; float mossR; uniform float uRefl, uRuin;" + SEASON_DECL,
    fColor: /* glsl */`
      if (uRefl * uRuin > 0. && fbm2(vW.xz * .4 + vW.y * .2) < uRefl * uRuin * .95) discard;   // collapsed roofs in the reflection
      vec2 st = vMUv;
      float rowH = .3, row = floor(st.y / rowH), u = st.x / .36 + hash12(vec2(row, 1.3)) , tv = hash12(vec2(floor(u), row));
      float px = max(length(fwidth(st)), 1e-4), vis = 1. - smoothstep(.03, .12, px), ev = fract(st.y / rowH);
      vec3 c = vec3(.034,.039,.05) * (.7 + .6 * mix(.5, tv, vis));
      c *= mix(1., .5, (1. - smoothstep(0., .22, ev)) * vis);
      mossR = smoothstep(.55, .8, fbmAA(st * .5, px * .5));
      c = mix(c, vec3(.03,.038,.022), mossR * .65);
      c = mix(c, vec3(.5, .53, .6), uSnow * smoothstep(.2, .6, vWN.y) * (.8 + .2 * tv));   // winter: snow on the roofs
      diffuseColor.rgb = c;
      bumpH = ev * .03 * vis;`,
    fRough: "roughnessFactor = mix(.42, .85, mossR);",
    fNormal: "normal = bumpN(normal, bumpH);",
  });
  const g = new Group(); g.position.set(C.x, C.T, C.z); g.rotation.y = C.rot;
  const sm = new Mesh(sg, stoneMat), rm = new Mesh(rg, roofMat);
  for (const m of [sm, rm]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  // windows: instanced arched panes; lit ones are HDR (they bloom) and flicker gently
  const wg = new PlaneGeometry(1, 1); wg.translate(0, 0.5, 0);
  const wm = patch(new MeshBasicMaterial({ map: windowTexture(), alphaTest: 0.5 }), "win", {
    uniforms: { uTime: timeU, uRefl: A.uRefl, uRuin: A.uRuin, uFigure: A.uFigure, uFigureWin: A.uFigureWin },
    vDecl: "flat varying float vId;", vMain: "vId = float(gl_InstanceID);",
    fDecl: "flat varying float vId; uniform float uTime, uRefl, uRuin, uFigure, uFigureWin;",
    fColor: /* glsl */`
      diffuseColor.rgb *= 1. + (.1 * sin(uTime * 7.3 + vId * 2.1) + .06 * sin(uTime * 13.7 + vId)) * step(.2, diffuseColor.r);
      if (uRefl > .5) {
        float burn = step(.55, fract(sin(vId * 12.9898) * 43758.5453));               // a few windows of the ruin are burning
        diffuseColor.rgb = mix(diffuseColor.rgb * (1. - uRuin * .95), vec3(2.6, .7, .16) * (.8 + .2 * sin(uTime * 9. + vId)), uRuin * burn);   // a dead castle in the water
        if (abs(vId - uFigureWin) < .5 && uFigure > 0.) {                            // someone stands in this window, only in the reflection
          vec2 q = vMapUv; float head = 1. - smoothstep(.1, .13, length((q - vec2(.5, .6)) * vec2(1., .55)));
          float body = 1. - smoothstep(.0, .04, length(max(abs(q - vec2(.5, .26)) - vec2(.17, .2), 0.)));
          vec3 glow = vec3(.6, .78, .95) * 4.5;
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(glow, vec3(.0), max(head, body)), uFigure);
        }
      }`,
  });
  const wi = new InstancedMesh(wg, wm, wins.length), o = new Object3D(), col = new Color();
  const warm = [], roles = {}, flarePos = [];
  wins.forEach(([x, y, z, ry, w, h, lit, role], i) => {
    o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(w, h, 1); o.updateMatrix(); wi.setMatrixAt(i, o.matrix);
    if (lit > 0) { col.setRGB(1.7, 0.82, 0.28).multiplyScalar(lit); warm.push([x, y, z, ry]); } else if (lit < 0) col.setRGB(0.004, 0.003, 0.003); else col.setRGB(0.012, 0.011, 0.012);
    wi.setColorAt(i, col);
    if (role) { (roles[role] = roles[role] || []).push(i); flarePos.push(x + Math.sin(ry) * 0.5, y + h * 0.5, z + Math.cos(ry) * 0.5); }
  });
  g.add(wi);
  // a soft flare in front of every Archive window (it blooms when the window lights for the first time)
  const fg = new BufferGeometry(); fg.setAttribute("position", new Float32BufferAttribute(flarePos, 3)); fg.setAttribute("aA", new Float32BufferAttribute(new Float32Array(flarePos.length / 3), 1));
  const flares = new Points(fg, new ShaderMaterial({
    uniforms: { uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: "attribute float aA; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; vA = aA; gl_PointSize = clamp(9000. / -mv.z, 4., 90.) * uPx * (.4 + aA); }",
    fragmentShader: "varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c) * 4.; if (r2 > 1. || vA < .004) discard; gl_FragColor = vec4(vec3(1.6, .95, .45) * (exp(-r2 * 9.) + exp(-r2 * 2.5) * .25) * vA, 1.); }",
  }));
  flares.frustumCulled = false; flares.renderOrder = 3; g.add(flares);
  // the chapel's own light (dark until the Archive grows; bright at the end)
  const chapelL = new PointLight(0xffd9a0, 0, 26, 1.8); chapelL.position.set(chx, chh + 5, chz + cd / 2 - 1.6); g.add(chapelL);
  // warm light spilling from the hall and the gate
  const pl1 = new PointLight(0xffa860, 70, 46, 2); pl1.position.set(-8, 7, -2); g.add(pl1);
  const pl2 = new PointLight(0xff9a50, 45, 30, 2); pl2.position.set(wall[7][0] * 0.5 + wall[8][0] * 0.5 + wall[7].out[0] * 4, 4, wall[7][1] * 0.5 + wall[8][1] * 0.5 + wall[7].out[1] * 4); g.add(pl2);
  g.userData.lit = warm.length;
  const flareIndex = {}; let fi = 0;
  wins.forEach(w => { if (w[7]) { (flareIndex[w[7]] = flareIndex[w[7]] || []).push(fi++); } });
  g.userData.archive = {
    wi, roles, flares, flareIndex, chapelL, chapel: new Vector3(chx, chh + 6.6 + 8, chz + cd / 2 - 1.6),
    keep: new Vector3(kx, kh, kz), figureWindows: wins.map((w, i) => (w[1] < 12 && w[4] >= 0.95 ? i : -1)).filter(i => i >= 0),   // the gate and the hall's tall windows: low enough to be seen in the water
  };
  return g;
}

/* =====================================================================================  SKY */
/* The real night of the reference place: Moon at its true altitude, lit by the Sun's true direction (so the phase and
   the bright limb are right), real stars (celestial.js), clouds, twilight, and the anomalies of the reflection pass. */
function buildSky(timeU, A, veil) {
  const u = {
    uTime: timeU, uMoon: { value: new Vector3(0.3, 0.3, -0.9).normalize() }, uSun: { value: new Vector3(0, -1, 0) },
    uMoonTint: { value: new Vector3(1, 1, 1) }, uMoonK: { value: 1 }, uSkyK: { value: 1 }, uTwi: { value: 0 }, uHalo: { value: 0 }, uVeil: veil,
    uRefl: A.uRefl, uRedMoon: A.uRedMoon, uPhantom: A.uPhantom, uPhantomOn: A.uPhantomOn,
  };
  const m = new Mesh(new SphereGeometry(9000, 48, 24), new ShaderMaterial({
    uniforms: u, side: BackSide, depthWrite: false,
    vertexShader: "varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: GLSL_NOISE + GLSL_CLOUDS + /* glsl */`
      varying vec3 vD; uniform vec3 uMoon, uSun, uMoonTint, uPhantom; uniform float uTime, uMoonK, uSkyK, uTwi, uHalo, uVeil, uRefl, uRedMoon, uPhantomOn;
      vec3 moonDisc(vec3 d, vec3 mdir, float R, vec3 tint, float full, out float disc){
        float md = dot(d, mdir);
        vec3 mt = normalize(cross(mdir, vec3(0., 1., 0.))), mb = cross(mt, mdir);
        vec2 mp = vec2(dot(d, mt), dot(d, mb)) / R; float r2 = dot(mp, mp);
        disc = (1. - smoothstep(.94, 1., sqrt(r2))) * step(0., md);
        // the sphere's normal at this point of the disc, lit by the real Sun: phase and bright limb come out right
        vec3 n = normalize(mp.x * mt + mp.y * mb - sqrt(max(0., 1. - r2)) * mdir);
        float lit = mix(smoothstep(-.04, .1, dot(n, uSun)), 1., full);   // the phantom Moon is always full (lit by the real Sun it could fall dark)
        float maria = smoothstep(.45, .7, fbm2(mp * 2.2 + 4.)) * .38 + smoothstep(.5, .8, vnoise(mp * 6.)) * .1;
        vec3 face = vec3(2.3, 2.35, 2.2) * (1. - maria) * (.72 + .28 * sqrt(max(0., 1. - r2)));
        return face * tint * (lit + .018);   // + a faint earthshine on the dark side
      }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        float md = dot(d, uMoon), up = smoothstep(-.03, .05, uMoon.y);
        vec3 zen = vec3(.0016,.0026,.0062), hor = vec3(.016,.022,.032);
        vec3 c = mix(hor, zen, smoothstep(-.02, .55, y)) * (.55 + .45 * uSkyK);
        // twilight: a cold band of light on the side of the (hidden) Sun
        vec3 sh = normalize(vec3(uSun.x, 0., uSun.z) + 1e-5); float sa = max(dot(normalize(vec3(d.x, 0., d.z) + 1e-5), sh), 0.);
        c += (vec3(.06,.05,.06) * pow(sa, 4.) * exp(-max(y, 0.) * 7.) + vec3(.012,.018,.03) * (1. - smoothstep(0., .7, y))) * uTwi;
        c += (vec3(.010,.013,.018) * pow(max(md, 0.), 8.) + vec3(.022,.026,.032) * pow(max(md, 0.), 90.)) * uMoonK * up;   // moon haze
        float cov = max(cloudCover(d, uTime), moonVeil(d, uMoon, uVeil, uTime));
        vec3 cloudC = vec3(.010,.013,.019) * (.6 + .4 * uSkyK) + vec3(.16,.18,.22) * (pow(max(md, 0.), 14.) * .9 + pow(max(md, 0.), 3.) * .08) * uMoonK * up;
        c = mix(c, cloudC, cov * .85);
        float disc; vec3 tint = uMoonTint;
        vec3 mdir = uMoon; float full = 0.;
        if (uRefl > .5) {                                   // the lake's lie: a red Moon in the water (or one that is not in the sky)
          tint = mix(tint, vec3(.5, .04, .025), uRedMoon);
          if (uPhantomOn > .5) { mdir = uPhantom; full = 1.; }
        }
        vec3 moon = moonDisc(d, mdir, .026 + .008 * full, tint, full, disc);
        float shown = uRefl > .5 && uPhantomOn > .5 ? uRedMoon : up;
        c = mix(c, moon * uMoonK, disc * (1. - cov * .3) * shown);
        float mdd = dot(d, mdir);
        c += (vec3(.16,.18,.22) * pow(max(mdd, 0.), 900.) + vec3(.035,.04,.05) * pow(max(mdd, 0.), 160.)) * tint * uMoonK * shown;
        // a 22-degree halo around the Moon (ice crystals: the solstice night)
        float ang = acos(clamp(md, -1., 1.)); c += vec3(.03, .034, .04) * uHalo * up * uMoonK * exp(-pow((ang - .384) / .018, 2.)) * (1. - cov * .5);
        if (y < 0.) c = hor * .8 * (.55 + .45 * uSkyK);
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  m.frustumCulled = false; m.renderOrder = -1;
  return { mesh: m, u };
}

/* =====================================================================================  POST */
const FOG_FS = GLSL_NOISE + /* glsl */`
  uniform sampler2D tColor, tDepth; uniform mat4 uPInv, uCamW; uniform vec3 uCam, uMoon; uniform float uTime, uSteps, uMistK, uMoonK;
  uniform vec4 uLant; uniform float uLantK;                // the lantern: position + radius, strength
  uniform vec4 uBeam; uniform float uBeamY;                // the pillar of light: x, z, intensity, height 0..1 ; base height
  uniform vec4 uLake; uniform vec2 uLakeRot;               // the lake (mist lies thinner over open water)
  varying vec2 vUv;
  void main(){
    vec3 col = texture2D(tColor, vUv).rgb; float z = texture2D(tDepth, vUv).x;
    vec4 vp = uPInv * vec4(vUv * 2. - 1., z * 2. - 1., 1.); vp /= vp.w;
    vec3 wp = (uCamW * vec4(vp.xyz, 1.)).xyz; vec3 rd = wp - uCam; float dist = length(rd); rd /= dist;
    if (z >= .99999) dist = 1800.;
    // 1) exponential height haze (aerial perspective)
    float a = .00055, b = .0036;
    float fh = a * exp(-b * uCam.y) * (abs(rd.y) > 1e-4 ? (1. - exp(-b * rd.y * dist)) / (b * rd.y) : dist);
    // 2) the valley mist: a noisy layer under ~34 m, ray-marched; thinner over the lake, cleared around the lantern
    float mist = 0.; float top = 36., bot = -12.;
    float t0 = 0., t1 = dist;
    if (abs(rd.y) > 1e-4) { float ta = (top - uCam.y) / rd.y, tb = (bot - uCam.y) / rd.y; t0 = max(0., min(ta, tb)); t1 = min(dist, max(ta, tb)); }
    else if (uCam.y > top) t1 = -1.;
    if (t1 > t0 && uSteps > .5) {
      float jit = hash12(gl_FragCoord.xy + fract(uTime) * 17.), dt = (t1 - t0) / uSteps;
      for (int i = 0; i < 10; i++) { if (float(i) >= uSteps) break;
        vec3 p = uCam + rd * (t0 + (float(i) + jit) * dt);
        float hk = (1. - smoothstep(top - 26., top, p.y)) * smoothstep(bot, bot + 14., p.y);
        float nz = fbm3(p * vec3(.0045, .02, .0045) + vec3(uTime * .012, 0., uTime * .004));
        vec2 lq = p.xz - uLake.xy; lq = vec2(lq.x * uLakeRot.x - lq.y * uLakeRot.y, lq.x * uLakeRot.y + lq.y * uLakeRot.x) / uLake.zw;
        hk *= mix(.18, 1., smoothstep(.75, 1.35, length(lq)));
        vec3 lv = p - uLant.xyz; hk *= 1. - .85 * uLantK * exp(-dot(lv, lv) / (uLant.w * uLant.w));
        mist += hk * smoothstep(.28, .72, nz) * dt;
      }
      mist *= .011 * uMistK;
    }
    float tr = exp(-fh - mist);
    float ph = pow(max(dot(rd, uMoon), 0.), 12.) * uMoonK;
    vec3 hazeC = mix(vec3(.022,.03,.042), vec3(.06,.072,.09), ph) * (.6 + .4 * uMoonK);
    vec3 mistC = mix(vec3(.055,.066,.08), vec3(.1,.11,.125), ph) * (.55 + .45 * uMoonK);
    vec3 fogC = mix(hazeC, mistC, mist / max(fh + mist, 1e-4));
    col = col * tr + fogC * (1. - tr);
    // the lantern's halo in the damp air
    if (uLantK > .001) {
      float s = clamp(dot(uLant.xyz - uCam, rd), 0., dist); vec3 q = uCam + rd * s - uLant.xyz; float d2 = dot(q, q) / (uLant.w * uLant.w);
      col += vec3(1., .58, .26) * uLantK * (exp(-d2 * 3.) * .05 + exp(-d2 * .6) * .012) * (.4 + .6 * (1. - tr));
    }
    // the pillar of light over the chapel: closest approach of the view ray to the vertical axis
    if (uBeam.z > .001) {
      vec2 o = uCam.xz - uBeam.xy, dxz = rd.xz; float aa = max(dot(dxz, dxz), 1e-6);
      float s = clamp(-dot(o, dxz) / aa, 0., dist); vec3 p = uCam + rd * s; float rr = length(p.xz - uBeam.xy);
      float topY = uBeamY + uBeam.w * 3000.;
      float vert = smoothstep(uBeamY - 1., uBeamY + 5., p.y) * (1. - smoothstep(topY - 700., topY, p.y)) * (.75 + .25 * sin(p.y * .02 - uTime * 1.3));
      float beam = (exp(-rr * rr / 5.) * 1.4 + exp(-rr / 14.) * .22 + exp(-rr / 60.) * .05) * vert;
      col += vec3(1., .9, .7) * beam * uBeam.z;
    }
    gl_FragColor = vec4(col, 1.);
  }`;
const FINAL_FS = /* glsl */`
  uniform sampler2D tColor, tDepth; uniform float uExposure, uTime, uMap; uniform vec2 uRes; uniform vec3 uGrade; uniform mat4 uPInv, uCamW; uniform vec3 uCam;
  varying vec2 vUv;
  vec3 RRTAndODTFit(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
  vec3 aces(vec3 c){const mat3 I=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);const mat3 O=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);return clamp(O*RRTAndODTFit(I*c),0.,1.);}
  float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
  void main(){
    vec3 c = texture2D(tColor, vUv).rgb * uExposure * uGrade;
    c = aces(c);
    float l = dot(c, vec3(.2126,.7152,.0722));
    c = mix(vec3(l), c, .82);                                                   // a little desaturated
    c *= mix(vec3(.84,.97,1.06), vec3(1.05,1.,.92), smoothstep(.0, .5, l));      // cool shadows, warmer highlights
    c = pow(c, vec3(1. / 2.2));
    c = mix(c, c * c * (3. - 2. * c), .22);                                      // gentle S-curve
    vec2 q = vUv - .5; q.x *= uRes.x / uRes.y;
    // the world turning into the map (cinematic navigation): contour lines and the 2D map's palette
    if (uMap > .001) {
      float z = texture2D(tDepth, vUv).x;
      vec4 vp = uPInv * vec4(vUv * 2. - 1., z * 2. - 1., 1.); vp /= vp.w; vec3 wp = (uCamW * vec4(vp.xyz, 1.)).xyz;
      float h = wp.y, fw = max(fwidth(h), 1e-3);
      float minor = 1. - smoothstep(0., fw * 1.2, abs(fract(h / 8. + .5) - .5) * 8.);
      float major = 1. - smoothstep(0., fw * 1.6, abs(fract(h / 40. + .5) - .5) * 40.);
      vec3 land = mix(vec3(.11,.149,.141), vec3(.153,.204,.184), smoothstep(10., 160., h)) * (.85 + .3 * l);
      vec3 m = mix(land, vec3(.365,.42,.39), minor * .35 + major * .55);
      if (h < 12.2 && h > 11.) m = vec3(.039,.059,.063);                         // the lake: the map's sea colour
      if (z >= .99999) m = vec3(.039,.059,.063);
      c = mix(c, m, uMap);
    }
    c *= mix(1., 1. - smoothstep(.25, 1.15, length(q)), .55 * (1. - uMap * .7));
    c += (h12(vUv * uRes + fract(uTime * 3.7) * 91.) - .5) * .028;               // film grain (also kills banding)
    gl_FragColor = vec4(c, 1.);
  }`;
const QUAD_VS = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";

/* =====================================================================================  IMPOSTORS
   Far trees are camera-facing cards whose picture is rendered once, from the real tree, with the same moonlight. */
function bakeImpostor(renderer, geo, mat, w, h) {
  const rt = new WebGLRenderTarget(w, h, { samples: 4, type: UnsignedByteType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
  rt.texture.colorSpace = SRGBColorSpace;
  const sc = new Scene(), m = new Mesh(geo, mat); sc.add(m);
  const dl = new DirectionalLight(0xb4c6e6, 2.6); dl.position.copy(LIGHT_DIR); sc.add(dl);
  sc.add(new HemisphereLight(0x4a6088, 0x141a14, 1.5));
  const cam = new OrthographicCamera(-0.3, 0.3, 1.03, -0.02, -5, 5); cam.position.set(0, 0, 1); cam.lookAt(0, 0, 0);
  const cc = new Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam); renderer.setRenderTarget(null); renderer.setClearColor(cc, ca);
  return rt;
}
function impostorMaterial(tex, a2c, lant) {
  return new ShaderMaterial({
    uniforms: { map: { value: tex }, uCam: { value: new Vector3() }, uLant: lant.pos, uLantK: lant.k }, alphaToCoverage: a2c,
    vertexShader: /* glsl */`
      uniform vec3 uCam; uniform vec4 uLant; uniform float uLantK; varying vec2 vUv; varying vec3 vTint;
      void main(){
        vec3 c = instanceMatrix[3].xyz; float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec3 tc = uCam - c; tc.y = 0.; vec3 rt = normalize(vec3(tc.z, 0., -tc.x));
        vec3 p = c + rt * position.x * sx + vec3(0., position.y * sy, 0.);
        vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vTint = instanceColor;
      #else
        vTint = vec3(1.);
      #endif
        vec3 lv = p - uLant.xyz; vTint += vec3(1.6, .95, .45) * uLantK * exp(-dot(lv, lv) / (uLant.w * uLant.w * 1.4)) * 1.4;   // the lantern on far crowns
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying vec3 vTint;
      void main(){
        vec4 t = texture2D(map, vUv);
        ${a2c ? "float a = clamp((t.a - .45) / max(fwidth(t.a), 1e-4) + .5, 0., 1.); if (a < .01) discard;" : "float a = 1.; if (t.a < .5) discard;"}
        gl_FragColor = vec4(t.rgb / max(t.a, .05) * vTint, a);
      }`,
  });
}

/* =====================================================================================  MAIN */
const TIERS = [
  { dTheta: 0.024, near: 140, far: 3500, tiers: 11, per: 5, segs: 1, msaa: 0, bloom: false, shadow: 1024, steps: 3, pr: 1, fps: 30, imp: 128 },
  { dTheta: 0.015, near: 360, far: 8000, tiers: 14, per: 6, segs: 1, msaa: 4, bloom: true, shadow: 1024, steps: 5, pr: 1.25, fps: 60, imp: 192 },
  { dTheta: 0.0105, near: 760, far: 14000, tiers: 20, per: 7, segs: 2, msaa: 4, bloom: true, shadow: 2048, steps: 8, pr: 1.5, fps: 60, imp: 256 },
];
const LAKE_DEPRESSION = 25 * DEG;
// the picture also reaches at least this high above the horizon: a band of tonight's real sky (stars, and the Moon when it
// is low enough) stays visible above the castle. v9 framed the towers right under the top edge, so on a wide screen the
// sky was a few pixels behind the header and the mountains, and the real Moon and stars were practically never seen.
const SKY_TOP = 24 * DEG;
/** The valley's compass orientation when the real Moon is low enough to be in the picture: the Moon is put near the
 *  castle, but where it is really in open sky (above the hills and the towers), not hidden behind them. v9 always put it
 *  13 deg right of the view, which is exactly behind the castle and its mountains: a Moon 5-15 deg high was never seen.
 *  Returns null when the Moon is too high or too low for the picture (the valley then uses sky.js valleyAzimuth). */
/** highest elevation (deg) of the land seen from the landing camera in world direction phi (deg, + = right of -z) */
function skyline(phi) {
  const camY = H(0, 0) + CAM_UP, sx = Math.sin(phi * DEG), sz = -Math.cos(phi * DEG); let best = -90;
  for (let d = 60; d < 7000; d += 8 + d * 0.03) best = Math.max(best, Math.atan2(H(sx * d, sz * d) - camY, d) / DEG);
  return best;
}
const skyCache = new Map();
/** skyline(), cached by half degrees (it does not change: the land is fixed) */
function skylineC(phi) { const k = Math.round(phi * 2); let v = skyCache.get(k); if (v === undefined) { v = skyline(k / 2); skyCache.set(k, v); } return v; }
function moonAzimuth(state) {
  const m = state.astro.moon; if (!(m.alt > 1.5 && m.alt < 20.5)) return null;
  const camY = H(0, 0) + CAM_UP, thC = Math.atan2(C.x, -C.z) / DEG, castleTop = Math.atan2(C.T + 46 - camY, Math.hypot(C.x, C.z)) / DEG;
  // 1) next to the castle, in the picture; 2) failing that (the hills there are higher than the Moon), anywhere the land
  //    is low enough, as near the castle as possible: then "Look at the sky" finds it in open sky, not behind a mountain
  const near = [], far = []; for (let d = -12; d <= 12; d += 0.5) near.push(d); for (let d = -80; d <= 60; d += 1) if (Math.abs(thC + d) <= 35) far.push(d);   // (the valley is built for views within ~+-75 deg of its axis)
  near.sort((a, b) => Math.abs(a - 4) - Math.abs(b - 4)); far.sort((a, b) => Math.abs(a) - Math.abs(b));
  for (const d of [...near, ...far]) {
    let sky = skyline(thC + d); if (Math.abs(d) < 7.5) sky = Math.max(sky, castleTop);   // the towers
    if (m.alt >= sky + 2.6) return norm360(m.az - thC - d);                   // the disc (and its glow) clears the skyline
  }
  return null;
}
const DBG = (() => { try { return Object.fromEntries(new URLSearchParams(location.search)); } catch (e) { return {}; } })();   // the frame reaches this far below the horizon, so the lake and its reflection are in view

/**
 * @param host  the element the canvas goes into
 * @param o     { reduce, onFail, onFinale(), onWisp() -> Promise, onEvent(type, detail), pointerHost }
 *              onEvent: "sighting" {id} (a rare thing was on screen: eyes, ridge, ruin, figure, redmoon, wisp, night:<id>),
 *                       "crow" {pan}, "wisp" {pan}, "wisp-catch", "water" {k} (the lantern over the lake, 0..1)
 */
export function createHero3D(host, { reduce = false, onFail = null, onFinale = null, onWisp = null, onEvent = null, pointerHost = null } = {}) {
  const emit = (type, d = {}) => { if (onEvent) try { onEvent(type, d); } catch (e) { /* optional */ } };
  const canvas = document.createElement("canvas");
  canvas.className = "hero-gl"; canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }); }
  catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  host.prepend(canvas);
  const tier = pickTier(renderer), Q = TIERS[tier], F = FEATURES[tier];
  const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  renderer.toneMapping = NoToneMapping; renderer.autoClear = true;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 1);

  const scene = new Scene(), camera = new PerspectiveCamera(36, 1, 1, 12000);
  camera.rotation.order = "YXZ";
  const timeU = { value: 0 };
  const stats = { tier, quality: QNAMES[tier], buildMs: 0, scale: 1, fps: 0, tris: 0, trees: 0, impostors: 0, ready: false };
  let rtScene = null, rtPost = null, bloom = null, fogQuad = null, finalQuad = null, sky = null, impMats = [];
  let ready = false, disposed = false, raf = 0, visible = true, last = 0, acc = 0, frames = 0, slowT = 0, fastT = 0;
  let W = 1, Hh = 1, pr = 1, scale = 1;
  const view = { px: 0, py: 0, s: 0, cx: 0, cy: 0, cs: 0 }, intro = { t: 1, on: false };
  // LOOKING UP AT THE REAL SKY: the camera tilts from the valley to tonight's Moon (or, when it is below the horizon,
  // to the stars high in the sky) and back. e = eased 0..1, to = where it is going, yaw/pitch = the target direction.
  const gaze = { t: 0, e: 0, to: 0, yaw: 0, pitch: 0, dur: 2.6 };
  const base = { pos: new Vector3(), yaw: 0, shift: 0, fov: 40 };

  /* ---------- tonight's sky (astronomy + special night) ---------- */
  let night = tonight();
  // the valley is fictional, so its compass orientation is free: put the real Moon next to the castle, or (when it is
  // low enough to be seen in the water) right above it, so that its reflection lies in the lake
  const Av = moonAzimuth(night) ?? valleyAzimuth(night);
  const moonW = new Vector3(), sunW = new Vector3(), northW = new Vector3(), tmpA = [0, 0, 0];
  const profile = night.night, season = night.season;
  SEASON_U.uSnow.value = season.snow; SEASON_U.uGreen.value = season.green; SEASON_U.uBrown.value = season.brown;
  const veil = { value: 0 };
  // shared by the lake (reflection pass) and the shaders that can "lie" in it
  const A = { uRefl: { value: 0 }, uRuin: { value: 0 }, uFigure: { value: 0 }, uFigureWin: { value: -1 }, uRedMoon: { value: 0 }, uPhantom: { value: new Vector3() }, uPhantomOn: { value: 0 } };
  const lant = { pos: { value: new Vector4(0, -1000, 0, 20) }, k: { value: 0 } };
  let terrainMesh = null, moonLight = null, hemi = null, fill = null, castle = null, arch = null, stars = null, lake = null, lantern = null, wisps = null, pres = null, progress = null;
  const beam = { k: 0, h: 0 }, chapel = { k: 0 };
  let lightK = 1, lastSkyT = 0;

  function applySky() {
    const a = night.astro;
    enuToWorld(a.moon.enu, Av, tmpA); moonW.set(tmpA[0], tmpA[1], tmpA[2]).normalize();
    enuToWorld(a.sun.enu, Av, tmpA); sunW.set(tmpA[0], tmpA[1], tmpA[2]).normalize();
    enuToWorld([0, 1, 0], Av, tmpA); northW.set(tmpA[0], tmpA[1], tmpA[2]);
    if (sky) {
      sky.u.uMoon.value.copy(moonW); sky.u.uSun.value.copy(sunW);
      const tint = profile ? profile.moonTint : [1, 1, 1], tk = profile ? profile.moonTintK : 0;
      // low Moon: warmer and dimmer (more air); special nights tint it (art)
      const low = 1 - smooth(2, 25, a.moon.alt);
      sky.u.uMoonTint.value.set(lerp(1, tint[0], tk) * (1 + low * 0.08), lerp(1, tint[1], tk) * (1 - low * 0.12), lerp(1, tint[2], tk) * (1 - low * 0.3));
      sky.u.uMoonK.value = 0.35 + 0.65 * Math.pow(a.moon.fraction, 0.7);
      sky.u.uSkyK.value = 0.35 + 0.65 * night.moonLight; sky.u.uTwi.value = night.twilight; sky.u.uHalo.value = profile ? profile.halo : 0;
    }
    if (stars) { stars.setMatrix(eqToWorldMatrix(a.eqToEnu, Av)); stars.uniforms.uSkyBright.value = night.moonLight; stars.uniforms.uTwilight.value = night.twilight; stars.uniforms.uK.value = profile && profile.frost ? 1.25 : 1; }
    A.uPhantom.value.copy(new Vector3(C.x - base.pos.x, 0, C.z - base.pos.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), 0.19).setY(0.3).normalize());   // high enough to clear the far hills in the water, left of the crag, clear of the title
    if (lake) lake.moonInWater = moonW.y > 0.1 && moonW.y < 0.42 && lake.reflects(moonW);
    if (moonLight) {
      // the Moon's light: phase (with the opposition surge) and height; below the horizon only the night sky lights the valley
      const up = moonW.y > 0, k = night.moonLight;
      const dir = up ? moonW : new Vector3(0.15, 1, -0.2).normalize();
      moonLight.position.copy(moonLight.target.position).addScaledVector(dir, 900);
      const low = 1 - smooth(2, 25, a.moon.alt);
      moonLight.color.setRGB(0.71 + 0.2 * low, 0.78 + 0.02 * low, 0.9 - 0.28 * low);
      if (profile) moonLight.color.multiply(new Color(...profile.moonTint).lerp(new Color(1, 1, 1), 1 - profile.moonTintK));
      moonLight.userData.k = 2.6 * k;
      hemi.intensity = 1.0 + 0.5 * k; fill.intensity = 0.45 * (0.35 + 0.65 * k);
      lightK = 1.3 - 0.3 * k;                            // a dark night is darker, but the exposure keeps it readable
      renderer.shadowMap.needsUpdate = true;
    }
    stats.sky = { season: season.id, caption: night.caption, live: night.live, tonight: night.tonight, moonAlt: +a.moon.alt.toFixed(1), moonAz: +a.moon.az.toFixed(1), phase: a.moon.name, fraction: +a.moon.fraction.toFixed(3), valleyAz: +Av.toFixed(1), night: profile ? profile.id : null };
  }

  /* ---------- build (in a few slices so the page stays responsive) ---------- */
  const steps = [];
  const t0 = performance.now();
  steps.push(() => {
    const g = buildTerrain(Q.dTheta), m = new Mesh(g, terrainMaterial(false)); m.userData.terrain = true; terrainMesh = m; m.material.side = DoubleSide;   // seen from above too (camera flights)
    m.receiveShadow = true; m.castShadow = true; scene.add(m);
    sky = buildSky(timeU, A, veil); scene.add(sky.mesh);
    const moon = new DirectionalLight(0xb4c6e6, 2.6), tgt = new Object3D(); tgt.position.set(10, 30, -200);
    moon.position.copy(tgt.position).addScaledVector(LIGHT_DIR, 900); moon.target = tgt; scene.add(moon, tgt);
    moon.castShadow = true; moon.shadow.mapSize.set(Q.shadow, Q.shadow);
    Object.assign(moon.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 200, far: 1700 }); moon.shadow.camera.updateProjectionMatrix();
    moon.shadow.bias = -0.0009; moon.shadow.normalBias = 1.3; moon.shadow.radius = 2.5;
    hemi = new HemisphereLight(0x4a6088, 0x141a14, 1.5); scene.add(hemi);
    fill = new DirectionalLight(0x7d8fb4, 0.45); fill.position.set(-0.55, 0.4, 0.75); scene.add(fill);   // skylight bounce on the shadow side
    moonLight = moon;
    stars = createStars({ maxMag: F.skyMag, timeU, moonDir: moonW, veil }); scene.add(stars.points);
    lantern = createLantern({ host: pointerHost || host, scene, camera, F, reduce });
    lant.pos = lantern.pos; lant.k = lantern.k;
  });
  steps.push(() => { castle = buildCastle(timeU, tier === 0, A); arch = castle.userData.archive; scene.add(castle); });
  steps.push(() => {
    // tree variants: three spruces/firs + a dead tree
    const atlas = foliageAtlas(tier === 2 ? 512 : 256), mat = foliageMaterial(atlas, Q.msaa > 0, timeU);
    const vars = [
      spruceGeometry(11, { tiers: Q.tiers, per: Q.per, R: 0.3, shape: 1.0, droop: 0.38, segs: Q.segs }),
      spruceGeometry(23, { tiers: Q.tiers + 2, per: Q.per, R: 0.24, shape: 0.9, droop: 0.5, segs: Q.segs }),
      spruceGeometry(37, { tiers: Q.tiers - 2, per: Q.per + 1, R: 0.34, shape: 1.15, droop: 0.28, segs: Q.segs }),
      deadTreeGeometry(51),
    ];
    const r = rng(777), near = vars.map(() => []), far = vars.map(() => []);
    const pick = () => { const v = r(); return v < 0.06 ? 3 : v < 0.45 ? 0 : v < 0.75 ? 1 : 2; };
    const NEAR_R = 230;
    // near trees: real geometry
    for (let i = 0, tries = 0; near.reduce((s, a) => s + a.length, 0) < Q.near && tries < Q.near * 40; tries++) {
      const rr = 12 + Math.sqrt(r()) * (NEAR_R - 12), a = -1.0 + r() * 2.05, x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      if (rr < 45) continue;                                                                   // keep the lens clear
      if (rr < 130 && Math.abs(a - Math.atan2(C.x, -C.z)) < 0.2) continue;                     // and the castle's reflection in the lake
      const h = H(x, z), ny = slopeY(x, z), f = forestDensity(x, z, h, ny);
      if (r() > f) continue;
      const v = pick(), s = (v === 3 ? 12 : 16) + r() * 15;
      near[v].push([x, h - 0.4, z, s, r() * 6.28, r()]); i++;
    }
    // undergrowth: saplings in the foreground
    for (let k = 0; k < (tier ? 90 : 30); k++) {
      const rr = 45 + r() * 120, a = -1.0 + r() * 2.05, x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      const h = H(x, z), ny = slopeY(x, z); if (ny < 0.8 || forestDensity(x, z, h, ny) < 0.2) continue;
      near[r() < 0.5 ? 0 : 2].push([x, h - 0.2, z, 2 + r() * 4, r() * 6.28, r()]);
    }
    // far trees: impostors, thinning out with distance
    for (let tries = 0, n = 0; n < Q.far && tries < Q.far * 30; tries++) {
      const rr = NEAR_R - 20 + Math.pow(r(), 1.6) * 2600, a = -1.05 + r() * 2.15, x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      const h = H(x, z), ny = slopeY(x, z), f = forestDensity(x, z, h, ny);
      if (r() > f) continue;
      const v = pick(); far[v].push([x, h - 0.6, z, (v === 3 ? 13 : 17) + r() * 14, 0, r()]); n++;
    }
    const o = new Object3D(), col = new Color();
    const tint = (k) => col.setRGB(0.82 + k * 0.3, 0.86 + k * 0.22, 0.8 + k * 0.2);
    vars.forEach((g, vi) => {
      if (near[vi].length) {
        const im = new InstancedMesh(g, mat, near[vi].length);
        near[vi].forEach(([x, y, z, s, ry, k], i) => { o.position.set(x, y, z); o.rotation.set((k - 0.5) * 0.05, ry, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, tint(k)); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.layers.set(LAYER_NOREFL); scene.add(im);
      }
      if (far[vi].length) {
        const rt = bakeImpostor(renderer, g, mat, Q.imp, Math.round(Q.imp * 1.75)), im2 = new InstancedMesh(new PlaneGeometry(0.6, 1.05).translate(0, 0.505, 0), impostorMaterial(rt.texture, Q.msaa > 0, lant), far[vi].length);
        im2.userData.rt = rt; impMats.push(im2.material);
        far[vi].forEach(([x, y, z, s, , k], i) => { o.position.set(x, y, z); o.rotation.set(0, 0, 0); o.scale.setScalar(s); o.updateMatrix(); im2.setMatrixAt(i, o.matrix); im2.setColorAt(i, tint(k)); });
        im2.frustumCulled = false; scene.add(im2);
      }
    });
    stats.trees = near.reduce((s, a) => s + a.length, 0); stats.impostors = far.reduce((s, a) => s + a.length, 0);
  });
  steps.push(() => {
    // boulders on the slopes and at the foot of the crag
    let g = new IcosahedronGeometry(1, tier ? 3 : 2); g.deleteAttribute("normal"); g.deleteAttribute("uv"); g = mergeVertices(g);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new Vector3().fromBufferAttribute(p, i), k = 0.72 + 0.5 * fbm(v.x * 1.3 + 3, v.z * 1.3 + v.y * 0.7, 3) + 0.1 * noise2(v.x * 5, v.y * 5 + v.z); v.multiplyScalar(k); v.y *= 0.62; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const r = rng(99), list = [];
    for (let tries = 0; list.length < (tier ? 140 : 60) && tries < 6000; tries++) {
      const rr = 12 + Math.pow(r(), 0.7) * 420, a = -1.0 + r() * 2.05, x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      const ny = slopeY(x, z), cr = cragR(x, z), want = cr < 1.15 || lakeR(x, z) < 1.12 ? 0 : (ny < 0.9 ? 0.5 : 0.04) + (cr < 2.2 ? 0.5 : 0);
      if (r() > want) continue; list.push([x, H(x, z), z, 0.6 + Math.pow(r(), 3) * (cr < 2.2 ? 5.5 : 3.5), r() * 6.28]);
    }
    const im = new InstancedMesh(g, terrainMaterial(true), list.length), o = new Object3D();
    list.forEach(([x, y, z, s, ry], i) => { o.position.set(x, y - s * 0.18, z); o.rotation.set(0, ry, 0); o.scale.set(s * (0.8 + (i % 5) * 0.1), s, s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  });
  steps.push(() => {
    // the crag's cliffs: big fissured rock masses ringing the plateau (the castle walls stand on them)
    const mkCliff = (seed, det) => {
      let g = new IcosahedronGeometry(1, det); g.deleteAttribute("normal"); g.deleteAttribute("uv"); g = mergeVertices(g);
      const p = g.attributes.position, v = new Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const big = fbm(v.x * 1.2 + seed, v.z * 1.2 + v.y * 1.1, 3), knob = fbm(v.x * 5.5 - seed, v.z * 5.5 + v.y * 4.7, 3);
        const lay = noise2(v.y * 7 + seed, v.x * 0.7 + v.z * 0.7) - 0.5;                                     // bedding planes
        v.multiplyScalar(0.85 + 0.22 * big + 0.1 * (knob - 0.5) + 0.06 * lay);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      // cleave it with planes: flat faces and sharp edges, like split rock
      const rc = rng(Math.round(seed * 1000)), cuts = [];
      for (let c = 0; c < 18; c++) { const n = new Vector3(rc() - 0.5, c < 3 ? 0.8 + rc() * 0.5 : (rc() - 0.5) * 0.9, rc() - 0.5).normalize(); cuts.push([n, 0.5 + rc() * 0.24]); }
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        for (const [n, d] of cuts) { const e = v.dot(n) - d; if (e > 0) v.addScaledVector(n, -e); }
        const kn = noise2(v.x * 9 + v.y * 3 + seed, v.z * 9 - v.y * 2) - 0.5; v.multiplyScalar(1 + kn * 0.035);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals(); return g;
    };
    const geos = [mkCliff(3.1, tier ? 4 : 3), mkCliff(8.7, tier ? 4 : 3)], r = rng(5150), lists = [[], []], mat = terrainMaterial(true);
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 20 : 28;
      for (let i = 0; i < n; i++) for (let lv = 0; lv < (ring ? 1 : 2); lv++) {
        const a = (i + r() * 0.5 + lv * 0.5) / n * Math.PI * 2, rr = ring ? 1.3 + r() * 0.25 : 1.04 + lv * 0.09 + r() * 0.06;
        const x = C.x + Math.cos(a) * C.rx * rr, z = C.z + Math.sin(a) * C.rz * rr;
        const sy = 12 + r() * 7, top = ring ? C.T * 0.5 + r() * 8 : C.T - 3 - r() * 5 - lv * 17;
        lists[(i + lv) % 2].push([x, top - sy * 0.75, z, 10 + r() * 6, sy, 9 + r() * 6, r() * 6.28]);
      }
    }
    const o = new Object3D();
    lists.forEach((l, k) => {
      const im = new InstancedMesh(geos[k], mat, l.length);
      l.forEach(([x, y, z, sx, sy, sz, ry], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
    });
  });
  steps.push(() => {
    // the living valley: the lake, the castle's Archive windows, the wisps, the presences
    castle.updateMatrixWorld(true);
    const toW = v => v.clone().applyMatrix4(castle.matrixWorld);
    lake = createLake({ renderer, scene, camera, timeU, F, hdr, moonDir: moonW, lantern: lant, sky: sky.mesh, stars: stars.points, anomaly: A });
    wisps = createWisps({ scene, camera, host: pointerHost || host, F, timeU, rate: profile ? profile.wisps : 1, project, lanternScreen: lantern.screen, reduce,
      onCatch: () => { stats.wispsCaught = (stats.wispsCaught || 0) + 1; emit("wisp-catch"); if (onWisp) onWisp(); },
      onSpawn: p => { const sp = project(p), r = canvas.getBoundingClientRect(); if (sp && sp.on) { emit("wisp", { pan: r.width ? (sp.x - r.left) / r.width * 2 - 1 : 0 }); emit("sighting", { id: "wisp" }); } } });
    keepW = toW(arch.keep);
    pres = createPresences({ scene, camera, F, timeU, keepWorld: toW(arch.keep), night: profile, lake: { anomaly: A, get figureWindows() { return arch.figureWindows; }, get moonInWater() { return !!(lake && lake.moonInWater); } }, sky, project, pointerScreen: lantern.screen, reduce, onEvent: emit });
    veil.value = 0; pres.veil = veil;
    beam.pos = toW(arch.chapel);
    progress = createCastleProgress({
      reduce,
      isVisible: () => visible && ready && !document.hidden && intro.t >= 1 && !rig.active,
      setWindow(role, level, flare) {
        const ids = arch.roles[role] || []; const col = new Color(), secret = role === "secret-wisp";
        for (const i of ids) { if (level > 0.001) col.setRGB(secret ? 0.35 : 1.7, secret ? 1.25 : 0.82, secret ? 1.05 : 0.28).multiplyScalar(level * (role === "seal-archivist" ? 1.2 : 1)); else col.setRGB(0.012, 0.011, 0.012); arch.wi.setColorAt(i, col); }
        arch.wi.instanceColor.needsUpdate = true;
        const fa = arch.flares.geometry.attributes.aA; for (const j of arch.flareIndex[role] || []) fa.array[j] = flare; fa.needsUpdate = true;
      },
      setChapel(k) { chapel.k = k; arch.chapelL.intensity = k * 38; const ids = arch.roles["seal-archivist"] || []; if (k > 1.01) { const c = new Color(1.8, 1.25, 0.6).multiplyScalar(k * 0.9); for (const i of ids) arch.wi.setColorAt(i, c); arch.wi.instanceColor.needsUpdate = true; } },
      setBeam(k, h) { beam.k = k; beam.h = h; },
      onFinale() { if (onFinale) onFinale(); },
    });
    applySky();
  });
  steps.push(() => {
    // render targets and post passes
    const type = hdr ? HalfFloatType : UnsignedByteType;
    rtScene = new WebGLRenderTarget(4, 4, { type, samples: Q.msaa, depthTexture: new DepthTexture(4, 4, UnsignedIntType) });
    rtPost = new WebGLRenderTarget(4, 4, { type });
    fogQuad = new FullScreenQuad(new ShaderMaterial({
      uniforms: {
        tColor: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture }, uPInv: { value: new Matrix4() }, uCamW: { value: new Matrix4() }, uCam: { value: new Vector3() },
        uMoon: { value: moonW }, uMoonK: { value: 1 }, uTime: timeU, uSteps: { value: Q.steps }, uMistK: { value: (profile ? profile.mist : 1) * season.mist * (DBG.mist != null ? +DBG.mist : 1) },
        uLant: lant.pos, uLantK: lant.k, uBeam: { value: new Vector4() }, uBeamY: { value: 0 },
        uLake: { value: new Vector4(LAKE.x, LAKE.z, LAKE.rx, LAKE.rz) }, uLakeRot: { value: new Vector2(Math.cos(LAKE.rot), Math.sin(LAKE.rot)) },
      },
      vertexShader: QUAD_VS, fragmentShader: FOG_FS, depthTest: false, depthWrite: false,
    }));
    finalQuad = new FullScreenQuad(new ShaderMaterial({
      uniforms: { tColor: { value: rtPost.texture }, tDepth: { value: rtScene.depthTexture }, uExposure: { value: 0 }, uTime: timeU, uRes: { value: new Vector3() }, uGrade: { value: new Vector3(...(profile ? profile.grade : [1, 1, 1])).multiply(new Vector3(...season.grade)) },
        uMap: { value: 0 }, uPInv: fogQuad.material.uniforms.uPInv, uCamW: fogQuad.material.uniforms.uCamW, uCam: fogQuad.material.uniforms.uCam },
      vertexShader: QUAD_VS, fragmentShader: FINAL_FS, depthTest: false, depthWrite: false,
    }));
    if (Q.bloom && hdr) { bloom = new UnrealBloomPass({ x: 256, y: 256 }, 0.32, 0.4, 0.75); }
    resize();
    renderer.compile(scene, camera);
    renderer.shadowMap.needsUpdate = true;
    stats.buildMs = Math.round(performance.now() - t0);
    ready = stats.ready = true;
    render(0.016);
    if (profile) emit("sighting", { id: "night:" + profile.id, label: profile.label });
    canvas.classList.add("on");
    kick();
  });
  const runSteps = () => {
    if (disposed) return;
    if (document.body.classList.contains("adv-open")) { setTimeout(runSteps, 600); return; }   // a 3D adventure has the machine: build later
    const s = steps.shift(); if (!s) return; try { s(); } catch (e) { console.error(e); fail(); return; } setTimeout(runSteps, 0); };
  const fail = () => { disposed = true; canvas.remove(); try { renderer.dispose(); } catch (e) { /* ignore */ } if (onFail) onFail(); };

  /* ---------- framing: the castle sits right of the title on wide screens, below it on tall ones; the lake below it ---------- */
  const castleC = new Vector3(C.x, C.T + 16, C.z);
  function frameCamera(aspect) {
    const t = clamp((aspect - 0.7) / (1.4 - 0.7), 0, 1);
    camera.fov = lerp(58, 46, t); camera.aspect = aspect;
    { const need = (Math.tan(SKY_TOP) + Math.tan(LAKE_DEPRESSION)) / 2; if (Math.tan(camera.fov * DEG / 2) < need) camera.fov = Math.min(62, 2 * Math.atan(need) / DEG); }   // open the sky
    base.fov = camera.fov;
    const ndcX = lerp(0.0, 0.36, t);
    base.pos.set(0, H(0, 0) + CAM_UP, 0);
    camera.position.copy(base.pos); camera.updateProjectionMatrix();
    const P = camera.projectionMatrix.elements, thC = Math.atan2(castleC.x - base.pos.x, -(castleC.z - base.pos.z));
    base.yaw = Math.atan(ndcX / P[0]) - thC;
    camera.rotation.set(0, base.yaw, 0); camera.updateMatrixWorld();
    // vertical framing: the bottom edge of the picture reaches LAKE_DEPRESSION below the horizon (the lake and its
    // reflection), without pushing the castle's towers out of the top
    const th = Math.tan(camera.fov * DEG / 2), v = castleC.clone().applyMatrix4(camera.matrixWorldInverse);
    let c = Math.tan(-LAKE_DEPRESSION) + th;                                     // tangent of the picture's centre
    const topNeed = Math.tan(Math.atan2(v.y + 30, -v.z) + 4.5 * DEG);            // tower tops + some sky under the header
    if (topNeed > c + th) c = topNeed - th;
    base.shift = c / th;   // ndc_y = tan(elevation) / th - shift
    applyShift();
    // the Moon is where the sky says it is: sky.js / astro.js (no art direction here any more)
    if (sky) applySky();
  }
  function applyShift(sh = base.shift) { camera.projectionMatrix.elements[9] = sh; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }

  function resize() {
    if (!rtScene || slept) return;
    W = Math.max(1, host.clientWidth); Hh = Math.max(1, host.clientHeight);
    pr = Math.min(window.devicePixelRatio || 1, Q.pr) * scale;
    renderer.setPixelRatio(pr); renderer.setSize(W, Hh, false);
    const bw = Math.max(1, Math.round(W * pr)), bh = Math.max(1, Math.round(Hh * pr));
    rtScene.setSize(bw, bh); rtPost.setSize(bw, bh); if (bloom) bloom.setSize(bw, bh);
    if (lake) lake.resize(bw, bh);
    finalQuad.material.uniforms.uRes.value.set(bw, bh, 0);
    const px = bh / 900 * Math.max(0.75, pr);
    if (stars) stars.uniforms.uPx.value = Math.max(1, pr); if (wisps) wisps.setPx(px); if (pres) pres.setPx(px); if (arch) arch.flares.material.uniforms.uPx.value = px;
    frameCamera(W / Hh);
    render(0);   // draw at once: a resized canvas is blank until the next frame
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(host);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }, { threshold: 0 }); io.observe(host);
  const onVis = () => kick(); document.addEventListener("visibilitychange", onVis);
  // while a 3D adventure is open the valley gives back its video memory (its render targets shrink to nothing)
  let slept = false;
  const sleepWake = () => {
    const adv = document.body.classList.contains("adv-open");
    if (adv && !slept && rtScene) { slept = true; renderer.setSize(1, 1, false); rtScene.setSize(1, 1); rtPost.setSize(1, 1); if (bloom) bloom.setSize(1, 1); if (lake) lake.rt.setSize(1, 1); }
    else if (!adv && slept) { slept = false; resize(); kick(); }
  };
  const mo = new MutationObserver(sleepWake); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /** world point -> client (CSS px) coordinates, or null when behind the camera / off screen */
  const pv = new Vector3();
  function project(v) {
    pv.copy(v).project(camera); if (pv.z > 1 || pv.z < -1) return null;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (pv.x + 1) / 2 * r.width, y: r.top + (1 - pv.y) / 2 * r.height, on: Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05 };
  }

  /* ---------- looking up at the real sky ---------- */
  const tv = new Vector3(), D2Rs = Math.PI / 180;
  function gazeTarget() {
    // the Moon when it is up (a little below the centre of the picture, so the sky around it shows); otherwise the stars
    // high in the south-east-ish part of the sky the valley already faces
    const up = moonW.y > Math.sin(2 * DEG);
    // (the yaw is kept within 40 deg of the valley's axis: further round, the edge of the built landscape would show)
    if (up) { tv.copy(moonW); return { yaw: clamp(Math.atan2(-tv.x, -tv.z), -40 * DEG, 40 * DEG), pitch: clamp(Math.asin(tv.y) + 4 * DEG, 12 * DEG, 72 * DEG), moon: true }; }
    // no Moon: the brightest named star that stands well up in the sky (Vega, Capella, Sirius...), with its neighbours
    // (high in the sky a sideways turn covers more of it, so a bright star well round to the side still comes into view)
    let best = null;
    for (const s of namedDirs()) { const alt = Math.asin(s.dir.y); if (alt > 15 * DEG && alt < 80 * DEG && (!best || s.mag < best.mag)) best = s; }
    if (best) return { yaw: clamp(Math.atan2(-best.dir.x, -best.dir.z), -40 * DEG, 40 * DEG), pitch: clamp(Math.asin(best.dir.y) - 3 * DEG, 22 * DEG, 68 * DEG), moon: false, star: best.name };
    return { yaw: base.yaw + 0.25, pitch: 42 * DEG, moon: false };
  }
  /** the named bright stars as world directions (tonight's real positions) */
  function namedDirs() {
    const M = eqToWorldMatrix(night.astro.eqToEnu, Av), out = [];
    for (const [name, ra, dec, mag] of NAMED_STARS) {
      const v = [Math.cos(dec * D2Rs) * Math.cos(ra * D2Rs), Math.cos(dec * D2Rs) * Math.sin(ra * D2Rs), Math.sin(dec * D2Rs)];
      out.push({ name, mag, dir: new Vector3(M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]) });
    }
    return out;
  }
  let gazeListener = null;
  function gazeDone() { if (lantern && !rig.active) lantern.setEnabled(true); if (gazeListener) gazeListener(false); kick(); }
  /** look up at the sky (true) or back down at the valley (false). Returns { moon } (is the Moon the target) or null. */
  function lookUp(on) {
    if (!ready || disposed || rig.active || intro.t < 1) return null;
    if (on) {
      const g = gazeTarget(); gaze.yaw = g.yaw; gaze.pitch = g.pitch; gaze.to = 1;
      lantern.setEnabled(false); if (gazeListener) gazeListener(true); kick(); if (reduce) render(0);
      return { moon: g.moon };
    }
    if (gaze.to === 0) return null;
    gaze.to = 0; kick(); if (reduce) { render(0); }
    return { moon: false };
  }
  /** is the real Moon (up) still behind the valley's hills or the castle, seen from the camera? */
  function moonHidden() { if (moonW.y <= 0) return false; const phi = Math.atan2(moonW.x, -moonW.z) / DEG; return Math.asin(moonW.y) / DEG < skylineC(phi) + 0.6; }
  /** the names to write on the sky while looking up: the Moon and the bright named stars that are in the picture */
  function skyMarks() {
    if (!ready || gaze.e < 0.6) return [];
    const out = [], a = night.astro, r = canvas.getBoundingClientRect();
    const add = (name, dir, kind) => {
      if (dir.y < Math.sin(4 * DEG)) return;
      if (kind !== "moon" && Math.asin(dir.y) / DEG < skylineC(Math.atan2(dir.x, -dir.z) / DEG) + 0.5) return;   // behind the hills
      tv.copy(dir).multiplyScalar(5000).add(camera.position); const sp = project(tv);
      if (sp && sp.on && sp.x > r.left + 30 && sp.x < r.right - 30 && sp.y > r.top + 70 && sp.y < r.bottom - 40) out.push({ name, kind, x: sp.x, y: sp.y });
    };
    if (moonW.y > 0) add(`The Moon · ${moonHidden() ? "still behind the mountains" : `${a.moon.name.toLowerCase()} (${Math.round(a.moon.fraction * 100)}%)`}`, moonW, "moon");
    for (const s of namedDirs()) if (s.mag <= 2.1) add(s.name, s.dir, "star");
    return out;
  }

  /* ---------- the camera rig: cinematic navigation drives the camera through it (see src/nav/) ---------- */
  const rig = { active: false, pos: new Vector3(), target: new Vector3(), up: new Vector3(0, 1, 0), fov: 40, shift: 0, map: 0, fade: 1, useQuat: false, quat: new Quaternion() };
  /** the resting pose of the landing camera (what a flight returns to) */
  function basePose() {
    const pos = base.pos.clone(), dir = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), base.yaw);
    return { pos, target: pos.clone().add(dir.multiplyScalar(100)), up: new Vector3(0, 1, 0), fov: base.fov, shift: base.shift };
  }

  /* ---------- per frame ---------- */
  function update(dt) {
    timeU.value += dt;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 2.2);
    view.cx += (view.px - view.cx) * k; view.cy += (view.py - view.cy) * k; view.cs += (view.s - view.cs) * (reduce ? 1 : 1 - Math.exp(-dt * 6));
    if (intro.on) { intro.t = Math.min(1, intro.t + dt / 4.6); if (intro.t >= 1) intro.on = false; }
    const e = 1 - Math.pow(1 - intro.t, 3), T = reduce ? 0 : timeU.value;
    if (rig.active) {
      camera.position.copy(rig.pos);
      if (rig.useQuat) camera.quaternion.copy(rig.quat); else { camera.up.copy(rig.up); camera.lookAt(rig.target); }
      if (camera.fov !== rig.fov) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld(); applyShift(rig.shift);
    } else {
      // the tilt towards the sky (and back): eased, and instant with reduced motion
      if (gaze.t !== gaze.to) { gaze.t = reduce ? gaze.to : gaze.to > gaze.t ? Math.min(gaze.to, gaze.t + dt / gaze.dur) : Math.max(gaze.to, gaze.t - dt / (gaze.dur * 0.8)); if (gaze.t === 0 && gaze.to === 0) gazeDone(); }
      const g = gaze.e = gaze.t * gaze.t * (3 - 2 * gaze.t);
      camera.position.copy(base.pos);
      camera.position.x += (view.cx * 6 + Math.sin(T * 0.045) * 2.5) * (1 - g);
      camera.position.y += (-view.cy * 2.5 + Math.sin(T * 0.07) * 0.6) * (1 - g) + view.cs * 26 - (1 - e) * 7;
      camera.position.z += (1 - e) * 55 - view.cs * 30;
      let dy = gaze.yaw - base.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));   // the short way round
      camera.rotation.set(lerp(-view.cy * 0.012, gaze.pitch, g), base.yaw - view.cx * 0.018 * (1 - g) + dy * g, 0);
      camera.updateMatrixWorld(); applyShift(base.shift * (1 - g));
    }
    sky.mesh.position.copy(camera.position); stars.points.position.copy(camera.position);
    for (const m of impMats) m.uniforms.uCam.value.copy(camera.position);
    const fu = fogQuad.material.uniforms;
    fu.uPInv.value.copy(camera.projectionMatrixInverse); fu.uCamW.value.copy(camera.matrixWorld); fu.uCam.value.copy(camera.position);
    // the sky turns: re-read the real time every 30 s (the valley itself never rotates during a visit)
    if (night.live && timeU.value - lastSkyT > 30) { lastSkyT = timeU.value; const n2 = tonight(); if (n2.live) { night = n2; applySky(); } }
    const veilDim = 1 - veil.value * 0.55;
    moonLight.intensity = (moonLight.userData.k ?? 2.6) * veilDim;
    sky.u.uMoonK.value = (0.35 + 0.65 * Math.pow(night.astro.moon.fraction, 0.7)) * (1 - veil.value * 0.4);
    fu.uMoonK.value = (0.3 + 0.7 * night.moonLight) * veilDim;
    fu.uBeam.value.set(beam.pos ? beam.pos.x : 0, beam.pos ? beam.pos.z : 0, beam.k, beam.h); fu.uBeamY.value = beam.pos ? beam.pos.y : 0;
    // rare things happen only while the valley is really in view: not when it has been scrolled mostly away (v9 kept
    // them going with a sliver of the valley on screen, and the journal noted sightings nobody could have seen)
    const idle = intro.t >= 1 && !rig.active && visible && view.s < 0.3 && gaze.t === 0;   // and not while looking up at the sky
    lantern.update(dt);
    if (!rig.active) { wisps.update(dt, { idle }); }
    pres.update(dt, { idle: idle && !rig.active });
    progress.update(dt);
    if (onEvent) sounds(dt, idle);
    const fq = finalQuad.material.uniforms;
    fq.uExposure.value = 4.2 * lightK * Math.min(1, intro.t * 1.6) * (rig.active ? rig.fade : 1 - view.cs * 0.35);
    fq.uMap.value = rig.active ? rig.map : 0;
  }
  // what the valley sounds like (played by src/ui/ambient.js, only when the visitor has switched the sound on):
  // a crow over the keep now and then, and the lake's lapping, louder while the lantern hangs over the water
  let crowT = 6 + Math.random() * 10, waterT = 0, waterK = -1, keepW = null;
  function sounds(dt, idle) {
    if (idle && keepW && (crowT -= dt) < 0) { crowT = 14 + Math.random() * 28; const sp = project(keepW), r = canvas.getBoundingClientRect(); emit("crow", { pan: sp && r.width ? Math.max(-1, Math.min(1, (sp.x - r.left) / r.width * 2 - 1)) : 0 }); }
    if ((waterT -= dt) < 0) {
      waterT = 0.25; const lp = lantern.pos.value, over = lakeR(lp.x, lp.z) < 1 ? 1 : 0, k = idle ? Math.round(over * Math.min(1, lantern.k.value) * 10) / 10 : 0;
      if (k !== waterK) { waterK = k; emit("water", { k }); }
    }
  }
  function render(dt) {
    if (!ready || disposed) return;
    update(dt);
    lake.render(!running());
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    stats.tris = renderer.info.render.triangles; stats.calls = renderer.info.render.calls;
    renderer.setRenderTarget(rtPost); fogQuad.render(renderer);
    if (bloom) bloom.render(renderer, null, rtPost, dt, false);
    renderer.setRenderTarget(null); finalQuad.render(renderer);
  }
  const running = () => ready && !disposed && (rig.active || (!reduce && visible && !document.hidden && !document.body.classList.contains("adv-open")));
  function loop(now) {
    raf = 0; if (!running()) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    if (Q.fps < 60 && dt < 1 / Q.fps - 0.004) return;
    last = now; render(Math.min(dt, 0.05));
    // dynamic resolution: drop the render scale when frames are slow, raise it again when there is headroom
    acc += dt; frames++;
    if (acc > 1) {
      const ms = acc / frames * 1000; stats.fps = Math.round(frames / acc); acc = 0; frames = 0;
      if (ms > 24) { slowT++; fastT = 0; } else if (ms < 17.5) { fastT++; slowT = 0; } else { slowT = fastT = 0; }
      if (slowT >= 2 && scale > 0.55) { scale = Math.max(0.55, scale * 0.82); slowT = 0; resize(); }
      else if (fastT >= 4 && scale < 1) { scale = Math.min(1, scale * 1.1); fastT = 0; resize(); }
      stats.scale = +scale.toFixed(2);
    }
  }
  function kick() { if (!raf && running()) { last = performance.now(); raf = requestAnimationFrame(loop); } else if (reduce && ready) render(0); }

  // build after the page has loaded (the page is usable sooner on slow machines; the scene fades in when ready)
  if (document.readyState === "complete") setTimeout(runSteps, 30); else addEventListener("load", () => setTimeout(runSteps, 30), { once: true });
  return {
    canvas,
    /** px, py: pointer in -1..1 ; s: scroll progress 0..1 */
    setView(px, py, s) { view.px = px; view.py = py; view.s = s; if (reduce) render(0); else kick(); },
    intro() { if (!reduce) { intro.t = 0; intro.on = true; } },
    skipIntro() { intro.t = 1; intro.on = false; },
    stats: () => ({ ...stats, castle: progress ? progress.state() : null, event: pres ? pres.current() : null, wisps: wisps ? wisps.active().length : 0 }),
    isReady: () => ready,
    /** a still of the valley as it is now (for the postcard): renders one frame and copies it at once (the drawing buffer
     *  is not preserved, so the copy must happen in the same task as the render) */
    snapshot(target) { if (!ready || disposed) return null; render(0.016); try { if (target) { target.getContext("2d").drawImage(canvas, 0, 0, target.width, target.height); return target; } return canvas.toDataURL("image/png"); } catch (e) { return null; } },
    size: () => ({ w: canvas.width, h: canvas.height }),
    /** look up at tonight's real sky (true) or back at the valley (false); onGaze(fn(on)) hears when it starts/ends */
    lookUp, onGaze: fn => { gazeListener = fn; }, gazing: () => gaze.to > 0 || gaze.t > 0, skyMarks, moonHidden: () => ready && moonHidden(),
    /** tonight's sky as the landing shows it (caption for the page, star map for the page sky) */
    sky: () => ({ caption: night.caption, live: night.live, tonight: night.tonight, night: profile, season, valleyAz: Av, astro: night.astro, ref: night.ref, local: night.local, moonLight: night.moonLight }),
    /** the camera rig for cinematic navigation */
    rig: {
      begin() { if (gaze.t || gaze.to) { gaze.to = 0; gaze.t = 0; gaze.e = 0; if (gazeListener) gazeListener(false); } rig.active = true; rig.map = 0; rig.fade = 1; rig.useQuat = false; rig.quat = new Quaternion(); rig.pos.copy(camera.position); rig.up.set(0, 1, 0); rig.target.copy(camera.position).add(new Vector3(0, 0, -100).applyQuaternion(camera.quaternion)); rig.fov = camera.fov; rig.shift = camera.projectionMatrix.elements[9]; lantern.setEnabled(false); kick(); return rig; },
      end() { rig.active = false; frameCamera(W / Hh); lantern.setEnabled(true); kick(); },
      get active() { return rig.active; },
      state: rig, basePose, north: () => northW.clone(), up: () => new Vector3(0, 1, 0),
      gate() { castle.updateMatrixWorld(true); return arch ? { ...gateInfo(castle) } : null; },
      castle: () => new Vector3(C.x, C.T, C.z), lake: () => new Vector3(LAKE.x, LAKE.level, LAKE.z),
      render: () => render(0.016),
    },
    /** debugging & tests: force an event of the valley, summon a wisp, replay the castle's first lights */
    debug: {
      trigger: name => pres && pres.trigger(name),
      summonWisp: () => wisps && wisps.summon(),
      wisps: () => (wisps ? wisps.active() : []),
      catchWisp: () => { const w = wisps && wisps.active().find(x => x.on); return w ? wisps.tryCatch(w.x, w.y, true) : false; },
      replayCastle: () => progress && progress.replay(),
      previewFinale: () => progress && progress.preview(),
      project: (x, y, z) => project(new Vector3(x, y, z)),
      terrainInfo: () => ({ side: terrainMesh.material.side, visible: terrainMesh.visible, layers: terrainMesh.layers.mask, bs: terrainMesh.geometry.boundingSphere, n: terrainMesh.geometry.attributes.normal.array.slice(3000, 3006) }),
      lakeUV: (x, y, z) => lake.uvOf(x, y, z),
      camera: () => ({ pos: camera.position.toArray(), fov: camera.fov, shift: camera.projectionMatrix.elements[9], rot: camera.rotation.toArray() }),
      reflImage() {   // the lake's reflection target as a data URL (development aid)
        const rt = lake.rt, w = rt.width, h = rt.height, half = rt.texture.type === HalfFloatType, buf = half ? new Uint16Array(w * h * 4) : new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), im = g.createImageData(w, h);
        const f16 = v => { const s = (v & 0x8000) ? -1 : 1, e = (v >> 10) & 31, m = v & 1023; return e === 0 ? s * Math.pow(2, -14) * m / 1024 : e === 31 ? 0 : s * Math.pow(2, e - 15) * (1 + m / 1024); };
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) { const v = buf[((h - 1 - y) * w + x) * 4 + k]; im.data[(y * w + x) * 4 + k] = k === 3 ? 255 : Math.min(255, Math.pow(Math.max(0, half ? f16(v) * 4 : v / 255), 1 / 2.2) * 255); }
        g.putImageData(im, 0, 0); return c.toDataURL();
      },
      castle: () => progress && progress.state(),
      lantern: (x, y) => { const e = new PointerEvent("pointermove", { clientX: x, clientY: y, pointerType: "mouse", bubbles: true }); (pointerHost || host).dispatchEvent(e); },
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); document.removeEventListener("visibilitychange", onVis);
      try { lantern && lantern.dispose(); wisps && wisps.dispose(); lake && lake.dispose(); } catch (e) { /* ignore */ }
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { for (const k in o.material) { const v = o.material[k]; if (v && v.isTexture) v.dispose(); } o.material.dispose(); } if (o.userData.rt) o.userData.rt.dispose(); });
      rtScene && rtScene.dispose(); rtPost && rtPost.dispose(); bloom && bloom.dispose(); renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* already gone */ }   // give the GPU memory back at once
      canvas.remove();
    },
  };
}

/** the castle gate in world space: the point in the gateway, the outward direction, the courtyard point behind it */
function gateInfo(castle) {
  const wall = [[-12, 24], [-28, 16]];   // the gate sits on the wall segment from wall[7] to wall[8] (see buildCastle)
  const mx = (wall[0][0] + wall[1][0]) / 2, mz = (wall[0][1] + wall[1][1]) / 2;
  let ox = -(wall[1][1] - wall[0][1]), oz = wall[1][0] - wall[0][0]; const L = Math.hypot(ox, oz); ox /= L; oz /= L;
  if (mx * ox + mz * oz < 0) { ox = -ox; oz = -oz; }
  const p = new Vector3(mx, 2.6, mz).applyMatrix4(castle.matrixWorld), out = new Vector3(ox, 0, oz).transformDirection(castle.matrixWorld).setY(0).normalize();
  const court = new Vector3(mx - ox * 16, 4, mz - oz * 16).applyMatrix4(castle.matrixWorld);
  return { p, out, court };
}
