const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

const NARROW = new Set("iljtfI.,:;|!'`()[]{} ".split(''));
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]|[\u{1F300}-\u{1FAFF}]|[☀-➿]/u;

export function textWidth(text, size = 12) {
  let w = 0;
  for (const ch of String(text ?? '')) {
    if (WIDE.test(ch)) w += 1.0;
    else if (NARROW.has(ch)) w += 0.32;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[mwMW@%]/.test(ch)) w += 0.85;
    else w += 0.56;
  }
  return w * size;
}

export function truncate(text, maxWidth, size = 12) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (maxWidth <= 0) return '';
  if (textWidth(s, size) <= maxWidth) return s;
  const chars = [...s];
  let out = '';
  for (const ch of chars) {
    if (textWidth(`${out}${ch}…`, size) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

export const fmtNumber = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '0');

export const fmtDate = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
};

export function frame({ width, height, theme, title, desc = '', body, id = 'w' }) {
  const r = theme.radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(desc)}</desc>
<style>
text{font-family:${theme.font};fill:${theme.text};font-size:13px}
.t{font-size:17px;font-weight:600;fill:${theme.title}}
.m{fill:${theme.muted}}
.s{font-size:11px}
.b{font-weight:600}
.n{font-size:26px;font-weight:700;fill:${theme.accent}}
.mono{font-family:${theme.mono}}
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${r}" fill="${theme.bg}" stroke="${theme.border}"/>
${body}
</svg>
`;
}
