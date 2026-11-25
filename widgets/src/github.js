const ENDPOINT = 'https://api.github.com/graphql';

export class GraphQLError extends Error {
  constructor(message, { status = 0, errors = null } = {}) {
    super(message);
    this.name = 'GraphQLError';
    this.status = status;
    this.errors = errors;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeClient({ token, fetchImpl = globalThis.fetch, retries = 3, baseDelayMs = 1500, endpoint = ENDPOINT } = {}) {
  if (!token) throw new GraphQLError('Falta el token (PROFILE_STATS_TOKEN o GITHUB_TOKEN)');
  return async function query(text, variables = {}) {
    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'profile-widgets' },
          body: JSON.stringify({ query: text, variables }),
          signal: AbortSignal.timeout(30_000)
        });
        const body = await res.json().catch(() => null);
        if (res.status >= 500 || res.status === 429 || (res.status === 403 && /rate limit|abuse|secondary/i.test(JSON.stringify(body ?? '')))) {
          last = new GraphQLError(`HTTP ${res.status}`, { status: res.status });
        } else if (!res.ok) {
          throw new GraphQLError(`HTTP ${res.status}${body?.message ? `: ${body.message}` : ''}`, { status: res.status });
        } else if (!body?.data) {
          throw new GraphQLError(`Respuesta sin datos${body?.errors ? `: ${body.errors.map((e) => e.message).join('; ')}` : ''}`, { errors: body?.errors });
        } else {
          if (body.errors?.length) body.data.__errors = body.errors.map((e) => e.message);
          return body.data;
        }
      } catch (err) {
        if (err instanceof GraphQLError && err.status && err.status < 500 && err.status !== 429) throw err;
        if (err instanceof GraphQLError && !err.status) throw err;
        last = err;
      }
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
    }
    throw last;
  };
}

const USER_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    login name createdAt
    avatarUrl(size: 96)
    followers { totalCount }
    issues { totalCount }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]) { totalCount }
    contributionsCollection { totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, orderBy: { field: NAME, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name isPrivate isFork stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

const PRS_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    pullRequests(first: 100, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number title state merged isDraft createdAt mergedAt closedAt url
        repository { nameWithOwner isPrivate isFork stargazerCount url primaryLanguage { name color } owner { login avatarUrl(size: 60) } }
      }
    }
  }
}`;

export const yearRanges = (createdAt, now = new Date()) => {
  const start = new Date(createdAt).getUTCFullYear();
  const end = now.getUTCFullYear();
  const out = [];
  for (let y = start; y <= end; y++) {
    out.push({ alias: `y${y}`, from: `${y}-01-01T00:00:00Z`, to: y === end ? now.toISOString() : `${y}-12-31T23:59:59Z` });
  }
  return out;
};

export const calendarQuery = (ranges) =>
  `query($login: String!) { user(login: $login) { ${ranges
    .map((r) => `${r.alias}: contributionsCollection(from: "${r.from}", to: "${r.to}") { contributionCalendar { weeks { contributionDays { date contributionCount } } } }`)
    .join(' ')} } }`;

export async function fetchProfile({ login, query, now = new Date() }) {
  let user = null;
  const repos = [];
  let after = null;
  for (;;) {
    const data = await query(USER_QUERY, { login, after });
    if (!data.user) throw new GraphQLError(`Usuario "${login}" no encontrado`);
    user ??= data.user;
    repos.push(...data.user.repositories.nodes);
    if (!data.user.repositories.pageInfo.hasNextPage) break;
    after = data.user.repositories.pageInfo.endCursor;
  }
  const prs = [];
  after = null;
  for (;;) {
    const data = await query(PRS_QUERY, { login, after });
    const page = data.user.pullRequests;
    prs.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  const ranges = yearRanges(user.createdAt, now);
  const cal = await query(calendarQuery(ranges), { login });
  const days = [];
  for (const r of ranges) {
    for (const w of cal.user?.[r.alias]?.contributionCalendar?.weeks || []) {
      for (const d of w.contributionDays) days.push({ date: d.date, count: d.contributionCount });
    }
  }
  return { user, repos, prs, days, fetchedAt: now.toISOString() };
}
