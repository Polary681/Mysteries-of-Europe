// Procedural building helpers shared by the adventures' worlds (v8 Sibilla, v9 Báthory): vertex-coloured geometry that is
// placed, painted and merged per material, a low two-slope roof, and a tiny shader patch that draws masonry, roof tiles or rock
// from world position (no textures).
import { Object3D, Color, Mesh, BufferGeometry, Float32BufferAttribute, MeshLambertMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const tmp = new Object3D(), col = new Color();
export function paint(g, c, jitter = 0, r = Math.random) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count, a = new Float32Array(n * 3); col.set(c);
  const k = 1 + (r() - 0.5) * jitter; for (let i = 0; i < n; i++) { a[i * 3] = col.r * k; a[i * 3 + 1] = col.g * k; a[i * 3 + 2] = col.b * k; }
  g.setAttribute("color", new Float32BufferAttribute(a, 3)); return g;
}
export function put(g, x, y, z, ry = 0, rx = 0, rz = 0) { tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); g.applyMatrix4(tmp.matrix); return g; }
export const VC = () => new MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** masonry for merged, vertex-coloured meshes: courses, staggered joints and per-stone tone, computed from world position in the
    fragment shader (no texture). kind: "stone" (dressed courses) | "rough" (rubble, bigger stones) | "tile" (rows of roof tiles)
    | "rock" (tone only) | "floor" (flagstones on horizontal surfaces) */
export function masonry(mat, kind = "stone") {
  const sc = kind === "tile" ? "vec3(5.0, 6.5, 5.0)" : kind === "rough" ? "vec3(1.4, 2.0, 1.4)" : kind === "rock" ? "vec3(0.9, 1.6, 0.9)" : "vec3(2.4, 3.4, 2.4)", jw = kind === "tile" ? "0.16" : kind === "rock" ? "0.0" : "0.07", amp = kind === "tile" ? "0.22" : kind === "rock" ? "0.3" : "0.2";
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;\nfloat mh3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }")
      .replace("#include <color_fragment>", `#include <color_fragment>
        { vec3 q = vWP * ${sc}; ${kind === "floor" ? "q = vec3(vWP.x * 0.9, vWP.z * 0.9, -0.5 * floor(vWP.z * 0.9));" : ""} float row = floor(q.y); vec3 cq = q + vec3(row * 0.5, 0.0, row * 0.5); vec3 cell = floor(cq);
          float n = mh3(cell * 1.37 + 0.5); float joint = ${kind === "rock" ? "0.0" : `clamp((1.0 - smoothstep(0.0, ${jw}, fract(q.y))) + smoothstep(1.0 - ${jw} * 0.5, 1.0, fract(q.y)) + (1.0 - smoothstep(0.0, ${jw}, fract(cq.x + cq.z))), 0.0, 1.0)`};
          diffuseColor.rgb *= (1.0 - ${amp} * 0.5 + ${amp} * n) * (1.0 - joint * 0.22); }`);
  };
  mat.customProgramCacheKey = () => "masonry-" + kind;
  return mat;
}
export function bake(list, mat, parent) { if (!list.length) return null; const m = new Mesh(mergeGeometries(list), mat); m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); list.length = 0; return m; }
export function gable(w, d, rise, over = 0.35) {   // a low two-slope roof, ridge along x; base at y = 0
  const hw = w / 2 + over, hd = d / 2 + over, p = [];
  const q = (a, b, c, e) => p.push(...a, ...b, ...c, ...a, ...c, ...e);
  q([-hw, 0, hd], [hw, 0, hd], [hw, rise, 0], [-hw, rise, 0]); q([hw, 0, -hd], [-hw, 0, -hd], [-hw, rise, 0], [hw, rise, 0]);
  p.push(-w / 2, 0, d / 2, -w / 2, rise - 0.05, 0, -w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, rise - 0.05, 0, w / 2, 0, d / 2);   // gable ends (wall)
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
