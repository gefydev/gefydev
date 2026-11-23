import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLanguages, computeStats, computeStreak, groupPullRequests } from './compute.js';
import { fetchProfile, makeClient } from './github.js';
import { renderLanguages } from './svg/languages.js';
import { renderPrs } from './svg/prs.js';
import { renderStats } from './svg/stats.js';
import { renderStreak } from './svg/streak.js';
import { theme as defaultTheme } from './svg/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFINITIONS = {
  prs: 'PRs creados por la cuenta en cualquier repositorio PUBLICO (propio o ajeno), en todos los estados. Los repos privados nunca entran en los totales, aunque el token los vea: con includePrivate=aggregate se muestran aparte y sin nombres.',
  commits: 'Commits publicos de los ultimos 12 meses (contributionsCollection.totalCommitContributions).',
  stars: 'Estrellas de los repositorios publicos propios que no son forks.',
  languages: 'Bytes por lenguaje de los repositorios propios, no forks. Privados solo con includePrivate=aggregate.',
  streak: 'Dias consecutivos con al menos una contribucion en el calendario de GitHub; el dia en curso sin contribuciones aun no corta la racha.'
};

export function loadConfig(file = path.join(here, '..', 'config.json')) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    login: cfg.login,
    includePrivate: cfg.includePrivate === 'aggregate' ? 'aggregate' : 'off',
    prs: { maxRepos: 8, lastPerRepo: 3, ...cfg.prs },
    languages: { top: 6, excludeRepos: [], excludeLanguages: [], ...cfg.languages },
    stats: { excludeRepos: [], ...cfg.stats }
  };
}

export function build(raw, cfg, { theme = defaultTheme, now = new Date() } = {}) {
  const streak = computeStreak(raw.days);
  streak.since = (raw.user?.createdAt || streak.firstDate || '').slice(0, 10) || null;
  const prSummary = groupPullRequests(raw.prs, { login: cfg.login, includePrivate: cfg.includePrivate, maxRepos: cfg.prs.maxRepos, lastPerRepo: cfg.prs.lastPerRepo });
  const languages = computeLanguages(raw.repos, { ...cfg.languages, includePrivate: cfg.includePrivate });
  const stats = computeStats({ user: raw.user, repos: raw.repos, prSummary, streak, excludeRepos: cfg.stats.excludeRepos });
  const data = { generatedAt: now.toISOString(), login: cfg.login, definitions: DEFINITIONS, stats, streak, languages, prs: prSummary };
  const files = {
    'stats.svg': renderStats(stats, theme),
    'languages.svg': renderLanguages(languages, theme),
    'streak.svg': renderStreak(streak, theme),
    'prs.svg': renderPrs(prSummary, theme),
    'data.json': `${JSON.stringify(data, null, 2)}\n`
  };
  return { data, files };
}

function parseArgs(argv) {
  const out = { out: 'dist', fixture: null, saveRaw: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--fixture') out.fixture = argv[++i];
    else if (argv[i] === '--save-raw') out.saveRaw = argv[++i];
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
    const token = process.env.PROFILE_STATS_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    raw = await fetchProfile({ login: cfg.login, query: makeClient({ token }) });
    if (args.saveRaw) fs.writeFileSync(args.saveRaw, JSON.stringify(raw));
  }
  const { data, files } = build(raw, cfg);
  fs.mkdirSync(args.out, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(args.out, name), content);
  const t = data.prs.totals;
  console.log(`widgets listos en ${args.out}: PRs ${t.total} (${t.merged} merged, ${t.open} open, ${t.closed} closed; ajenos ${t.external.total}, propios ${t.own.total}), repos con PR ${data.prs.repoCount}, racha actual ${data.streak.current.length}, mas larga ${data.streak.longest.length}, lenguajes ${data.languages.items.length}`);
  if (data.prs.private) console.log(`privados (agregado): ${data.prs.private.total} PRs`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`fallo: ${String(err.message || err).replace(/(ghp_|github_pat_|ghs_|ghu_)[A-Za-z0-9_]+/g, '[redacted]')}`);
    process.exit(1);
  });
}
