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
