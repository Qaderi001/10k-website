// Small shared toolkit for the lead demos: renderer, studio lighting, scroll and drag helpers.
import * as THREE from '../../assets/vendor/three.module.min.js';
export { THREE };

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const ease = t => 1 - Math.pow(1 - t, 3);
// maps p from [a,b] to [0,1], clamped
export const range = (p, a, b) => clamp((p - a) / (b - a));

export function makeRenderer(canvas, { alpha = true, exposure = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// A soft studio environment built from glowing panels, so metal and paint get real reflections
// without loading an HDR file.
export function studioEnv(renderer, { bg = '#202226', panels = [] } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide }));
  scene.add(box);
  const def = panels.length ? panels : [
    { pos: [0, 9, 0], size: [10, 10], color: '#ffffff', i: 3, rot: [Math.PI / 2, 0, 0] },
    { pos: [-9, 3, 2], size: [4, 8], color: '#ffffff', i: 2, rot: [0, Math.PI / 2, 0] },
    { pos: [9, 2, -2], size: [3, 6], color: '#ffe8d0', i: 1.4, rot: [0, -Math.PI / 2, 0] },
  ];
  for (const p of def) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...p.size), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.i), side: THREE.DoubleSide }));
    m.position.set(...p.pos); if (p.rot) m.rotation.set(...p.rot); scene.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, 0.04).texture;
  pm.dispose();
  return tex;
}

// Fit a renderer + camera to its element.
export function autoSize(renderer, camera, el, after) {
  const fit = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    after && after(w, h);
  };
  fit(); new ResizeObserver(fit).observe(el);
  return fit;
}

// Runs fn(dt, t) on animation frames only while el is on screen and the tab is visible.
export function loop(el, fn) {
  let on = false, raf = 0, last = 0, t = 0;
  const tick = now => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    fn(dt, t); raf = requestAnimationFrame(tick);
  };
  const set = v => { if (v === on) return; on = v; if (on) { last = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); };
  let vis = false;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; set(vis && !document.hidden); }, { rootMargin: '100px' }).observe(el);
  document.addEventListener('visibilitychange', () => set(vis && !document.hidden));
  return { once: () => fn(0, t) };
}

// Scroll progress 0..1 of a tall section whose child is position:sticky.
export function scrollProgress(section) {
  const r = section.getBoundingClientRect();
  const total = r.height - innerHeight;
  return total <= 0 ? 0 : clamp(-r.top / total);
}

// Drag to turn an object around Y (and a little around X), with inertia.
export function dragRotate(el, obj, { x = true, speed = 1.6, idle = 0.12 } = {}) {
  let down = false, lx = 0, ly = 0, vy = 0, vx = 0, tx = obj.rotation.x, touched = 0;
  el.addEventListener('pointerdown', e => { down = true; lx = e.clientX; ly = e.clientY; vy = 0; el.setPointerCapture(e.pointerId); touched = performance.now(); });
  el.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = (e.clientX - lx) / el.clientWidth * Math.PI * speed, dy = (e.clientY - ly) / el.clientHeight * Math.PI * 0.6;
    lx = e.clientX; ly = e.clientY; obj.rotation.y += dx; vy = dx;
    if (x) { tx = clamp(tx + dy, -0.35, 0.5); vx = dy; }
    touched = performance.now();
  });
  const up = () => { down = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return dt => {
    if (!down) { obj.rotation.y += vy; vy *= 0.92; if (!reduced && performance.now() - touched > 2500) obj.rotation.y += idle * dt; }
    if (x) obj.rotation.x += (tx - obj.rotation.x) * 0.15;
  };
}

// Reveal-on-scroll for elements with [data-reveal]
export function reveals() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
}
