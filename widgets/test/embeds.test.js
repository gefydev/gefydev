import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { build, readEmbeds } from '../src/index.js';
import { assertSafeEmbed, parse3d, prepSnake, render, splitTopGroups, THEME_IDS } from '../src/glass.js';
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

test('3D compuesto: XML valido, dark/light, escritorio y movil; ninguno lleva animaciones SMIL (primer cuadro con la altura final)', () => {
  const d = { embeds: embeds(), now: '2026-11-23T12:00:00Z' };
  for (const theme of THEME_IDS) {
    const desk = render('3d', d, theme);
    const mob = render('3d', d, theme, { mobile: true });
    assertWellFormed(desk);
    assertWellFormed(mob);
    assert.match(desk, /width="850"/);
    assert.match(mob, /width="340"/);
    assert.doesNotMatch(desk, /<animate/, 'el 3D de escritorio arranca con la altura final');
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
  assert.doesNotMatch(y, /feat\/profile-widgets/);
  assert.match(y, /push:\n    branches:\n      - main\n\npermissions|push:\n    branches:\n      - main\n\n/);
  assert.equal((y.match(/persist-credentials: false/g) || []).length, 2);
  assert.match(y, /permissions:\n  contents: write\n/);
  assert.equal((y.match(/^\s{2,}\w+: (read|write)$/gm) || []).length, 1);
  assert.match(y, /SETTING_JSON: widgets\/3d-settings\.json/);
  // solo main puede escribir la rama que muestra el perfil
  assert.match(y, /OUTPUT_BRANCH: \$\{\{ github\.ref == 'refs\/heads\/main' && 'widgets-output' \|\| 'widgets-preview' \}\}/);
  assert.doesNotMatch(y, /\.git" widgets-output/);
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

const HOSTILE = {
  script: '<script>alert(1)</script>',
  foreignObject: '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
  handler: '<rect width="1" height="1" onload="alert(1)"/>',
  handlerSpaced: '<rect width="1" height="1" onmouseover = "x()"/>',
  js: '<rect width="1" height="1" fill="javascript:alert(1)"/>',
  import: '<style>@import url(//evil.example/x.css);</style>',
  externalUrl: '<rect width="1" height="1" style="fill:url(https://evil.example/p.svg#a)"/>',
  externalLink: '<text>https://evil.example/pixel</text>',
  image: '<image width="1" height="1" href="https://evil.example/p.png"/>',
  use: '<use href="#a"/>',
  anchor: '<a href="https://evil.example"><rect width="1" height="1"/></a>',
  dataUri: '<rect width="1" height="1" style="fill:url(data:image/svg+xml;base64,AAAA)"/>'
};

test('N1: un 3D hostil se rechaza (script, handlers, foreignObject, @import, javascript:, URLs externas, image, use, a, data:)', () => {
  for (const [name, evil] of Object.entries(HOSTILE)) {
    const raw = mini3d().replace('</svg>', `${evil}</svg>`).replace('</style><rect', `</style><g>${evil}</g><rect`);
    const hostileCubes = mini3d().replace('class="cont-top-0"></rect>', `class="cont-top-0"></rect>${evil}`);
    assert.throws(() => parse3d(hostileCubes), /embebido no permitido/, name);
    void raw;
  }
  const evilStyle = mini3d().replace('</style>', '.x{background:url(https://evil.example/a.png)}</style>');
  assert.throws(() => parse3d(evilStyle), /URL externa|url\(\)/);
});

test('N1: una snake hostil se rechaza y las limpias pasan', () => {
  for (const [name, evil] of Object.entries(HOSTILE)) {
    const raw = miniSnake().replace('</svg>', `${evil}</svg>`);
    assert.throws(() => prepSnake(raw, 'dark'), /embebido no permitido/, name);
  }
  assert.doesNotThrow(() => prepSnake(miniSnake(), 'dark'));
  assert.doesNotThrow(() => parse3d(mini3d()));
  assert.throws(() => assertSafeEmbed('<g onclick="x"/>', 'prueba'), /manejador de eventos/);
  assert.doesNotThrow(() => assertSafeEmbed('<g class="cont-top-1" transform="translate(1 2)"><animate attributeName="height" values="2.6;12" dur="3s" repeatCount="1"></animate></g>', 'prueba'));
});

test('N1: un embebido hostil no llega al SVG final: build lo omite con aviso y conserva el resto', () => {
  const warnings = [];
  const evil3d = mini3d().replace('class="cont-top-0"></rect>', 'class="cont-top-0"></rect><script>alert(1)</script>');
  const evilSnake = miniSnake().replace('</svg>', '<rect onload="x()"/></svg>');
  const r = build(emptyRaw(), cfg, { embeds: { threeD: { dark: evil3d, light: mini3d() }, snake: evilSnake }, warn: (m) => warnings.push(m) });
  for (const [name, content] of Object.entries(r.files)) if (name.endsWith('.svg')) assert.doesNotMatch(content, /<script|onload=|foreignObject|javascript:|@import/i, name);
  assert.equal(Object.keys(r.files).filter((n) => /^(3d|snake)-/.test(n)).length, 0);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((w) => /embebido no permitido/.test(w) && /se conserva el anterior/.test(w)));
  assert.ok(r.files['hero-dark.svg'] && r.files['prs-dark.svg']);
});

test('el encabezado es el estático de Davinci: nombre accesible, sin texto con fuentes, sin animación, seguro y sin el LinkedIn viejo', () => {
  for (const theme of THEME_IDS) for (const mobile of [false, true]) {
    const svg = render('hero', {}, theme, { mobile });
    assertWellFormed(svg);
    assert.match(svg, mobile ? /width="340"/ : /width="850"/);
    assert.match(svg, /<title id="ttl">[^<]*Genaro Febbo Yapur[^<]*<\/title>/);
    assert.doesNotMatch(svg, /<text|font-family|<animate|@keyframes|genadev/);
    // el filtro mira el contenido (la etiqueta raíz solo trae el xmlns), igual que con el 3D y la snake
    assert.doesNotThrow(() => assertSafeEmbed(svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')), 'hero'));
  }
});
