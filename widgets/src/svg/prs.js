import { esc, fmtDate, fmtNumber, frame, truncate } from './kit.js';

const stateColor = (theme, s) => (s === 'merged' ? theme.merged : s === 'open' ? theme.open : theme.closed);

export function renderPrs(summary, theme) {
  const width = 720;
  const head = 74;
  const blockH = (r) => 34 + Math.max(1, r.last.length) * 21 + 12;
  const repos = summary.repos || [];
  const footerLines = (summary.hiddenRepos ? 1 : 0) + (summary.private ? 1 : 0);
  const height = head + (repos.length ? repos.reduce((s, r) => s + blockH(r), 0) : 40) + footerLines * 24 + 14;
  const t = summary.totals;
  let body = `<text x="24" y="34" class="t">Pull Requests</text>\n`;
  body += `<text x="24" y="56" class="m s">${fmtNumber(t.total)} total · ${fmtNumber(t.merged)} merged · ${fmtNumber(t.open)} open · ${fmtNumber(t.closed)} closed — ${fmtNumber(t.external.total)} in other people's repos, ${fmtNumber(t.own.total)} in own repos</text>\n`;
  let y = head;
  if (!repos.length) body += `<text x="24" y="${y + 20}" class="m">No pull requests yet</text>\n`;
  for (const r of repos) {
    const headline = `In repo ${r.repo} — ${fmtNumber(r.total)} ${r.total === 1 ? 'PR' : 'PRs'}, ${fmtNumber(r.merged)} merged`;
    const stars = r.stars ? `★ ${fmtNumber(r.stars)}` : '';
    body += `<rect x="16" y="${y}" width="${width - 32}" height="${blockH(r) - 8}" rx="8" fill="${theme.panel}"/>\n`;
    body += `<text x="30" y="${y + 22}" class="b">${esc(truncate(headline, width - 140, 13))}</text>`;
    if (stars) body += `<text x="${width - 30}" y="${y + 22}" text-anchor="end" class="m s">${esc(stars)}</text>`;
    body += '\n';
    r.last.forEach((p, i) => {
      const ry = y + 44 + i * 21;
      const num = `#${p.number}`;
      const date = fmtDate(p.createdAt);
      const titleMax = width - 30 - 30 - 28 - 62 - 82;
      body += `<circle cx="36" cy="${ry - 4}" r="4" fill="${stateColor(theme, p.state)}"/>`;
      body += `<text x="48" y="${ry}" class="m s mono">${esc(num)}</text>`;
      body += `<text x="${48 + 56}" y="${ry}" class="s">${esc(truncate(p.title || '(no title)', titleMax, 11))}</text>`;
      body += `<text x="${width - 30}" y="${ry}" text-anchor="end" class="m s">${esc(`${p.draft && p.state === 'open' ? 'draft' : p.state} · ${date}`)}</text>\n`;
    });
    y += blockH(r);
  }
  if (!repos.length) y += 40;
  if (summary.hiddenRepos) {
    body += `<text x="24" y="${y + 16}" class="m s">+ ${fmtNumber(summary.hiddenRepos)} more ${summary.hiddenRepos === 1 ? 'repository' : 'repositories'}</text>\n`;
    y += 24;
  }
  if (summary.private) {
    const p = summary.private;
    body += `<text x="24" y="${y + 16}" class="m s">+ ${fmtNumber(p.total)} PRs in private repositories (${fmtNumber(p.merged)} merged)</text>\n`;
  }
  return frame({ width, height, theme, title: 'Pull request contributions', desc: `${t.total} pull requests, ${t.merged} merged, in ${summary.repoCount} repositories`, body, id: 'prs' });
}
