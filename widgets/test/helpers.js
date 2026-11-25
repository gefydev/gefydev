import assert from 'node:assert/strict';

export function assertWellFormed(xml) {
  assert.match(xml, /^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(xml, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  assert.doesNotMatch(xml, /&(?!(amp|lt|gt|quot|#39);)/, 'entidad sin escapar');
  assert.doesNotMatch(xml, /<script|javascript:|on\w+="/i);
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>|<!--[\s\S]*?-->|<[^>]*>/g;
  let m;
  let last = 0;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index);
    assert.doesNotMatch(between, /</, `texto con < sin escapar: ${between.slice(0, 40)}`);
    last = re.lastIndex;
    if (!m[2]) {
      assert.ok(m[0].startsWith('<!--'), `tag mal formado: ${m[0].slice(0, 60)}`);
      continue;
    }
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], `cierre inesperado </${m[2]}>`);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}

export const day = (n, base = '2026-01-01') => new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function pr(over = {}) {
  return { number: 1, title: 'feat: algo', state: 'MERGED', merged: true, isDraft: false, createdAt: '2026-01-01T10:00:00Z', url: 'https://github.com/o/r/pull/1', repository: { nameWithOwner: 'o/r', isPrivate: false, isFork: false, stargazerCount: 5, url: 'https://github.com/o/r', owner: { login: 'o' } }, ...over };
}

export function repo(name, langs = [], over = {}) {
  return { name, isPrivate: false, isFork: false, stargazerCount: 0, languages: { edges: langs.map(([n, size, color]) => ({ size, node: { name: n, color } })) }, ...over };
}

export const emptyRaw = () => ({ user: { login: 'me', name: 'Me', createdAt: '2020-01-01T00:00:00Z', followers: { totalCount: 0 }, issues: { totalCount: 0 }, repositoriesContributedTo: { totalCount: 0 }, contributionsCollection: { totalCommitContributions: 0, restrictedContributionsCount: 0, totalPullRequestReviewContributions: 0 } }, repos: [], prs: [], days: [] });

const cells = (n = 3) => Array.from({ length: n }, (_, i) => `<g transform="translate(${140 + i * 20} ${154 + i * 8})"><animateTransform attributeName="transform" type="translate" values="${140 + i * 20} 160;${140 + i * 20} ${154 + i * 8}" dur="3s" repeatCount="1"></animateTransform><rect stroke="none" x="0" y="0" width="18" height="18" class="cont-top-${i % 5}"></rect><rect stroke="none" x="0" y="0" width="18" height="12" class="cont-left-${i % 5}"><animate attributeName="height" values="2.6;12" dur="3s" repeatCount="1"></animate></rect></g>`).join('');

export function mini3d({ total = 1266, withTotals = true } = {}) {
  const style = `<style>* { font-family: "Ubuntu", "Helvetica", "Arial", sans-serif; }\n.fill-fg { fill: #eeeeff; }\n.fill-bg { fill: #00000f; }\n.stroke-bg { stroke: #00000f; }\n.fill-strong { fill: #ffb972; }\n.fill-weak { fill: #aaaaaa; }\n.radar { stroke-width: 4px; }\n.cont-top-0 { fill: #262f5c; }\n.cont-top-1 { fill: rgb(15, 110, 120); }\n.cont-top-2 { fill: #0db7b9; }\n.cont-top-3 { fill: #6f9bf5; }\n.cont-top-4 { fill: #b49cff; }\n.cont-left-0 { fill: #1a2247; }</style>`;
  const radar = '<g transform="translate(980, 284.5)"><text class="fill-fg">Commit</text><text class="fill-strong">PullReq 84 RADAR-MARK</text></g>';
  const donut = '<g transform="translate(40, 520)"><g><text class="fill-fg">Rust DONUT-MARK</text></g></g>';
  const totals = withTotals ? `<g><text class="fill-strong">${total}</text><text class="fill-fg">contributions</text><text class="fill-weak">2025-11-23 / 2026-11-23</text></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="850" viewBox="0 0 1280 850">${style}<rect x="0" y="0" width="1280" height="850" class="fill-bg"></rect><g>${cells(5)}</g>${radar}${donut}${totals}</svg>`;
}

export function miniSnake() {
  return `<svg viewBox="-16 -32 880 192" width="880" height="192" xmlns="http://www.w3.org/2000/svg"><desc>Generated with https://github.com/Platane/snk</desc><style>:root{--cb:#1b1f230a;--cs:purple;--ce:#161b22;--c0:#161b22;--c1:#01311f;--c2:#034525;--c3:#0f6d31;--c4:#00c647}.c{shape-rendering:geometricPrecision;fill:var(--ce);stroke-width:1px;stroke:var(--cb);animation:none 52700ms linear infinite;width:12px;height:12px}@keyframes c0{25.8%{fill:var(--c1)}25.82%,100%{fill:var(--ce)}}.c.c0{fill:var(--c1);animation-name:c0}@keyframes c0a{10%{fill:var(--c2)}10.02%,100%{fill:var(--ce)}}.c.c1{fill:var(--c2);animation-name:c0a}.u{transform-origin:0 0;transform:scale(0,1);animation:none 52700ms linear infinite}@keyframes u0{0%,31%{transform:scale(1,1)}32%,100%{transform:scale(0,1)}}.u.u0{fill:var(--c1);animation-name:u0}.s{shape-rendering:geometricPrecision;fill:var(--cs);animation:none 52700ms linear infinite}@keyframes s0{0%{transform:translate(0px,0px)}100%{transform:translate(16px,0px)}}.s.s0{transform:translate(0px,0px);animation-name:s0}</style><rect class="c" x="2" y="2" rx="2" ry="2"/><rect class="c c0" x="2" y="18" rx="2" ry="2"/><rect class="c c1" x="18" y="2" rx="2" ry="2"/><rect class="u u0" height="12" width="158.4" x="2" y="144"/><rect class="s s0" x="0.8" y="0.8" width="14.4" height="14.4" rx="4.5" ry="4.5"/></svg>`;
}
