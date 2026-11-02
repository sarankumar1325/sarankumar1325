#!/usr/bin/env node
// Writes README.md and the calendar and icons in assets/ from data/activity.json. The koi pond at
// the top comes from scripts/pond.mjs and does not depend on the data, so it is drawn separately.
//   node scripts/build.mjs            rewrite the README from data/activity.json
//   node scripts/build.mjs --refresh  fetch the latest activity from GitHub first
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => path.join(ROOT, ...parts);

// The profile's own account comes first; every number, graph and list adds the others in.
const ACCOUNTS = ['sarankumar1325', 'swsarancodes'];
const HOME = `https://github.com/${ACCOUNTS[0]}`;
const TIME_ZONE = 'Asia/Kolkata';
const W = 846; // the width of a profile README on a desktop screen
const DAY = 864e5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// GitHub's own colours. The empty cell in dark is a tint rather than a colour, so it also suits dark dimmed.
const THEMES = {
  light: { muted: '#59636e', edge: '#1f23280d', cells: ['fill:#eff2f5', 'fill:#aceebb', 'fill:#4ac26b', 'fill:#2da44e', 'fill:#116329'] },
  dark: { muted: '#9198a1', edge: '#0104090d', cells: ['fill:#f0f6fc;fill-opacity:.045', 'fill:#033a16', 'fill:#196c2e', 'fill:#2ea043', 'fill:#56d364'] },
};
// An SVG shown through <img> cannot load web fonts but can use installed ones, so its labels ask
// for the same system fonts GitHub sets its own text in.
const SYSTEM_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const number = (n) => n.toLocaleString('en-US');
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const addDays = (date, n) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const local = (iso, options) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options }).format(new Date(iso));
const localDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso));
const ownName = (repo) => {
  const [owner, name] = repo.split('/');
  return ACCOUNTS.includes(owner) ? name : repo;
};
const round = (n) => Math.round(n * 10) / 10;

// GitHub's own levels: quartiles of the days that have any contributions at all.
function levels(days) {
  const counts = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => counts[Math.floor(p * (counts.length - 1))] ?? 0;
  const [a, b, c] = [q(0.25), q(0.5), q(0.75)];
  return (n) => (n === 0 ? 0 : n <= a ? 1 : n <= b ? 2 : n <= c ? 3 : 4);
}

function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const { count } of days) {
    run = count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today still counts as open, so a streak only breaks once a whole day passes without a contribution.
  let current = 0;
  for (let i = days.length - (days.at(-1).count ? 1 : 2); i >= 0 && days[i].count > 0; i--) current++;
  return { current, longest };
}

// The year as GitHub draws it, at the full width of the README, without weekday labels. Where the
// image is drawn narrower than 600px, as on a phone, every other month is named in larger type.
function calendar(days, theme, title) {
  const t = THEMES[theme];
  const level = levels(days);
  const first = new Date(Date.parse(days[0].date)).getUTCDay();
  const cols = Math.ceil((days.length + first) / 7);
  const gap = 3;
  const pitch = (W + gap) / cols;
  const cell = pitch - gap;
  const top = 32;
  const height = Math.ceil(top + 7 * pitch - gap);

  const cells = days.map(({ count }, i) => {
    const slot = i + first;
    const x = Math.floor(slot / 7) * pitch;
    const y = top + (slot % 7) * pitch;
    return `<rect class="c${level(count)}" x="${round(x + 0.5)}" y="${round(y + 0.5)}" width="${round(cell - 1)}" height="${round(cell - 1)}" rx="2"/>`;
  });

  // A month is named over the first week whose Sunday falls in it, unless its name would run off the edge.
  const months = [];
  for (let c = 0; c < cols; c++) {
    const sunday = new Date(Date.parse(days[0].date) + (c * 7 - first) * DAY);
    if (sunday.getUTCDate() <= 7 && c * pitch + 40 <= W) months.push({ x: round(c * pitch), name: MONTHS[sunday.getUTCMonth()] });
  }
  const label = (m, cls) => `<text class="${cls}" x="${m.x}" y="${cls === 'wide' ? 20 : 25}">${m.name}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-labelledby="title">`,
    `<title id="title">${escape(title)}</title>`,
    `<style>text{font-family:${SYSTEM_FONT};fill:${t.muted}}.wide{font-size:12px}.narrow{font-size:26px;display:none}@media (max-width:600px){.wide{display:none}.narrow{display:inline}}${t.cells.map((rule, i) => `.c${i}{${rule}}`).join('')}rect{stroke:${t.edge}}</style>`,
    ...months.map((m) => label(m, 'wide')),
    ...months.filter((_, i) => i % 2 === 0).map((m) => label(m, 'narrow')),
    ...cells,
    '</svg>',
    '',
  ].join('\n');
}

// Octicons (MIT License, GitHub Inc.; see scripts/octicons-LICENSE). The merged purple sits between
// GitHub's light and dark shades, so one file reads on either theme; so does the green of the bars.
const ICONS = {
  'merged.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#8957e5" d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"/></svg>\n`,
  // Stretched to any width by the README. GitHub sets images to height: auto, so the bar has no size
  // or shape of its own that would make a short bar thinner than a long one.
  'bar.svg': `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#2ea043"/></svg>\n`,
};

const TYPES = 'build|chore|ci|docs|feat|fix|perf|refactor|revert|security|style|test';

// Pull request titles lose commit-style prefixes; code in backticks is shown as code.
function tidy(title) {
  const plain = title
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(new RegExp(`^\\s*(?:${TYPES})(?:\\([^)]*\\))?!?:\\s*`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();
  const capital = plain.charAt(0).toUpperCase() + plain.slice(1);
  return capital
    .split('`')
    .map((part, i) => (i % 2 ? `<code>${escape(part)}</code>` : escape(part)))
    .join('');
}

const SUMMARY = `query($login: String!, $month: DateTime!, $quarter: DateTime!) {
  user(login: $login) {
    year: contributionsCollection {
      totalCommitContributions
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
    month: contributionsCollection(from: $month) { ...repos }
    quarter: contributionsCollection(from: $quarter) { ...repos }
    pushed: repositories(first: 5, privacy: PUBLIC, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes { nameWithOwner pushedAt }
    }
  }
}
fragment repos on ContributionsCollection {
  commitContributionsByRepository(maxRepositories: 25) {
    repository { nameWithOwner url isPrivate }
    contributions { totalCount }
  }
}`;

// Search finds merged pull requests far more cheaply than paging through every contribution, which
// trips GitHub's secondary rate limit for the token Actions provides.
const SEARCH = `query($merged: String!, $recent: String!, $after: String, $count: Boolean!) {
  merged: search(type: ISSUE, query: $merged, first: 1) @include(if: $count) { issueCount }
  recent: search(type: ISSUE, query: $recent, first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { number title url mergedAt repository { nameWithOwner stargazerCount } } }
  }
}`;

async function refresh() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const headers = { authorization: `bearer ${token}`, 'user-agent': `${ACCOUNTS[0]}-profile-readme` };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let last = 0;
  const call = async (url, init, read) => {
    for (let attempt = 1; ; attempt++) {
      // Bursts are what set off the secondary rate limit, so requests go out at least a second apart.
      await sleep(Math.max(0, last + 1000 - Date.now()));
      last = Date.now();
      const response = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
      const body = await response.json().catch(() => null);
      const failure = !response.ok ? `${response.status} ${JSON.stringify(body)?.slice(0, 300)}` : body?.errors ? JSON.stringify(body.errors).slice(0, 300) : null;
      if (!failure) return read(body);
      const limited = ([403, 429].includes(response.status) && /rate limit/i.test(failure)) || body?.errors?.some((e) => e.type === 'RATE_LIMITED');
      if (attempt === 4 || !(limited || response.status >= 500)) throw new Error(`${url} failed: ${failure}`);
      const wait = Number(response.headers.get('retry-after')) || (limited ? 60 * attempt : 2 * attempt);
      console.log(`GitHub answered ${response.status}; trying again in ${wait}s.`);
      await sleep(wait * 1000);
    }
  };
  const graphql = (query, variables) =>
    call('https://api.github.com/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) }, (body) => body.data);

  const now = Date.now();
  const since = (days) => new Date(now - days * DAY).toISOString();
  const outside = ACCOUNTS.map((a) => `-user:${a}`).join(' ');
  const calendar = new Map();
  const repos = { month: new Map(), quarter: new Map() };
  const pulls = [];
  let commits = 0;
  let merged = 0;
  let push = null;

  for (const login of ACCOUNTS) {
    const { user } = await graphql(SUMMARY, { login, month: since(30), quarter: since(90) });
    for (const week of user.year.contributionCalendar.weeks) {
      for (const { date, contributionCount } of week.contributionDays) calendar.set(date, (calendar.get(date) ?? 0) + contributionCount);
    }
    commits += user.year.totalCommitContributions;
    // The events API can miss pushes entirely, so the latest push comes from each repository instead.
    // Profile repositories are skipped because a workflow, not a person, pushes to them.
    for (const { nameWithOwner, pushedAt } of user.pushed.nodes) {
      const own = ACCOUNTS.some((a) => nameWithOwner === `${a}/${a}`);
      if (!own && pushedAt && (!push || pushedAt > push.at)) push = { repo: nameWithOwner, at: pushedAt };
    }
    for (const window of ['month', 'quarter']) {
      for (const { repository, contributions } of user[window].commitContributionsByRepository) {
        if (repository.isPrivate) continue;
        const entry = repos[window].get(repository.nameWithOwner) ?? { repo: repository.nameWithOwner, url: repository.url, commits: 0 };
        entry.commits += contributions.totalCount;
        repos[window].set(repository.nameWithOwner, entry);
      }
    }

    // Every merged pull request opened this year counts; the list only wants other people's repositories.
    const queries = {
      merged: `author:${login} is:pr is:merged is:public created:>=${since(365).slice(0, 10)}`,
      recent: `author:${login} is:pr is:merged is:public merged:>=${since(60).slice(0, 10)} ${outside}`,
    };
    let after = null;
    do {
      const result = await graphql(SEARCH, { ...queries, after, count: after === null });
      if (result.merged) merged += result.merged.issueCount;
      for (const pr of result.recent.nodes) {
        if (!pr?.repository || !pr.mergedAt) continue;
        const stars = pr.repository.stargazerCount;
        // Stars are kept at the precision they are shown with, so the data only changes when the README does.
        pulls.push({ repo: pr.repository.nameWithOwner, number: pr.number, title: pr.title, url: pr.url, stars: stars >= 1000 ? Math.round(stars / 100) * 100 : stars, mergedAt: pr.mergedAt });
      }
      after = result.recent.pageInfo.hasNextPage ? result.recent.pageInfo.endCursor : null;
    } while (after);
  }

  const dates = [...calendar.keys()].sort();
  const start = dates[0];
  const length = Math.round((Date.parse(dates.at(-1)) - Date.parse(start)) / DAY) + 1;
  const counts = Array.from({ length }, (_, i) => calendar.get(addDays(start, i)) ?? 0);

  // One pull request per repository, the most recent, from the last 60 days, best known first.
  const cutoff = Date.parse(dates.at(-1)) - 60 * DAY;
  const latest = new Map();
  for (const pr of pulls.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt))) {
    if (Date.parse(pr.mergedAt) >= cutoff && !latest.has(pr.repo)) latest.set(pr.repo, pr);
  }
  const top = (map) => [...map.values()].sort((a, b) => b.commits - a.commits || a.repo.localeCompare(b.repo)).slice(0, 10);
  const data = {
    accounts: ACCOUNTS,
    calendar: { start, counts },
    commits,
    merged,
    push,
    pulls: [...latest.values()].sort((a, b) => b.stars - a.stars || b.mergedAt.localeCompare(a.mergedAt)).slice(0, 24),
    repos: { month: top(repos.month), quarter: top(repos.quarter) },
  };
  const json = JSON.stringify(data, null, 2).replace(/"counts": \[[\s\d,]*\]/, (m) => m.replace(/\s+/g, '').replace('"counts":', '"counts": '));
  fs.mkdirSync(at('data'), { recursive: true });
  fs.writeFileSync(at('data', 'activity.json'), `${json}\n`);
  console.log(`Saved activity: ${counts.reduce((a, b) => a + b, 0)} contributions, ${commits} commits, ${merged} merged pull requests, ${data.pulls.length} recent merges.`);
}

if (process.argv.includes('--refresh')) await refresh();
const data = JSON.parse(fs.readFileSync(at('data', 'activity.json'), 'utf8'));
const days = data.calendar.counts.map((count, i) => ({ date: addDays(data.calendar.start, i), count }));
const total = days.reduce((sum, d) => sum + d.count, 0);
const { current, longest } = streaks(days);
const asOf = Date.parse(days.at(-1).date) + DAY;
const profile = (login) => `<a href="https://github.com/${login}">@${login}</a>`;

const recent = data.pulls.filter((p) => asOf - Date.parse(p.mergedAt) <= 30 * DAY);
const pulls = (recent.length >= 4 ? recent : data.pulls)
  .slice(0, 6)
  .map((p) => ({ ...p, key: localDay(p.mergedAt) }))
  .sort((a, b) => b.key.localeCompare(a.key) || b.stars - a.stars);

const window = data.repos.month.length >= 3 ? 30 : 90;
const repos = data.repos[window === 30 ? 'month' : 'quarter'].slice(0, 5);

// Pictures switch with the GitHub theme, and only the one for the theme in use is downloaded.
const picture = (name, ext, alt, width) =>
  [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.${ext}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="assets/${name}-light.${ext}">`,
    `  <img src="assets/${name}-light.${ext}" width="${width}" alt="${escape(alt)}">`,
    '</picture>',
  ].join('\n');

const sections = [];
sections.push(picture('pond', 'gif', 'sarankumar, written on the floor of a koi pond while five koi swim over it', W));

// Each figure keeps its words on one line, so a narrow screen breaks the line only between figures,
// and a separator stays at the end of the line it follows.
const keep = (s) => s.replace(/ /g, '&nbsp;');
const SEP = '&nbsp;&nbsp;·&nbsp; ';
const figures = [
  `<b>${number(total)}</b> contributions in the last year`,
  `<b>${number(data.commits)}</b> commits`,
  `<b>${number(data.merged)}</b> pull requests merged`,
  current >= 3 ? `<b>${number(current)}</b> days in a row` : `longest streak <b>${number(longest)}</b> days`,
];
sections.push(`<p>\n${figures.map(keep).join(SEP)}\n</p>`);

const accounts = ACCOUNTS.map((a) => `@${a}`).join(' and ');
const graphTitle = `Contribution graph for the last 12 months: ${number(total)} contributions across ${accounts}.`;
const notes = [`Counting ${ACCOUNTS.map(profile).join(' and ')}`];
if (data.push) {
  const when = local(data.push.at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(' at ', ', ');
  notes.push(`last push to <a href="https://github.com/${data.push.repo}">${escape(ownName(data.push.repo))}</a> on ${when} IST`);
}
sections.push(`${picture('calendar', 'svg', graphTitle, W)}\n<p><sub>${notes.join(SEP)}</sub></p>`);

if (pulls.length) {
  const search = `https://github.com/search?q=${encodeURIComponent(`${ACCOUNTS.map((a) => `author:${a}`).join(' ')} is:pr is:merged`)}&type=pullrequests`;
  const items = pulls.map((p) => {
    const ref = `${p.repo}#${p.number}`;
    const meta = [`<a href="${escape(p.url)}">${escape(ref)}</a>`, keep(`merged ${local(p.mergedAt, { day: 'numeric', month: 'short' })}`), keep(`★ ${compact(p.stars)}`)];
    return `<p>\n<a href="${escape(p.url)}"><img src="assets/merged.svg" width="16" height="16" align="absmiddle" alt="Merged"></a>&ensp;<b>${tidy(p.title)}</b><br>\n<sub>${meta.join(SEP)}</sub>\n</p>`;
  });
  sections.push(`### Recently merged\n\n${items.join('\n\n')}\n\n<p><sub><a href="${escape(search)}">All merged pull requests</a></sub></p>`);
}

if (repos.length) {
  const most = Math.max(...repos.map((r) => r.commits));
  const rows = repos.map((r) => {
    const share = Math.max(1, Math.round((40 * r.commits) / most));
    return `<a href="${escape(r.url)}"><img src="assets/bar.svg" width="${share}%" height="8" alt=""></a>&ensp;<b>${number(r.commits)}</b>&ensp;<a href="${escape(r.url)}">${escape(ownName(r.repo))}</a>`;
  });
  sections.push(`### Commits in the last ${window} days\n\n<p>\n${rows.join('<br>\n')}\n</p>`);
}

// Only files this script owns are replaced; the pond GIFs in assets/ are left alone.
for (const file of fs.readdirSync(at('assets'))) if (file.endsWith('.svg')) fs.rmSync(at('assets', file));
for (const theme of ['light', 'dark']) fs.writeFileSync(at('assets', `calendar-${theme}.svg`), calendar(days, theme, graphTitle));
for (const [file, svg] of Object.entries(ICONS)) fs.writeFileSync(at('assets', file), svg);

const readme = ['<!-- Written by scripts/build.mjs from data/activity.json; the pond is drawn by scripts/pond.mjs. -->', '', ...sections.flatMap((s) => [s, ''])].join('\n');
fs.writeFileSync(at('README.md'), readme);
console.log(`README.md written: ${number(total)} contributions, ${pulls.length} merged pull requests, ${repos.length} repositories.`);
