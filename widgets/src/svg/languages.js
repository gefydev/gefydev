import { esc, fmtNumber, frame } from './kit.js';

export function renderLanguages(langs, theme) {
  const width = 400;
  const items = langs.items || [];
  const rowsPerCol = Math.max(1, Math.ceil(items.length / 2));
  const height = items.length ? 92 + rowsPerCol * 24 : 110;
  const barX = 24;
  const barW = width - 48;
  const colorOf = (l) => (l.name === 'Other' ? theme.otherColor : l.color || theme.fallbackLanguageColor);
  let body = `<text x="24" y="34" class="t">Top Languages</text>\n`;
  if (!items.length) {
    body += `<text x="24" y="72" class="m">No language data</text>`;
    return frame({ width, height, theme, title: 'Top languages', desc: 'No language data', body, id: 'langs' });
  }
  let x = barX;
  const clipId = 'langs-clip';
  const segs = items
    .map((l, i) => {
      const w = i === items.length - 1 ? barX + barW - x : Math.max(1, (l.percent / 100) * barW);
      const seg = `<rect x="${x.toFixed(2)}" y="50" width="${Math.max(0, w).toFixed(2)}" height="10" fill="${colorOf(l)}"/>`;
      x += w;
      return seg;
    })
    .join('');
  body += `<clipPath id="${clipId}"><rect x="${barX}" y="50" width="${barW}" height="10" rx="5"/></clipPath><g clip-path="url(#${clipId})">${segs}</g>\n`;
  items.forEach((l, i) => {
    const col = i < rowsPerCol ? 0 : 1;
    const row = col === 0 ? i : i - rowsPerCol;
    const cx = 24 + col * 188;
    const y = 90 + row * 24;
    const label = l.name === 'Other' && l.count ? `Other (${fmtNumber(l.count)})` : l.name;
    body += `<circle cx="${cx + 5}" cy="${y - 4}" r="5" fill="${colorOf(l)}"/><text x="${cx + 18}" y="${y}">${esc(label.length > 16 ? `${label.slice(0, 15)}…` : label)}</text><text x="${cx + 168}" y="${y}" text-anchor="end" class="m s">${l.percent.toFixed(1)}%</text>\n`;
  });
  return frame({ width, height, theme, title: 'Top languages', desc: items.map((l) => `${l.name} ${l.percent.toFixed(1)}%`).join(', '), body, id: 'langs' });
}
