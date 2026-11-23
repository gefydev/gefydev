import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/index.js';
import { esc, fmtNumber, textWidth, truncate } from '../src/svg/kit.js';
import { theme } from '../src/svg/theme.js';
import { computeLanguages, computeStreak, groupPullRequests } from '../src/compute.js';
import { renderLanguages } from '../src/svg/languages.js';
import { renderPrs } from '../src/svg/prs.js';
import { renderStreak } from '../src/svg/streak.js';
import { assertWellFormed, day, emptyRaw, pr, repo } from './helpers.js';

const cfg = { login: 'me', includePrivate: 'off', prs: { maxRepos: 8, lastPerRepo: 3 }, languages: { top: 6, excludeRepos: [], excludeLanguages: [] }, stats: { excludeRepos: [] } };

test('kit: escapa XML, quita caracteres invalidos y surrogates sueltos', () => {
  assert.equal(esc(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc('a\u0000b\u0008c\uD800d'), 'abcd');
  assert.equal(esc('😀 ok'), '😀 ok');
  assert.equal(esc(null), '');
  assert.equal(fmtNumber(1234567), '1,234,567');
  assert.equal(fmtNumber('x'), '0');
});

test('kit: truncate respeta el ancho, agrega puntos suspensivos y no corta emojis', () => {
  const long = 'x'.repeat(300);
  const t = truncate(long, 200, 12);
  assert.ok(textWidth(t, 12) <= 200);
  assert.ok(t.endsWith('…'));
  assert.equal(truncate('corto', 200, 12), 'corto');
  assert.equal(truncate('  espacios   raros  ', 200, 12), 'espacios raros');
  const emoji = truncate('😀'.repeat(60), 100, 12);
  assert.doesNotMatch(emoji, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  assert.equal(truncate('algo', 0, 12), '');
});

test('datos vacios: los cuatro SVG son validos y dicen que no hay datos', () => {
  const { files } = build(emptyRaw(), cfg);
  for (const name of ['stats.svg', 'languages.svg', 'streak.svg', 'prs.svg']) assertWellFormed(files[name]);
  assert.match(files['languages.svg'], /No language data/);
  assert.match(files['prs.svg'], /No pull requests yet/);
  assert.match(files['stats.svg'], /Total Stars Earned/);
  assert.equal(JSON.parse(files['data.json']).prs.totals.total, 0);
});

test('datos largos y hostiles: titulos enormes, XSS, muchos repos y lenguajes, sin romper el XML', () => {
  const evil = '<script>alert(1)</script> "quoted" & \'single\' ]]> ' + 'larguisimo '.repeat(80);
  const prs = [];
  for (let r = 0; r < 40; r++) {
    for (let i = 0; i < 5; i++) {
      prs.push(pr({ number: i + 1, title: evil, createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, repository: { nameWithOwner: `owner-${'x'.repeat(60)}/repo-${r}-${'y'.repeat(60)}`, isPrivate: false, isFork: false, stargazerCount: 1e9, owner: { login: 'owner' } } }));
    }
  }
  const raw = emptyRaw();
  raw.prs = prs;
  raw.user.name = '<b>Nombre</b> & "x" ' + 'n'.repeat(200);
  raw.repos = Array.from({ length: 30 }, (_, i) => repo(`r${i}`, [[`Lang <${i}> & "q"`, 1000 + i, i % 2 ? '#fff' : null]]));
  raw.days = Array.from({ length: 800 }, (_, i) => ({ date: day(i, '2024-01-01'), count: i % 3 }));
  const { files } = build(raw, cfg);
  for (const name of ['stats.svg', 'languages.svg', 'streak.svg', 'prs.svg']) {
    assertWellFormed(files[name]);
    assert.ok(files[name].length < 200_000, `${name} demasiado grande`);
  }
  assert.doesNotMatch(files['prs.svg'], /<script/);
  assert.match(files['prs.svg'], /\+ 32 more repositories/);
  const h = Number(/height="(\d+)"/.exec(files['prs.svg'])[1]);
  assert.ok(h < 2000);
  assert.ok((files['prs.svg'].match(/…/g) || []).length > 5);
});

test('prs: un repo, un PR, plural y singular, draft y privados agregados sin nombres', () => {
  const one = renderPrs(groupPullRequests([pr()], { login: 'me' }), theme);
  assertWellFormed(one);
  assert.match(one, /In repo o\/r — 1 PR, 1 merged/);
  const many = renderPrs(groupPullRequests([pr(), pr({ number: 2 })], { login: 'me' }), theme);
  assert.match(many, /2 PRs, 2 merged/);
  const priv = pr({ repository: { nameWithOwner: 'me/secreto', isPrivate: true, isFork: false, stargazerCount: 0, owner: { login: 'me' } } });
  const draft = pr({ number: 9, state: 'OPEN', merged: false, isDraft: true });
  const out = renderPrs(groupPullRequests([priv, priv, draft], { login: 'me', includePrivate: 'aggregate' }), theme);
  assertWellFormed(out);
  assert.match(out, /\+ 2 PRs in private repositories/);
  assert.match(out, /draft · /);
  assert.doesNotMatch(out, /secreto/);
});

test('languages: 1 lenguaje, 100%, y barra que cubre exactamente el ancho', () => {
  const svg = renderLanguages(computeLanguages([repo('a', [['Rust', 10, '#dea584']])]), theme);
  assertWellFormed(svg);
  assert.match(svg, /100\.0%/);
  const widths = [...svg.matchAll(/<rect x="([\d.]+)" y="50" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const end = widths.at(-1)[0] + widths.at(-1)[1];
  assert.ok(Math.abs(end - 376) < 0.01);
});

test('streak: etiquetas, rango unico y sin racha', () => {
  const none = renderStreak({ ...computeStreak([]), since: null }, theme);
  assertWellFormed(none);
  assert.match(none, /Current Streak/);
  const one = renderStreak({ ...computeStreak([{ date: '2026-01-01', count: 3 }]), since: '2020-09-21' }, theme);
  assertWellFormed(one);
  assert.match(one, /since 2020-09-21/);
});

test('privados: con includePrivate=off no aparecen ni en data.json aunque el token los vea', () => {
  const raw = emptyRaw();
  raw.prs = [pr({ repository: { nameWithOwner: 'me/privado-secreto', isPrivate: true, isFork: false, stargazerCount: 0, owner: { login: 'me' } } })];
  raw.repos = [repo('privado-secreto', [['Zig', 9999, '#ec915c']], { isPrivate: true })];
  const off = build(raw, cfg);
  for (const content of Object.values(off.files)) assert.doesNotMatch(content, /privado-secreto|Zig/);
  assert.equal(off.data.prs.private, null);
  const agg = build(raw, { ...cfg, includePrivate: 'aggregate' });
  for (const content of Object.values(agg.files)) assert.doesNotMatch(content, /privado-secreto/);
  assert.equal(agg.data.prs.private.total, 1);
  assert.equal(agg.data.prs.totals.total, 0);
});
