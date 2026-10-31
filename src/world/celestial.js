// THE REAL STARS of the landing sky: the Yale Bright Star Catalogue drawn as points on the sky dome, turned by the
// real sidereal time for the reference place (see astro.js, sky.js). Clouds and the Moon's glare hide them; the limiting
// magnitude drops with moonlight and towards the horizon. One draw call, positions never touched on the CPU after build:
// the whole sky turns through one 3x3 matrix uniform.
import { Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending, Matrix3, Vector3 } from "three";
import { STARS, STAR_COUNT } from "./stars-data.js";
import { GLSL_NOISE, GLSL_CLOUDS } from "./glsl.js";

/** approximate sRGB-ish colour of a star of temperature K (blackbody fit, kept gentle) */
export function starColor(K) {
  const t = K / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = v => Math.max(0, Math.min(255, v)) / 255;
  // desaturate: real stars look almost white to the eye
  const R = c(r), G = c(g), B = c(b), L = (R + G + B) / 3;
  return [L + (R - L) * 0.45, L + (G - L) * 0.45, L + (B - L) * 0.45];
}
/** the catalogue as unit vectors (J2000 equatorial), magnitudes and colours, brightest first */
export function catalogue(maxMag = 9) {
  const out = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const ra = STARS[i * 4] / 10 * Math.PI / 180, dec = STARS[i * 4 + 1] / 10 * Math.PI / 180, mag = STARS[i * 4 + 2] / 100;
    if (mag > maxMag) break;
    out.push({ v: [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], mag, col: starColor(STARS[i * 4 + 3] * 100) });
  }
  return out;
}

export function createStars({ maxMag = 5.3, timeU, moonDir, veil }) {
  const cat = catalogue(maxMag), n = cat.length;
  const eq = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3);
  cat.forEach((s, i) => { eq.set(s.v, i * 3); mag[i] = s.mag; col.set(s.col, i * 3); });
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(eq, 3));   // the equatorial vector (turned in the shader)
  g.setAttribute("aMag", new Float32BufferAttribute(mag, 1)); g.setAttribute("aCol", new Float32BufferAttribute(col, 3));
  const u = {
    uEq: { value: new Matrix3() }, uTime: timeU, uMoon: { value: moonDir || new Vector3(0, 1, 0) }, uVeil: veil || { value: 0 },
    uPx: { value: 1 }, uSkyBright: { value: 0.5 }, uK: { value: 1 }, uTwilight: { value: 0 },
  };
  const m = new ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending,
    vertexShader: GLSL_NOISE + GLSL_CLOUDS + /* glsl */`
      attribute float aMag; attribute vec3 aCol;
      uniform mat3 uEq; uniform float uTime, uPx, uSkyBright, uK, uVeil, uTwilight; uniform vec3 uMoon;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 d = normalize(uEq * position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(d * 8000., 1.);
        float flux = pow(10., -.4 * (aMag - 1.));
        float lim = mix(5.6, 3.6, uSkyBright) - mix(0., 2.4, uTwilight) - (1. - smoothstep(.0, .35, d.y)) * 1.8;   // limiting magnitude
        float vis = smoothstep(lim + .25, lim - .55, aMag);
        float cov = max(cloudCover(d, uTime), moonVeil(d, uMoon, uVeil, uTime));
        float tw = 1. + (.22 + .3 * (1. - smoothstep(.0, .4, d.y))) * sin(uTime * (1.7 + fract(aMag * 7.31) * 5.) + aMag * 41.7 + position.x * 90.);
        vA = vis * (1. - cov * .96) * smoothstep(-.01, .07, d.y) * (1. - smoothstep(.975, .997, dot(d, uMoon))) * tw;
        gl_PointSize = clamp(1.7 + sqrt(flux) * 1.6, 1.7, 7.) * uPx;
        vCol = aCol * (.07 + .66 * pow(min(flux, 6.), .75)) * uK;   // v9.1: a little brighter, so the real stars read over the castle
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c) * 4.; float a = exp(-r2 * 3.2) - .04; if (a <= 0. || vA <= .002) discard;
        gl_FragColor = vec4(vCol * a * vA, 1.); }`,
  });
  const p = new Points(g, m); p.frustumCulled = false; p.renderOrder = 0;
  const tmp = new Matrix3();
  return {
    points: p, uniforms: u, count: n,
    /** eqToWorld: row-major 3x3 (equatorial J2000 -> valley world) */
    setMatrix(rm) { tmp.set(rm[0], rm[1], rm[2], rm[3], rm[4], rm[5], rm[6], rm[7], rm[8]); u.uEq.value.copy(tmp); },
  };
}

/** combine ENU<-equatorial (row-major) with world<-ENU for a valley azimuth: returns the row-major world<-equatorial */
export function eqToWorldMatrix(eqToEnu, Av) {
  const a = Av * Math.PI / 180, fx = Math.sin(a), fy = Math.cos(a), rx = Math.cos(a), ry = -Math.sin(a);
  // world = W * enu, W rows: x = [rx, ry, 0], y = [0, 0, 1], z = [-fx, -fy, 0]
  const W = [rx, ry, 0, 0, 0, 1, -fx, -fy, 0], E = eqToEnu, out = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = W[r * 3] * E[c] + W[r * 3 + 1] * E[3 + c] + W[r * 3 + 2] * E[6 + c];
  return out;
}
