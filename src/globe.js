import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  Box3,
  SphereGeometry,
  Mesh,
  MeshBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Group,
  Vector3,
  Quaternion,
  Euler,
  ShaderMaterial,
  AdditiveBlending,
  BackSide,
  Points,
  PointsMaterial,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  DoubleSide,
} from "three";

import { createStage } from "./engine.js";
import { clamp, rand } from "./common.js";

const D2R = Math.PI / 180;
const MODEL_LON_OFFSET = -180;

const ll = (lon, lat, r = 1) =>
  new Vector3(
    r * Math.cos(lat * D2R) * Math.sin(lon * D2R),
    r * Math.sin(lat * D2R),
    r * Math.cos(lat * D2R) * Math.cos(lon * D2R)
  );

function linesFrom(list, r, { loop = false } = {}) {
  const pos = [];

  for (const l of list) {
    for (let i = 0; i + 3 < l.length; i += 2) {
      const a = ll(l[i], l[i + 1], r);
      const b = ll(l[i + 2], l[i + 3], r);

      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }

    if (loop && l.length >= 6) {
      const a = ll(l[l.length - 2], l[l.length - 1], r);
      const b = ll(l[0], l[1], r);

      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(pos, 3)
  );

  return geometry;
}

export function createGlobe(host, GEO) {
  const st = createStage(host, {
    bg: 0x040607,
    fov: 38,
    far: 50,
  });

  if (!st) return null;

  const { scene, camera } = st;

  camera.position.set(0, 0, 3);

  // Main group: both globes rotate together.
  const globe = new Group();
  scene.add(globe);

  // --------------------------------------------------
  // REALISTIC NASA GLOBE
  // --------------------------------------------------

  const realisticLayer = new Group();
  globe.add(realisticLayer);

  const fallbackEarth = new Mesh(
    new SphereGeometry(0.998, 64, 48),
    new MeshStandardMaterial({
      color: 0x1769aa,
      roughness: 0.9,
      metalness: 0,
    })
  );

  realisticLayer.add(fallbackEarth);

  let disposed = false;

  const earthLoader = new GLTFLoader();

  // Browsers refuse fetch() on file:// pages, so the realistic model can only load when the site is served
  // (npm run serve). Opened by double-click, skip the request and show the classic (Natural Earth) globe instead.
  const canFetchModel = location.protocol !== "file:";

  if (canFetchModel) earthLoader.load(
    "./assets/models/Earth_1_12756.glb",

    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((object) => {
          if (!object.isMesh) return;

          object.geometry?.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          for (const material of materials) {
            material?.dispose();
          }
        });

        return;
      }

      const earthModel = gltf.scene;

      const originalBounds = new Box3().setFromObject(earthModel);
      const originalSize = originalBounds.getSize(new Vector3());
      const originalCenter = originalBounds.getCenter(new Vector3());

      const maxDimension = Math.max(
        originalSize.x,
        originalSize.y,
        originalSize.z
      );

      if (!maxDimension || !Number.isFinite(maxDimension)) {
        console.error("The Earth model has invalid dimensions.");
        return;
      }

      earthModel.position.sub(originalCenter);
      earthModel.scale.setScalar(1.996 / maxDimension);

      earthModel.traverse((object) => {
        if (!object.isMesh || !object.material) return;

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        for (const material of materials) {
          material.side = DoubleSide;
          material.needsUpdate = true;
        }
      });

      realisticLayer.remove(fallbackEarth);
      fallbackEarth.geometry.dispose();
      fallbackEarth.material.dispose();

      realisticLayer.add(earthModel);
    },

    undefined,

    (error) => {
      // Missing model (e.g. no assets/models folder): not an error for the site, fall back to the classic globe.
      console.warn("Could not load Earth model:", error);
      useClassicOnly();
    }
  );

  // --------------------------------------------------
  // CLASSIC GLOBE
  // --------------------------------------------------

  const classicLayer = new Group();
  classicLayer.visible = false;
  classicLayer.rotation.y = Math.PI;
  globe.add(classicLayer);

  const classicOcean = new Mesh(
    new SphereGeometry(0.998, 64, 48),
    new MeshStandardMaterial({
      color: 0x0c1416,
      roughness: 0.85,
      metalness: 0.1,
    })
  );

  classicLayer.add(classicOcean);

  const grat = [];

  for (let lat = -75; lat <= 75; lat += 15) {
    const line = [];

    for (let lon = -180; lon <= 180; lon += 5) {
      line.push(lon, lat);
    }

    grat.push(line);
  }

  for (let lon = -180; lon < 180; lon += 15) {
    const line = [];

    for (let lat = -85; lat <= 85; lat += 5) {
      line.push(lon, lat);
    }

    grat.push(line);
  }

  classicLayer.add(
    new LineSegments(
      linesFrom(grat, 1.0005),
      new LineBasicMaterial({
        color: 0x26332f,
        transparent: true,
        opacity: 0.55,
      })
    )
  );

  classicLayer.add(
    new LineSegments(
      linesFrom(GEO.globe.mesh, 1.002),
      new LineBasicMaterial({
        color: 0xa9bfa0,
      })
    )
  );

  // --------------------------------------------------
  // LIGHTING AND ATMOSPHERE
  // --------------------------------------------------

  scene.add(new AmbientLight(0x8890d0, 1.3));

  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 1.5, 3);
  scene.add(sun);

  const atmosphere = new Mesh(
    new SphereGeometry(1.16, 48, 32),
    new ShaderMaterial({
      transparent: true,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,

      vertexShader: `
        varying vec3 n;

        void main() {
          n = normalize(normalMatrix * normal);
          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        varying vec3 n;

        void main() {
          float intensity =
            pow(0.62 - dot(n, vec3(0.0, 0.0, 1.0)), 3.0);

          gl_FragColor =
            vec4(0.50, 0.66, 0.70, 1.0) * intensity;
        }
      `,
    })
  );

  scene.add(atmosphere);

  // Stars.
  const starPositions = [];

  for (let i = 0; i < 500; i++) {
    const v = new Vector3(
      rand(-1, 1),
      rand(-1, 1),
      rand(-1, 1)
    )
      .normalize()
      .multiplyScalar(rand(14, 26));

    starPositions.push(v.x, v.y, v.z);
  }

  const starGeometry = new BufferGeometry();

  starGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(starPositions, 3)
  );

  scene.add(
    new Points(
      starGeometry,
      new PointsMaterial({
        color: 0xcfd6cc,
        size: 0.06,
        sizeAttenuation: true,
      })
    )
  );

  // --------------------------------------------------
  // COUNTRY SELECTION: INDEPENDENT GREEN DOTS
  // --------------------------------------------------

  // Each globe has its own selection group.
  // This prevents one globe's coordinate system from
  // affecting the other globe's green dot.

  const realisticSelection = new Group();
  realisticLayer.add(realisticSelection);

  const classicSelection = new Group();
  classicLayer.add(classicSelection);

  const greenMaterial = new MeshBasicMaterial({
    color: 0xf2e9cf,
    depthTest: true,
    depthWrite: false,
  });

  let realisticDot = null;
  let classicDot = null;

  function removeDot(selectionGroup, dot) {
    if (!dot) return;

    selectionGroup.remove(dot);
    dot.geometry.dispose();
  }

  function clearSelection() {
    removeDot(realisticSelection, realisticDot);
    removeDot(classicSelection, classicDot);

    realisticDot = null;
    classicDot = null;
  }

  function createDot(selectionGroup, lon, lat) {
    const dot = new Mesh(
      new SphereGeometry(0.024, 16, 12),
      greenMaterial
    );

    dot.position.copy(ll(lon, lat, 1.025));
    dot.renderOrder = 10;

    selectionGroup.add(dot);

    return dot;
  }

  function placeDot(lon, lat) {
    clearSelection();

    // NASA model: use the longitude offset required
    // by the orientation of the realistic Earth model.
    realisticDot = createDot(
      realisticSelection,
      lon + MODEL_LON_OFFSET,
      lat
    );

    // Classic model: its parent group is already rotated
    // by 180 degrees, so use the original coordinates.
    classicDot = createDot(
      classicSelection,
      lon,
      lat
    );
  }

  // --------------------------------------------------
  // ROTATION, ZOOM AND COUNTRY FOCUS
  // --------------------------------------------------

  const toQuat = (lon, lat) =>
    new Quaternion().setFromEuler(
      new Euler(lat * D2R, -lon * D2R, 0, "XYZ")
    );

  globe.quaternion.copy(toQuat(-160, 50));

  let target = null;
  let vx = 0;
  let vy = 0;
  let dragging = false;
  let last = null;
  let zoom = 3;
  let zoomT = 3;
  let idle = 0;

  const reduce = matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const canvas = st.canvas;

  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  let engaged = false;

  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      engaged = false;
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    engaged = true;
    dragging = true;
    last = [event.clientX, event.clientY];

    target = null;
    vx = 0;
    vy = 0;

    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !last) return;

    const dx = event.clientX - last[0];
    const dy = event.clientY - last[1];

    last = [event.clientX, event.clientY];

    const factor = 0.0055 * (zoom / 3);

    vy = dx * factor;
    vx = dy * factor;

    rotateGlobe(vx, vy);
  });

  function endDrag() {
    dragging = false;
    last = null;
    canvas.style.cursor = "grab";
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!(engaged || event.ctrlKey || event.metaKey)) return;

      event.preventDefault();

      zoomT = clamp(
        zoomT + event.deltaY * 0.002,
        1.55,
        4.5
      );
    },
    { passive: false }
  );

  const rotationQuaternion = new Quaternion();
  const rotationEuler = new Euler();

  function rotateGlobe(ax, ay) {
    rotationQuaternion.setFromEuler(
      rotationEuler.set(ax, ay, 0, "XYZ")
    );

    globe.quaternion.premultiply(rotationQuaternion);
  }

  function focusCountry(lon, lat) {
    const modelLon = lon + MODEL_LON_OFFSET;

    target = toQuat(
      modelLon,
      clamp(lat - 2, -70, 75)
    );

    zoomT = 2.05;
    idle = 0;
  }

  // Called by the existing 2D map.
  function select(code) {
    const cap = GEO.globe.cap[code];

    if (!cap) {
      clearSelection();
      return;
    }

    const lat = cap[0];
    const lon = cap[1];

    placeDot(lon, lat);
    focusCountry(lon, lat);
  }

  // Preserve the existing legend-selection interface.
  function legend(key) {
    const coordinates = GEO.globe.leg[key];

    if (!coordinates) return;

    const lat = coordinates[0];
    const lon = coordinates[1];

    placeDot(lon, lat);
    focusCountry(lon, lat);

    zoomT = 1.9;
  }

  // --------------------------------------------------
  // BUTTON: REALISTIC / CLASSIC GLOBE
  // --------------------------------------------------

  const toggleButton = document.createElement("button");

  let realisticMode = true;

  toggleButton.type = "button";
  toggleButton.textContent = "Passa al globo classico";
  toggleButton.setAttribute("aria-pressed", "true");

  Object.assign(toggleButton.style, {
    display: "block",
    margin: "12px auto 0",
    padding: "10px 18px",
    border: "1px solid rgba(180, 201, 168, 0.4)",
    borderRadius: "999px",
    background: "rgba(9, 13, 14, 0.95)",
    color: "#e9e1cb",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    position: "relative",
    zIndex: "5",
    transition: "background 180ms ease, border-color 180ms ease",
  });

  toggleButton.addEventListener("pointerenter", () => {
    toggleButton.style.background = "rgba(36, 48, 42, 0.98)";
    toggleButton.style.borderColor = "rgba(180, 201, 168, 0.85)";
  });

  toggleButton.addEventListener("pointerleave", () => {
    toggleButton.style.background = "rgba(9, 13, 14, 0.95)";
    toggleButton.style.borderColor = "rgba(180, 201, 168, 0.4)";
  });

  toggleButton.addEventListener("click", () => {
    realisticMode = !realisticMode;

    realisticLayer.visible = realisticMode;
    classicLayer.visible = !realisticMode;

    toggleButton.textContent = realisticMode
      ? "Passa al globo classico"
      : "Passa al globo realistico";

    toggleButton.setAttribute(
      "aria-pressed",
      String(realisticMode)
    );
  });

  host.appendChild(toggleButton);

  // Realistic model unavailable: show the classic globe and hide the (now pointless) switch.
  function useClassicOnly() {
    if (disposed) return;
    realisticMode = false;
    realisticLayer.visible = false;
    classicLayer.visible = true;
    toggleButton.style.display = "none";
  }

  if (!canFetchModel) useClassicOnly();

  // --------------------------------------------------
  // ANIMATION
  // --------------------------------------------------

  st.onFrame((dt) => {
    zoom += (zoomT - zoom) * (1 - Math.exp(-6 * dt));
    camera.position.z = zoom;

    if (target) {
      globe.quaternion.slerp(
        target,
        1 - Math.exp(-4 * dt)
      );

      if (globe.quaternion.angleTo(target) < 0.002) {
        target = null;
      }

      idle = 0;
    } else if (!dragging) {
      if (Math.abs(vx) + Math.abs(vy) > 1e-4) {
        rotateGlobe(vx, vy);

        vx *= 0.93;
        vy *= 0.93;

        idle = 0;
      } else {
        idle += dt;

        if (!reduce && idle > 4) {
          rotateGlobe(0, 0.0016 * 60 * dt);
        }
      }
    }
  });

  return {
    select,
    legend,

    dispose: () => {
      disposed = true;

      clearSelection();
      toggleButton.remove();
      greenMaterial.dispose();

      st.dispose();
    },
  };
}
