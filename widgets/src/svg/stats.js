import { esc, fmtNumber, frame, truncate } from './kit.js';

export function renderStats(stats, theme) {
  const rows = [
    ['Total Stars Earned', fmtNumber(stats.stars)],
    ['Commits (last 12 months)', fmtNumber(stats.commitsLastYear)],
    ['Pull Requests', fmtNumber(stats.prs.total)],
    ['PRs Merged', fmtNumber(stats.prs.merged)],
    ['Code Reviews', fmtNumber(stats.reviews)],
    ['Issues', fmtNumber(stats.issues)],
    ['Contributed to', fmtNumber(stats.contributedTo)]
  ];
  const width = 495;
  const top = 62;
  const step = 25;
  const height = top + rows.length * step + 12;
  const name = truncate(stats.name || stats.login || 'GitHub', width - 48, 17);
  const lines = rows
    .map(([label, value], i) => {
      const y = top + i * step;
      return `<circle cx="32" cy="${y - 4}" r="3" fill="${theme.title}"/><text x="46" y="${y}">${esc(label)}</text><text x="${width - 28}" y="${y}" text-anchor="end" class="b">${esc(value)}</text>`;
    })
    .join('\n');
  const body = `<text x="24" y="34" class="t">${esc(name)}'s GitHub Stats</text>\n${lines}`;
  return frame({ width, height, theme, title: `${stats.name || stats.login} GitHub stats`, desc: rows.map((r) => `${r[0]}: ${r[1]}`).join(', '), body, id: 'stats' });
}
