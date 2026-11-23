import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { build, readEmbeds } from '../src/index.js';
import { parse3d, prepSnake, render, splitTopGroups, THEME_IDS } from '../src/glass.js';
import { assertWellFormed, emptyRaw, mini3d, miniSnake } from './helpers.js';

const cfg = { login: 'me', prs: { maxRepos: 6, lastPerRepo: 3 }, languages: { top: 6, excludeRepos: [], excludeLanguages: [] }, stats: { excludeRepos: [] }, profile: { name: 'Me', tagline: 'Dev', phrases: ['a'], links: {}, stack: [] } };
const embeds = () => ({ threeD: { dark: mini3d(), light: mini3d({ total: 99 }) }, snake: miniSnake() });
const OURS = new Set(['s', 'm', 'n', 'o1', 'o2', 'o3', 'fl1', 'fl2', 'fl3', 'sw', 'bar', 'cur', 'rg']);
const classesIn = (svg) => new Set([...svg.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean)));

test('3D: se conserva solo el gráfico isométrico, la paleta y el total; radar y donut quedan afuera', () => {
  const e = parse3d(mini3d());
  assert.equal(e.total, 1266);
  assert.equal(e.from, '2025-11-23');
  assert.equal(e.to, '2026-11-23');
  assert.deepEqual(e.levels, ['#262f5c', 'rgb(15, 110, 120)', '#0db7b9', '#6f9bf5', '#b49cff']);
  assert.match(e.cubes, /cont-top-/);
  assert.doesNotMatch(e.style, /font-family/);
  for (const dark of THEME_IDS) {
    const svg = render('3d', { embeds: { threeD: { dark: mini3d(), light: mini3d() } }, now: '2026-11-23T12:00:00Z' }, dark);
    assert.doesNotMatch(svg, /RADAR-MARK|DONUT-MARK|PullReq/);
  }
  assert.throws(() => parse3d('<svg><style></style><g></g></svg>'), /no tiene cubos/);
  assert.equal(splitTopGroups('<g><g>a</g></g><g>b</g>').length, 2);
});

test('3D compuesto: XML valido, dark/light, escritorio y movil; el movil no lleva animaciones SMIL', () => {
  const d = { embeds: embeds(), now: '2026-11-23T12:00:00Z' };
  for (const theme of THEME_IDS) {
    const desk = render('3d', d, theme);
    const mob = render('3d', d, theme, { mobile: true });
    assertWellFormed(desk);
    assertWellFormed(mob);
    assert.match(desk, /width="850"/);
    assert.match(mob, /width="420"/);
    assert.match(desk, /<animate/);
    assert.doesNotMatch(mob, /<animate/);
    assert.match(desk, /1,266|99/);
    assert.match(desk, /Less/);
    assert.match(desk, /Nov 23, 2025 – Nov 23, 2026/);
    assert.doesNotMatch(desk, /https?:\/\/(?!www\.w3\.org)/);
  }
});

test('3D sin totales sigue renderizando (sin numero ni rango)', () => {
  const svg = render('3d', { embeds: { threeD: { dark: mini3d({ withTotals: false }), light: mini3d({ withTotals: false }) } }, now: '2026-11-23T12:00:00Z' }, 'dark');
  assertWellFormed(svg);
  assert.doesNotMatch(svg, />contributions</);
});

test('snake: clases y animaciones prefijadas, sin choques con las del marco, y paleta de marca por tema', () => {
  const dark = prepSnake(miniSnake(), 'dark');
  const light = prepSnake(miniSnake(), 'light');
  assert.doesNotMatch(dark.css, /purple|#1b1f230a|#161b22/);
  assert.match(dark.css, /--cs:#ffb972/);
  assert.match(light.css, /--cs:#d9480f/);
  assert.notEqual(dark.css, light.css);
  assert.match(dark.css, /@keyframes snc0\{/);
  assert.match(dark.css, /animation-name:snc0\b/);
  assert.match(dark.css, /\.snc\.snc0\{/);
  assert.doesNotMatch(dark.css.replace(/@keyframes sn\w+/g, ''), /(^|[^\w-])\.(c|u|s)\d*[{.,\s]/);
  assert.match(dark.inner, /class="snc snc0"/);
  assert.doesNotMatch(dark.inner, /class="(c|u|s)[ "]|class="[a-z]+ (c|u|s)\d/);
  assert.deepEqual(dark.viewBox, [-16, -32, 880, 192]);
  for (const theme of THEME_IDS) {
    const svg = render('snake', { embeds: embeds() }, theme);
    assertWellFormed(svg);
    assertWellFormed(render('snake', { embeds: embeds() }, theme, { mobile: true }));
    const unknown = [...classesIn(svg)].filter((c) => !OURS.has(c) && !c.startsWith('sn'));
    assert.deepEqual(unknown, []);
    assert.equal((svg.match(/\.s\{/g) || []).length, 1, 'solo la regla .s del marco');
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
  }
  assert.throws(() => prepSnake('<svg></svg>', 'dark'), /no tiene estilos/);
});

test('build: sin embebidos no hay 3D ni snake; con embebidos salen 8 archivos mas; data.json no incluye los SVG ajenos', () => {
  const without = build(emptyRaw(), cfg);
  assert.equal(Object.keys(without.files).filter((n) => /^(3d|snake)-/.test(n)).length, 0);
  const withE = build(emptyRaw(), cfg, { embeds: embeds() });
  const names = Object.keys(withE.files).filter((n) => /^(3d|snake)-/.test(n)).sort();
  assert.deepEqual(names, ['3d-dark.svg', '3d-light.svg', '3d-m-dark.svg', '3d-m-light.svg', 'snake-dark.svg', 'snake-light.svg', 'snake-m-dark.svg', 'snake-m-light.svg']);
  assert.match(withE.files['data.json'], /\[embedded svg\]/);
  assert.doesNotMatch(withE.files['data.json'], /RADAR-MARK|cont-top/);
  const partial = build(emptyRaw(), cfg, { embeds: { threeD: { dark: mini3d(), light: null }, snake: null } });
  assert.equal(Object.keys(partial.files).filter((n) => /^(3d|snake)-/.test(n)).length, 0);
});

test('build: un embebido roto se omite con aviso y no impide el resto', () => {
  const warnings = [];
  const r = build(emptyRaw(), cfg, { embeds: { threeD: { dark: '<svg>basura</svg>', light: '<svg>basura</svg>' }, snake: miniSnake() }, warn: (m) => warnings.push(m) });
  assert.equal(Object.keys(r.files).filter((n) => n.startsWith('3d-')).length, 0);
  assert.equal(Object.keys(r.files).filter((n) => n.startsWith('snake-')).length, 4);
  assert.ok(warnings.some((w) => /3d/.test(w) && /se conserva el anterior/.test(w)));
  assert.ok(r.files['hero-dark.svg']);
});

test('readEmbeds: lee los archivos esperados y avisa de los que faltan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-emb-'));
  fs.writeFileSync(path.join(dir, 'gefy-3d-dark.svg'), mini3d());
  const snake = path.join(dir, 'snake.svg');
  fs.writeFileSync(snake, miniSnake());
  const warnings = [];
  const e = readEmbeds({ threeDDir: dir, snake }, { warn: (m) => warnings.push(m) });
  assert.ok(e.threeD.dark);
  assert.equal(e.threeD.light, null);
  assert.ok(e.snake);
  assert.equal(warnings.length, 1);
  assert.deepEqual(readEmbeds({}), { threeD: {}, snake: null });
});

test('workflow: acciones fijadas por SHA, un solo permiso, sin PAT y checkouts sin credenciales persistentes', () => {
  const y = fs.readFileSync(new URL('../../.github/workflows/profile-widgets.yml', import.meta.url), 'utf8');
  const uses = [...y.matchAll(/uses:\s*(\S+)\s*(#.*)?/g)];
  assert.ok(uses.length >= 5);
  for (const [, ref, comment] of uses) {
    assert.match(ref, /@[0-9a-f]{40}$/, ref);
    assert.ok(comment, `${ref} sin etiqueta de version`);
  }
  assert.doesNotMatch(y, /PROFILE_STATS_TOKEN/);
  assert.equal((y.match(/persist-credentials: false/g) || []).length, 2);
  assert.match(y, /permissions:\n  contents: write\n/);
  assert.equal((y.match(/^\s{2,}\w+: (read|write)$/gm) || []).length, 1);
  assert.match(y, /SETTING_JSON: widgets\/3d-settings\.json/);
  assert.match(y, /snake\/snake-raw\.svg/);
});

test('3d-settings.json: dos salidas con la paleta de marca y 5 niveles', () => {
  const s = JSON.parse(fs.readFileSync(new URL('../3d-settings.json', import.meta.url), 'utf8'));
  assert.deepEqual(s.map((x) => x.fileName), ['gefy-3d-dark.svg', 'gefy-3d-light.svg']);
  for (const x of s) {
    assert.equal(x.type, 'normal');
    assert.equal(x.contribColors.length, 5);
    for (const c of [x.backgroundColor, x.foregroundColor, x.strongColor, x.weakColor, x.radarColor, ...x.contribColors]) assert.match(c, /^#[0-9a-f]{6}$/i);
  }
});
