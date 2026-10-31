// THE LAKE THAT LIES: dark water at the foot of the crag. It shows a planar reflection of the valley (a second, mirrored
// camera renders into a small target, at 1/4..1/2 resolution and every 1..6 frames depending on the quality level),
// rippled by wind. The reflection pass sets uRefl = 1 for the shaders that take part, which is how the lake can "lie":
// the castle seen in the water can be a ruin, a figure can stand in a reflected window, the reflected Moon can turn red.
// Those anomalies are driven by the event director (presences.js) through the shared uniforms in `anomaly`.
import { Mesh, BufferGeometry, Float32BufferAttribute, ShaderMaterial, WebGLRenderTarget, PerspectiveCamera, Vector3, Vector4, Matrix4, Plane, HalfFloatType, UnsignedByteType, LinearFilter } from "three";
import { LAKE, lakeR } from "./terrain.js";
import { GLSL_NOISE } from "./glsl.js";

export const LAYER_WATER = 2, LAYER_NOREFL = 3;   // the water itself and things too costly to reflect on low tiers

/** the shoreline as a triangle fan (only where lakeR < edge), so the water never shows outside its basin */
function lakeGeometry(edge = 1.18) {
  const P = [LAKE.x, LAKE.level, LAKE.z], N = 96;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let r = 4; while (r < 260 && lakeR(LAKE.x + dx * r, LAKE.z + dz * r) < edge) r += 2;
    P.push(LAKE.x + dx * r, LAKE.level, LAKE.z + dz * r);
  }
  const idx = []; for (let i = 1; i <= N; i++) idx.push(0, i + 1, i);
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

export function createLake({ renderer, scene, camera, timeU, F, hdr, moonDir, lantern, sky, stars, anomaly: shared = null }) {
  const anomaly = shared || {
    uRefl: { value: 0 }, uRuin: { value: 0 }, uFigure: { value: 0 }, uFigureWin: { value: -1 }, uRedMoon: { value: 0 },
    uPhantom: { value: new Vector3(0, 0.25, -1).normalize() }, uPhantomOn: { value: 0 },
  };
  const rt = new WebGLRenderTarget(4, 4, { type: hdr ? HalfFloatType : UnsignedByteType, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false });
  const vcam = new PerspectiveCamera(); vcam.layers.disableAll(); vcam.layers.enable(0); vcam.layers.enable(1); if (F.reflTrees) vcam.layers.enable(LAYER_NOREFL);
  const texMat = new Matrix4(), clip = new Plane(new Vector3(0, 1, 0), -LAKE.level + 0.15);
  const u = {
    tRefl: { value: rt.texture }, uTexMat: { value: texMat }, uTime: timeU, uMoon: { value: moonDir }, uMoonK: { value: 1 },
    uLantern: lantern.pos, uLanternK: lantern.k,
  };
  const mat = new ShaderMaterial({
    uniforms: u, defines: /[?&]refl=1/.test(typeof location !== "undefined" ? location.search : "") ? { SHOW_REFL: "" } : /[?&]refl=2/.test(typeof location !== "undefined" ? location.search : "") ? { SHOW_UV: "" } : {},
    vertexShader: /* glsl */`
      uniform mat4 uTexMat; varying vec3 vW; varying vec4 vR;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vR = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GLSL_NOISE + /* glsl */`
      uniform sampler2D tRefl; uniform float uTime, uMoonK, uLanternK; uniform vec3 uMoon; uniform vec4 uLantern;
      varying vec3 vW; varying vec4 vR;
      float waves(vec2 p){
        float t = uTime;
        return vnoise(p * .32 + vec2(t * .22, t * .07)) * .55 + vnoise(p * .9 - vec2(t * .31, -t * .19)) * .3 + vnoise(p * 2.3 + vec2(-t * .5, t * .4)) * .15;
      }
      void main(){
        vec3 V = vW - cameraPosition; float dist = length(V); V /= dist;
        // ripples: gradient of a moving noise field, a slow gust darkening patches of the surface
        float e = .35, h0 = waves(vW.xz), hx = waves(vW.xz + vec2(e, 0.)), hz = waves(vW.xz + vec2(0., e));
        float gust = smoothstep(.35, .8, vnoise(vW.xz * .02 + vec2(uTime * .03, 0.)));
        float amp = .3 + .55 * gust;
        vec3 n = normalize(vec3(-(hx - h0) / e * amp, 1., -(hz - h0) / e * amp));
        vec2 uv = vR.xy / vR.w + n.xz * (.018 + .01 * gust) * (60. / max(dist, 60.));
        vec3 refl = texture2D(tRefl, uv).rgb;
        // the far reflection crosses more air: haze it like the post pass would
        refl = mix(refl, vec3(.03, .038, .05), .12);
        float fres = .03 + .97 * pow(1. - max(dot(-V, n), 0.), 5.);
        vec3 water = vec3(.0025, .004, .005);
        vec3 col = mix(water, refl, clamp(.55 + fres * .6, 0., .96));   // art: a dark mirror, stronger than physics
        #ifdef SHOW_REFL
        col = texture2D(tRefl, vR.xy / vR.w).rgb;
        #endif
        #ifdef SHOW_UV
        col = vec3(fract(vR.xy / vR.w), 0.) * .3;
        #endif
        // glints of the Moon on the ripples
        vec3 R = reflect(V, n);
        col += vec3(.9, .95, 1.) * pow(max(dot(R, uMoon), 0.), 1600.) * .8 * uMoonK * smoothstep(-.02, .08, uMoon.y) * smoothstep(.62, .3, uMoon.y);   // glints: only a low Moon
        // the lantern's warm light on the water
        vec3 L = uLantern.xyz - vW; float dl = length(L); L /= dl;
        col += vec3(1., .62, .3) * pow(max(dot(R, L), 0.), 60.) * uLanternK * 2.2 * (40. / (40. + dl));
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new Mesh(lakeGeometry(), mat); mesh.layers.set(LAYER_WATER); mesh.renderOrder = 1;
  scene.add(mesh); camera.layers.enable(LAYER_WATER); camera.layers.enable(LAYER_NOREFL);

  const p = new Vector3(), f = new Vector3(), up = new Vector3(), target = new Vector3(), rot = new Matrix4();
  const bias = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  let frame = 0, W = 4, Hh = 4;
  const dbgScale = (() => { try { const v = new URLSearchParams(location.search).get("reflscale"); return v ? +v : 0; } catch (e) { return 0; } })();
  function resize(bw, bh) { const k = dbgScale || F.reflScale; W = Math.max(8, Math.round(bw * k)); Hh = Math.max(8, Math.round(bh * k)); rt.setSize(W, Hh); }
  /** render the reflection (call before the main scene pass) */
  function render(force = false) {
    frame++; if (!force && frame % F.reflEvery !== 1 % F.reflEvery) return;
    const L = LAKE.level;
    camera.updateMatrixWorld();
    p.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(camera.matrixWorld);
    f.set(0, 0, -1).applyMatrix4(rot); up.set(0, 1, 0).applyMatrix4(rot);
    if (p.y <= L + 0.5) return;   // under the surface: nothing sensible to reflect
    vcam.position.set(p.x, 2 * L - p.y, p.z);
    target.set(p.x + f.x, 2 * L - (p.y + f.y), p.z + f.z);
    vcam.up.set(up.x, -up.y, up.z); vcam.lookAt(target);
    vcam.near = camera.near; vcam.far = camera.far; vcam.projectionMatrix.copy(camera.projectionMatrix);
    vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
    vcam.updateMatrixWorld(); vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    texMat.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    // the sky dome and the stars are centred on whichever camera is rendering
    const skyPos = sky.position.clone(), starPos = stars ? stars.position.clone() : null;
    sky.position.copy(vcam.position); if (stars) stars.position.copy(vcam.position);
    const su = stars && stars.material.uniforms, px0 = su ? su.uPx.value : 1, k0 = su ? su.uK.value : 1;
    const starsVis = stars ? stars.visible : false; if (stars) stars.visible = !!F.reflTrees;   // mirrored stars only on high quality
    if (su) { su.uPx.value = Math.max(0.8, px0 * F.reflScale * 1.6); su.uK.value = k0 * 0.35; }
    const oldClip = renderer.clippingPlanes, oldRT = renderer.getRenderTarget();
    renderer.clippingPlanes = [clip]; anomaly.uRefl.value = 1;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam);
    renderer.setRenderTarget(oldRT); renderer.clippingPlanes = oldClip; anomaly.uRefl.value = 0;
    sky.position.copy(skyPos); if (stars) stars.position.copy(starPos);
    if (su) { su.uPx.value = px0; su.uK.value = k0; } if (stars) stars.visible = starsVis;
  }
  return {
    mesh, anomaly, uniforms: u, render, resize, rt, vcam,
    uvOf(x, y, z) { const v = new Vector4(x, y, z, 1).applyMatrix4(texMat); const q = new Vector3(x, y, z).project(vcam); return { tex: [v.x / v.w, v.y / v.w], ndc: [q.x, q.y, q.z], pm9: vcam.projectionMatrix.elements[9], cam9: camera.projectionMatrix.elements[9] }; },
    /** screen-relevant: is a world point reflected inside the lake? (used to decide whether the real Moon shows in the water) */
    reflects(dir) {
      // a sky direction is seen in the water where the view ray, mirrored, points to it: check the lake centre region
      const c = new Vector3(LAKE.x, LAKE.level, LAKE.z), cam = new Vector3().setFromMatrixPosition(camera.matrixWorld);
      const v = c.clone().sub(cam).normalize(); v.y = -v.y;   // the mirrored ray from the lake centre
      return v.dot(dir) > 0.9;
    },
    dispose() { rt.dispose(); mesh.geometry.dispose(); mat.dispose(); },
  };
}
