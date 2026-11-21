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
