import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDataUri } from './avatars.js';
import { computeLanguages, computeStats, computeStreak, groupPullRequests } from './compute.js';
import { embedMobile, embedWidgets, mobileWidgets, render, THEME_IDS, widgets } from './glass.js';
import { fetchProfile, makeClient } from './github.js';
import { toGlassData } from './model.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFINITIONS = {
  prs: 'PRs creados por la cuenta en repositorios PUBLICOS de otras personas u organizaciones, en todos los estados. Los PRs en repos propios se informan aparte (prs.ownTotal). Los repos privados nunca entran en PRs, repos, lenguajes ni estrellas.',
  commits: 'Commits publicos de los ultimos 12 meses (contributionsCollection.totalCommitContributions).',
  stars: 'Estrellas de los repositorios publicos propios que no son forks.',
  languages: 'Bytes por lenguaje de los repositorios publicos propios que no son forks.',
  streak: 'Dias consecutivos con al menos una contribucion en el calendario de GitHub; el dia en curso sin contribuciones aun no corta la racha. ATENCION: ese calendario incluye contribuciones privadas anonimizadas (sin nombres) si el perfil tiene activada "Include private contributions"; es el mismo numero que muestra el perfil publico.',
  prsRepos: 'Repos ajenos ordenados por PRs mergeados (desempate: PR mas reciente), maximo 6, cada uno con sus 3 PRs mas recientes por fecha de creacion.'
};

export function loadConfig(file = path.join(here, '..', 'config.json')) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    login: cfg.login,
    prs: { maxRepos: 6, lastPerRepo: 3, ...cfg.prs },
    languages: { top: 6, excludeRepos: [], excludeLanguages: [], ...cfg.languages },
    stats: { excludeRepos: [], ...cfg.stats },
    profile: cfg.profile || {}
  };
}

export function readEmbeds({ threeDDir, snake }, { warn = (m) => console.warn(m) } = {}) {
  const read = (f) => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return null;
    }
  };
  const embeds = { threeD: {}, snake: null };
  if (threeDDir) for (const theme of THEME_IDS) {
    embeds.threeD[theme] = read(path.join(threeDDir, `gefy-3d-${theme}.svg`));
    if (!embeds.threeD[theme]) warn(`::warning::no se encontró el 3D ${theme} en ${threeDDir}; se conserva el anterior`);
  }
  if (snake) {
    embeds.snake = read(snake);
    if (!embeds.snake) warn(`::warning::no se encontró la snake (${snake}); se conserva la anterior`);
  }
  return embeds;
}

export function compute(raw, cfg) {
  const streak = computeStreak(raw.days);
  streak.since = (raw.user?.createdAt || streak.firstDate || '').slice(0, 10) || null;
  const prSummary = groupPullRequests(raw.prs, { login: cfg.login, maxRepos: cfg.prs.maxRepos, lastPerRepo: cfg.prs.lastPerRepo });
  const languages = computeLanguages(raw.repos, cfg.languages);
  const stats = computeStats({ user: raw.user, repos: raw.repos, prSummary, streak, excludeRepos: cfg.stats.excludeRepos });
  return { streak, prSummary, languages, stats };
}

export function build(raw, cfg, { avatars = {}, embeds = null, now = new Date(), sample = false, warn = (m) => console.warn(m) } = {}) {
  const c = compute(raw, cfg);
  const model = toGlassData({ cfg, raw, ...c, avatars, embeds, now });
  const files = {};
  for (const name of Object.keys(widgets)) {
    for (const theme of THEME_IDS) {
      files[`${name}-${theme}.svg`] = render(name, model, theme, { sample });
      if (mobileWidgets[name]) files[`${name}-m-${theme}.svg`] = render(name, model, theme, { sample, mobile: true });
    }
  }
  for (const name of Object.keys(embedWidgets)) {
    const have = name === 'snake' ? Boolean(embeds?.snake) : THEME_IDS.every((t) => embeds?.threeD?.[t]);
    if (!have) continue;
    try {
      const made = {};
      for (const theme of THEME_IDS) {
        made[`${name}-${theme}.svg`] = render(name, model, theme, { sample });
        made[`${name}-m-${theme}.svg`] = render(name, model, theme, { sample, mobile: true });
      }
      Object.assign(files, made);
    } catch (err) {
      warn(`::warning::no se pudo componer ${name}: ${err.message}; se conserva el anterior`);
    }
  }
  const publicModel = JSON.parse(JSON.stringify(model, (k, v) => (k === 'avatarDataUri' ? (v ? '[embedded]' : null) : k === 'embeds' ? (v ? '[embedded svg]' : null) : v)));
  files['data.json'] = `${JSON.stringify({ generatedAt: now.toISOString(), definitions: DEFINITIONS, model: publicModel }, null, 2)}\n`;
  return { model, files, computed: c };
}

async function avatarsFor(raw, cfg) {
  const { prSummary } = compute(raw, cfg);
  const out = {};
  for (const r of prSummary.repos) if (!(r.owner in out)) out[r.owner] = await fetchDataUri(r.avatarUrl);
  return out;
}

function parseArgs(argv) {
  const out = { out: 'dist', fixture: null, saveRaw: null, sample: false, noAvatars: false, threeDDir: null, snake: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--fixture') out.fixture = argv[++i];
    else if (argv[i] === '--save-raw') out.saveRaw = argv[++i];
    else if (argv[i] === '--sample') out.sample = true;
    else if (argv[i] === '--no-avatars') out.noAvatars = true;
    else if (argv[i] === '--3d-dir') out.threeDDir = argv[++i];
    else if (argv[i] === '--snake') out.snake = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  if (process.env.PROFILE_USER) cfg.login = process.env.PROFILE_USER;
  let raw;
  if (args.fixture) raw = JSON.parse(fs.readFileSync(args.fixture, 'utf8'));
  else {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    raw = await fetchProfile({ login: cfg.login, query: makeClient({ token }) });
    if (args.saveRaw) fs.writeFileSync(args.saveRaw, JSON.stringify(raw));
  }
  const avatars = args.noAvatars ? {} : await avatarsFor(raw, cfg);
  const embeds = readEmbeds(args);
  const { files, computed } = build(raw, cfg, { avatars, embeds, sample: args.sample });
  fs.mkdirSync(args.out, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(args.out, name), content);
  const e = computed.prSummary.external;
  console.log(`widgets listos en ${args.out} (${Object.keys(files).length} archivos): PRs ajenos ${e.total} (${e.merged} merged, ${e.open} open, ${e.closed} closed) en ${computed.prSummary.reposTotal} repos, propios ${computed.prSummary.own.total}; racha actual ${computed.streak.current.length}, mas larga ${computed.streak.longest.length}; lenguajes ${computed.languages.items.length}; avatares ${Object.values(avatars).filter(Boolean).length}/${Object.keys(avatars).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`fallo: ${String(err.message || err).replace(/(ghp_|github_pat_|ghs_|ghu_)[A-Za-z0-9_]+/g, '[redacted]')}`);
    process.exit(1);
  });
}
