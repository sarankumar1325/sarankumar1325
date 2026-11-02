#!/usr/bin/env node
// Writes README.md and every image in assets/ from data/activity.json.
//   node scripts/build.mjs            redraw everything from data/activity.json
//   node scripts/build.mjs --refresh  fetch the latest activity from GitHub first
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => path.join(ROOT, ...parts);
const SITE = 'https://www.sarankumar.space';

// The profile's own account comes first; every number, graph and list adds the others in.
const ACCOUNTS = ['sarankumar1325', 'swsarancodes'];
const HOME = `https://github.com/${ACCOUNTS[0]}`;
const TIME_ZONE = 'Asia/Kolkata';

const PROFILE = {
  name: 'Saran Kumar',
  full: 'Saran Kumar S.',
  // Longest first; each composition takes the first pair whose lines both fit their column.
  role: [
    ['Applied AI engineer at goML', 'Coimbatore, India'],
    ['Applied AI engineer', 'goML, Coimbatore'],
    ['AI engineer', 'goML'],
  ],
};

function loadFont(file) {
  const buf = fs.readFileSync(at('scripts', 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Text is drawn as outlines because an SVG shown through <img> cannot load web fonts.
const FONTS = { l: loadFont('mona-sans-300.ttf'), r: loadFont('mona-sans-400.ttf'), m: loadFont('mona-sans-500.ttf') };

// Octicons (MIT License, GitHub Inc.; see scripts/octicons-LICENSE), drawn on a 16-unit grid.
const ICONS = {
  merge: 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z',
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
};

// GitHub's own colours, so the artwork reads as part of the page in either theme. The empty
// contribution cell in dark is a tint rather than a colour, so it also matches dark dimmed.
const THEMES = {
  light: {
    ink: '#1f2328', muted: '#59636e', live: '#1a7f37', done: '#8250df', edge: '#1f23280d',
    cells: ['fill:#eff2f5', 'fill:#aceebb', 'fill:#4ac26b', 'fill:#2da44e', 'fill:#116329'],
  },
  dark: {
    ink: '#f0f6fc', muted: '#9198a1', live: '#3fb950', done: '#ab7df8', edge: '#0104090d',
    cells: ['fill:#f0f6fc;fill-opacity:.045', 'fill:#033a16', 'fill:#196c2e', 'fill:#2ea043', 'fill:#56d364'],
  },
};

const W = 846;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = 864e5;

// Each image holds five compositions. A media query inside an SVG measures the image as drawn on the
// page, so each composition takes over where the one before would shrink its text below about 14px.
// `k` turns a desktop pixel size into viewBox units; `below` is the widest drawing it covers.
const SIZES = [
  { cls: 'D', k: 1 },
  { cls: 'L', k: 1.16, below: 740 },
  { cls: 'T', k: 1.45, below: 640 },
  { cls: 'M', k: 1.85, below: 520 },
  { cls: 'P', k: 2.31, below: 420 },
];
const RESPONSIVE = [
  `${SIZES.slice(1).map(({ cls }) => `.${cls}`).join(',')}{display:none}`,
  ...SIZES.slice(1).map(({ cls, below }, i) => `@media (max-width:${below}px){.${SIZES[i].cls}{display:none}.${cls}{display:inline}}`),
].join('');
const CALM = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

const round = (n) => Math.round(n * 10) / 10;
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

function shape(text, face, size, tracking = 0) {
  const font = FONTS[face];
  const scale = size / font.unitsPerEm;
  const kerning = font.position && font.position.defaultKerningTables;
  const glyphs = font.stringToGlyphs(text);
  const placed = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    placed.push({ glyph, x });
    x += (glyph.advanceWidth || 0) * scale;
    const next = glyphs[i + 1];
    if (!next) return;
    const kern = kerning ? font.position.getKerningValue(kerning, glyph.index, next.index) : font.getKerningValue(glyph, next);
    x += kern * scale + tracking * size;
  });
  return { face, size, scale, placed, width: x };
}

// The width of a vertical stroke in Mona Sans Regular, per 1000 units.
const STEM = (() => { const box = FONTS.r.charToGlyph('l').getBoundingBox(); return box.x2 - box.x1; })();
const capHeight = (face, size) => (FONTS[face].tables.os2.sCapHeight / FONTS[face].unitsPerEm) * size;

// The inked extent of a line, so large type can sit on the margin by its edge rather than its side bearing.
function ink(shaped) {
  let left = Infinity;
  let right = -Infinity;
  for (const { glyph, x } of shaped.placed) {
    const box = glyph.getBoundingBox();
    if (box.x1 === box.x2) continue;
    left = Math.min(left, x + box.x1 * shaped.scale);
    right = Math.max(right, x + box.x2 * shaped.scale);
  }
  return { left, right, width: right - left };
}

function fitToWidth(text, face, tracking, width) {
  const probe = ink(shape(text, face, 100, tracking));
  const shaped = shape(text, face, (100 * width) / probe.width, tracking);
  return { shaped, offset: -ink(shaped).left };
}

const fits = (text, face, size, width) => shape(text, face, size).width <= width;
const firstFitting = (options, face, size, width) => options.find((t) => fits(t, face, size, width)) ?? null;

function clip(text, face, size, width) {
  if (fits(text, face, size, width)) return text;
  const words = text.split(' ');
  while (words.length > 1) {
    words.pop();
    const cut = `${words.join(' ').replace(/[\s,:;.\-]+$/, '')}…`;
    if (fits(cut, face, size, width)) return cut;
  }
  return clipName(text, face, size, width);
}

// Repository names have no spaces to break at, so they lose characters instead of words.
function clipName(text, face, size, width) {
  if (fits(text, face, size, width)) return text;
  for (let n = text.length - 1; n > 1; n--) {
    const cut = `${text.slice(0, n).replace(/[\s\-_./]+$/, '')}…`;
    if (fits(cut, face, size, width)) return cut;
  }
  return '…';
}

class Svg {
  constructor(width, height, title) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.glyphs = new Map();
    this.icons = new Set();
    this.styles = [];
    this.defs = [];
    this.body = [];
  }

  glyph(face, glyph) {
    const id = face + glyph.index;
    if (!this.glyphs.has(id)) this.glyphs.set(id, glyph.getPath(0, 0, FONTS[face].unitsPerEm).toPathData(0));
    return this.glyphs.get(id) ? id : null;
  }

  text(shaped, x, y, { cls, anchor = 'start' } = {}) {
    const left = anchor === 'end' ? x - shaped.width : x;
    const uses = shaped.placed
      .map(({ glyph, x: gx }) => {
        const id = this.glyph(shaped.face, glyph);
        return id ? `<use href="#${id}" x="${Math.round(gx / shaped.scale)}"/>` : '';
      })
      .join('');
    return `<g transform="translate(${round(left)} ${round(y)}) scale(${shaped.scale.toFixed(5)})"${cls ? ` class="${cls}"` : ''}>${uses}</g>`;
  }

  icon(name, x, y, size, cls) {
    this.icons.add(name);
    return `<use href="#icon-${name}" class="${cls}" transform="translate(${round(x)} ${round(y)}) scale(${(size / 16).toFixed(4)})"/>`;
  }

  // An arrow pointing up and to the right, drawn at the weight of the text it follows.
  arrow(right, baseline, size, tone) {
    const cap = capHeight('r', size);
    const stem = (STEM * size) / 1000;
    const box = cap * 0.74;
    const inset = stem / 2;
    const x2 = right - inset;
    const y2 = baseline - cap + inset;
    const x1 = x2 - box + inset;
    const y1 = y2 + box - inset;
    const head = box * 0.66;
    const d = `M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}M${round(x2 - head)} ${round(y2)}H${round(x2)}V${round(y2 + head)}`;
    return { span: box, svg: `<path class="${tone}s" d="${d}" fill="none" stroke-width="${round(stem * 100) / 100}" stroke-linecap="square"/>` };
  }

  render(theme) {
    const t = THEMES[theme];
    const palette = [
      `.i{fill:${t.ink}}.m{fill:${t.muted}}.g{fill:${t.live}}.d{fill:${t.done}}.is{stroke:${t.ink}}.ms{stroke:${t.muted}}.edge{stroke:${t.edge}}`,
      ...t.cells.map((rule, i) => `.c${i}{${rule}}`),
    ].join('');
    const paths = [...this.glyphs].filter(([, d]) => d).map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
    const icons = [...this.icons].map((name) => `<path id="icon-${name}" d="${ICONS[name]}"/>`).join('');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" role="img" aria-labelledby="title">`,
      `<title id="title">${escape(this.title)}</title>`,
      `<style>${palette}${this.styles.join('')}${CALM}</style>`,
      `<defs>${paths}${icons}${this.defs.join('')}</defs>`,
      ...this.body,
      '</svg>',
      '',
    ].join('\n');
  }
}

// The name across the full measure, then two columns hung from the start of each word.
function hero(status) {
  const height = 236;
  const svg = new Svg(W, height, `${PROFILE.full}, applied AI engineer at goML in Coimbatore, India. ${status.alt}`);
  const tracking = -0.02;
  const { shaped: mark, offset } = fitToWidth(PROFILE.name, 'l', tracking, W);
  const base = Math.round(6 + capHeight('l', mark.size));
  const k = mark.placed.find(({ glyph }) => glyph.unicode === 'K'.charCodeAt(0));
  const column = round(offset + k.x + k.glyph.getBoundingBox().x1 * mark.scale);

  svg.styles.push(
    `.up{animation:up 1.1s ${EASE} both}@keyframes up{from{transform:translateY(1150px)}to{transform:none}}`,
    '.fade{animation:fade .9s ease-out .75s both}@keyframes fade{from{opacity:0}to{opacity:1}}',
    '.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.6s ease-out 1.6s infinite both}@keyframes pulse{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.8);opacity:0}}',
    RESPONSIVE,
  );

  // Each letter rises from behind its own baseline.
  svg.defs.push(`<clipPath id="mask"><rect x="-10" y="-10" width="${W + 20}" height="${round(base + mark.size * 0.08 + 10)}"/></clipPath>`);
  let i = 0;
  const letters = mark.placed
    .map(({ glyph, x }) => {
      const id = svg.glyph('l', glyph);
      if (!id) return '';
      const delay = (0.12 + i++ * 0.045).toFixed(3);
      return `<g class="up" style="animation-delay:${delay}s"><use href="#${id}" x="${Math.round(x / mark.scale)}"/></g>`;
    })
    .join('');
  svg.body.push(`<g clip-path="url(#mask)"><g class="i" transform="translate(${round(offset)} ${base}) scale(${mark.scale.toFixed(5)})">${letters}</g></g>`);

  const choose = (pairs, size, limit) =>
    pairs.find((pair) => pair.every((t) => fits(t, 'r', size, limit))) ?? pairs.at(-1).map((t) => clip(t, 'r', size, limit));

  for (const { cls, k: scale } of SIZES) {
    const size = 16 * scale;
    const first = base + 40 - (scale - 1) * 8 + capHeight('r', size);
    const lead = size * (1.5 - 0.1 * (scale - 1));
    const [l1, l2] = choose(PROFILE.role, size, column - 24 * scale);
    const [r1, r2] = choose(status.lines, size, W - column);
    const lines = [
      svg.text(shape(l1, 'r', size), 0, first, { cls: 'i' }),
      svg.text(shape(l2, 'r', size), 0, first + lead, { cls: 'm' }),
      svg.text(shape(r1, 'r', size), column, first, { cls: 'i' }),
      svg.text(shape(r2, 'r', size), column, first + lead, { cls: 'm' }),
    ];
    // The live dot hangs in the gutter so both columns keep their edges.
    const r = 3.4 * scale;
    const dx = round(column - 14 * scale);
    const dy = round(first - capHeight('r', size) / 2);
    const dot = `<circle class="g pulse" cx="${dx}" cy="${dy}" r="${round(r)}"/><circle class="g" cx="${dx}" cy="${dy}" r="${round(r)}"/>`;
    svg.body.push(`<g class="${cls}"><g class="fade">${lines.join('')}${dot}</g></g>`);
  }
  return svg;
}

const HEAD = 88;
const headBaseline = (k) => HEAD - 22 - (k - 1) * 6;

function headingParts(svg, label, more, k, { arrow = true } = {}) {
  const size = 16 * k;
  const y = headBaseline(k);
  const parts = [svg.text(shape(label, 'r', size), 0, y, { cls: 'm' })];
  if (more) {
    const mark = arrow ? svg.arrow(W, y, size, 'm') : null;
    const right = mark ? W - mark.span - 6 * k : W;
    parts.push(svg.text(shape(more, 'r', size), right, y, { cls: 'm', anchor: 'end' }));
    if (mark) parts.push(mark.svg);
  }
  return parts;
}

function heading(label, more, options) {
  const svg = new Svg(W, HEAD, more ? `${label}. ${more}.` : label);
  svg.styles.push(RESPONSIVE);
  for (const { cls, k } of SIZES) svg.body.push(`<g class="${cls}">${headingParts(svg, label, more, k, options).join('')}</g>`);
  return svg;
}

// The year in a few numbers, set in the light weight of the name. Narrow compositions drop the
// least telling numbers rather than shrink the rest, and every composition is centred in the
// height the tallest one needs.
function stats(items) {
  const svg = new Svg(W, 0, `${items.map((s) => `${s.value} ${s.label}`).join(', ')}.`);
  svg.styles.push(`.rise{animation:rise .9s ${EASE} both}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`, RESPONSIVE);
  const layouts = SIZES.map(({ cls, k }) => {
    const big = 44 * Math.min(k, 1.25);
    const size = 16 * k;
    let layout = null;
    for (let n = items.length; n >= 1 && !layout; n--) {
      const kept = [...items].sort((a, b) => a.rank - b.rank).slice(0, n);
      const shown = items.filter((s) => kept.includes(s));
      const col = W / n;
      const room = col - 16 * k;
      const labels = shown.map((s) => firstFitting([s.label, s.short], 'r', size, room));
      if (n === 1 || (labels.every(Boolean) && shown.every((s) => fits(s.value, 'l', big, room)))) layout = { col, shown, labels };
    }
    const top = capHeight('l', big);
    const base = top + 13 * Math.min(k, 1.5) + capHeight('r', size);
    return { cls, k, big, size, layout, top, base, need: base + size * 0.3 };
  });
  const height = Math.ceil(Math.max(...layouts.map((l) => l.need)) + 24);
  svg.height = height;
  for (const { cls, big, size, layout, top, base, need } of layouts) {
    const shift = (height - need) / 2;
    const parts = layout.shown.map((s, i) => {
      const x = round(i * layout.col);
      const figure = shape(s.value, 'l', big);
      const label = layout.labels[i] ?? s.short;
      const delay = (0.1 + i * 0.08).toFixed(2);
      return `<g class="rise" style="animation-delay:${delay}s">${svg.text(figure, x - ink(figure).left, shift + top, { cls: 'i' })}${svg.text(shape(label, 'r', size), x, shift + base, { cls: 'm' })}</g>`;
    });
    svg.body.push(`<g class="${cls}">${parts.join('')}</g>`);
  }
  return svg;
}

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

// The year as GitHub draws it, larger, without weekday labels, and in the same greens.
function calendar(days) {
  const level = levels(days);
  const first = new Date(Date.parse(days[0].date)).getUTCDay();
  const cols = Math.ceil((days.length + first) / 7);
  const gap = 3;
  const pitch = (W + gap) / cols;
  const cell = pitch - gap;
  const top = 34;
  const bottom = top + 7 * pitch - gap;
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const svg = new Svg(W, Math.round(bottom + 44), `Contribution graph for the last 12 months: ${number(total)} contributions across ${ACCOUNTS.map((a) => `@${a}`).join(' and ')}.`);
  svg.styles.push('.wk{animation:wk .7s ease-out both}@keyframes wk{from{opacity:0}to{opacity:1}}', RESPONSIVE);

  const square = (x, y, size, lvl) => `<rect class="c${lvl}" x="${round(x + 0.5)}" y="${round(y + 0.5)}" width="${round(size - 1)}" height="${round(size - 1)}" rx="2"/>`;
  const columns = Array.from({ length: cols }, () => []);
  days.forEach(({ count }, i) => {
    const slot = i + first;
    const c = Math.floor(slot / 7);
    columns[c].push(square(c * pitch, top + (slot % 7) * pitch, cell, level(count)));
  });
  svg.body.push(`<g class="edge">${columns.map((cells, c) => `<g class="wk" style="animation-delay:${(0.15 + c * 0.012).toFixed(3)}s">${cells.join('')}</g>`).join('')}</g>`);

  // A month is named over the first week whose Sunday falls in it.
  const months = [];
  for (let c = 0; c < cols; c++) {
    const sunday = new Date(Date.parse(days[0].date) + (c * 7 - first) * DAY);
    if (sunday.getUTCDate() <= 7) months.push({ x: round(c * pitch), name: MONTHS[sunday.getUTCMonth()].slice(0, 3) });
  }

  for (const { cls, k } of SIZES) {
    const size = 12 * k;
    const named = months.map((m) => ({ ...m, shaped: shape(m.name, 'r', size) })).filter((m) => m.x + m.shaped.width <= W);
    let shown = named;
    for (const step of [1, 2, 3, 4]) {
      shown = named.filter((_, i) => i % step === 0);
      if (shown.every((m, i) => i === 0 || m.x >= shown[i - 1].x + shown[i - 1].shaped.width + 10 * k)) break;
    }
    const parts = shown.map((m) => svg.text(m.shaped, m.x, top - 10, { cls: 'm' }));

    const base = round(bottom + 12 + capHeight('r', size));
    const box = cell * Math.min(k, 1.5);
    const step = box + 3 * Math.min(k, 1.5);
    const more = shape('More', 'r', size);
    const start = W - more.width - 6 * k - (4 * step + box);
    const y = base - capHeight('r', size) / 2 - box / 2;
    parts.push(
      svg.text(shape('Last 12 months', 'r', size), 0, base, { cls: 'm' }),
      svg.text(shape('Less', 'r', size), start - 6 * k, base, { cls: 'm', anchor: 'end' }),
      `<g class="edge">${[0, 1, 2, 3, 4].map((lvl) => square(start + lvl * step, y, box, lvl)).join('')}</g>`,
      svg.text(more, W, base, { cls: 'm', anchor: 'end' }),
    );
    svg.body.push(`<g class="${cls}">${parts.join('')}</g>`);
  }
  return svg;
}

const ROW = 56;

// `draw` returns one composition's parts; `end` is where text stops short of the row's arrow.
function row(title, draw) {
  const svg = new Svg(W, ROW, title);
  svg.styles.push(RESPONSIVE);
  for (const { cls, k } of SIZES) {
    const size = 16 * k;
    const y = round(ROW / 2 + capHeight('r', size) / 2);
    const arrow = svg.arrow(W, y, size, 'm');
    const end = W - arrow.span - 16 * k;
    svg.body.push(`<g class="${cls}">${arrow.svg}${draw(svg, k, size, y, end).join('')}</g>`);
  }
  return svg;
}

const GRID = { second: 211.5 };
const widest = (texts, face, size) => Math.max(...texts.map((t) => shape(t, face, size).width));

// A repository that will not fit by its full name drops its owner first, then letters.
function fitRepo(full, short, size, width) {
  return firstFitting([short, full.split('/').pop()], 'm', size, width) ?? clipName(full.split('/').pop(), 'm', size, width);
}

// Merged pull requests: a merge mark in GitHub's merged purple, the repository, the title, the
// repository's stars and the day. Columns line up across rows because each one measures them all.
function mergedRows(pulls) {
  return pulls.map((pr) =>
    row(`${pr.repo} #${pr.number}, ${pr.title}. Merged ${pr.long}.`, (svg, k, size, y, end) => {
      const mark = 16 * k;
      const x = round(mark + 12 * k);
      const dateWidth = widest(pulls.map((p) => p.day), 'r', size);
      const parts = [
        svg.icon('merge', 0, ROW / 2 - mark / 2, mark, 'd'),
        svg.text(shape(pr.day, 'r', size), end, y, { cls: 'm', anchor: 'end' }),
      ];
      let stop = end - dateWidth - 28 * k;
      if (k <= 1.5) {
        const star = 13 * k;
        const starsWidth = widest(pulls.map((p) => compact(p.stars)), 'r', size);
        const starAt = stop - starsWidth - 5 * k - star;
        parts.push(
          svg.icon('star', starAt, y - capHeight('r', size) / 2 - star / 2, star, 'm'),
          svg.text(shape(compact(pr.stars), 'r', size), stop, y, { cls: 'm', anchor: 'end' }),
        );
        stop = starAt - 28 * k;
      }
      const repoWidth = Math.min(widest(pulls.map((p) => p.repo), 'm', size), k <= 1.2 ? 320 : stop - x);
      parts.push(svg.text(shape(fitRepo(pr.repo, pr.repo, size, repoWidth), 'm', size), x, y, { cls: 'i' }));
      if (k <= 1.2) {
        const titleAt = x + repoWidth + 28 * k;
        if (stop - titleAt > 120 * k) parts.push(svg.text(shape(clip(pr.title, 'r', size, stop - titleAt), 'r', size), titleAt, y, { cls: 'm' }));
      }
      return parts;
    }),
  );
}

// Commits by repository: the name, a bar against the busiest repository, and the count.
function commitRows(repos, window) {
  const most = Math.max(...repos.map((r) => r.commits));
  return repos.map((r) =>
    row(`${r.repo}: ${r.label} in the last ${window} days.`, (svg, k, size, y, end) => {
      const countWidth = widest(repos.map((x) => x.label), 'r', size);
      const room = end - countWidth - 24 * k;
      const names = repos.map((x) => fitRepo(x.repo, x.name, size, room));
      const nameWidth = widest(names, 'm', size);
      const parts = [
        svg.text(shape(names[repos.indexOf(r)], 'm', size), 0, y, { cls: 'i' }),
        svg.text(shape(r.label, 'r', size), end, y, { cls: 'm', anchor: 'end' }),
      ];
      const from = round(k <= 1.2 ? Math.max(GRID.second, nameWidth + 32 * k) : nameWidth + 32 * k);
      const to = round(end - countWidth - 32 * k);
      if (to - from >= 90 * k) {
        const h = round(4 * k);
        const top = round(ROW / 2 - h / 2);
        const span = to - from;
        parts.push(
          `<rect class="c0" x="${from}" y="${top}" width="${round(span)}" height="${h}" rx="${round(h / 2)}"/>`,
          `<rect class="c3 grow" x="${from}" y="${top}" width="${round(Math.max(h, (span * r.commits) / most))}" height="${h}" rx="${round(h / 2)}"/>`,
        );
      }
      return parts;
    }),
  );
}

const TYPES = 'build|chore|ci|docs|feat|fix|perf|refactor|revert|security|style|test';

// Pull request titles lose commit-style prefixes and any character Mona Sans cannot draw.
function tidy(title) {
  const plain = title
    .replace(/`/g, '')
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(new RegExp(`^\\s*(?:${TYPES})(?:\\([^)]*\\))?!?:\\s*`, 'i'), '');
  const drawable = [...plain].filter((ch) => ch === ' ' || FONTS.r.charToGlyphIndex(ch) > 0).join('').replace(/\s+/g, ' ').trim();
  return drawable.charAt(0).toUpperCase() + drawable.slice(1);
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

const PULLS = `query($login: String!, $after: String) {
  user(login: $login) {
    contributionsCollection {
      pullRequestContributions(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { pullRequest { number title url merged mergedAt repository { nameWithOwner isPrivate stargazerCount owner { login } } } }
      }
    }
  }
}`;

async function refresh() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const headers = { authorization: `bearer ${token}`, 'user-agent': `${ACCOUNTS[0]}-profile-readme` };
  const call = async (url, init, read) => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
      const body = await response.json().catch(() => null);
      const failure = !response.ok ? `${response.status} ${JSON.stringify(body)?.slice(0, 300)}` : body?.errors ? JSON.stringify(body.errors).slice(0, 300) : null;
      if (!failure) return read(body);
      if (attempt === 3 || (response.status >= 400 && response.status < 500)) throw new Error(`${url} failed: ${failure}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  };
  const graphql = (query, variables) =>
    call('https://api.github.com/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) }, (body) => body.data);

  const now = Date.now();
  const since = (days) => new Date(now - days * DAY).toISOString();
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

    let after = null;
    do {
      const page = (await graphql(PULLS, { login, after })).user.contributionsCollection.pullRequestContributions;
      for (const { pullRequest: pr } of page.nodes) {
        if (!pr?.merged || !pr.repository || pr.repository.isPrivate) continue;
        merged += 1;
        if (ACCOUNTS.includes(pr.repository.owner.login)) continue;
        const stars = pr.repository.stargazerCount;
        // Stars are kept at the precision they are shown with, so the data only changes when the picture does.
        pulls.push({ repo: pr.repository.nameWithOwner, number: pr.number, title: pr.title, url: pr.url, stars: stars >= 1000 ? Math.round(stars / 100) * 100 : stars, mergedAt: pr.mergedAt });
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
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

// GitHub hides a link whose address ends in #gh-light-mode-only or #gh-dark-mode-only in the other
// theme. Unlike <picture>, which GitHub takes apart inside a link, this keeps each image clickable.
function themed(name, href, svg, alt) {
  const size = `width="${svg.width}" height="${svg.height}"`;
  return ['light', 'dark']
    .map((theme) => `<a href="${escape(`${href}#gh-${theme}-mode-only`)}"><img src="assets/${name}-${theme}.svg" ${size} align="top" alt="${escape(alt)}"></a>`)
    .join('');
}

if (process.argv.includes('--refresh')) await refresh();
const data = JSON.parse(fs.readFileSync(at('data', 'activity.json'), 'utf8'));
const days = data.calendar.counts.map((count, i) => ({ date: addDays(data.calendar.start, i), count }));
const total = days.reduce((sum, d) => sum + d.count, 0);
const { current, longest } = streaks(days);
const asOf = Date.parse(days.at(-1).date) + DAY;

let status;
if (data.push) {
  const repo = ownName(data.push.repo);
  const day = local(data.push.at, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = local(data.push.at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  status = {
    lines: [
      [`Pushed to ${repo}`, `${day}, ${time} IST`],
      [`Pushed to ${repo}`, local(data.push.at, { day: 'numeric', month: 'short', year: 'numeric' })],
      [repo, local(data.push.at, { day: 'numeric', month: 'short' })],
    ],
    alt: `Last pushed to ${data.push.repo} on ${day}.`,
  };
} else {
  status = { lines: [[`${number(total)} contributions`, 'In the last 12 months'], [number(total), 'Contributions']], alt: `${number(total)} contributions in the last 12 months.` };
}

const items = [
  { value: number(total), label: 'contributions', short: 'contributions', rank: 0 },
  { value: number(data.commits), label: 'commits', short: 'commits', rank: 3 },
  { value: number(data.merged), label: 'pull requests merged', short: 'merged PRs', rank: 2 },
  current >= 3
    ? { value: number(current), label: 'days in a row', short: 'day streak', rank: 1 }
    : { value: number(longest), label: 'days, longest streak', short: 'best streak', rank: 1 },
];

const recent = data.pulls.filter((p) => asOf - Date.parse(p.mergedAt) <= 30 * DAY);
const pulls = (recent.length >= 4 ? recent : data.pulls)
  .slice(0, 6)
  .map((p) => ({ ...p, title: tidy(p.title), key: localDay(p.mergedAt), day: local(p.mergedAt, { day: 'numeric', month: 'short' }), long: local(p.mergedAt, { day: 'numeric', month: 'long', year: 'numeric' }) }))
  .sort((a, b) => b.key.localeCompare(a.key) || b.stars - a.stars);

const window = data.repos.month.length >= 3 ? 30 : 90;
const repos = data.repos[window === 30 ? 'month' : 'quarter']
  .slice(0, 5)
  .map((r) => ({ ...r, name: ownName(r.repo), label: `${number(r.commits)} ${r.commits === 1 ? 'commit' : 'commits'}` }));

const art = new Map();
const add = (name, svg) => art.set(name, svg);
const link = (name, href) => themed(name, href, art.get(name), art.get(name).title);
const block = (lines) => `<p>\n${lines.join('<br>\n')}\n</p>`;
const sections = [];

add('hero', hero(status));
sections.push(`<p>${link('hero', SITE)}</p>`);

const others = ACCOUNTS.slice(1);
add('activity', others.length ? heading('Activity', `Includes ${others.map((a) => `@${a}`).join(' and ')}`) : heading('Activity', 'Last 12 months', { arrow: false }));
add('numbers', stats(items));
add('calendar', calendar(days));
sections.push(block([link('activity', others.length ? `https://github.com/${others[0]}` : HOME), link('numbers', HOME), link('calendar', HOME)]));

if (pulls.length) {
  add('merged', heading('Recently merged', 'All pull requests'));
  const lines = [link('merged', `https://github.com/search?q=${encodeURIComponent(`author:${ACCOUNTS[0]} is:pr is:merged`)}&type=pullrequests`)];
  mergedRows(pulls).forEach((svg, i) => {
    add(`merged-${i + 1}`, svg);
    lines.push(link(`merged-${i + 1}`, pulls[i].url));
  });
  sections.push(block(lines));
}

if (repos.length) {
  add('commits', heading('Commits', `Last ${window} days`, { arrow: false }));
  const lines = [link('commits', HOME)];
  commitRows(repos, window).forEach((svg, i) => {
    add(`commits-${i + 1}`, svg);
    lines.push(link(`commits-${i + 1}`, repos[i].url));
  });
  sections.push(block(lines));
}

fs.rmSync(at('assets'), { recursive: true, force: true });
fs.mkdirSync(at('assets'), { recursive: true });
let bytes = 0;
for (const [name, svg] of art) {
  for (const theme of ['light', 'dark']) {
    const out = svg.render(theme);
    bytes += out.length;
    fs.writeFileSync(at('assets', `${name}-${theme}.svg`), out);
  }
}

const readme = ['<!-- Written by scripts/build.mjs from data/activity.json. Edit the layout there, then run `npm run build`. -->', '', ...sections.flatMap((s) => [s, ''])].join('\n');
fs.writeFileSync(at('README.md'), readme);
console.log(`${art.size * 2} images, ${(bytes / 1024).toFixed(0)} KB; README.md written.`);
