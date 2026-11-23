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
  assert.equal(computeLanguages(repos, { top: 10, includePrivate: 'aggregate' }).items.some((i) => i.name === 'Zig'), true);
  assert.equal(computeLanguages(repos, { top: 10, excludeRepos: ['A'], excludeLanguages: ['rust'] }).items.some((i) => i.name === 'Rust'), false);
});

test('lenguajes: vacio, bytes invalidos y nombres repetidos', () => {
  assert.deepEqual(computeLanguages([]), { total: 0, items: [] });
  assert.deepEqual(computeLanguages([repo('x', [['A', 0], ['B', -1], ['C', NaN]])]), { total: 0, items: [] });
  assert.equal(computeLanguages([null, {}, repo('x', [[undefined, 5]])]).items.length, 0);
});

test('PRs: totales, propios vs ajenos, privados nunca en los totales', () => {
  const own = { nameWithOwner: 'me/own', isPrivate: false, isFork: false, stargazerCount: 2, owner: { login: 'Me' } };
  const ext = { nameWithOwner: 'x/ext', isPrivate: false, isFork: false, stargazerCount: 900, owner: { login: 'x' } };
  const priv = { nameWithOwner: 'me/secret', isPrivate: true, isFork: false, stargazerCount: 0, owner: { login: 'me' } };
  const prs = [
    pr({ number: 1, repository: own }), pr({ number: 2, repository: own, state: 'OPEN', merged: false }),
    pr({ number: 3, repository: ext }), pr({ number: 4, repository: ext, state: 'CLOSED', merged: false }),
    pr({ number: 5, repository: priv }), pr({ number: 6, repository: priv, state: 'OPEN', merged: false })
  ];
  const off = groupPullRequests(prs, { login: 'me' });
  assert.deepEqual([off.totals.total, off.totals.merged, off.totals.open, off.totals.closed], [4, 2, 1, 1]);
  assert.deepEqual([off.totals.external.total, off.totals.own.total], [2, 2]);
  assert.equal(off.private, null);
  assert.equal(JSON.stringify(off).includes('secret'), false);
  const agg = groupPullRequests(prs, { login: 'me', includePrivate: 'aggregate' });
  assert.deepEqual(agg.totals, off.totals);
  assert.deepEqual([agg.private.total, agg.private.merged, agg.private.open], [2, 1, 1]);
  assert.equal(JSON.stringify(agg).includes('secret'), false);
});

test('PRs: por repo ordenado, ultimos 3 por fecha, limite de repos y repos ocultos', () => {
  const mk = (name, n, stars = 0) => Array.from({ length: n }, (_, i) => pr({ number: i + 1, title: `t${i}`, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, repository: { nameWithOwner: name, isPrivate: false, isFork: false, stargazerCount: stars, owner: { login: name.split('/')[0] } } }));
  const prs = [...mk('a/one', 5), ...mk('b/two', 7), ...mk('c/three', 1)];
  const g = groupPullRequests(prs, { login: 'me', maxRepos: 2, lastPerRepo: 3 });
  assert.deepEqual(g.repos.map((r) => r.repo), ['b/two', 'a/one']);
  assert.equal(g.hiddenRepos, 1);
  assert.equal(g.repoCount, 3);
  assert.deepEqual(g.repos[0].last.map((p) => p.number), [7, 6, 5]);
  assert.equal(g.repos[0].total, 7);
  assert.equal(groupPullRequests(prs, { login: 'me', maxRepos: 0 }).repos.length, 0);
});

test('PRs: lista vacia, entradas invalidas y drafts', () => {
  const g = groupPullRequests([], { login: 'me' });
  assert.equal(g.totals.total, 0);
  assert.deepEqual(g.repos, []);
  assert.equal(groupPullRequests([null, {}, { repository: {} }], { login: 'me' }).totals.total, 0);
  const d = groupPullRequests([pr({ state: 'OPEN', merged: false, isDraft: true })], { login: 'me' });
  assert.equal(d.repos[0].last[0].draft, true);
  assert.equal(d.totals.open, 1);
});

test('stats: usa repos publicos no excluidos y tolera datos faltantes', () => {
  const s = computeStats({ user: { login: 'me', contributionsCollection: { totalCommitContributions: 10 } }, repos: [repo('a', [], { stargazerCount: 5 }), repo('b', [], { stargazerCount: 7, isPrivate: true }), repo('c', [], { stargazerCount: 1 })], prSummary: groupPullRequests([], { login: 'me' }), streak: computeStreak([]), excludeRepos: ['C'] });
  assert.equal(s.stars, 5);
  assert.equal(s.publicRepos, 1);
  assert.equal(s.commitsLastYear, 10);
  assert.equal(s.reviews, 0);
  assert.equal(computeStats({}).stars, 0);
});
