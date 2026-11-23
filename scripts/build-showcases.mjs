#!/usr/bin/env node
// Renders content/showcases.json into the "Arbeiten" block of index.html.
// Usage:  node scripts/build-showcases.mjs          write index.html
//         node scripts/build-showcases.mjs --check  fail if rules are broken or index.html is out of date
//
// The rules exist so that no unverified number can reach the live site:
//  - only status "live" is rendered
//  - a live entry must not contain any [placeholder]
//  - a live client project ("kunde") needs ergebnis.verifiziert = true, a beleg note,
//    at least one kennzahl and a zeitraum
//  - a demo must not carry kennzahlen and can never be marked verified
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'content/showcases.json');
const pagePath = join(root, 'index.html');
const START = '<!-- showcases:start (generated from content/showcases.json, do not edit by hand) -->';
const END = '<!-- showcases:end -->';
const check = process.argv.includes('--check');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLACEHOLDER = /\[[^\]]*\]/;
function findPlaceholder(v, path = ''){
  if (typeof v === 'string') return PLACEHOLDER.test(v) ? `${path}: "${v}"` : null;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++){ const r = findPlaceholder(v[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)){ if (k === 'beleg') continue; const r = findPlaceholder(x, path ? `${path}.${k}` : k); if (r) return r; } }
  return null;
}

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const errors = [];
const ids = new Set();
for (const s of data.showcases){
  const where = `showcase "${s.id}"`;
  if (!s.id || ids.has(s.id)) errors.push(`${where}: id missing or duplicate`); ids.add(s.id);
  if (!['demo', 'kunde'].includes(s.art)) errors.push(`${where}: art must be "demo" or "kunde"`);
  if (!['live', 'entwurf'].includes(s.status)) errors.push(`${where}: status must be "live" or "entwurf"`);
  if (s.status !== 'live') continue;
  const ph = findPlaceholder(s);
  if (ph) errors.push(`${where}: still has a placeholder at ${ph}`);
  for (const f of ['gewerk', 'titel', 'ausgangslage']) if (!s[f]) errors.push(`${where}: ${f} is empty`);
  if (!Array.isArray(s.gebaut) || !s.gebaut.length) errors.push(`${where}: gebaut needs at least one point`);
  const e = s.ergebnis || {};
  if (s.art === 'kunde'){
    if (e.verifiziert !== true) errors.push(`${where}: client results must be verified (ergebnis.verifiziert = true)`);
    if (!e.beleg || !e.beleg.trim()) errors.push(`${where}: ergebnis.beleg is empty. Note where the numbers come from and when the client approved them.`);
    if (!Array.isArray(e.kennzahlen) || !e.kennzahlen.length) errors.push(`${where}: a client project needs at least one kennzahl`);
    if (!e.zeitraum) errors.push(`${where}: a client project needs a zeitraum`);
  } else {
    if (e.verifiziert) errors.push(`${where}: a demo cannot be marked verified`);
    if (Array.isArray(e.kennzahlen) && e.kennzahlen.length) errors.push(`${where}: a demo must not show kennzahlen`);
  }
  const v = s.vorschau || {};
  if (!['konfigurator', 'vorher-nachher', 'bild'].includes(v.typ)) errors.push(`${where}: vorschau.typ unknown`);
  if (v.typ === 'bild' && !(v.src && v.alt && v.breite && v.hoehe)) errors.push(`${where}: vorschau bild needs src, alt, breite, hoehe`);
}
if (data.showcases.filter(s => s.status === 'live' && s.vorschau?.typ === 'vorher-nachher').length > 1) errors.push('only one live vorher-nachher preview is supported');
if (errors.length){ console.error('Showcase rules broken:\n- ' + errors.join('\n- ')); process.exit(1); }

/* ---------- rendering ---------- */
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const FENCE_SVG = `<svg class="fence-svg" viewBox="0 0 400 250" aria-hidden="true"><rect width="400" height="250" fill="#E9ECE4"/><path d="M0 188h400v62H0z" fill="#D5DACB"/><g fill="#3B4045"><rect x="38" y="70" width="7" height="122"/><rect x="152" y="70" width="7" height="122"/><rect x="266" y="70" width="7" height="122"/><rect x="380" y="70" width="7" height="122"/></g><g stroke="#3B4045" stroke-width="1.6"><path d="M45 92h107M45 96h107M45 132h107M45 136h107M45 172h107M45 176h107M159 92h107M159 96h107M159 132h107M159 136h107M159 172h107M159 176h107M273 92h107M273 96h107M273 132h107M273 136h107M273 172h107M273 176h107"/></g><g stroke="#3B4045" stroke-width="1.2" opacity=".85"><path d="${Array.from({ length: 51 }, (_, i) => { const x = 47 + i * 6.6; return x % 114 < 4 ? '' : `M${x.toFixed(1)} 74V186`; }).join('')}"/></g></svg>`;
const BA = `<div class="ba" data-ba style="--pos:50%">
          <div class="ba-old" aria-hidden="true"><div class="o-bar">www.tischlerei-beispiel.de/index_neu2.html</div><p class="o-title">Herzlich Willkommen bei der Tischlerei Beispiel!!</p><div class="o-row"><div class="o-img">[Bild]</div><ul><li><u>Startseite</u></li><li><u>Über uns</u></li><li><u>Leistungen</u></li><li><u>Kontakt</u></li></ul></div><p class="o-count">Sie sind Besucher Nr. 004213</p></div>
          <div class="ba-new" aria-hidden="true"><div class="n-nav"><b>BEISPIEL</b><span>Möbel</span><span>Küchen</span><i>Projekt anfragen</i></div><p class="n-head">Holz,<br>das bleibt.</p><span class="n-btn">Projekt anfragen</span><div class="n-wood"></div></div>
          <div class="ba-handle" aria-hidden="true"><span></span></div>
          <span class="ba-tag l" aria-hidden="true">Vorher</span><span class="ba-tag r" aria-hidden="true">Nachher</span>
          <input class="sr ba-range" type="range" min="0" max="100" value="50" aria-label="Vorher und Nachher vergleichen">
        </div>`;

function media(s){
  const v = s.vorschau;
  if (v.typ === 'konfigurator') return `<a class="case-media" href="${esc(s.link?.href || '#demo')}" tabindex="-1" aria-hidden="true">${FENCE_SVG}</a>`;
  if (v.typ === 'vorher-nachher') return `<div class="case-media">${BA}</div>`;
  return `<div class="case-media"><img src="${esc(v.src)}" alt="${esc(v.alt)}" width="${+v.breite}" height="${+v.hoehe}" loading="lazy" decoding="async"></div>`;
}
function card(s){
  const e = s.ergebnis || {};
  const kunde = s.art === 'kunde';
  const badge = kunde ? '<span class="badge badge-client">Kundenprojekt</span>' : '<span class="badge badge-demo">Konzept-Demo</span>';
  const who = kunde ? `<p class="case-who">${esc(s.firma)}${s.ort ? ', ' + esc(s.ort) : ''}</p>` : '';
  const kpis = kunde && e.kennzahlen?.length
    ? `<ul class="kpis">${e.kennzahlen.map(k => `<li><b>${esc(k.wert)}</b><span>${esc(k.label)}</span></li>`).join('')}</ul>` : '';
  const zeit = e.zeitraum ? `<p class="case-time">Zeitraum: ${esc(e.zeitraum)}</p>` : '';
  const proof = kunde ? '<p class="case-proof">Zahlen vom Kunden freigegeben.</p>' : '<p class="case-proof">Keine Kundenzahlen. Demo.</p>';
  const quote = kunde && s.zitat?.text ? `<blockquote class="case-quote"><p>„${esc(s.zitat.text)}“</p><footer>${esc(s.zitat.person)}</footer></blockquote>` : '';
  const ext = s.link && /^https?:/.test(s.link.href) ? ' rel="noopener" target="_blank"' : '';
  const link = s.link ? `<a class="case-link" href="${esc(s.link.href)}"${ext}>${esc(s.link.text)} ${ARROW}</a>` : '';
  return `      <article class="case case-${kunde ? 'client' : 'demo'}" id="arbeit-${esc(s.id)}">
        ${media(s)}
        <div class="case-body">
          <p class="case-tag">${badge}<span>${esc(s.gewerk)}</span></p>
          <h3>${esc(s.titel)}</h3>
          ${who}
          <dl>
            <div><dt>Branche / Gewerk</dt><dd>${esc(s.gewerk)}</dd></div>
            <div><dt>Ausgangslage</dt><dd>${esc(s.ausgangslage)}</dd></div>
            <div><dt>Was wir gebaut haben</dt><dd><ul>${s.gebaut.map(g => `<li>${esc(g)}</li>`).join('')}</ul></dd></div>
            <div><dt>Ergebnis &amp; Zeitraum</dt><dd>${kpis}${e.text ? `<p>${esc(e.text)}</p>` : ''}${zeit}${proof}</dd></div>
          </dl>
          ${quote}
          ${link}
        </div>
      </article>`;
}

const live = data.showcases.filter(s => s.status === 'live');
const clients = live.filter(s => s.art === 'kunde');
const demos = live.filter(s => s.art === 'demo');
const note = clients.length ? '' : `\n      <p class="cases-note">Kundenprojekte mit Zahlen stehen hier, sobald die Ergebnisse belegt und vom Kunden freigegeben sind. Bis dahin zeigen wir nur, was als Demo gekennzeichnet ist.</p>`;
const block = `${START}
      <div class="cases">
${[...clients, ...demos].map(card).join('\n')}
      </div>${note}
      ${END}`;

const page = readFileSync(pagePath, 'utf8');
const a = page.indexOf(START), b = page.indexOf(END);
if (a < 0 || b < 0){ console.error('Markers not found in index.html'); process.exit(1); }
const next = page.slice(0, a) + block + page.slice(b + END.length);
if (check){
  if (next !== page){ console.error('index.html is out of date. Run: node scripts/build-showcases.mjs'); process.exit(1); }
  console.log(`OK: ${clients.length} client project(s), ${demos.length} demo(s) live, ${data.showcases.length - live.length} draft(s).`);
} else {
  writeFileSync(pagePath, next);
  console.log(`index.html updated: ${clients.length} client project(s), ${demos.length} demo(s) live, ${data.showcases.length - live.length} draft(s) kept back.`);
}
