import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarQuery, fetchProfile, GraphQLError, makeClient, yearRanges } from '../src/github.js';

const res = (status, body) => new Response(JSON.stringify(body), { status });
const user = (extra = {}) => ({ login: 'me', name: 'Me', createdAt: '2025-06-01T00:00:00Z', followers: { totalCount: 1 }, issues: { totalCount: 0 }, repositoriesContributedTo: { totalCount: 0 }, contributionsCollection: {}, repositories: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }, ...extra });

test('cliente: exige token y no lo imprime en errores', async () => {
  assert.throws(() => makeClient({}), GraphQLError);
  const q = makeClient({ token: 'ghp_SECRETO123', fetchImpl: async () => res(401, { message: 'Bad credentials' }), retries: 0 });
  await assert.rejects(() => q('query{}'), (e) => e.status === 401 && !String(e.message).includes('SECRETO'));
});

test('cliente: reintenta 502 y rate limit secundario, y no reintenta 401/404', async () => {
  let n = 0;
  const q = makeClient({ token: 't', baseDelayMs: 1, retries: 3, fetchImpl: async () => (++n < 3 ? res(502, {}) : res(200, { data: { ok: true } })) });
  assert.deepEqual(await q('q'), { ok: true });
  assert.equal(n, 3);
  n = 0;
  const q2 = makeClient({ token: 't', baseDelayMs: 1, retries: 2, fetchImpl: async () => (++n < 2 ? res(403, { message: 'You have exceeded a secondary rate limit' }) : res(200, { data: { ok: 1 } })) });
  assert.deepEqual(await q2('q'), { ok: 1 });
  n = 0;
  const q3 = makeClient({ token: 't', baseDelayMs: 1, retries: 3, fetchImpl: async () => (n++, res(404, { message: 'nope' })) });
  await assert.rejects(() => q3('q'));
  assert.equal(n, 1);
  n = 0;
  const q4 = makeClient({ token: 't', baseDelayMs: 1, retries: 2, fetchImpl: async () => (n++, res(500, {})) });
  await assert.rejects(() => q4('q'));
  assert.equal(n, 3);
});

test('cliente: errores de red se reintentan, errores GraphQL sin datos fallan y los parciales se anotan', async () => {
  let n = 0;
  const q = makeClient({ token: 't', baseDelayMs: 1, retries: 2, fetchImpl: async () => { if (++n < 2) throw new TypeError('fetch failed'); return res(200, { data: { x: 1 } }); } });
  assert.deepEqual(await q('q'), { x: 1 });
  const bad = makeClient({ token: 't', retries: 0, fetchImpl: async () => res(200, { errors: [{ message: 'Field x' }] }) });
  await assert.rejects(() => bad('q'), /Field x/);
  const partial = makeClient({ token: 't', retries: 0, fetchImpl: async () => res(200, { data: { user: {} }, errors: [{ message: 'SAML' }] }) });
  assert.deepEqual((await partial('q')).__errors, ['SAML']);
});

test('rangos anuales y consulta del calendario', () => {
  const r = yearRanges('2020-09-21T00:00:00Z', new Date('2026-11-23T10:00:00Z'));
  assert.equal(r.length, 7);
  assert.equal(r[0].alias, 'y2020');
  assert.equal(r.at(-1).to, '2026-11-23T10:00:00.000Z');
  assert.match(calendarQuery(r), /y2026: contributionsCollection\(from: "2026-01-01T00:00:00Z"/);
  assert.equal(yearRanges('2026-11-01T00:00:00Z', new Date('2026-11-23T00:00:00Z')).length, 1);
});

test('fetchProfile: pagina repos y PRs y arma los dias del calendario', async () => {
  const calls = [];
  const query = async (text, vars) => {
    calls.push([text.includes('repositories(') ? 'user' : text.includes('pullRequests(') ? 'prs' : 'cal', vars.after]);
    if (text.includes('repositories(')) {
      return vars.after ? { user: user({ repositories: { pageInfo: { hasNextPage: false }, nodes: [{ name: 'r2' }] } }) } : { user: user({ repositories: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [{ name: 'r1' }] } }) };
    }
    if (text.includes('pullRequests(')) {
      return vars.after ? { user: { pullRequests: { totalCount: 3, pageInfo: { hasNextPage: false }, nodes: [{ number: 3 }] } } } : { user: { pullRequests: { totalCount: 3, pageInfo: { hasNextPage: true, endCursor: 'p1' }, nodes: [{ number: 1 }, { number: 2 }] } } };
    }
    return { user: { y2025: { contributionCalendar: { weeks: [{ contributionDays: [{ date: '2025-06-01', contributionCount: 2 }] }] } }, y2026: { contributionCalendar: { weeks: [{ contributionDays: [{ date: '2026-01-01', contributionCount: 0 }] }] } } } };
  };
  const raw = await fetchProfile({ login: 'me', query, now: new Date('2026-11-23T00:00:00Z') });
  assert.deepEqual(raw.repos.map((r) => r.name), ['r1', 'r2']);
  assert.deepEqual(raw.prs.map((p) => p.number), [1, 2, 3]);
  assert.deepEqual(raw.days, [{ date: '2025-06-01', count: 2 }, { date: '2026-01-01', count: 0 }]);
  await assert.rejects(() => fetchProfile({ login: 'x', query: async () => ({ user: null }) }), /no encontrado/);
});
