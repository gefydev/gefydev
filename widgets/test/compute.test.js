import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLanguages, computeStats, computeStreak, groupPullRequests } from '../src/compute.js';
import { day, pr, repo } from './helpers.js';

const days = (counts, base) => counts.map((count, i) => ({ date: day(i, base), count }));

test('racha: sin datos', () => {
  const s = computeStreak([]);
  assert.deepEqual([s.total, s.current.length, s.longest.length], [0, 0, 0]);
  assert.equal(computeStreak(undefined).firstDate, null);
  assert.equal(computeStreak([{ date: 'basura', count: 3 }, null]).total, 0);
});

test('racha: actual y mas larga, con cortes', () => {
  const s = computeStreak(days([1, 1, 1, 0, 2, 2, 0, 1, 1, 1, 1]));
  assert.equal(s.total, 11);
  assert.deepEqual(s.longest, { start: day(7), end: day(10), length: 4 });
  assert.deepEqual(s.current, { start: day(7), end: day(10), length: 4 });
});

test('racha: el dia en curso sin contribuciones no corta la racha, pero un dia anterior vacio si', () => {
  const alive = computeStreak(days([1, 1, 1, 0]));
  assert.equal(alive.current.length, 3);
  assert.equal(alive.current.end, day(2));
  const dead = computeStreak(days([1, 1, 0, 0]));
  assert.equal(dead.current.length, 0);
  assert.equal(dead.longest.length, 2);
  assert.equal(computeStreak(days([0, 0, 0])).current.length, 0);
});

test('racha: fechas desordenadas y repetidas entre anios no se suman dos veces', () => {
  const s = computeStreak([{ date: day(2), count: 5 }, { date: day(0), count: 1 }, { date: day(1), count: 2 }, { date: day(1), count: 2 }]);
  assert.equal(s.total, 8);
  assert.equal(s.longest.length, 3);
});

test('racha: anio completo de contribuciones', () => {
  const s = computeStreak(days(Array(366).fill(1), '2024-01-01'));
  assert.equal(s.current.length, 366);
  assert.equal(s.longest.length, 366);
});

test('lenguajes: agrega, ordena, agrupa el resto en Other y excluye forks y privados', () => {
  const repos = [
    repo('a', [['TS', 600, '#3178c6'], ['CSS', 100, '#563d7c']]),
    repo('b', [['TS', 300, '#3178c6'], ['Rust', 200, '#dea584']]),
    repo('fork', [['Go', 99999, '#00add8']], { isFork: true }),
    repo('priv', [['Zig', 50000, '#ec915c']], { isPrivate: true }),
    repo('c', [['Lua', 5, null], ['Perl', 5, null], ['Vim', 5, null]])
  ];
  const l = computeLanguages(repos, { top: 3 });
  assert.deepEqual(l.items.map((i) => i.name), ['TS', 'Rust', 'CSS', 'Other']);
  assert.equal(l.items[0].bytes, 900);
  assert.equal(l.items.at(-1).count, 3);
  assert.ok(Math.abs(l.items.reduce((s, i) => s + i.percent, 0) - 100) < 1e-9);
  assert.equal(computeLanguages(repos, { top: 10 }).items.some((i) => i.name === 'Zig'), false);
  assert.equal(computeLanguages(repos, { top: 10, excludeRepos: ['A'], excludeLanguages: ['rust'] }).items.some((i) => i.name === 'Rust'), false);
});

test('lenguajes: vacio, bytes invalidos y nombres repetidos', () => {
  assert.deepEqual(computeLanguages([]), { total: 0, items: [] });
  assert.deepEqual(computeLanguages([repo('x', [['A', 0], ['B', -1], ['C', NaN]])]), { total: 0, items: [] });
  assert.equal(computeLanguages([null, {}, repo('x', [[undefined, 5]])]).items.length, 0);
});

const mkRepo = (nameWithOwner, extra = {}) => ({ nameWithOwner, isPrivate: false, isFork: false, stargazerCount: 7, url: `https://github.com/${nameWithOwner}`, primaryLanguage: { name: 'Rust', color: '#dea584' }, owner: { login: nameWithOwner.split('/')[0], avatarUrl: 'https://avatars.githubusercontent.com/u/1?s=60' }, ...extra });

test('PRs: el titular es solo repos ajenos; los propios van aparte y los privados no cuentan en nada', () => {
  const own = mkRepo('Me/own');
  const ext = mkRepo('x/ext', { stargazerCount: 900 });
  const priv = mkRepo('me/secret', { isPrivate: true });
  const prs = [
    pr({ number: 1, repository: own }), pr({ number: 2, repository: own, state: 'OPEN', merged: false }),
    pr({ number: 3, repository: ext }), pr({ number: 4, repository: ext, state: 'CLOSED', merged: false }),
    pr({ number: 5, repository: priv }), pr({ number: 6, repository: priv, state: 'OPEN', merged: false })
  ];
  const g = groupPullRequests(prs, { login: 'me' });
  assert.deepEqual([g.external.total, g.external.merged, g.external.open, g.external.closed], [2, 1, 0, 1]);
  assert.deepEqual([g.own.total, g.own.merged, g.own.open], [2, 1, 1]);
  assert.equal(g.reposTotal, 1);
  assert.deepEqual(g.repos.map((r) => r.name), ['ext']);
  assert.equal(g.repos[0].owner, 'x');
  assert.equal(g.repos[0].language, 'Rust');
  assert.equal(g.repos[0].stars, 900);
  assert.equal(JSON.stringify(g).includes('secret'), false);
  assert.equal(JSON.stringify(g).includes('own'), true);
});

test('PRs: repos ordenados por merged desc (desempate por PR mas reciente), maximo 6, ultimos 3 por fecha', () => {
  const mk = (name, merged, closed, newestDay) => [
    ...Array.from({ length: merged }, (_, i) => pr({ number: i + 1, createdAt: `2026-01-${String(newestDay - i > 0 ? newestDay - i : 1).padStart(2, '0')}T00:00:00Z`, repository: mkRepo(name) })),
    ...Array.from({ length: closed }, (_, i) => pr({ number: 100 + i, state: 'CLOSED', merged: false, createdAt: '2026-01-01T00:00:00Z', repository: mkRepo(name) }))
  ];
  const prs = [...mk('a/many-closed', 2, 9, 5), ...mk('b/most-merged', 5, 0, 10), ...mk('c/tie-new', 2, 0, 20), ...mk('d/tie-old', 2, 0, 3), ...mk('e/one', 1, 0, 2), ...mk('f/two', 1, 1, 2), ...mk('g/three', 1, 0, 1), ...mk('h/four', 1, 0, 1)];
  const g = groupPullRequests(prs, { login: 'me', maxRepos: 6 });
  assert.deepEqual(g.repos.slice(0, 4).map((r) => r.name), ['most-merged', 'tie-new', 'many-closed', 'tie-old']);
  assert.equal(g.repos.length, 6);
  assert.equal(g.reposTotal, 8);
  assert.deepEqual(g.repos[0].recent.map((p) => p.n), [1, 2, 3]);
  assert.equal(g.repos[0].recent.length, 3);
  assert.equal(groupPullRequests(prs, { login: 'me', maxRepos: 0 }).repos.length, 0);
});

test('PRs: lista vacia, entradas invalidas y repos propios con otra capitalizacion', () => {
  const g = groupPullRequests([], { login: 'me' });
  assert.equal(g.external.total, 0);
  assert.deepEqual(g.repos, []);
  assert.equal(groupPullRequests([null, {}, { repository: {} }], { login: 'me' }).external.total, 0);
  const g2 = groupPullRequests([pr({ repository: mkRepo('ME/Mine') })], { login: 'me' });
  assert.equal(g2.own.total, 1);
  assert.equal(g2.external.total, 0);
});

test('stats: usa repos publicos no excluidos y tolera datos faltantes', () => {
  const s = computeStats({ user: { login: 'me', contributionsCollection: { totalCommitContributions: 10 } }, repos: [repo('a', [], { stargazerCount: 5 }), repo('b', [], { stargazerCount: 7, isPrivate: true }), repo('c', [], { stargazerCount: 1 })], prSummary: groupPullRequests([], { login: 'me' }), streak: computeStreak([]), excludeRepos: ['C'] });
  assert.equal(s.stars, 5);
  assert.equal(s.publicRepos, 1);
  assert.equal(s.commitsLastYear, 10);
  assert.equal(s.reviews, 0);
  assert.equal(computeStats({}).stars, 0);
});
