// Scroll-scrubbed image sequence: small helpers without three.js.
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (p, a, b) => clamp((p - a) / (b - a));
export const smooth = t => t * t * (3 - 2 * t);

export function scrollProgress(section) {
  const r = section.getBoundingClientRect();
  const total = r.height - innerHeight;
  return total <= 0 ? 0 : clamp(-r.top / total);
}

export function reveals() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
}

// Loads frames coarse-to-fine (first frame, key frames, every 8th, 4th, 2nd, all)
// so scrubbing works right away and gets smoother as more frames arrive.
export function frameLoader(count, url, keys = [], onFirst) {
  const imgs = new Array(count).fill(null);
  const order = [], seen = new Set();
  const push = i => { if (i >= 0 && i < count && !seen.has(i)) { seen.add(i); order.push(i); } };
  push(0); keys.forEach(push);
  for (const s of [8, 4, 2, 1]) for (let i = 0; i < count; i += s) push(i);
  let next = 0, active = 0;
  const pump = () => {
    while (active < 6 && next < order.length) {
      const i = order[next++], im = new Image();
      active++;
      im.decoding = 'async'; im.src = url(i);
      im.decode().catch(() => {}).then(() => { if (im.naturalWidth) { imgs[i] = im; if (i === 0 && onFirst) onFirst(); } active--; pump(); });
    }
  };
  pump();
  // nearest loaded frame to i
  return i => {
    if (imgs[i]) return imgs[i];
    for (let d = 1; d < count; d++) { if (imgs[i - d]) return imgs[i - d]; if (imgs[i + d]) return imgs[i + d]; }
    return null;
  };
}

// A full-screen canvas stage that draws pictures crisply at device resolution.
// Desktop: picture fills the height and sits to the right of the headline.
// Phone: picture sits in the lower part under the text.
export function stage(stick, canvas, bg) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const off = document.createElement('canvas'), octx = off.getContext('2d');
  const st = { ctx, mobile: innerWidth < 760, w: 0, h: 0 };
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    st.w = canvas.width = Math.round(stick.clientWidth * dpr);
    st.h = canvas.height = Math.round(stick.clientHeight * dpr);
    off.width = st.w; off.height = st.h;
    st.mobile = innerWidth < 760;
    ctx.imageSmoothingQuality = 'high'; octx.imageSmoothingQuality = 'high';
  };
  fit();
  // rect for an image with aspect a (w/h) and optional zoom
  st.rect = (a, zoom = 1) => {
    const cw = st.w, ch = st.h;
    if (st.mobile) {
      const w = cw * 1.02 * zoom, h = w / a;
      return [(cw - w) / 2, Math.max(ch * .32, ch - h - ch * .1) - (zoom - 1) * h * .5, w, h];
    }
    const h0 = Math.max(ch, cw * 1.02 / a), w = h0 * a * zoom, h = h0 * zoom;
    return [cw - w * .9 + (zoom - 1) * w * .4, (ch - h) * .5, w, h];
  };
  st.clear = () => { ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(0, 0, st.w, st.h); };
  st.draw = (img, alpha = 1, zoom = 1, c = ctx) => {
    if (!img || !img.naturalWidth || alpha <= 0) return;
    const [x, y, w, h] = st.rect(img.naturalWidth / img.naturalHeight, zoom);
    c.globalAlpha = Math.min(1, alpha); c.drawImage(img, x, y, w, h); c.globalAlpha = 1;
  };
  // reveal img inside a soft growing ellipse centred at (fx, fy) of the picture
  st.reveal = (img, t, fx, fy, rmax, squash = .62) => {
    if (!img || !img.naturalWidth || t <= 0) return;
    if (t >= 1) return st.draw(img);
    const [x, y, w, h] = st.rect(img.naturalWidth / img.naturalHeight);
    octx.globalCompositeOperation = 'source-over'; octx.clearRect(0, 0, st.w, st.h);
    octx.drawImage(img, x, y, w, h);
    octx.globalCompositeOperation = 'destination-in';
    const cx = x + w * fx, cy = y + h * fy, r = Math.max(1, t * rmax * w), soft = w * .05;
    octx.save(); octx.translate(cx, cy); octx.scale(1, squash);
    const g = octx.createRadialGradient(0, 0, Math.max(0, r - soft), 0, 0, r + soft);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g; octx.fillRect(-st.w * 2, -st.h * 4, st.w * 4, st.h * 8); octx.restore();
    ctx.drawImage(off, 0, 0);
  };
  // clean wipe from the right: new picture slides in behind a moving edge
  st.wipe = (img, t, zoom = 1) => {
    if (!img || !img.naturalWidth || t <= 0) return;
    const e = t >= 1 ? 0 : st.w * (1 - t);
    ctx.save(); ctx.beginPath(); ctx.rect(e, 0, st.w - e, st.h); ctx.clip(); st.draw(img, 1, zoom); ctx.restore();
    if (t < 1) { ctx.fillStyle = 'rgba(255,194,26,.9)'; ctx.fillRect(e - 2, 0, 3, st.h); }
  };
  // phone: fade the picture edges into the page colour
  st.edges = rgb => {
    if (!st.mobile) return;
    const top = st.h * .3, g = ctx.createLinearGradient(0, top, 0, top + st.h * .14);
    g.addColorStop(0, bg); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, st.w, top); ctx.fillStyle = g; ctx.fillRect(0, top - 1, st.w, st.h * .14);
    const g2 = ctx.createLinearGradient(0, st.h * .82, 0, st.h); g2.addColorStop(0, `rgba(${rgb},0)`); g2.addColorStop(1, bg);
    ctx.fillStyle = g2; ctx.fillRect(0, st.h * .82, st.w, st.h * .18);
  };
  st.fit = fit;
  return st;
}

export function loadImg(src) { const im = new Image(); im.decoding = 'async'; im.src = src; return im; }

// Fractional frame: blend two neighbouring frames so motion stays smooth with fewer files.
export function drawFrame(st, get, f, alpha = 1) {
  const i = Math.floor(f), t = f - i;
  const a = get(i), b = t > .01 ? get(i + 1) : null;
  st.draw(a, alpha);
  if (b && b !== a) st.draw(b, alpha * t);
}
