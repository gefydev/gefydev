import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from '../src/index.js';
import { mobileWidgets, render, THEME_IDS, widgets } from '../src/glass.js';
import { toGlassData } from '../src/model.js';
import { fetchDataUri } from '../src/avatars.js';
import { assertWellFormed, day, emptyRaw, pr, repo } from './helpers.js';

const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/sample.json', import.meta.url), 'utf8'));
const cfg = { login: 'me', prs: { maxRepos: 6, lastPerRepo: 3 }, languages: { top: 6, excludeRepos: [], excludeLanguages: [] }, stats: { excludeRepos: [] }, profile: { name: 'Me', tagline: 'Dev', phrases: ['uno', 'dos'], links: { linkedin: 'in/me', site: 'me.dev', email: 'hi@me.dev' }, stack: [{ slug: 'typescript', name: 'TypeScript', kind: 'Language' }, { slug: 'rust', name: 'Rust', kind: 'Learning' }] } };
const all = () => Object.keys(widgets).flatMap((w) => THEME_IDS.flatMap((t) => [[w, t, false], ...(mobileWidgets[w] ? [[w, t, true]] : [])]));
const extRepo = (nameWithOwner, extra = {}) => ({ nameWithOwner, isPrivate: false, isFork: false, stargazerCount: 12, primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, owner: { login: nameWithOwner.split('/')[0], avatarUrl: 'https://avatars.githubusercontent.com/u/1' }, ...extra });

test('el diseno de ejemplo de Davinci renderiza en los 2 temas, escritorio y movil, con XML valido y con la marca de ejemplo', () => {
  for (const [w, t, m] of all()) {
    const svg = render(w, sample, t, { sample: true, mobile: m });
    assertWellFormed(svg);
    // el encabezado es estático (no muestra datos), así que no lleva la marca de ejemplo
    if (w !== 'hero') assert.match(svg, /DATOS DE EJEMPLO/, `${w}-${t}${m ? '-m' : ''}`);
    assert.doesNotMatch(render(w, sample, t, { mobile: m }), /DATOS DE EJEMPLO/);
    assert.match(svg, /<title id=/);
    assert.ok(svg.length < 80_000, `${w} pesa ${svg.length}`);
  }
});

test('anchos: escritorio <= 850 y movil 340, sin recursos externos ni JS', () => {
  for (const [w, t, m] of all()) {
    const svg = render(w, sample, t, { mobile: m });
    const width = Number(/<svg[^>]* width="(\d+)"/.exec(svg)[1]);
    assert.ok(m ? width === 340 : width <= 850, `${w} ${m} ${width}`);
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/, `${w} referencia un recurso externo`);
    assert.doesNotMatch(svg, /@import|foreignObject|<script|<image[^>]*href="http/i);
  }
});

test('datos vacios: todo valido y los textos de estado vacio aparecen', () => {
  const { files, model } = build(emptyRaw(), cfg);
  assert.equal(Object.keys(files).length, 6 * 2 + 6 * 2 + 1);
  for (const [name, content] of Object.entries(files)) if (name.endsWith('.svg')) assertWellFormed(content);
  assert.match(files['prs-dark.svg'], /No pull requests yet/);
  assert.match(files['prs-m-light.svg'], /No pull requests yet/);
  assert.match(files['streak-dark.svg'], /No active streak/);
  assert.doesNotMatch(files['streak-dark.svg'], /1970|Invalid/);
  assert.equal(model.prs.repos.length, 0);
  assert.equal(JSON.parse(files['data.json']).model.prs.total, 0);
});

test('datos largos y hostiles: titulos enormes, XSS, CJK, 40 repos, nombres gigantes', () => {
  const evil = '<script>alert(1)</script> "quoted" & \'single\' ]]> 日本語のタイトル😀 ' + 'larguisimo '.repeat(80);
  const raw = emptyRaw();
  raw.user.name = '<b>Nombre</b> & "x"';
  raw.prs = [];
  for (let r = 0; r < 40; r++) for (let i = 0; i < 5; i++) raw.prs.push(pr({ number: i + 1, title: evil, createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, repository: extRepo(`owner${r}-${'x'.repeat(50)}/repo-${r}-${'y'.repeat(70)}`, { stargazerCount: 1e9, primaryLanguage: { name: 'Lang <&"> ' + 'z'.repeat(40), color: null } }) }));
  raw.repos = Array.from({ length: 30 }, (_, i) => repo(`r${i}`, [[`Lang <${i}> & "q"`, 1000 + i, i % 2 ? '#fff' : null]]));
  raw.days = Array.from({ length: 800 }, (_, i) => ({ date: day(i, '2024-01-01'), count: i % 3 }));
  const { files, model } = build(raw, { ...cfg, profile: { ...cfg.profile, name: '<i>Gefy</i> & "Dev" ' + 'N'.repeat(80), tagline: 'T'.repeat(300), phrases: ['<b>x</b> ' + 'p'.repeat(200), '😀'.repeat(100)] } });
  for (const [name, content] of Object.entries(files)) if (name.endsWith('.svg')) {
    assertWellFormed(content);
    assert.ok(content.length < 120_000, `${name} ${content.length}`);
  }
  assert.equal(model.prs.repos.length, 6);
  assert.match(files['prs-dark.svg'], /\+ 34 more repositories/);
  assert.match(files['prs-m-dark.svg'], /6 of 40 repos/);
  assert.doesNotMatch(files['prs-dark.svg'], /<script>alert/);
  assert.ok(Number(/height="(\d+)"/.exec(files['prs-dark.svg'])[1]) < 1400);
});

test('el widget de PRs usa solo repos ajenos y muestra los propios como dato secundario', () => {
  const raw = emptyRaw();
  raw.prs = [pr({ number: 1, repository: extRepo('me/mine') }), pr({ number: 2, repository: extRepo('me/mine') }), pr({ number: 3, repository: extRepo('acme/lib') })];
  const { files, model } = build(raw, cfg);
  assert.equal(model.prs.total, 1);
  assert.equal(model.prs.ownTotal, 2);
  assert.equal(model.stats.prs, 1);
  assert.match(files['prs-dark.svg'], /\+ 2 in own repositories/);
  assert.match(files['prs-m-dark.svg'], /\+ 2 in own repos/);
  assert.match(files['prs-dark.svg'], /acme\//);
  assert.doesNotMatch(files['prs-dark.svg'], />me\/</);
  assert.match(files['stats-dark.svg'], /Commits \(last 12 months\)/);
  assert.match(files['stats-dark.svg'], /PRs to other repos/);
});

test('privados: ni en los SVG ni en data.json, con o sin token que los vea', () => {
  const raw = emptyRaw();
  raw.prs = [pr({ repository: extRepo('me/privado-secreto', { isPrivate: true }) }), pr({ repository: extRepo('acme/ok') })];
  raw.repos = [repo('privado-secreto', [['Zig', 9999, '#ec915c']], { isPrivate: true })];
  const { files } = build(raw, cfg);
  for (const content of Object.values(files)) assert.doesNotMatch(content, /privado-secreto|Zig/);
  assert.equal(JSON.parse(files['data.json']).model.prs.total, 1);
});

test('singular, sin lenguaje ni estrellas, 0 merged y racha en 0 no muestran basura', () => {
  const raw = emptyRaw();
  raw.prs = [pr({ number: 9, state: 'CLOSED', merged: false, repository: extRepo('acme/solo', { primaryLanguage: null, stargazerCount: null }) })];
  const { files } = build(raw, cfg);
  const svg = files['prs-dark.svg'];
  assert.match(svg, />1 PR</);
  assert.match(svg, />0 merged</);
  assert.doesNotMatch(svg, /null|undefined|NaN|0 ★/);
  for (const content of Object.values(files)) assert.doesNotMatch(content, /undefined|NaN/);
});

test('modelo: contrato de datos del diseno completo y lenguajes sin Other vacio', () => {
  const raw = emptyRaw();
  raw.repos = [repo('a', [['TypeScript', 700, '#3178c6'], ['Rust', 300, '#dea584']])];
  raw.days = [{ date: '2026-11-22', count: 2 }, { date: '2026-11-23', count: 1 }];
  const { model } = build(raw, cfg, { now: new Date('2026-11-23T12:00:00Z') });
  for (const k of ['now', 'profile', 'stats', 'languages', 'streak', 'stack', 'prs']) assert.ok(k in model, k);
  assert.deepEqual(Object.keys(sample.stats).sort(), ['commits', 'contributedTo', 'issues', 'prs', 'stars', 'year'].sort());
  for (const k of ['commits', 'prs', 'issues', 'stars', 'contributedTo']) assert.equal(typeof model.stats[k], 'number');
  assert.deepEqual(model.languages.map((l) => [l.name, l.pct]), [['TypeScript', 70], ['Rust', 30]]);
  assert.equal(model.streak.current, 2);
  assert.equal(model.streak.totalFrom, '2020-01-01');
  assert.equal(model.stack.length, 2);
  assert.equal(toGlassData({ cfg, raw, stats: { prs: { total: 0, merged: 0, open: 0, closed: 0 }, commitsLastYear: 0, issues: 0, stars: 0, contributedTo: 0 }, streak: { current: {}, longest: {} }, languages: { items: [] }, prSummary: { external: { total: 0, merged: 0, open: 0, closed: 0 }, own: { total: 0, merged: 0 }, reposTotal: 0, repos: [] } }).profile.avatarDataUri, undefined);
});

test('avatares: solo hosts de GitHub, tipos de imagen y tamano acotado; si falla devuelve null', async () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const ok = async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
  assert.match(await fetchDataUri('https://avatars.githubusercontent.com/u/1', { fetchImpl: ok }), /^data:image\/png;base64,/);
  assert.equal(await fetchDataUri('https://evil.example/a.png', { fetchImpl: ok }), null);
  assert.equal(await fetchDataUri('http://avatars.githubusercontent.com/u/1', { fetchImpl: ok }), null);
  assert.equal(await fetchDataUri(null, { fetchImpl: ok }), null);
  assert.equal(await fetchDataUri('https://avatars.githubusercontent.com/u/1', { fetchImpl: async () => new Response('<svg onload=x>', { headers: { 'content-type': 'image/svg+xml' } }) }), null);
  assert.equal(await fetchDataUri('https://avatars.githubusercontent.com/u/1', { fetchImpl: async () => new Response(Buffer.alloc(50_000), { headers: { 'content-type': 'image/png' } }) }), null);
  assert.equal(await fetchDataUri('https://avatars.githubusercontent.com/u/1', { fetchImpl: async () => { throw new TypeError('x'); } }), null);
  assert.equal(await fetchDataUri('https://avatars.githubusercontent.com/u/1', { fetchImpl: async () => new Response('', { status: 404 }) }), null);
});

test('render rechaza widget o tema desconocido', () => {
  assert.throws(() => render('nada', sample, 'dark'), /desconocido/);
  assert.throws(() => render('hero', sample, 'sepia'), /desconocido/);
});

const streakTexts = (svg) => [...svg.matchAll(/text-anchor="middle">([^<]*(?:–|Since)[^<]*)</g)].map((m) => m[1]);
const streakData = (over = {}) => ({ ...sample, now: '2026-11-23T12:00:00Z', streak: { total: 3860, totalFrom: '2020-09-21', totalTo: '2026-11-23', current: 2, currentFrom: '2026-11-22', currentTo: '2026-11-23', longest: 13, longestFrom: '2024-04-27', longestTo: '2024-05-09', ...over } });

test('racha: el año aparece cuando no es el actual y el total dice desde cuándo', () => {
  assert.deepEqual(streakTexts(render('streak', streakData(), 'dark')), ['Since Sep 21, 2020', 'Nov 22 – Present', 'Apr 27 – May 9, 2024']);
  const mob = render('streak', streakData(), 'dark', { mobile: true });
  for (const s of ["Since Sep 21 '20", 'Nov 22 – Present', "Apr 27 – May 9 '24"]) assert.ok(mob.includes(`>${s}<`), `falta ${s}`);
  const cross = streakData({ longestFrom: '2023-12-28', longestTo: '2024-01-03', currentFrom: '2026-01-01' });
  assert.deepEqual(streakTexts(render('streak', cross, 'light')), ['Since Sep 21, 2020', 'Jan 1 – Present', 'Dec 28, 2023 – Jan 3, 2024']);
  const mobSvg = render('streak', cross, 'light', { mobile: true });
  assert.match(mobSvg, />Dec 28 '23 – Jan 3 '24</);
  assert.doesNotMatch(mobSvg, /…/);
  const sizes = [...mobSvg.matchAll(/<text[^>]*font-size="([\d.]+)"[^>]*>([^<]+)</g)].filter((x) => /^[A-Za-z]/.test(x[2])).map((x) => Number(x[1]));
  assert.ok(sizes.length > 4);
  assert.ok(Math.min(...sizes) >= 13, `texto móvil de la racha menor a 13: ${Math.min(...sizes)}`);
  const sameYear = streakData({ longestFrom: '2026-03-03', longestTo: '2026-04-18' });
  assert.equal(streakTexts(render('streak', sameYear, 'dark'))[2], 'Mar 3 – Apr 18');
  for (const t of streakTexts(render('streak', streakData({ totalFrom: null, currentFrom: null, longestFrom: null }), 'dark'))) assert.doesNotMatch(t, /1970|Invalid|NaN/);
});

test('consistencia: "Other repos with PRs" es exactamente el conteo del widget de PRs', () => {
  const raw = emptyRaw();
  raw.user.repositoriesContributedTo = { totalCount: 99 };
  raw.prs = [pr({ number: 1, repository: extRepo('a/one') }), pr({ number: 2, repository: extRepo('b/two') }), pr({ number: 3, repository: extRepo('b/two') }), pr({ number: 4, repository: extRepo('me/own') })];
  const { model, files } = build(raw, cfg);
  assert.equal(model.prs.reposTotal, 2);
  assert.equal(model.stats.contributedTo, 2);
  assert.match(files['prs-dark.svg'], /2 of 2 repositories/);
  assert.match(files['prs-m-dark.svg'], /2 of 2 repos/);
  assert.match(files['stats-dark.svg'], />Other repos with PRs</);
  assert.doesNotMatch(files['stats-dark.svg'], />Contributed to</);
  assert.equal(JSON.parse(files['data.json']).model.stats.contributedTo, 2);
});

test('primer cuadro: barras y anillos no arrancan vacios, el halo se anima con la barra y se respeta prefers-reduced-motion', () => {
  for (const [w, t, m] of all()) {
    const svg = render(w, sample, t, { mobile: m });
    const id = `${w}-${t}${m ? '-m' : ''}`;
    assert.doesNotMatch(svg, /scaleX\(0\)/, `${id}: la barra no puede partir de ancho cero`);
    assert.doesNotMatch(svg, /@keyframes ring\{from\{stroke-dashoffset:var\(--len\)\}/, `${id}: el anillo no puede partir vacio`);
    if (/class="bar"/.test(svg)) {
      assert.match(svg, /prefers-reduced-motion:reduce\)\{[^}]*\.bar/, `${id}: sin animacion con prefers-reduced-motion`);
      assert.doesNotMatch(svg, /fGlow\)">(?:(?!<\/g>).)*<\/g><g class="bar">/s, `${id}: el halo queda fuera de .bar`);
      assert.match(svg, /<g class="bar"><g opacity="[\d.]+" filter="url\(#fGlow\)">/, `${id}: el halo va dentro de .bar`);
    }
  }
});

test('movil: 340 px y ningun texto por debajo de 13 (11,2 px reales a 293)', () => {
  for (const w of ['stack', 'stats', 'langs', 'streak', 'prs']) {
    const svg = render(w, sample, 'dark', { mobile: true });
    const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.ok(Math.min(...sizes) >= 13, `${w}: ${Math.min(...sizes)}`);
    assert.match(svg, /\*\{animation:none!important\}/, `${w}: el movil no se anima`);
  }
});
