export function toGlassData({ cfg, raw, stats, streak, languages, prSummary, avatars = {}, embeds = null, now = new Date() }) {
  const p = cfg.profile || {};
  const user = raw.user || {};
  return {
    now: now.toISOString(),
    embeds,
    profile: {
      name: p.name || user.name || cfg.login,
      login: cfg.login,
      tagline: p.tagline || '',
      links: p.links || {}
    },
    stats: {
      commits: stats.commitsLastYear,
      prs: stats.prs.total,
      issues: stats.issues,
      stars: stats.stars,
      contributedTo: prSummary.reposTotal
    },
    languages: languages.items.map((l) => ({ name: l.name, pct: Number(l.percent.toFixed(1)), color: l.name === 'Other' ? '#8b93ad' : l.color || '#8b93ad' })),
    streak: {
      total: streak.total,
      totalFrom: streak.since || streak.firstDate,
      totalTo: streak.lastDate,
      current: streak.current.length,
      currentFrom: streak.current.start,
      currentTo: streak.current.end,
      longest: streak.longest.length,
      longestFrom: streak.longest.start,
      longestTo: streak.longest.end
    },
    stack: p.stack || [],
    prs: {
      total: prSummary.external.total,
      merged: prSummary.external.merged,
      open: prSummary.external.open,
      closed: prSummary.external.closed,
      reposTotal: prSummary.reposTotal,
      ownTotal: prSummary.own.total,
      ownMerged: prSummary.own.merged,
      repos: prSummary.repos.map((r) => ({
        owner: r.owner,
        name: r.name,
        language: r.language,
        langColor: r.langColor,
        stars: r.stars,
        avatarDataUri: avatars[r.owner] || null,
        total: r.total,
        merged: r.merged,
        open: r.open,
        closed: r.closed,
        recent: r.recent.map((x) => ({ n: x.n, title: x.title, state: x.state, at: x.at }))
      }))
    }
  };
}
