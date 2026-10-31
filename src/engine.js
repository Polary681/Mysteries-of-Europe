// Tiny three.js "stage" helper: renderer + scene + camera + loop + clean disposal.
import { WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, Clock } from "three";

export function createStage(host, { bg = 0x060813, fog = 0, fogColor = bg, fov = 55, far = 400, maxPR = 2 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "gl";
  // the canvas must never take part in the layout (otherwise on hi-dpi screens it grows its own container in a loop)
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  host.style.overflow = "hidden";
  host.prepend(canvas);
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    canvas.remove();
    const m = document.createElement("div");
    m.className = "nogl";
    m.textContent = "Your browser or device does not support WebGL, so the 3D games cannot run here.";
    host.prepend(m);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  const scene = new Scene();
  scene.background = new Color(bg);
  if (fog) scene.fog = new FogExp2(fogColor, fog);
  const camera = new PerspectiveCamera(fov, 1, 0.1, far);
  const tickers = new Set();
  const resizers = new Set();
  const clock = new Clock();
  let raf = 0, visible = true, disposed = false;

  const resize = () => {
    const w = Math.min(Math.max(host.clientWidth, 1), 4096), h = Math.min(Math.max(host.clientHeight, 1), 4096);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizers.forEach(f => f(w, h));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.01 });
  io.observe(host);

  const loop = () => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    const t = clock.elapsedTime;
    tickers.forEach(f => f(dt, t));
    renderer.render(scene, camera);
  };
  resize();
  loop();

  return {
    renderer, scene, camera, canvas, host,
    onFrame: f => { tickers.add(f); return () => tickers.delete(f); },
    onResize: f => { resizers.add(f); f(host.clientWidth, host.clientHeight); },
    size: () => [host.clientWidth, host.clientHeight],
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      tickers.clear(); resizers.clear();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
