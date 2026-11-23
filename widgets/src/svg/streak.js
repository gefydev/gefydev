import { esc, fmtNumber, frame } from './kit.js';

const range = (a, b) => (a && b ? (a === b ? a : `${a} → ${b}`) : '—');

export function renderStreak(streak, theme) {
  const width = 495;
  const height = 150;
  const colW = (width - 48) / 3;
  const cols = [
    { n: fmtNumber(streak.total), label: 'Total Contributions', sub: streak.since || streak.firstDate ? `since ${streak.since || streak.firstDate}` : '—' },
    { n: fmtNumber(streak.current.length), label: 'Current Streak', sub: range(streak.current.start, streak.current.end), hot: streak.current.length > 0 },
    { n: fmtNumber(streak.longest.length), label: 'Longest Streak', sub: range(streak.longest.start, streak.longest.end) }
  ];
  let body = '';
  cols.forEach((c, i) => {
    const cx = 24 + colW * i + colW / 2;
    if (i > 0) body += `<line x1="${24 + colW * i}" y1="32" x2="${24 + colW * i}" y2="${height - 32}" stroke="${theme.border}"/>\n`;
    body += `<text x="${cx}" y="76" text-anchor="middle" class="n"${c.hot ? ` style="fill:${theme.warn}"` : ''}>${esc(c.n)}</text>`;
    body += `<text x="${cx}" y="100" text-anchor="middle" class="b">${esc(c.label)}</text>`;
    body += `<text x="${cx}" y="120" text-anchor="middle" class="m s">${esc(c.sub)}</text>\n`;
  });
  return frame({ width, height, theme, title: 'Contribution streak', desc: cols.map((c) => `${c.label}: ${c.n}`).join(', '), body, id: 'streak' });
}
