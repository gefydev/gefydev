const DAY_MS = 86_400_000;
const dayIndex = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const fromIndex = (i) => new Date(i * DAY_MS).toISOString().slice(0, 10);

export function computeStreak(days = []) {
  const byDate = new Map();
  for (const d of days) {
    if (!d || typeof d.date !== 'string' || !Number.isFinite(Date.parse(`${d.date}T00:00:00Z`))) continue;
    byDate.set(d.date, Math.max(byDate.get(d.date) || 0, Number(d.count) || 0));
  }
  const dates = [...byDate.keys()].sort();
  const empty = { length: 0, start: null, end: null };
  if (!dates.length) return { total: 0, firstDate: null, lastDate: null, current: empty, longest: empty };
  let total = 0;
  let longest = { ...empty };
  let run = null;
  let prev = null;
  for (const date of dates) {
    const count = byDate.get(date);
    total += count;
    const idx = dayIndex(date);
    if (count > 0) {
      run = run && prev !== null && idx === prev + 1 ? { start: run.start, end: date, length: run.length + 1 } : { start: date, end: date, length: 1 };
      if (run.length > longest.length) longest = { ...run };
    } else {
      run = null;
    }
    prev = idx;
  }
  const lastDate = dates.at(-1);
  let current = { ...empty };
  let i = dates.length - 1;
  if (byDate.get(dates[i]) === 0) i -= 1;
  if (i >= 0 && byDate.get(dates[i]) > 0) {
    let end = dates[i];
    let start = end;
    let length = 1;
    while (i > 0 && dayIndex(dates[i - 1]) === dayIndex(dates[i]) - 1 && byDate.get(dates[i - 1]) > 0) {
      i -= 1;
      start = dates[i];
      length += 1;
    }
    current = { length, start, end };
  }
  return { total, firstDate: dates[0], lastDate, current, longest };
}

export function computeLanguages(repos = [], { top = 6, excludeRepos = [], excludeLanguages = [] } = {}) {
  const skipRepo = new Set(excludeRepos.map((s) => s.toLowerCase()));
  const skipLang = new Set(excludeLanguages.map((s) => s.toLowerCase()));
  const acc = new Map();
  for (const r of repos) {
    if (!r || r.isFork) continue;
    if (r.isPrivate) continue;
    if (skipRepo.has(String(r.name).toLowerCase())) continue;
    for (const e of r.languages?.edges || []) {
      const name = e?.node?.name;
      const size = Number(e?.size);
      if (!name || !Number.isFinite(size) || size <= 0 || skipLang.has(name.toLowerCase())) continue;
      const cur = acc.get(name) || { name, color: e.node.color || null, bytes: 0 };
      cur.bytes += size;
      acc.set(name, cur);
    }
  }
  const all = [...acc.values()].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const total = all.reduce((s, l) => s + l.bytes, 0);
  if (!total) return { total: 0, items: [] };
  const head = all.slice(0, Math.max(1, top));
  const rest = all.slice(head.length);
  const items = head.map((l) => ({ ...l, percent: (l.bytes / total) * 100 }));
  if (rest.length) {
    const bytes = rest.reduce((s, l) => s + l.bytes, 0);
    items.push({ name: 'Other', color: null, bytes, percent: (bytes / total) * 100, count: rest.length });
  }
  return { total, items };
}

const stateOf = (pr) => (pr.merged || pr.state === 'MERGED' ? 'merged' : pr.state === 'OPEN' ? 'open' : 'closed');

export function groupPullRequests(prs = [], { login, maxRepos = 6, lastPerRepo = 3 } = {}) {
  const counts = () => ({ total: 0, merged: 0, open: 0, closed: 0 });
  const external = counts();
  const own = counts();
  const byRepo = new Map();
  const me = String(login || '').toLowerCase();
  for (const pr of prs) {
    const repo = pr?.repository;
    if (!repo?.nameWithOwner || repo.isPrivate) continue;
    const st = stateOf(pr);
    const [owner, name] = repo.nameWithOwner.split('/');
    const isOwn = String(repo.owner?.login || owner).toLowerCase() === me;
    const bucket = isOwn ? own : external;
    bucket.total += 1;
    bucket[st] += 1;
    if (isOwn) continue;
    const e = byRepo.get(repo.nameWithOwner) || {
      owner: repo.owner?.login || owner,
      name: name || repo.nameWithOwner,
      language: repo.primaryLanguage?.name || null,
      langColor: repo.primaryLanguage?.color || null,
      stars: repo.stargazerCount ?? null,
      avatarUrl: repo.owner?.avatarUrl || null,
      ...counts(),
      prs: []
    };
    e.total += 1;
    e[st] += 1;
    e.prs.push({ n: pr.number, title: String(pr.title ?? ''), state: st, at: pr.createdAt });
    byRepo.set(repo.nameWithOwner, e);
  }
  const newest = (e) => e.prs.reduce((m, p) => (String(p.at) > m ? String(p.at) : m), '');
  const all = [...byRepo.values()]
    .map((e) => ({ ...e, recent: [...e.prs].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, lastPerRepo), newest: newest(e) }))
    .sort((a, b) => b.merged - a.merged || b.newest.localeCompare(a.newest) || b.total - a.total || `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`))
    .map(({ prs: _p, newest: _n, ...rest }) => rest);
  return { external, own, reposTotal: all.length, repos: all.slice(0, Math.max(0, maxRepos)) };
}

export function computeStats({ user, repos = [], prSummary, streak, excludeRepos = [] }) {
  const skip = new Set(excludeRepos.map((s) => s.toLowerCase()));
  const own = repos.filter((r) => r && !r.isPrivate && !skip.has(String(r.name).toLowerCase()));
  const cc = user?.contributionsCollection || {};
  return {
    login: user?.login || '',
    name: user?.name || user?.login || '',
    createdAt: user?.createdAt || null,
    followers: user?.followers?.totalCount ?? 0,
    publicRepos: own.length,
    stars: own.reduce((s, r) => s + (r.stargazerCount || 0), 0),
    commitsLastYear: cc.totalCommitContributions ?? 0,
    restrictedContributions: cc.restrictedContributionsCount ?? 0,
    reviews: cc.totalPullRequestReviewContributions ?? 0,
    issues: user?.issues?.totalCount ?? 0,
    contributedTo: user?.repositoriesContributedTo?.totalCount ?? 0,
    prs: prSummary?.external || { total: 0, merged: 0, open: 0, closed: 0 },
    prsOwn: prSummary?.own?.total ?? 0,
    contributionsTotal: streak?.total ?? 0
  };
}
