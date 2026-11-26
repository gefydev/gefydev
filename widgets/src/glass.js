// Plantillas SVG "Gefy Glass" (diseño de Davinci). Cada widget es una función pura (datos, tema) -> string SVG.
// Portado de diseno/src/build.mjs: sin I/O; la marca "DATOS DE EJEMPLO" se activa con render(..., { sample: true }).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOGOS = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../assets/logos.json', import.meta.url)), 'utf8'));
const SAMPLE_MODE = { on: false };

/* ───────────── tipografía (solo fuentes del sistema) ───────────── */
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,'Liberation Sans','DejaVu Sans',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace";

/* ───────────── tokens de tema ───────────── */
const THEMES = {
  dark: {
    id: 'dark',
    bg: ['#080c18', '#0f1631'],
    orbs: { violet: '#8b5cf6', teal: '#0db7b9', blue: '#5b8cff', pink: '#f472b6' },
    orbOp: 0.55,
    base: ['#060916', 0.6], tint: '#ffffff', glassA: 0.105, glassB: 0.035, subA: 0.06, subB: 0.025,
    stroke: [['#ffffff', 0.5], ['#ffffff', 0.07], ['#ffffff', 0.22]],
    sceneStroke: ['#ffffff', 0.14],
    shadow: ['#000000', 0.45],
    noise: ['1', 0.42],       // color del ruido (1=blanco), opacidad
    text: '#f2f5ff', text2: '#c9d1ea', text3: '#aab4d4',
    teal: '#45dcde', violet: '#b49cff', blue: '#8cb0ff', pink: '#f9a8d4', fire1: '#ffb972', fire2: '#ff6b8b',
    merged: '#c0a4ff', open: '#62df70', closed: '#ff8a82',
    hair: ['#ffffff', 0.10],
    gefy: ['#0db7b9', '#7aa2f7', '#a78bfa'],
    plate: ['#222b55', '#10163a'], plateStroke: 0.16,
    onPlateDark: '#f1f5f9',
  },
  light: {
    id: 'light',
    bg: ['#eef2ff', '#f9fbff'],
    orbs: { violet: '#a78bfa', teal: '#5eead4', blue: '#7dd3fc', pink: '#f9a8d4' },
    orbOp: 0.75,
    base: ['#ffffff', 0], tint: '#ffffff', glassA: 0.78, glassB: 0.46, subA: 0.55, subB: 0.32,
    stroke: [['#6d4fe0', 0.30], ['#6d4fe0', 0.07], ['#0a7a7c', 0.22]],
    sceneStroke: ['#6d4fe0', 0.14],
    shadow: ['#4c3fa8', 0.20],
    noise: ['0', 0.2],
    text: '#101426', text2: '#3b4364', text3: '#555d80',
    teal: '#07696c', violet: '#5b3bd2', blue: '#2c4cc4', pink: '#be185d', fire1: '#a24408', fire2: '#c2255c',
    merged: '#7239d6', open: '#146c2b', closed: '#b3202b',
    hair: ['#3b3f7a', 0.12],
    gefy: ['#0a8f91', '#3b5bdb', '#6d4fe0'],
    plate: ['#222b55', '#10163a'], plateStroke: 0.16,
    onPlateDark: '#f1f5f9',
  },
};

/* ───────────── utilidades ───────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Number(n).toLocaleString('en-US');
const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));
const r1 = (n) => Math.round(n * 10) / 10;
// ancho aproximado de texto (px). Conservador: sirve para truncar y alinear pills.
const tw = (s, size, { mono = false, bold = false } = {}) => [...String(s)].reduce((a, ch) => a + size * (ch.codePointAt(0) >= 0x2E80 ? 1.0 : mono ? 0.61 : bold ? 0.6 : 0.53), 0);
function trunc(s, maxPx, size, opts) {
  s = String(s);
  if (tw(s, size, opts) <= maxPx) return s;
  const chars = [...s]; let out = '';
  for (const ch of chars) { if (tw(out + ch + '…', size, opts) > maxPx) break; out += ch; }
  return out.trimEnd() + '…';
}
function rel(iso, nowIso) {
  const d = new Date(iso), now = new Date(nowIso);
  const s = (now - d) / 1000;
  if (s < 3600) return 'just now';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return d.getUTCFullYear() === now.getUTCFullYear() ? `${mon} ${d.getUTCDate()}` : `${mon} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
const dshort = (iso, nowIso, { year = 'auto', short = false } = {}) => {
  const d = new Date(iso);
  const base = d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const cur = nowIso ? new Date(nowIso).getUTCFullYear() : null;
  if (year === false || (year === 'auto' && (cur === null || d.getUTCFullYear() === cur))) return base;
  const y = d.getUTCFullYear();
  return short ? `${base} '${String(y).slice(2)}` : `${base}, ${y}`;
};
// Rango "Mon D – Mon D": agrega el año cuando no es el actual (o cuando los extremos son de años distintos).
const range = (a, b, toNow, nowIso, { short = false } = {}) => {
  if (!a || !Number.isFinite(Date.parse(a))) return '—';
  const cur = nowIso ? new Date(nowIso).getUTCFullYear() : null;
  const ya = new Date(a).getUTCFullYear(); const yb = toNow ? cur : new Date(b).getUTCFullYear();
  const cross = ya !== yb;
  const left = dshort(a, nowIso, { year: cross, short });
  const right = toNow ? 'Present' : dshort(b, nowIso, { short });
  return `${left} – ${right}`;
};
// "Since Mon D, YYYY" (siempre con año)
const since = (a, nowIso, { short = false } = {}) => (!a || !Number.isFinite(Date.parse(a)) ? '—' : `Since ${dshort(a, nowIso, { year: true, short })}`);

// Íconos Octicons (MIT) en grilla 16
const OCT = {
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z',
  pr: 'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z',
  merge: 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z',
  closed: 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
  issue: 'M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z',
  commit: 'M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z',
  repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  mail: 'M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2ZM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.809L8.38 9.397a.75.75 0 0 1-.76 0L1.5 5.809v6.442Zm13-8.181v-.32a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25v.32L8 7.88Z',
  globe: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z',
  flame: 'M8 0c.55 2.6-.9 3.9-2.3 5.4C4.3 6.8 3 8.2 3 10.2A5 5 0 0 0 13 10.2c0-1.8-.9-3.2-1.8-4.3-.3 1.2-1 1.9-1.8 2.1.6-2.7-.2-5.7-1.4-8Z',
};
const icon = (key, x, y, size, fill, extra = '') => `<path transform="translate(${x} ${y}) scale(${size / 16})" d="${OCT[key]}" fill="${fill}" ${extra}/>`;
const logoPath = (slug, x, y, size, fill) => `<path transform="translate(${x} ${y}) scale(${size / 24})" d="${LOGOS[slug].path}" fill="${fill}"/>`;
const hexLum = (hex) => { const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
// color del logo sobre placa oscura: marca real, o claro si la marca es casi negra
const logoOnPlate = (slug, t) => { const h = LOGOS[slug].hex; return hexLum(h) < 0.06 ? t.onPlateDark : '#' + h; };

/* ───────────── contexto SVG ───────────── */
function ctx(t, w, h, title, desc) { return { t, w, h, title, desc, n: 0, defs: [], body: [] }; }
const uid = (c, p) => `${p}${++c.n}`;

function head(c) {
  const t = c.t;
  const g = (id, stops, extra = '') => `<linearGradient id="${id}" ${extra}>${stops.map(([o, col, op = 1]) => `<stop offset="${o}" stop-color="${col}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
  const noiseM = t.noise[0] === '1' ? '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1' : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="0 0 ${c.w} ${c.h}" role="img" aria-labelledby="ttl dsc">
<title id="ttl">${esc(c.title)}</title><desc id="dsc">${esc(c.desc)}</desc>
<defs>
<style>
.s{font-family:${SANS}}.m{font-family:${MONO}}.n{font-variant-numeric:tabular-nums}
@keyframes d1{0%,100%{transform:translate(0,0)}50%{transform:translate(34px,16px)}}
@keyframes d2{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}}
@keyframes d3{0%,100%{transform:translate(0,0)}50%{transform:translate(18px,-22px)}}
@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes sw{0%{transform:translateX(-900px)}60%,100%{transform:translateX(900px)}}
@keyframes ring{from{stroke-dashoffset:calc(var(--off) + (var(--len) - var(--off)) * .3)}to{stroke-dashoffset:var(--off)}}
@keyframes grow{from{transform:scaleX(.72)}to{transform:scaleX(1)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.o1{animation:d1 16s ease-in-out infinite}.o2{animation:d2 20s ease-in-out infinite}.o3{animation:d3 24s ease-in-out infinite}
.fl1{animation:fl 6s ease-in-out infinite}.fl2{animation:fl 7.5s ease-in-out -2s infinite}.fl3{animation:fl 5.5s ease-in-out -4s infinite}
.sw{animation:sw 9s ease-in-out infinite}
.bar{transform-box:fill-box;transform-origin:left center;animation:grow 1.2s cubic-bezier(.2,.7,.2,1) both}
.cur{animation:blink 1s steps(1) infinite}
@media (prefers-reduced-motion:reduce){.o1,.o2,.o3,.fl1,.fl2,.fl3,.sw,.bar,.cur{animation:none}}
</style>
${g('bg', [[0, t.bg[0]], [1, t.bg[1]]], 'x1="0" y1="0" x2="1" y2="1"')}
${g('gefy', [[0, t.gefy[0]], [0.5, t.gefy[1]], [1, t.gefy[2]]], 'x1="0" y1="0" x2="1" y2="0"')}
${g('fire', [[0, t.fire1], [1, t.fire2]], 'x1="0" y1="0" x2="1" y2="1"')}
${g('gFill', [[0, t.tint, t.glassA], [1, t.tint, t.glassB]], 'x1="0" y1="0" x2="0.8" y2="1"')}
${g('sFill', [[0, t.tint, t.subA], [1, t.tint, t.subB]], 'x1="0" y1="0" x2="0.8" y2="1"')}
${g('gStroke', [[0, ...t.stroke[0].slice(0, 1), t.stroke[0][1]], [0.45, t.stroke[1][0], t.stroke[1][1]], [1, t.stroke[2][0], t.stroke[2][1]]], 'x1="0" y1="0" x2="1" y2="1"')}
${g('shine', [[0, '#ffffff', 0], [0.5, '#ffffff', t.id === 'dark' ? 0.55 : 0.95], [1, '#ffffff', 0]], 'x1="0" y1="0" x2="1" y2="0"')}
${g('plate', [[0, t.plate[0]], [1, t.plate[1]]], 'x1="0" y1="0" x2="1" y2="1"')}
${g('vline', [[0, t.hair[0], 0], [0.5, t.hair[0], t.hair[1] * 2.2], [1, t.hair[0], 0]], 'x1="0" y1="0" x2="0" y2="1"')}
<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="${t.tint === '#ffffff' && t.id === 'dark' ? '#fff' : '#4c3fa8'}" opacity="${t.id === 'dark' ? 0.07 : 0.10}"/></pattern>
<filter id="fBig" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="40"/></filter>
<filter id="fSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="fGlow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter>
<filter id="fNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="${noiseM} 0 0 0 .55 -.2"/></filter>
<clipPath id="sc"><rect width="${c.w}" height="${c.h}" rx="20"/></clipPath>
${c.defs.join('\n')}
</defs>`;
}

function scene(c, orbs) {
  const t = c.t;
  const col = (k) => t.orbs[k];
  const cls = ['o1', 'o2', 'o3'];
  return `<rect width="${c.w}" height="${c.h}" rx="20" fill="url(#bg)"/>
<g clip-path="url(#sc)"><g filter="url(#fBig)">${orbs.map(([cx, cy, r, k, op = 1], i) => `<circle class="${cls[i % 3]}" cx="${cx}" cy="${cy}" r="${r}" fill="${col(k)}" opacity="${r1(t.orbOp * op)}"/>`).join('')}</g><rect width="${c.w}" height="${c.h}" fill="url(#dots)"/></g>
<rect x=".5" y=".5" width="${c.w - 1}" height="${c.h - 1}" rx="19.5" fill="none" stroke="${t.sceneStroke[0]}" stroke-opacity="${t.sceneStroke[1]}"/>`;
}

// panel de vidrio principal: sombra, relleno degradado, ruido, borde con brillo y línea de luz superior
function panel(c, x, y, w, h, r = 18) {
  const t = c.t; const id = uid(c, 'pc');
  c.defs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`);
  return `<rect x="${x + 4}" y="${y + 10}" width="${w - 8}" height="${h - 4}" rx="${r}" fill="${t.shadow[0]}" opacity="${t.shadow[1]}" filter="url(#fSoft)"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${t.base[0]}" fill-opacity="${t.base[1]}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#gFill)"/>
<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#fNoise)" opacity="${t.noise[1]}"/><rect x="${x + r}" y="${y + 1}" width="${w - r * 2}" height="1" fill="url(#shine)"/></g>
<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="url(#gStroke)"/>`;
}
// sub-panel (tarjeta interior), más sutil
function sub(c, x, y, w, h, r = 14) {
  const t = c.t;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#sFill)"/><rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="url(#gStroke)" stroke-opacity=".55"/><rect x="${x + r}" y="${y + 1}" width="${w - r * 2}" height="1" fill="url(#shine)" opacity=".6"/>`;
}
const tx = (x, y, s, { sz = 13, w = 400, fill, anchor = 'start', mono = false, op, ls, cls = '' } = {}) =>
  `<text x="${x}" y="${y}" class="${mono ? 'm' : 's'} ${cls}" font-size="${sz}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}"${op != null ? ` opacity="${op}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}>${esc(s)}</text>`;
const hair = (c, x1, y, x2) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="1" fill="${c.t.hair[0]}" opacity="${c.t.hair[1]}"/>`;
function sampleTag(c) {
  if (!SAMPLE_MODE.on) return '';
  const w = 112; const x = c.w - w - 30; const y = 3;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="15" rx="7.5" fill="${c.t.id === 'dark' ? c.t.bg[0] : '#ffffff'}" fill-opacity=".94"/><rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="14" rx="7" fill="none" stroke="${c.t.text3}" stroke-opacity=".7" stroke-dasharray="3 2"/><text x="${x + w / 2}" y="${y + 10.6}" class="s" font-size="8.5" font-weight="700" letter-spacing=".08em" fill="${c.t.id === 'dark' ? '#b4bedb' : '#41496b'}" text-anchor="middle">DATOS DE EJEMPLO</text></g>`;
}
// placa oscura con logo de tecnología (funciona igual en dark y light)
function plate(c, slug, cx, cy, size = 44, glow = true) {
  const t = c.t; const col = logoOnPlate(slug, t); const x = cx - size / 2, y = cy - size / 2;
  const brand = '#' + (hexLum(LOGOS[slug].hex) < 0.06 ? '7aa2f7' : LOGOS[slug].hex);
  return `${glow ? `<circle cx="${cx}" cy="${cy + 4}" r="${size * 0.62}" fill="${brand}" opacity="${t.id === 'dark' ? 0.34 : 0.30}" filter="url(#fSoft)"/>` : ''}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.28}" fill="url(#plate)"/><rect x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size * 0.28 - .5}" fill="none" stroke="#fff" stroke-opacity="${t.plateStroke}"/><rect x="${x + size * 0.28}" y="${y + 1}" width="${size * 0.44}" height="1" fill="url(#shine)"/>${logoPath(slug, cx - size * 0.29, cy - size * 0.29, size * 0.58, col)}`;
}
function monogram(c, cx, cy, r, letter, dataUri) {
  const t = c.t; const id = uid(c, 'av');
  c.defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
  if (dataUri) return `<g clip-path="url(#${id})"><image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice"/></g><circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="none" stroke="#fff" stroke-opacity=".35"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#plate)"/><circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="none" stroke="#fff" stroke-opacity=".28"/><text x="${cx}" y="${cy + r * 0.36}" class="s" font-size="${r * 1.0}" font-weight="800" fill="#f1f5f9" text-anchor="middle">${esc(letter.toUpperCase())}</text>`;
}
const finish = (c, inner) => head(c) + '\n' + inner + '\n</svg>\n';

/* ───────────── WIDGET: hero ───────────── */
// Encabezado de Davinci (propuesta C, "La línea de base"): SVG estáticos y finales (todo trazado, sin datos, fuentes ni
// animación). Viven en widgets/assets/hero/ y se publican tal cual; letras y textos con fuentes SIL OFL 1.1 ya trazadas.
const heroFile = (name) => fs.readFileSync(fileURLToPath(new URL(`../assets/hero/${name}.svg`, import.meta.url)), 'utf8');
const hero = (d, t) => heroFile(`hero-${t.id}`);
const heroM = (d, t) => heroFile(`hero-m-${t.id}`);

/* ───────────── cabecera común de tarjeta media ───────────── */
function cardHeader(c, title, iconKey, right) {
  const t = c.t;
  let o = `<rect x="32" y="26" width="28" height="28" rx="9" fill="url(#plate)"/><rect x="32.5" y="26.5" width="27" height="27" rx="8.5" fill="none" stroke="#fff" stroke-opacity=".2"/>${icon(iconKey, 38, 32, 16, '#9fe9ea')}`;
  o += tx(70, 46, title, { sz: 16, w: 700, fill: t.text });
  if (right) o += tx(c.w - 32, 45, right, { sz: 11.5, fill: t.text3, anchor: 'end', mono: true });
  o += hair(c, 32, 64, c.w - 32);
  return o;
}

/* ───────────── WIDGET: stats ───────────── */
function stats(d, t) {
  const s = d.stats; const W = 420, H = 270;
  const c = ctx(t, W, H, 'GitHub stats', `Commits in the last 12 months ${s.commits}, PRs to other people's repositories ${s.prs}, issues ${s.issues}, stars ${s.stars}, other repositories with pull requests ${s.contributedTo}`);
  let o = scene(c, [[60, 40, 120, 'violet'], [380, 260, 140, 'teal'], [330, 30, 80, 'blue', 0.8]]);
  o += panel(c, 10, 10, W - 20, H - 20, 18);
  o += cardHeader(c, 'GitHub Stats', 'repo', `@${d.profile.login}`);
  const rows = [
    ['commit', 'Commits (last 12 months)', s.commits, 'teal'],
    ['pr', 'PRs to other repos', s.prs, 'violet'],
    ['issue', 'Issues', s.issues, 'blue'],
    ['star', 'Stars Earned', s.stars, 'fire1'],
    ['repo', 'Other repos with PRs', s.contributedTo, 'pink'],
  ];
  rows.forEach(([ic, label, val, ck], i) => {
    const y = 76 + i * 36;
    const col = t[ck];
    o += `<rect x="32" y="${y}" width="28" height="28" rx="9" fill="${col}" opacity="${t.id === 'dark' ? 0.16 : 0.13}"/><rect x="32.5" y="${y + .5}" width="27" height="27" rx="8.5" fill="none" stroke="${col}" stroke-opacity=".38"/>`;
    o += icon(ic, 38, y + 6, 16, col);
    o += tx(72, y + 19, label, { sz: 13.5, w: 500, fill: t.text2 });
    o += tx(W - 32, y + 20, fmt(val), { sz: 17, w: 800, fill: t.text, anchor: 'end', mono: true, cls: 'n' });
    if (i < rows.length - 1) o += hair(c, 72, y + 32, W - 32);
  });
  o += sampleTag(c).replace(`x="${W - 112 - 22}"`, `x="${W - 112 - 22}"`);
  return finish(c, o);
}

/* ───────────── WIDGET: lenguajes ───────────── */
function langs(d, t) {
  const L = d.languages; const W = 420, H = 270;
  const c = ctx(t, W, H, 'Top languages', L.map((l) => `${l.name} ${l.pct}%`).join(', '));
  let o = scene(c, [[360, 40, 120, 'teal'], [40, 250, 130, 'violet'], [220, 140, 70, 'pink', 0.5]]);
  o += panel(c, 10, 10, W - 20, H - 20, 18);
  o += cardHeader(c, 'Top Languages', 'repo', 'by code size');
  if (!L.length) {
    const cx = W / 2, cy = 150;
    o += `<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${t.text3}" stroke-opacity=".5" stroke-dasharray="3 5"/><rect x="${cx - 20}" y="${cy - 20}" width="40" height="40" rx="13" fill="url(#plate)"/>` + icon('repo', cx - 10, cy - 10, 20, '#9fe9ea');
    o += tx(cx, cy + 56, 'No language data yet', { sz: 14, w: 700, fill: t.text, anchor: 'middle' });
    o += sampleTag(c);
    return finish(c, o);
  }
  const top = L[0]; const pctS = String(Math.round(top.pct)); const offX = 32 + (pctS.length * 0.64 + 0.95) * 40 + 12;
  o += `<text x="32" y="112" class="s n" font-size="40" font-weight="800" letter-spacing="-1" fill="url(#gefy)">${Math.round(top.pct)}%</text>`;
  o += tx(offX, 100, top.name, { sz: 16, w: 700, fill: t.text });
  o += tx(offX, 117, 'most used language', { sz: 11.5, fill: t.text3 });
  // barra segmentada con glow
  const bx = 32, bw = W - 64, by = 134, bh = 12, gap = 3;
  const usable = bw - gap * (L.length - 1); let x = bx;
  c.defs.push(`<clipPath id="lbar"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6"/></clipPath>`);
  let segs = '', glow = '';
  L.forEach((l, i) => {
    const w = Math.max(4, (l.pct / 100) * usable);
    segs += `<rect x="${r1(x)}" y="${by}" width="${r1(w)}" height="${bh}" rx="3" fill="${l.color}"/>`;
    glow += `<rect x="${r1(x)}" y="${by + 2}" width="${r1(w)}" height="${bh}" rx="3" fill="${l.color}"/>`;
    x += w + gap;
  });
  o += `<g class="bar"><g opacity="${t.id === 'dark' ? 0.55 : 0.4}" filter="url(#fGlow)">${glow}</g>${segs}</g>`;
  // leyenda 2 columnas
  const half = Math.ceil(L.length / 2);
  L.forEach((l, i) => {
    const col = i < half ? 0 : 1; const row = i % half;
    const lx = 32 + col * 184; const ly = 176 + row * 24;
    o += `<circle cx="${lx + 5}" cy="${ly - 4}" r="4.5" fill="${l.color}"/>`;
    o += tx(lx + 18, ly, trunc(l.name, 96, 12.5), { sz: 12.5, w: 500, fill: t.text2 });
    o += tx(lx + 168, ly, l.pct.toFixed(1) + '%', { sz: 12, w: 600, fill: t.text3, anchor: 'end', mono: true, cls: 'n' });
  });
  o += sampleTag(c);
  return finish(c, o);
}

/* ───────────── WIDGET: racha ───────────── */
function streak(d, t) {
  const s = d.streak; const W = 850, H = 190;
  const c = ctx(t, W, H, 'Contribution streak', `Total ${s.total}, current streak ${s.current} days, longest ${s.longest} days`);
  let o = scene(c, [[130, 100, 130, 'violet'], [425, 190, 110, 'pink', 0.55], [720, 80, 150, 'teal']]);
  o += panel(c, 10, 10, W - 20, H - 20, 20);
  const third = (W - 20) / 3; const cxs = [10 + third / 2, 10 + third * 1.5, 10 + third * 2.5];
  [1, 2].forEach((i) => { o += `<rect x="${10 + third * i}" y="38" width="1" height="${H - 76}" fill="url(#vline)"/>`; });
  const label = (cx, txt) => tx(cx, 42, txt.toUpperCase(), { sz: 11, w: 700, fill: t.text3, anchor: 'middle', ls: '.12em' });
  // total
  o += label(cxs[0], 'Total contributions');
  o += `<text x="${cxs[0]}" y="112" class="s n" font-size="48" font-weight="800" letter-spacing="-1.5" fill="${t.text}" text-anchor="middle">${fmt(s.total)}</text>`;
  o += tx(cxs[0], 150, since(s.totalFrom, d.now), { sz: 12.5, fill: t.text2, anchor: 'middle' });
  // actual: anillo
  const R = 40, cy = 98, len = 2 * Math.PI * R; const pct = Math.min(1, s.current / Math.max(1, s.longest)); const off = len * (1 - pct);
  o += label(cxs[1], 'Current streak');
  c.defs.push(`<style>.rg{--len:${r1(len)};--off:${r1(off)};stroke-dasharray:${r1(len)};stroke-dashoffset:${r1(off)};animation:ring 1.6s cubic-bezier(.2,.7,.2,1) both}</style>`);
  o += `<circle cx="${cxs[1]}" cy="${cy}" r="${R}" fill="none" stroke="${t.hair[0]}" stroke-opacity="${t.id === 'dark' ? 0.14 : 0.16}" stroke-width="7"/>`;
  o += `<g transform="rotate(-90 ${cxs[1]} ${cy})"><circle class="rg" cx="${cxs[1]}" cy="${cy}" r="${R}" fill="none" stroke="url(#fire)" stroke-width="7" stroke-linecap="round" opacity=".5" filter="url(#fGlow)"/><circle class="rg" cx="${cxs[1]}" cy="${cy}" r="${R}" fill="none" stroke="url(#fire)" stroke-width="7" stroke-linecap="round"/></g>`;
  o += `<text x="${cxs[1]}" y="${cy + 6}" class="s n" font-size="30" font-weight="800" fill="${t.text}" text-anchor="middle">${s.current}</text>`;
  o += tx(cxs[1], cy + 21, s.current === 1 ? 'day' : 'days', { sz: 10.5, fill: t.text3, anchor: 'middle', w: 600 });
  if (s.current > 0) o += `<circle cx="${cxs[1]}" cy="${cy - R}" r="11" fill="url(#fire)"/>` + icon('flame', cxs[1] - 6.5, cy - R - 7.5, 13, '#fff');
  o += tx(cxs[1], 164, s.current > 0 ? range(s.currentFrom, s.currentTo, true, d.now) : 'No active streak', { sz: 12.5, fill: t.text2, anchor: 'middle' });
  // más larga
  o += label(cxs[2], 'Longest streak');
  o += `<text x="${cxs[2]}" y="112" class="s n" font-size="48" font-weight="800" letter-spacing="-1.5" fill="${t.text}" text-anchor="middle">${s.longest}<tspan font-size="16" font-weight="600" fill="${t.text3}" letter-spacing="0"> days</tspan></text>`;
  o += tx(cxs[2], 150, range(s.longestFrom, s.longestTo, false, d.now), { sz: 12.5, fill: t.text2, anchor: 'middle' });
  o += sampleTag(c);
  return finish(c, o);
}

/* ───────────── WIDGET: tech stack ───────────── */
function stack(d, t, opts = {}) {
  const S = d.stack; const W = opts.W || 850; const cols = opts.cols || 8; const k = W / 850; const tileW = (W - 64 - (cols - 1) * 10) / cols; const tileH = 108;
  const rows = Math.ceil(S.length / cols); const H = 84 + rows * (tileH + 10) + 14;
  const c = ctx(t, W, H, 'Tech stack', S.map((x) => x.name).join(', '));
  let o = scene(c, [[100 * k, 60, 130, 'blue'], [430 * k, H - 20, 130, 'violet', 0.85], [780 * k, 70, 130, 'teal']]);
  o += panel(c, 10, 10, W - 20, H - 20, 20);
  o += `<rect x="32" y="26" width="28" height="28" rx="9" fill="url(#plate)"/><rect x="32.5" y="26.5" width="27" height="27" rx="8.5" fill="none" stroke="#fff" stroke-opacity=".2"/>${logoPath('typescript', 37, 31, 18, '#7aa2f7')}`;
  o += tx(70, 46, 'Tech Stack & Tooling', { sz: 16, w: 700, fill: t.text });
  o += hair(c, 32, 64, W - 32);
  S.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 32 + col * (tileW + 10), y = 78 + row * (tileH + 10);
    o += sub(c, r1(x), y, r1(tileW), tileH, 15);
    const cx = x + tileW / 2;
    o += `<g class="fl${(i % 3) + 1}" style="animation-duration:${6 + (i % 4)}s">${plate(c, it.slug, r1(cx), y + 38, 46)}</g>`;
    const nsz = opts.nameSz || 12.5;
    o += tx(r1(cx), y + 82, trunc(it.name, tileW - (opts.nameSz ? 4 : 10), nsz, { bold: true }), { sz: nsz, w: 700, fill: t.text, anchor: 'middle' });
    const ksz = opts.nameSz ? 12 : 10;
    o += tx(r1(cx), y + 98, trunc(it.kind, tileW - 6, ksz), { sz: ksz, w: 500, fill: t.text3, anchor: 'middle', ls: opts.nameSz ? '.02em' : '.04em' });
  });
  o += sampleTag(c);
  return finish(c, o);
}

/* ───────────── WIDGET: PRs por repo ───────────── */
const stateOf = (t) => ({ merged: { col: t.merged, ic: 'merge', label: 'Merged' }, open: { col: t.open, ic: 'pr', label: 'Open' }, closed: { col: t.closed, ic: 'closed', label: 'Closed' } });

function prs(d, t, opts = {}) {
  const P = d.prs; const W = opts.W || 850; const now = d.now;
  const narrow = W < 600; const cols = opts.cols || (narrow ? 1 : 2); const fm = narrow ? 12 : 11; const ft = narrow ? 13 : 12.5;
  const repos = P.repos; const cardW = (W - 64 - (cols - 1) * 12) / cols; const rowH = 40; const empty = P.total === 0;
  const rowsOf = (r) => Math.max(1, r.recent.length);
  const cardH = (r) => 78 + rowsOf(r) * rowH + 6;
  const pairs = []; for (let i = 0; i < repos.length; i += cols) pairs.push(repos.slice(i, i + cols));
  const pairH = pairs.map((pr) => Math.max(...pr.map(cardH)));
  const bodyH = empty ? 168 : pairH.reduce((a, b) => a + b, 0) + (pairs.length - 1) * 12;
  const moreRepos = Math.max(0, (P.reposTotal || repos.length) - repos.length);
  const foot = moreRepos > 0 ? 38 : 8;
  const top = narrow ? 182 : 138; const H = top + bodyH + foot + 24;
  const c = ctx(t, W, H, 'Open source contributions', `${P.total} pull requests, ${P.merged} merged, ${P.open} open, ${P.closed} closed, in other people's repositories`);
  const ST = stateOf(t);
  let o = scene(c, [[70, 90, 150, 'violet'], [W - 60, 200, 160, 'teal'], [W / 2, H - 40, 140, 'blue', 0.8], [W - 50, H - 120, 100, 'pink', 0.6]]);
  o += panel(c, 10, 10, W - 20, H - 20, 22);
  // header
  o += `<rect x="32" y="30" width="34" height="34" rx="11" fill="url(#plate)"/><rect x="32.5" y="30.5" width="33" height="33" rx="10.5" fill="none" stroke="#fff" stroke-opacity=".2"/>${icon('merge', 40, 38, 18, '#9fe9ea')}`;
  if (narrow) {
    o += tx(78, 52, 'Open Source Contributions', { sz: 17, w: 800, fill: t.text });
    o += tx(78, 70, "To other people's repos · latest 3 each", { sz: 12, fill: t.text3 });
    o += `<text x="32" y="116" class="s n" font-size="34" font-weight="800" letter-spacing="-1" fill="url(#gefy)">${fmt(P.total)}</text>`;
    o += tx(32 + tw(fmt(P.total), 34, { bold: true }) + 8, 116, P.total === 1 ? 'PR to other repos' : 'PRs to other repos', { sz: 12, w: 700, fill: t.text3 });
    if (P.ownTotal > 0) o += tx(W - 32, 116, `+ ${fmt(P.ownTotal)} in own repos`, { sz: 12, fill: t.text3, anchor: 'end' });
    const bx = 32, bw = W - 64, by = 134, bh = 8;
    if (empty) {
      o += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="${t.hair[0]}" opacity="${t.hair[1] * 1.3}"/>`;
    } else {
      const parts = [['merged', P.merged], ['open', P.open], ['closed', P.closed]].filter(([, v]) => v > 0);
      const gap = 3; const usable = bw - gap * (parts.length - 1); let x = bx; let segs = '', glow = '';
      parts.forEach(([k, v]) => { const w = Math.max(6, (v / P.total) * usable); segs += `<rect x="${r1(x)}" y="${by}" width="${r1(w)}" height="${bh}" rx="3" fill="${ST[k].col}"/>`; glow += `<rect x="${r1(x)}" y="${by + 1.5}" width="${r1(w)}" height="${bh}" rx="3" fill="${ST[k].col}"/>`; x += w + gap; });
      o += `<g class="bar"><g opacity="${t.id === 'dark' ? 0.5 : 0.35}" filter="url(#fGlow)">${glow}</g>${segs}</g>`;
    }
    let lx = 32; const ly = 166;
    [['merged', P.merged], ['open', P.open], ['closed', P.closed]].forEach(([k, v]) => {
      o += `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${ST[k].col}"/>`;
      const lab = `${fmt(v)} ${k}`; o += tx(lx + 14, ly, lab, { sz: 12.5, w: 700, fill: t.text });
      lx += 14 + tw(lab, 12.5, { bold: true }) + 18;
    });
    if (!empty) o += tx(W - 32, ly, `${repos.length} of ${P.reposTotal || repos.length} repos`, { sz: 12, fill: t.text3, anchor: 'end' });
    o += hair(c, 32, 176, W - 32);
  } else {
    o += tx(78, 50, 'Open Source Contributions', { sz: 19, w: 800, fill: t.text });
    o += tx(78, 68, "Pull requests to other people's repositories · latest 3 each", { sz: 12, fill: t.text3 });
    o += `<text x="${W - 32}" y="60" class="s n" font-size="34" font-weight="800" letter-spacing="-1" fill="url(#gefy)" text-anchor="end">${fmt(P.total)}</text>`;
    o += tx(W - 32 - tw(fmt(P.total), 34, { bold: true }) - 8, 60, P.total === 1 ? 'PR' : 'PRs', { sz: 12, w: 700, fill: t.text3, anchor: 'end', ls: '.08em' });
    if (P.ownTotal > 0) o += tx(W - 32, 79, `+ ${fmt(P.ownTotal)} in own repositories`, { sz: 11, fill: t.text3, anchor: 'end' });
    // barra proporcional + leyenda
    const bx = 32, bw = W - 64, by = 88, bh = 8;
    if (empty) {
      o += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="${t.hair[0]}" opacity="${t.hair[1] * 1.3}"/>`;
    } else {
      const parts = [['merged', P.merged], ['open', P.open], ['closed', P.closed]].filter(([, v]) => v > 0);
      const gap = 3; const usable = bw - gap * (parts.length - 1); let x = bx; let segs = '', glow = '';
      parts.forEach(([k, v]) => { const w = Math.max(6, (v / P.total) * usable); segs += `<rect x="${r1(x)}" y="${by}" width="${r1(w)}" height="${bh}" rx="3" fill="${ST[k].col}"/>`; glow += `<rect x="${r1(x)}" y="${by + 1.5}" width="${r1(w)}" height="${bh}" rx="3" fill="${ST[k].col}"/>`; x += w + gap; });
      o += `<g class="bar"><g opacity="${t.id === 'dark' ? 0.5 : 0.35}" filter="url(#fGlow)">${glow}</g>${segs}</g>`;
    }
    let lx = 32; const ly = 122;
    [['merged', P.merged], ['open', P.open], ['closed', P.closed]].forEach(([k, v]) => {
      o += `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${ST[k].col}"/>`;
      const lab = `${fmt(v)} ${k}`; o += tx(lx + 14, ly, lab, { sz: 12.5, w: 700, fill: t.text });
      lx += 14 + tw(lab, 12.5, { bold: true }) + 22;
    });
    if (!empty) o += tx(W - 32, ly, `${repos.length} of ${P.reposTotal || repos.length} repositories`, { sz: 12, fill: t.text3, anchor: 'end' });
    o += hair(c, 32, 132, W - 32);
  }
  if (empty) {
    const cx = W / 2, cy = top + 54;
    o += `<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${t.text3}" stroke-opacity=".5" stroke-dasharray="3 5"/>` + `<rect x="${cx - 20}" y="${cy - 20}" width="40" height="40" rx="13" fill="url(#plate)"/>` + icon('pr', cx - 10, cy - 10, 20, '#9fe9ea');
    o += tx(cx, cy + 56, 'No pull requests yet', { sz: 15, w: 700, fill: t.text, anchor: 'middle' });
    o += tx(cx, cy + 76, 'Merged, open and closed PRs will show up here automatically.', { sz: 12.5, fill: t.text3, anchor: 'middle' });
    o += sampleTag(c);
    return finish(c, o);
  }
  // tarjetas
  let y = top;
  pairs.forEach((pr, pi) => {
    pr.forEach((r, ci) => {
      const x = 32 + ci * (cardW + 12); const h = pairH[pi];
      o += sub(c, x, y, r1(cardW), h, 16);
      o += monogram(c, x + 32, y + 33, 15, r.owner[0], r.avatarDataUri);
      const rightW = tw(`${r.total} PRs`, 15, { bold: true }) + 6;
      const nameMax = cardW - 64 - rightW - (narrow ? 38 : 24);
      const ownerS = r.owner + '/';
      const full = trunc(ownerS + r.name, nameMax, 13.5, { bold: true });
      if (full.startsWith(ownerS) && full.length > ownerS.length) o += `<text x="${x + 56}" y="${y + 31}" class="s" font-size="13.5" font-weight="700" fill="${t.text3}">${esc(ownerS)}<tspan fill="${t.text}">${esc(full.slice(ownerS.length))}</tspan></text>`;
      else o += tx(x + 56, y + 31, full, { sz: 13.5, w: 700, fill: t.text3 });
      // lenguaje + estrellas
      let mx = x + 56;
      if (r.language) { o += `<circle cx="${mx + 4}" cy="${y + 47}" r="4" fill="${r.langColor || t.text3}"/>`; const lt = trunc(r.language, 84, fm); o += tx(mx + 13, y + 51, lt, { sz: fm, fill: t.text2 }); mx += 13 + tw(lt, fm) + 12; }
      if (r.stars != null) { o += icon('star', mx, y + 41, 11, t.fire1); o += tx(mx + 15, y + 51, compact(r.stars), { sz: fm, fill: t.text2, cls: 'n' }); }
      // total + merged
      o += tx(x + cardW - 16, y + 31, `${r.total} ${r.total === 1 ? 'PR' : 'PRs'}`, { sz: 15, w: 800, fill: t.text, anchor: 'end', cls: 'n' });
      o += tx(x + cardW - 16, y + 49, `${r.merged} merged`, { sz: narrow ? 12 : 11.5, w: 700, fill: r.merged ? t.merged : t.text3, anchor: 'end', cls: 'n' });
      // mini barra
      const mbw = cardW - 32; const parts = [['merged', r.merged], ['open', r.open], ['closed', r.closed]].filter(([, v]) => v > 0); let bxx = x + 16; const gp = 2; const us = mbw - gp * Math.max(0, parts.length - 1);
      parts.forEach(([k, v]) => { const w = Math.max(4, (v / r.total) * us); o += `<rect x="${r1(bxx)}" y="${y + 62}" width="${r1(w)}" height="4" rx="2" fill="${ST[k].col}"/>`; bxx += w + gp; });
      // últimos PRs
      r.recent.slice(0, 3).forEach((p, i) => {
        const ry = y + 78 + i * rowH; const st = ST[p.state];
        if (i > 0) o += hair(c, x + 16, ry - 3, x + cardW - 16);
        o += icon(st.ic, x + 16, ry + 3, 14, st.col);
        const dateS = rel(p.at, now);
        const titleMax = cardW - 42 - 16 - tw(dateS, fm) - 26;
        o += tx(x + 40, ry + 14, trunc(p.title, titleMax, ft), { sz: ft, w: 500, fill: t.text });
        o += tx(x + cardW - 16, ry + 14, dateS, { sz: fm, fill: t.text3, anchor: 'end' });
        o += `<text x="${x + 40}" y="${ry + 30}" class="s" font-size="${fm}" fill="${t.text3}"><tspan fill="${st.col}" font-weight="700">${st.label}</tspan> · #${p.n}</text>`;
      });
    });
    y += pairH[pi] + 12;
  });
  if (moreRepos > 0) {
    const lab = `+ ${moreRepos} more ${moreRepos === 1 ? 'repository' : 'repositories'}`; const w = tw(lab, 12, { bold: true }) + 32; const fy = y + 2;
    o += `<rect x="${W / 2 - w / 2}" y="${fy}" width="${w}" height="26" rx="13" fill="url(#sFill)"/><rect x="${W / 2 - w / 2 + .5}" y="${fy + .5}" width="${w - 1}" height="25" rx="12.5" fill="none" stroke="url(#gStroke)" stroke-opacity=".7"/>` + tx(W / 2, fy + 17, lab, { sz: 12, w: 700, fill: t.text2, anchor: 'middle' });
  }
  o += sampleTag(c);
  return finish(c, o);
}



/* ───────────── variantes móviles (420 px de ancho: a 375 px de pantalla se escalan ~0.8 y el texto sigue legible) ───────────── */

// Texto de 12 px; si no entra, se parte en dos líneas por el guion en vez de achicar la letra.
function fitLines(text, maxW, sz = 12) {
  if (tw(text, sz) <= maxW) return [text];
  const parts = text.split(' – ');
  if (parts.length === 2) return [`${parts[0]} –`, parts[1]].map((l) => trunc(l, maxW, sz));
  return [trunc(text, maxW, sz)];
}
const lines = (cx, y, arr, t) => arr.map((l, i) => tx(cx, y + i * 14, l, { sz: 12, fill: t.text2, anchor: 'middle' })).join('');

/* ───────────── embebidos (3D y snake) dentro del marco glass ───────────── */
const stripAnimations = (str) => str.replace(/<animate(?:Transform)?\b[^>]*?(?:\/>|>\s*<\/animate(?:Transform)?>)/g, '');

const UNSAFE_EMBED = [
  [/<\s*script/i, '<script>'], [/<\s*foreignObject/i, '<foreignObject>'], [/<\s*(iframe|object|embed|image|use|a|link|audio|video|animation)\b/i, 'elemento no permitido'],
  [/(^|[\s"'\/])on[a-z]+\s*=/i, 'manejador de eventos'], [/javascript\s*:/i, 'javascript:'], [/@import/i, '@import'],
  [/url\(\s*['"]?\s*(?!#)/i, 'url() que no es interna'], [/\b(?:xlink:)?href\s*=/i, 'href'], [/\bsrc\s*=/i, 'src'], [/https?:\/\/|\/\/[\w.-]+\.[a-z]{2,}/i, 'URL externa'], [/data\s*:/i, 'data:']
];
// Los SVG de github-profile-3d-contrib y snk los generan acciones fijadas por SHA, pero igual se incrustan en nuestro SVG:
// si traen algo activo o externo se rechazan (la Action conserva el anterior) en vez de publicarlo.
export function assertSafeEmbed(text, label) {
  for (const [re, why] of UNSAFE_EMBED) if (re.test(text)) throw new Error(`embebido no permitido en ${label}: ${why}`);
}

export function splitTopGroups(body) {
  const groups = []; let depth = 0; let start = -1;
  for (const m of body.matchAll(/<g[\s>]|<\/g>/g)) {
    if (m[0] !== '</g>') { if (depth === 0) start = m.index; depth += 1; } else { depth -= 1; if (depth === 0) groups.push(body.slice(start, m.index + 4)); }
  }
  return groups;
}

// Del SVG de github-profile-3d-contrib se conservan solo el gráfico isométrico (cubos) y su paleta; el radar y el donut
// repiten datos que ya tienen sus widgets (y el radar cuenta PRs de otra forma), y el total se rehace con el estilo glass.
export function parse3d(raw) {
  const style = (/<style>([\s\S]*?)<\/style>/.exec(raw) || [])[1] || '';
  const body = raw.slice(raw.indexOf('</style>') + 8, raw.lastIndexOf('</svg>'));
  const groups = splitTopGroups(body);
  const cubes = groups.find((g) => g.includes('cont-top-'));
  if (!cubes) throw new Error('el SVG del 3D no tiene cubos');
  assertSafeEmbed(`${style}${cubes}`, '3D');
  const totals = groups.find((g) => /contributions/.test(g) && /fill-strong/.test(g)) || '';
  const total = /class="fill-strong"[^>]*>([\d,]+)</.exec(totals)?.[1] ?? null;
  const range = /(\d{4}-\d{2}-\d{2}) \/ (\d{4}-\d{2}-\d{2})/.exec(totals);
  const levels = [0, 1, 2, 3, 4].map((n) => (new RegExp(`\\.cont-top-${n}\\s*\\{\\s*fill:\\s*([^;}]+)`).exec(style) || [])[1]?.trim() || null);
  return { style: style.replace(/\*\s*\{[^}]*\}/, ''), cubes, total: total ? Number(total.replace(/,/g, '')) : null, from: range?.[1] || null, to: range?.[2] || null, levels };
}

const SNAKE_VARS = {
  dark: { cb: '#ffffff14', cs: '#ffb972', ce: '#262f5c', c0: '#262f5c', c1: '#0f6e78', c2: '#0db7b9', c3: '#6f9bf5', c4: '#b49cff' },
  light: { cb: '#10142614', cs: '#d9480f', ce: '#dfe5fb', c0: '#dfe5fb', c1: '#9fe3e3', c2: '#2fc3c6', c3: '#6a8df0', c4: '#7a55e0' }
};

// Prefija clases y animaciones de snk (c, u, s…) para que no choquen con las del marco y aplica la paleta de marca.
export function prepSnake(raw, themeId) {
  const m = /<style>([\s\S]*?)<\/style>/.exec(raw);
  if (!m) throw new Error('el SVG de la snake no tiene estilos');
  const vars = SNAKE_VARS[themeId];
  let css = m[1].replace(/:root\{[^}]*\}/, `:root{${Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(';')}}`);
  css = css.replace(/@keyframes ([\w-]+)/g, '@keyframes sn$1').replace(/animation-name:([\w-]+)/g, 'animation-name:sn$1').replace(/\.([cus]\d*)(?![\w-])/g, '.sn$1');
  const vb = /viewBox="([^"]+)"/.exec(raw)?.[1] || '-16 -32 880 192';
  assertSafeEmbed(`${m[1]}${raw.slice(raw.indexOf('</style>') + 8, raw.lastIndexOf('</svg>'))}`, 'snake');
  const inner = raw.slice(raw.indexOf('</style>') + 8, raw.lastIndexOf('</svg>')).replace(/class="([^"]*)"/g, (_, v) => `class="${v.split(/\s+/).map((x) => `sn${x}`).join(' ')}"`);
  return { css, inner, viewBox: vb.split(/\s+/).map(Number) };
}

const prettyDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function activity3d(d, t, opts = {}) {
  const raw = d.embeds?.threeD?.[t.id];
  if (!raw) throw new Error('falta el SVG del 3D');
  const e = parse3d(raw);
  const W = opts.W || 850; const narrow = W < 600; const pad = 32; const cw = W - pad * 2;
  const vb = [10, 134, 1216, 702]; const k = cw / vb[2]; const ch = Math.round(vb[3] * k);
  const top = 78; const H = top + ch + 24;
  const rangeS = e.from && e.to ? `${prettyDate(e.from)} – ${prettyDate(e.to)}` : '';
  const c = ctx(t, W, H, '3D contribution graph', `Contribution calendar of the last 12 months${e.total != null ? `, ${e.total} contributions` : ''}`);
  let o = scene(c, [[W * 0.12, 70, 120, 'violet'], [W * 0.88, H - 60, 150, 'teal'], [W * 0.5, H - 20, 110, 'blue', 0.8]]);
  o += panel(c, 10, 10, W - 20, H - 20, 20);
  o += cardHeader(c, '3D Contribution Graph', 'commit', narrow ? null : rangeS);
  c.defs.push(`<style>${e.style}</style>`);
  const body = stripAnimations(e.cubes); // altura final desde el primer cuadro: el SMIL de la librería arranca plano (2,6) y no respeta prefers-reduced-motion
  o += `<svg x="${pad}" y="${top}" width="${cw}" height="${ch}" viewBox="${vb.join(' ')}">${body}</svg>`;
  // total (esquina superior derecha, vacía en el gráfico)
  if (e.total != null) {
    const nx = W - pad - 4; const ny = top + (narrow ? 34 : 62);
    o += `<text x="${nx}" y="${ny}" class="s n" font-size="${narrow ? 30 : 46}" font-weight="800" letter-spacing="-1" fill="url(#gefy)" text-anchor="end">${fmt(e.total)}</text>`;
    o += tx(nx, ny + (narrow ? 20 : 26), 'contributions', { sz: narrow ? 12 : 13, w: 600, fill: t.text2, anchor: 'end' });
    if (narrow && rangeS) o += tx(nx, ny + 38, 'last 12 months', { sz: 12, fill: t.text3, anchor: 'end' });
    else if (rangeS) o += tx(nx, ny + 44, 'last 12 months', { sz: 11.5, fill: t.text3, anchor: 'end' });
  }
  // leyenda Less/More (esquina inferior izquierda)
  const ly = top + ch - (narrow ? 4 : 8); const sq = narrow ? 11 : 13;
  let lx = pad + 2;
  o += tx(lx, ly, 'Less', { sz: narrow ? 12 : 11.5, fill: t.text3 });
  lx += tw('Less', narrow ? 12 : 11.5) + 8;
  e.levels.forEach((col, i) => { if (col) o += `<rect x="${lx}" y="${ly - sq + 2}" width="${sq}" height="${sq}" rx="3" fill="${col}"/>`; lx += sq + 4; });
  o += tx(lx + 4, ly, 'More', { sz: narrow ? 12 : 11.5, fill: t.text3 });
  o += sampleTag(c);
  return finish(c, o);
}

function snakeWidget(d, t, opts = {}) {
  const raw = d.embeds?.snake;
  if (!raw) throw new Error('falta el SVG de la snake');
  const sn = prepSnake(raw, t.id);
  const W = opts.W || 850; const narrow = W < 600; const pad = 32; const cw = W - pad * 2;
  const [, , vw, vh] = sn.viewBox; const k = cw / vw; const ch = Math.round(vh * k);
  const top = 76; const H = top + ch + (narrow ? 22 : 26);
  const c = ctx(t, W, H, 'Contribution snake', 'Animated snake eating the contribution calendar of the last 12 months');
  let o = scene(c, [[W * 0.1, 60, 110, 'violet'], [W * 0.9, H - 40, 130, 'teal'], [W * 0.5, H - 10, 90, 'pink', 0.55]]);
  o += panel(c, 10, 10, W - 20, H - 20, 20);
  o += cardHeader(c, 'Contribution Snake', 'flame', narrow ? null : 'eats the last 12 months');
  c.defs.push(`<style>${sn.css}</style>`);
  o += `<svg x="${pad}" y="${top - 4}" width="${cw}" height="${ch}" viewBox="${sn.viewBox.join(' ')}">${sn.inner}</svg>`;
  o += sampleTag(c);
  return finish(c, o);
}

/* ───────────── variantes móviles v2: compuestas a 340 px lógicos ─────────────
   A 375 px de pantalla el contenedor del README mide 293 px (escala 0,862): ningún texto baja de 13 (11,2 px reales).
   Sin animaciones (salvo la snake, cuyo primer cuadro es el calendario completo). Mismo contrato de datos que escritorio. */
const MW = 340, MX = 22, MR = MW - 22, MI = MR - MX;
const STILL = '<style>*{animation:none!important}</style>';
const mFinish = (c, o, still = true) => finish(c, o + sampleTag(c) + (still ? STILL : ''));
function mFrame(c, H) { return scene(c, [[40, 50, 110, 'violet'], [MW - 30, H - 50, 130, 'teal'], [MW / 2, H - 10, 90, 'blue', 0.7]]) + panel(c, 8, 8, MW - 16, H - 16, 18); }
function mHeader(c, title, badge, sub2) {
  const t = c.t;
  let o = `<rect x="${MX}" y="22" width="30" height="30" rx="9" fill="url(#plate)"/><rect x="${MX + .5}" y="22.5" width="29" height="29" rx="8.5" fill="none" stroke="#fff" stroke-opacity=".2"/>${badge}`;
  o += tx(MX + 40, sub2 ? 36 : 43, title, { sz: 16, w: 800, fill: t.text });
  if (sub2) o += tx(MX + 40, 53, sub2, { sz: 13, fill: t.text3 });
  return o + hair(c, MX, 64, MR);
}
const mIcon = (key) => icon(key, MX + 7, 29, 16, '#9fe9ea');
// tw() subestima con fuentes anchas (DejaVu y similares): en móvil se mide contra el 90 % del ancho disponible
const fitM = (s, maxW, sz, opts) => trunc(s, maxW * 0.9, sz, opts);
// corta en hasta n líneas por palabras; la última lleva … si sobra
function mWrap(s, maxW, sz, n = 2, opts) {
  const words = String(s).split(/\s+/).filter(Boolean); const out = [];
  while (words.length && out.length < n) {
    if (out.length === n - 1) { out.push(fitM(words.join(' '), maxW, sz, opts)); break; }
    let line = words.shift();
    while (words.length && tw(`${line} ${words[0]}`, sz, opts) <= maxW * 0.9) line += ` ${words.shift()}`;
    out.push(fitM(line, maxW, sz, opts));
  }
  return out.length ? out : [''];
}

function stackM(d, t) {
  const S = d.stack; const gap = 8; const tileW = (MI - gap) / 2; const tileH = 54;
  const H = 76 + Math.ceil(S.length / 2) * (tileH + gap) + 12;
  const c = ctx(t, MW, H, 'Tech stack', S.map((x) => x.name).join(', '));
  let o = mFrame(c, H) + mHeader(c, 'Tech Stack & Tooling', logoPath('typescript', MX + 6, 28, 18, '#7aa2f7'));
  S.forEach((it, i) => {
    const x = MX + (i % 2) * (tileW + gap), y = 76 + Math.floor(i / 2) * (tileH + gap);
    o += sub(c, x, y, tileW, tileH, 13) + plate(c, it.slug, x + 28, y + 27, 36);
    o += tx(x + 54, y + 23, trunc(it.name, tileW - 58, 14, { bold: true }), { sz: 14, w: 700, fill: t.text });
    o += tx(x + 54, y + 42, trunc(it.kind, tileW - 58, 13), { sz: 13, w: 500, fill: t.text3 });
  });
  return mFinish(c, o);
}

function statsM(d, t) {
  const s = d.stats; const rowH = 40; const H = 76 + 5 * rowH + 12;
  const c = ctx(t, MW, H, 'GitHub stats', `Commits in the last 12 months ${s.commits}, PRs to other people's repositories ${s.prs}, issues ${s.issues}, stars ${s.stars}, other repositories with pull requests ${s.contributedTo}`);
  let o = mFrame(c, H) + mHeader(c, 'GitHub Stats', mIcon('repo'), `@${d.profile.login}`);
  const rows = [['commit', 'Commits (last 12 months)', s.commits, 'teal'], ['pr', 'PRs to other repos', s.prs, 'violet'], ['issue', 'Issues', s.issues, 'blue'], ['star', 'Stars Earned', s.stars, 'fire1'], ['repo', 'Other repos with PRs', s.contributedTo, 'pink']];
  rows.forEach(([ic, label, val, ck], i) => {
    const y = 76 + i * rowH; const col = t[ck];
    o += `<rect x="${MX}" y="${y}" width="28" height="28" rx="9" fill="${col}" opacity="${t.id === 'dark' ? 0.16 : 0.13}"/><rect x="${MX + .5}" y="${y + .5}" width="27" height="27" rx="8.5" fill="none" stroke="${col}" stroke-opacity=".38"/>${icon(ic, MX + 6, y + 6, 16, col)}`;
    const v = fmt(val); const vw = tw(v, 18, { mono: true });
    o += tx(MX + 38, y + 19, trunc(label, MI - 38 - vw - 12, 14), { sz: 14, w: 500, fill: t.text2 });
    o += tx(MR, y + 20, v, { sz: 18, w: 800, fill: t.text, anchor: 'end', mono: true, cls: 'n' });
    if (i < rows.length - 1) o += hair(c, MX + 38, y + 34, MR);
  });
  return mFinish(c, o);
}

function langsM(d, t) {
  const L = d.languages; const half = Math.ceil(L.length / 2); const H = 158 + half * 44 + 6;
  const c = ctx(t, MW, H, 'Top languages', L.map((l) => `${l.name} ${l.pct}%`).join(', '));
  let o = mFrame(c, H) + mHeader(c, 'Top Languages', mIcon('repo'), 'by code size');
  if (!L.length) return mFinish(c, o + tx(MW / 2, 120, 'No language data yet', { sz: 14, w: 600, fill: t.text2, anchor: 'middle' }));
  const big = `${Math.round(L[0].pct)}%`; const off = MX + [...String(Math.round(L[0].pct))].length * 25 + 52;
  o += `<text x="${MX}" y="112" class="s n" font-size="40" font-weight="800" letter-spacing="-1" fill="url(#gefy)">${big}</text>`;
  o += tx(off, 97, trunc(L[0].name, MR - off, 16, { bold: true }), { sz: 16, w: 700, fill: t.text }) + tx(off, 115, 'most used language', { sz: 13, fill: t.text3 });
  const gap = 3, usable = MI - gap * (L.length - 1); let x = MX;
  L.forEach((l) => { const w = Math.max(4, (l.pct / 100) * usable); o += `<rect x="${r1(x)}" y="128" width="${r1(w)}" height="12" rx="3" fill="${l.color}"/>`; x += w + gap; });
  const colW = MI / 2;
  L.forEach((l, i) => {
    const cx = MX + (i < half ? 0 : 1) * (colW + 6), cy = 168 + (i % half) * 44;
    o += `<circle cx="${cx + 5}" cy="${cy - 5}" r="5" fill="${l.color}"/>`;
    o += tx(cx + 18, cy, trunc(l.name, colW - 26, 14, { bold: true }), { sz: 14, w: 600, fill: t.text });
    o += tx(cx + 18, cy + 18, `${l.pct.toFixed(1)}%`, { sz: 13, fill: t.text3, mono: true, cls: 'n' });
  });
  return mFinish(c, o);
}

function streakM(d, t) {
  const s = d.streak; const H = 330;
  const c = ctx(t, MW, H, 'Contribution streak', `Total ${s.total}, current streak ${s.current} days, longest ${s.longest} days`);
  let o = mFrame(c, H);
  const cx = MX + 44; const label = (y, a) => tx(MX + 108, y, a, { sz: 14, w: 700, fill: t.text });
  const dates = (y, str) => mWrap(str, MI - 108, 13, 2).map((l, i) => tx(MX + 108, y + i * 17, l, { sz: 13, fill: t.text3 })).join('');
  const num = (y, v, sz = 30, maxW = 92) => `<text x="${cx}" y="${y}" class="s n" font-size="${Math.max(15, Math.min(sz, Math.floor(maxW / (v.length * 0.62))))}" font-weight="800" letter-spacing="-1" fill="${t.text}" text-anchor="middle">${v}</text>`;
  // racha actual (protagonista): anillo con número
  const R = 36, cy = 72, len = 2 * Math.PI * R; const pct = Math.min(1, s.current / Math.max(1, s.longest));
  o += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${t.hair[0]}" stroke-opacity="${t.id === 'dark' ? 0.14 : 0.16}" stroke-width="7"/>`;
  if (pct > 0) o += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#fire)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${r1(len)}" stroke-dashoffset="${r1(len * (1 - pct))}" transform="rotate(-90 ${cx} ${cy})"/>`;
  o += num(cy + 9, fmt(s.current), 28, 60);
  if (s.current > 0) o += `<circle cx="${cx}" cy="${cy - R}" r="10" fill="url(#fire)"/>${icon('flame', cx - 6, cy - R - 7, 12, '#fff')}`;
  o += label(62, `Current streak · ${s.current === 1 ? 'day' : 'days'}`) + dates(84, s.current > 0 ? range(s.currentFrom, s.currentTo, true, d.now, { short: true }) : 'No active streak');
  o += hair(c, MX, 126, MR);
  o += num(180, fmt(s.longest)) + label(166, `Longest streak · ${s.longest === 1 ? 'day' : 'days'}`) + dates(188, range(s.longestFrom, s.longestTo, false, d.now, { short: true }));
  o += hair(c, MX, 224, MR);
  o += num(278, fmt(s.total)) + label(264, 'Total contributions') + dates(286, since(s.totalFrom, d.now, { short: true }));
  return mFinish(c, o);
}

const M_PRS_PER_REPO = 2;
function prsM(d, t) {
  if (t.id === 'dark') t = { ...t, closed: '#ff9a93' }; // AA sobre la tarjeta interna a 13 px
  const P = d.prs; const now = d.now; const repos = P.repos; const empty = P.total === 0; const ST = stateOf(t);
  const pad = 12, cardX = MX - 4, cardW = MI + 8, titleX = cardX + pad + 22, titleW = cardW - pad * 2 - 22;
  const cards = repos.map((r) => ({ r, items: r.recent.slice(0, M_PRS_PER_REPO).map((p) => ({ p, lines: mWrap(p.title, titleW, 14, 2) })) }));
  const itemH = (it) => it.lines.length * 18 + 18 + 12; const cardH = (cd) => 84 + cd.items.reduce((a, it) => a + itemH(it), 0);
  const more = Math.max(0, (P.reposTotal || repos.length) - repos.length);
  const top = 202; const body = empty ? 150 : cards.reduce((a, cd) => a + cardH(cd) + 10, 0);
  const H = top + body + (more ? 28 : 0) + 8;
  const c = ctx(t, MW, H, 'Open source contributions', `${P.total} pull requests, ${P.merged} merged, ${P.open} open, ${P.closed} closed, in other people's repositories`);
  let o = mFrame(c, H) + mHeader(c, 'Open Source PRs', mIcon('merge'), "in other people's repositories");
  const tot = fmt(P.total);
  o += `<text x="${MX}" y="110" class="s n" font-size="40" font-weight="800" letter-spacing="-1" fill="url(#gefy)">${tot}</text>`;
  const lx0 = MX + tw(tot, 40, { bold: true }) + 8;
  o += tx(lx0, 94, P.total === 1 ? 'pull request' : 'pull requests', { sz: 14, w: 700, fill: t.text });
  if (P.ownTotal > 0) o += tx(lx0, 112, `+ ${fmt(P.ownTotal)} in own repos`, { sz: 13, fill: t.text3 });
  const parts = [['merged', P.merged], ['open', P.open], ['closed', P.closed]];
  const bar = (x, y, w, h, vals, total) => { const v = vals.filter(([, n]) => n > 0); let bx = x; const us = w - 2 * Math.max(0, v.length - 1); return v.map(([k, n]) => { const ww = Math.max(4, (n / total) * us); const s = `<rect x="${r1(bx)}" y="${y}" width="${r1(ww)}" height="${h}" rx="${h / 2}" fill="${ST[k].col}"/>`; bx += ww + 2; return s; }).join(''); };
  o += empty ? `<rect x="${MX}" y="126" width="${MI}" height="8" rx="4" fill="${t.hair[0]}" opacity="${t.hair[1] * 1.3}"/>` : bar(MX, 126, MI, 8, parts, P.total);
  let lx = MX; parts.forEach(([k, v]) => { const lab = `${fmt(v)} ${k}`; o += `<circle cx="${lx + 4}" cy="155" r="4.5" fill="${ST[k].col}"/>` + tx(lx + 14, 160, lab, { sz: 14, w: 700, fill: t.text }); lx += 14 + tw(lab, 14, { bold: true }) + 14; });
  if (!empty) o += tx(MX, 186, `${repos.length} of ${P.reposTotal || repos.length} repos · latest ${M_PRS_PER_REPO} PRs each`, { sz: 13, fill: t.text3 });
  if (empty) {
    o += icon('pr', MW / 2 - 14, top + 20, 28, t.text3) + tx(MW / 2, top + 80, 'No pull requests yet', { sz: 15, w: 700, fill: t.text, anchor: 'middle' });
    o += tx(MW / 2, top + 104, 'They will show up automatically.', { sz: 13, fill: t.text3, anchor: 'middle' });
    return mFinish(c, o);
  }
  let y = top;
  cards.forEach((cd) => {
    const r = cd.r, h = cardH(cd);
    o += sub(c, cardX, y, cardW, h, 14) + monogram(c, cardX + pad + 14, y + 26, 14, r.owner[0], r.avatarDataUri);
    const nPr = `${r.total} ${r.total === 1 ? 'PR' : 'PRs'}`, nMg = `${r.merged} merged`; const rightW = Math.max(tw(nPr, 16, { bold: true }), tw(nMg, 13, { bold: true })) * 1.08;
    const nameX = cardX + pad + 36, nameW = cardX + cardW - pad - rightW - 8 - nameX;
    o += tx(nameX, y + 21, fitM(`${r.owner}/`, nameW, 13), { sz: 13, fill: t.text3 }) + tx(nameX, y + 40, fitM(r.name, nameW, 15, { bold: true }), { sz: 15, w: 700, fill: t.text });
    o += tx(cardX + cardW - pad, y + 22, nPr, { sz: 16, w: 800, fill: t.text, anchor: 'end', cls: 'n' }) + tx(cardX + cardW - pad, y + 40, nMg, { sz: 13, w: 700, fill: r.merged ? t.merged : t.text3, anchor: 'end', cls: 'n' });
    let mx = cardX + pad;
    if (r.language) { const lt = trunc(r.language, 110, 13); o += `<circle cx="${mx + 4}" cy="${y + 57}" r="4" fill="${r.langColor || t.text3}"/>` + tx(mx + 13, y + 62, lt, { sz: 13, fill: t.text2 }); mx += 13 + tw(lt, 13) + 14; }
    if (r.stars != null) o += icon('star', mx, y + 51, 12, t.fire1) + tx(mx + 16, y + 62, compact(r.stars), { sz: 13, fill: t.text2, cls: 'n' });
    o += bar(cardX + pad, y + 72, cardW - pad * 2, 4, [['merged', r.merged], ['open', r.open], ['closed', r.closed]], Math.max(1, r.total));
    let ry = y + 88;
    cd.items.forEach((it, i) => {
      const st = ST[it.p.state];
      if (i > 0) o += hair(c, cardX + pad, ry - 6, cardX + cardW - pad);
      o += icon(st.ic, cardX + pad, ry + 1, 14, st.col);
      it.lines.forEach((l, j) => { o += tx(titleX, ry + 13 + j * 18, l, { sz: 14, w: 500, fill: t.text }); });
      const my = ry + 13 + it.lines.length * 18;
      o += `<text x="${titleX}" y="${my}" class="s" font-size="13" fill="${t.text3}"><tspan fill="${st.col}" font-weight="700">${st.label}</tspan> · #${it.p.n} · ${esc(rel(it.p.at, now))}</text>`;
      ry += itemH(it);
    });
    y += h + 10;
  });
  if (more) o += tx(MW / 2, y + 14, `+ ${more} more ${more === 1 ? 'repository' : 'repositories'}`, { sz: 13, w: 700, fill: t.text2, anchor: 'middle' });
  return mFinish(c, o);
}

function activity3dM(d, t) {
  const raw = d.embeds?.threeD?.[t.id];
  if (!raw) throw new Error('falta el SVG del 3D');
  const e = parse3d(raw);
  const vb = [10, 134, 1216, 702]; const gw = MW - 24; const gh = Math.round(vb[3] * (gw / vb[2]));
  const top = 128; const H = top + gh + 42;
  const rangeS = e.from && e.to ? `${prettyDate(e.from)} – ${prettyDate(e.to)}` : '';
  const c = ctx(t, MW, H, '3D contribution graph', `Contribution calendar of the last 12 months${e.total != null ? `, ${e.total} contributions` : ''}`);
  let o = mFrame(c, H) + mHeader(c, '3D Contribution Graph', mIcon('commit'), rangeS || 'last 12 months');
  c.defs.push(`<style>${e.style}</style>`);
  if (e.total != null) { const n = fmt(e.total); o += `<text x="${MX}" y="106" class="s n" font-size="36" font-weight="800" letter-spacing="-1" fill="url(#gefy)">${n}</text>`; const nx = MX + tw(n, 36, { bold: true }) + 10; o += tx(nx, 90, 'contributions', { sz: 14, w: 700, fill: t.text }) + tx(nx, 108, 'last 12 months', { sz: 13, fill: t.text3 }); }
  o += `<svg x="12" y="${top}" width="${gw}" height="${gh}" viewBox="${vb.join(' ')}">${stripAnimations(e.cubes)}</svg>`;
  const ly = top + gh + 18; let lx = MX;
  o += tx(lx, ly, 'Less', { sz: 13, fill: t.text3 }); lx += tw('Less', 13) + 10;
  e.levels.forEach((col) => { if (col) o += `<rect x="${lx}" y="${ly - 11}" width="12" height="12" rx="3" fill="${col}"/>`; lx += 16; });
  o += tx(lx + 4, ly, 'More', { sz: 13, fill: t.text3 });
  return mFinish(c, o);
}

// La snake se parte en dos mitades apiladas (primer y segundo semestre): las celdas quedan al doble de tamaño.
function snakeWidgetM(d, t) {
  const raw = d.embeds?.snake;
  if (!raw) throw new Error('falta el SVG de la snake');
  const sn = prepSnake(raw, t.id);
  const [vx, vy, vw, vh] = sn.viewBox; const half = vw / 2; const gh = Math.round(vh * (MI / half));
  const H = 76 + gh * 2 + 8 + 18;
  const c = ctx(t, MW, H, 'Contribution snake', 'Animated snake eating the contribution calendar of the last 12 months');
  let o = mFrame(c, H) + mHeader(c, 'Contribution Snake', mIcon('flame'), 'eats the last 12 months');
  c.defs.push(`<style>${sn.css}</style>`);
  [0, 1].forEach((i) => { o += `<svg x="${MX}" y="${74 + i * (gh + 8)}" width="${MI}" height="${gh}" viewBox="${vx + i * half} ${vy} ${half} ${vh}">${sn.inner}</svg>`; });
  return mFinish(c, o, false);
}

export const embedWidgets = { '3d': activity3d, snake: snakeWidget };
export const embedMobile = { '3d': activity3dM, snake: snakeWidgetM };

export const widgets = { hero, stack, stats, langs, streak, prs };
export const mobileWidgets = {
  hero: heroM,
  stack: stackM,
  stats: statsM,
  langs: langsM,
  streak: streakM,
  prs: prsM
};
export const THEME_IDS = Object.keys(THEMES);

export function render(name, data, themeId, { sample = false, mobile = false } = {}) {
  const fn = mobile ? (mobileWidgets[name] || embedMobile[name]) : (widgets[name] || embedWidgets[name]);
  const theme = THEMES[themeId];
  if (!fn || !theme) throw new Error(`widget o tema desconocido: ${name}/${themeId}`);
  SAMPLE_MODE.on = sample;
  try {
    return fn(data, theme);
  } finally {
    SAMPLE_MODE.on = false;
  }
}
