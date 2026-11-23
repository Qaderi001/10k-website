// Zaun-Konfigurator: 3D view. Built into assets/js/fence3d.min.js with `npm run build:3d`.
// Performance rules: one WebGL context, cheap Lambert materials, no shadows,
// one InstancedMesh per material (a few draw calls whatever the fence length),
// and the scene renders only when something changes. Nothing runs while idle.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, PlaneGeometry,
  MeshLambertMaterial, Mesh, InstancedMesh, Object3D, Group,
  HemisphereLight, DirectionalLight, SRGBColorSpace, Vector3
} from 'three';

export const VIEW_MAX = 14;   // longer fences are drawn shortened so the detail stays readable; the price uses the full length

export function mount(host, initial){
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: (devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'low-power' });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  host.prepend(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 300);
  scene.add(new HemisphereLight(0xffffff, 0xaeb7a4, 2.1));
  const sun = new DirectionalLight(0xffffff, 2.0); sun.position.set(-5, 9, 7); scene.add(sun);
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshLambertMaterial({ color: 0xd9dfcf }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const strip = new Mesh(new PlaneGeometry(1, 1), new MeshLambertMaterial({ color: 0xc9ceba }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.002; scene.add(strip);

  const M = {
    steel: new MeshLambertMaterial({ color: 0x3b4045 }),
    post: new MeshLambertMaterial({ color: 0x33373b }),
    wood: new MeshLambertMaterial({ color: 0xa8763e }),
    woodPost: new MeshLambertMaterial({ color: 0x8a5f31 }),
    wpc: new MeshLambertMaterial({ color: 0x7d6f62 }),
    alu: new MeshLambertMaterial({ color: 0x5c6166 })
  };
  const box = new BoxGeometry(1, 1, 1);
  const fence = new Group(); scene.add(fence);
  const dummy = new Object3D();

  let yaw = -0.42, pitch = 0.16, dist = 12, targetY = 0.7, pending = false;

  function render(){
    if (pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; renderer.render(scene, camera); });
  }
  function placeCamera(){
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, targetY + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, targetY, 0);
  }
  // frame the whole fence: find the smallest distance at which every corner of its box fits on screen
  const corner = new Vector3();
  let box3 = [0, 0];
  function fit(L, H){
    box3 = [L, H];
    targetY = H * 0.45;
    let lo = 1, hi = 200;
    for (let i = 0; i < 22; i++){
      dist = (lo + hi) / 2; placeCamera(); camera.updateMatrixWorld();
      let ok = true;
      for (const x of [-L / 2 - 0.3, L / 2 + 0.3]) for (const y of [0, H + 0.15]) for (const z of [-0.6, 0.6]){
        corner.set(x, y, z).project(camera);
        if (Math.abs(corner.x) > 0.9 || Math.abs(corner.y) > 0.8) ok = false;
      }
      if (ok) hi = dist; else lo = dist;
    }
    dist = Math.max(hi, 3.5);
  }
  function build(s){
    for (const c of [...fence.children]){ fence.remove(c); c.dispose(); }
    const H = s.hoehe / 100, L = Math.min(s.laenge, VIEW_MAX);
    const parts = {};   // material key -> list of [x, y, z, sx, sy, sz]
    const add = (k, x, y, z, sx, sy, sz) => (parts[k] || (parts[k] = [])).push([x, y, z, sx, sy, sz]);
    const postKey = s.material === 'holz' ? 'woodPost' : s.material === 'wpc' ? 'alu' : 'post';
    const postW = s.material === 'holz' ? 0.09 : s.material === 'wpc' ? 0.08 : 0.06;
    const lift = 0.04;

    // infill of one field between x0 and x1, from y0 to y1
    function infill(x0, x1, y0, y1){
      const w = x1 - x0, cx = (x0 + x1) / 2, h = y1 - y0;
      if (s.material === 'doppelstab'){
        const n = Math.max(2, Math.floor(w / 0.05));
        for (let i = 0; i <= n; i++) add('steel', x0 + i * w / n, y0 + h / 2, 0, 0.009, h, 0.009);
        for (let y = y0 + 0.03; y < y1; y += 0.2){ add('steel', cx, y, 0.009, w, 0.011, 0.011); add('steel', cx, y, -0.009, w, 0.011, 0.011); }
      } else if (s.material === 'holz'){
        for (let y = y0 + 0.045; y + 0.045 <= y1 + 0.001; y += 0.12) add('wood', cx, y, 0, w, 0.09, 0.022);
      } else {
        const n = Math.max(1, Math.round(h / 0.15)), bh = h / n;
        for (let i = 0; i < n; i++) add('wpc', cx, y0 + bh * (i + 0.5), 0, w, bh - 0.004, 0.026);
        add('alu', cx, y1 + 0.015, 0, w, 0.03, 0.045);
      }
    }
    function post(x, tall = 0){ add(postKey, x, (H + lift + 0.05 + tall) / 2, 0, postW + tall * 0.06, H + lift + 0.05 + tall, postW + tall * 0.06); }

    let x = -L / 2;
    const gateW = s.tor === 'einfahrt' ? 3.5 : s.tor === 'garten' ? 1.0 : 0;
    const hasGate = gateW > 0 && gateW < L - 1;
    if (hasGate){
      post(x, 0.06);
      const leaves = s.tor === 'einfahrt' ? 2 : 1, lw = gateW / leaves;
      for (let i = 0; i < leaves; i++){
        const a = x + i * lw + 0.03, b = x + (i + 1) * lw - 0.03, f = 0.04, y0 = lift + 0.04, y1 = H + lift - 0.02;
        add('alu', a + f / 2, (y0 + y1) / 2, 0, f, y1 - y0, f); add('alu', b - f / 2, (y0 + y1) / 2, 0, f, y1 - y0, f);
        add('alu', (a + b) / 2, y0 + f / 2, 0, b - a, f, f); add('alu', (a + b) / 2, y1 - f / 2, 0, b - a, f, f);
        infill(a + f, b - f, y0 + f, y1 - f);
      }
      x += gateW; post(x, 0.06);
    }
    const rest = L / 2 - x, panel = s.material === 'doppelstab' ? 2.5 : 1.8;
    const n = Math.max(1, Math.ceil(rest / panel)), w = rest / n;
    for (let i = 0; i < n; i++){
      const a = x + i * w, b = a + w;
      if (i > 0 || !hasGate) post(a);
      infill(a + postW / 2, b - postW / 2, lift, H + lift);
    }
    post(L / 2);

    for (const [k, list] of Object.entries(parts)){
      const mesh = new InstancedMesh(box, M[k], list.length);
      list.forEach(([px, py, pz, sx, sy, sz], i) => { dummy.position.set(px, py, pz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.instanceMatrix.needsUpdate = true;
      fence.add(mesh);
    }
    strip.scale.set(L + 1.2, 0.9, 1);
    fit(L, H);
    placeCamera();
  }

  function size(){
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (state) { fit(Math.min(state.laenge, VIEW_MAX), state.hoehe / 100); placeCamera(); }
    render();
  }

  // drag to turn around the fence; on touch only sideways, so vertical page scroll keeps working
  let down = false, lx = 0, ly = 0;
  host.addEventListener('pointerdown', e => { down = true; lx = e.clientX; ly = e.clientY; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', e => {
    if (!down) return;
    const k = Math.PI / Math.max(300, host.clientWidth);
    yaw = Math.max(-1.35, Math.min(1.35, yaw - (e.clientX - lx) * k));
    if (e.pointerType === 'mouse') pitch = Math.max(0.04, Math.min(0.75, pitch + (e.clientY - ly) * k));
    lx = e.clientX; ly = e.clientY;
    fit(box3[0], box3[1]); placeCamera(); render();
  });
  const up = () => { down = false; };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.tabIndex = 0;
  host.addEventListener('keydown', e => {
    const d = { ArrowLeft: 0.12, ArrowRight: -0.12 }[e.key];
    if (d === undefined) return;
    e.preventDefault(); yaw = Math.max(-1.35, Math.min(1.35, yaw + d)); fit(box3[0], box3[1]); placeCamera(); render();
  });

  let state = initial;
  build(state);
  new ResizeObserver(size).observe(host);
  size();
  host.classList.add('gl');

  return { update(s){ state = s; build(s); render(); } };
}
