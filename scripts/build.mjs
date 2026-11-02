#!/usr/bin/env node
// Writes README.md and every image in assets/ from the content in this file.
//   node scripts/build.mjs            redraw everything from data/writing.json
//   node scripts/build.mjs --refresh  fetch the latest posts from the blog first
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => path.join(ROOT, ...parts);
const SITE = 'https://www.sarankumar.space';

const PROFILE = {
  name: 'Saran Kumar',
  full: 'Saran Kumar S.',
  email: 'sarankumar131313@gmail.com',
  intro:
    "I'm Saran, 21. At [goML](https://www.goml.io) I build agent harnesses on LangGraph and Amazon Bedrock, run inference on vLLM, and put each new frontier model through the kind of work our clients actually do. I joined as an ML engineering intern in June 2025 and became an applied AI engineer a year later. Evenings go into tools I want to use myself, and into writing, mostly about models and sometimes about streetlamps.",
};

const LINKS = [
  ['site', 'sarankumar.space', SITE],
  ['writing', 'Writing', `${SITE}/blogs`],
  ['resume', 'Résumé', `${SITE}/resume`],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/saran-kumar-s-sk13022005'],
  ['x', 'X', 'https://x.com/iamsaranhere'],
  ['kaggle', 'Kaggle', 'https://www.kaggle.com/sarankumar132513'],
  ['leetcode', 'LeetCode', 'https://leetcode.com/u/sarankumar131313/'],
];

// `about` is the desktop line, `short` the tablet line and `tiny` the phone line.
const WORK = [
  { id: 'manicule', name: 'Manicule', about: 'A quiet Markdown studio. Local first.', short: 'Quiet Markdown studio', tiny: 'Markdown studio', stack: 'TypeScript, Rust', url: 'https://manicule.online' },
  { id: 'queryshift', name: 'QueryShift', about: 'Evidence-backed PostgreSQL change intelligence', short: 'PostgreSQL change intelligence', tiny: 'PostgreSQL changes', stack: 'Go', url: 'https://github.com/sarankumar1325/pgbot' },
  { id: 'retrace', name: 'Retrace', about: 'Verifiable fact-level unlearning for LLMs', short: 'Fact-level unlearning for LLMs', tiny: 'LLM unlearning', stack: 'Python', url: 'https://github.com/swsarancodes/retrace' },
  { id: 'shortly', name: 'Shortly', about: 'Short links with workspaces and click analytics', short: 'Short links with analytics', tiny: 'Link shortener', stack: 'TypeScript, Python', url: 'https://shortlyyy-web.vercel.app' },
  { id: 'moe', name: 'Mixture-of-Experts', about: 'Sparse and shared-expert MoE layers', short: 'Sparse MoE layers', tiny: 'MoE layers', stack: 'PyTorch', url: 'https://github.com/sarankumar1325/Mixture-of-Experts' },
  { id: 'freeforstudents', name: 'Free for Students', about: 'Free software for verified students', short: 'Free software for students', tiny: 'Student directory', stack: 'TypeScript', url: 'https://freeforunifolks.vercel.app' },
  { id: 'qarag', name: 'QARAG', about: 'Answers from your documents, with sources', short: 'Cited answers from documents', tiny: 'Cited answers', stack: 'Python', url: 'https://github.com/sarankumar1325/QARAG' },
  { id: 'aetheria', name: 'Aetheria PDF', about: 'PDF tools that never leave your browser', short: 'In-browser PDF tools', tiny: 'PDF tools', stack: 'TypeScript', url: 'https://v0pdftools.vercel.app' },
  { id: 'mcp', name: 'MCP from Scratch', about: 'A Model Context Protocol server and client', short: 'MCP server and client', tiny: 'Server and client', stack: 'TypeScript', url: 'https://github.com/sarankumar1325/MCP-FROM-SCRATCH' },
  { id: 'unslop', name: 'UNSLOP', about: 'An agent skill that stops AI writing like AI', short: 'Stops AI writing like AI', tiny: 'Agent skill', stack: 'Agent skill', url: 'https://github.com/swsarancodes/UNSLOP-AI' },
  { id: 'more', name: '@swsarancodes', about: 'My second account, where newer work lives', short: 'Where newer work lives', tiny: 'Second account', stack: '', url: 'https://github.com/swsarancodes' },
];

function loadFont(file) {
  const buf = fs.readFileSync(at('scripts', 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Text is drawn as outlines because an SVG shown through <img> cannot load web fonts.
const FONTS = { l: loadFont('mona-sans-300.ttf'), r: loadFont('mona-sans-400.ttf'), m: loadFont('mona-sans-500.ttf') };

// GitHub's own text colours, so the artwork reads as part of the page in either theme.
const THEMES = {
  light: { ink: '#1f2328', muted: '#59636e', live: '#1a7f37' },
  dark: { ink: '#f0f6fc', muted: '#9198a1', live: '#3fb950' },
};

const W = 846;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
const sentence = (s) => `${s.replace(/[.\s]+$/, '')}.`;
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function clip(text, face, size, width) {
  if (shape(text, face, size).width <= width) return text;
  const words = text.split(' ');
  while (words.length > 1) {
    words.pop();
    const cut = `${words.join(' ').replace(/[\s,:;.\-]+$/, '')}…`;
    if (shape(cut, face, size).width <= width) return cut;
  }
  return text;
}

const fits = (text, face, size, width) => shape(text, face, size).width <= width;
const firstFitting = (options, face, size, width) => options.find((t) => fits(t, face, size, width)) ?? null;

class Svg {
  constructor(width, height, title) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.glyphs = new Map();
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
    const palette = `.i{fill:${t.ink}}.m{fill:${t.muted}}.g{fill:${t.live}}.is{stroke:${t.ink}}.ms{stroke:${t.muted}}`;
    const paths = [...this.glyphs].filter(([, d]) => d).map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" role="img" aria-labelledby="title">`,
      `<title id="title">${escape(this.title)}</title>`,
      `<style>${palette}${this.styles.join('')}${CALM}</style>`,
      `<defs>${paths}${this.defs.join('')}</defs>`,
      ...this.body,
      '</svg>',
      '',
    ].join('\n');
  }
}

function describe(post) {
  const date = new Date(post.date);
  const title = post.title.trim();
  const test = /llm test/i.test(title);
  const label = test
    ? title.replace(/^LLM Testing of\s+/i, '').replace(/\s+LLM Testing\b.*$/i, '').replace(/:.*$/, '').trim()
    : title;
  let kind = 'Essay';
  if (test) kind = 'Model test';
  else if (/\bguide\b/i.test(title)) kind = 'Guide';
  else if (/\boverview\b/i.test(title)) kind = 'Overview';
  const short = MONTHS[date.getMonth()].slice(0, 3);
  return {
    url: post.url,
    label,
    kind,
    day: `${date.getDate()} ${short}`,
    full: `${date.getDate()} ${short} ${date.getFullYear()}`,
    long: `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

// The name across the full measure, then two columns hung from the start of each word.
function hero(latest) {
  const height = 236;
  const svg = new Svg(W, height, `${PROFILE.full}, applied AI engineer at goML in Coimbatore, India. Latest model test: ${latest.label}, ${latest.long}.`);
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

  // Longest first; each composition takes the first pair whose lines both fit their column.
  const left = [
    ['Applied AI engineer at goML', 'Coimbatore, India'],
    ['Applied AI engineer', 'goML, Coimbatore'],
    ['AI engineer', 'goML'],
  ];
  const right = [
    [latest.label, `Latest model test, ${latest.full}`],
    [latest.label, 'Latest model test'],
    [latest.label, 'Latest test'],
  ];
  const choose = (pairs, size, limit) =>
    pairs.find((pair) => pair.every((t) => fits(t, 'r', size, limit))) ?? pairs.at(-1).map((t) => clip(t, 'r', size, limit));

  for (const { cls, k: scale } of SIZES) {
    const size = 16 * scale;
    const first = base + 40 - (scale - 1) * 8 + capHeight('r', size);
    const lead = size * (1.5 - 0.1 * (scale - 1));
    const [l1, l2] = choose(left, size, column - 24 * scale);
    const [r1, r2] = choose(right, size, W - column);
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

function chip(label) {
  const size = 15;
  const shaped = shape(label, 'r', size);
  const height = 24;
  const baseline = 17;
  const svg = new Svg(0, height, label);
  const arrow = svg.arrow(shaped.width + 6 + capHeight('r', size) * 0.74, baseline, size, 'm');
  svg.width = Math.ceil(shaped.width + 6 + arrow.span + 26);
  svg.body.push(svg.text(shaped, 0, baseline, { cls: 'i' }), arrow.svg);
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

function heading(label, more) {
  const svg = new Svg(W, HEAD, more ? `${label}. ${more}.` : label);
  svg.styles.push(RESPONSIVE);
  for (const { cls, k } of SIZES) svg.body.push(`<g class="${cls}">${headingParts(svg, label, more, k).join('')}</g>`);
  return svg;
}

const ROW = 56;

// `layout` returns the row's parts for one composition; a part without `x` is set flush right, before the arrow.
function row(title, layout) {
  const svg = new Svg(W, ROW, title);
  svg.styles.push(RESPONSIVE);
  for (const { cls, k } of SIZES) {
    const size = 16 * k;
    const y = round(ROW / 2 + capHeight('r', size) / 2);
    const arrow = svg.arrow(W, y, size, 'm');
    const end = W - arrow.span - 16 * k;
    const parts = [arrow.svg];
    for (const part of layout(k, size, end)) {
      if (!part.text) continue;
      const shaped = shape(part.text, part.face ?? 'r', size);
      parts.push(svg.text(shaped, part.x ?? end, y, { cls: part.tone, anchor: part.x === undefined ? 'end' : 'start' }));
    }
    svg.body.push(`<g class="${cls}">${parts.join('')}</g>`);
  }
  return svg;
}

// Desktop columns sit on quarters of the measure; narrower compositions measure the longest name instead.
const GRID = { second: 211.5, fourth: 634.5 };
const nameColumn = (k) => Math.ceil(Math.max(...WORK.map((item) => shape(item.name, 'm', 16 * k).width)) + 28 * k);

function workRow(item) {
  const title = `${item.name}: ${sentence(item.about)}${item.stack ? ` ${sentence(item.stack)}` : ''}`;
  return row(title, (k, size, end) => {
    const name = { text: item.name, face: 'm', x: 0, tone: 'i' };
    const lines = [item.about, item.short, item.tiny];
    if (k <= 1.2) {
      const x = Math.max(GRID.second, nameColumn(k));
      return [
        name,
        { text: firstFitting(lines, 'r', size, GRID.fourth - x - 20 * k), x, tone: 'm' },
        { text: item.stack && clip(item.stack, 'r', size, end - GRID.fourth), x: GRID.fourth, tone: 'm' },
      ];
    }
    if (k <= 1.9) {
      const x = nameColumn(k);
      return [name, { text: firstFitting(lines, 'r', size, end - x), x, tone: 'm' }];
    }
    const room = end - shape(item.name, 'm', size).width - 24 * k;
    return [name, { text: firstFitting([item.short, item.tiny], 'r', size, room), tone: 'm' }];
  });
}

function writingRow(entry) {
  return row(`${entry.label}, ${entry.kind.toLowerCase()}, ${entry.long}.`, (k, size, end) => {
    if (k <= 1.2) {
      return [
        { text: clip(entry.label, 'r', size, GRID.fourth - 24 * k), x: 0, tone: 'i' },
        { text: entry.kind, x: GRID.fourth, tone: 'm' },
        { text: entry.day, tone: 'm' },
      ];
    }
    if (k <= 1.9) {
      const day = shape(entry.day, 'r', size).width;
      return [
        { text: clip(entry.label, 'r', size, end - day - 32 * k), x: 0, tone: 'i' },
        { text: entry.day, tone: 'm' },
      ];
    }
    return [{ text: clip(entry.label, 'r', size, end), x: 0, tone: 'i' }];
  });
}

// The close: the address set like the name at the top, under a label in the heading style.
function closing() {
  const { shaped, offset } = fitToWidth(PROFILE.email, 'l', -0.01, W);
  const base = Math.round(HEAD + 14 + capHeight('l', shaped.size));
  const height = Math.round(base + shaped.size * 0.26);
  const svg = new Svg(W, height, `Write to me at ${PROFILE.email}. IST, UTC+5:30.`);
  svg.styles.push(RESPONSIVE);
  for (const { cls, k } of SIZES) svg.body.push(`<g class="${cls}">${headingParts(svg, 'Write to me', 'IST, UTC+5:30', k, { arrow: false }).join('')}</g>`);
  svg.body.push(svg.text(shaped, offset, base, { cls: 'i' }));
  return svg;
}

function decode(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePosts(html) {
  const seen = new Set();
  const posts = [];
  for (const [, slug, inner] of html.matchAll(/<a[^>]+href="(\/blogs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const spans = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]));
    if (spans.length < 2 || Number.isNaN(Date.parse(spans[1])) || seen.has(slug)) continue;
    seen.add(slug);
    const summary = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    posts.push({ url: SITE + slug, title: spans[0], date: spans[1], summary: summary ? decode(summary[1]) : '' });
  }
  return posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

async function refresh() {
  const response = await fetch(`${SITE}/blogs`, { headers: { 'user-agent': 'sarankumar1325-profile-readme' } });
  if (!response.ok) throw new Error(`${SITE}/blogs answered ${response.status}`);
  const posts = parsePosts(await response.text());
  if (posts.length < 3) throw new Error(`Found ${posts.length} posts on ${SITE}/blogs; the page layout may have changed.`);
  fs.mkdirSync(at('data'), { recursive: true });
  fs.writeFileSync(at('data', 'writing.json'), `${JSON.stringify(posts, null, 2)}\n`);
  console.log(`Saved ${posts.length} posts.`);
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
const posts = JSON.parse(fs.readFileSync(at('data', 'writing.json'), 'utf8')).map(describe);
const latest = posts.find((post) => post.kind === 'Model test') ?? posts[0];

const art = new Map();
const add = (name, svg) => art.set(name, svg);
const block = (lines) => `<p>\n${lines.join('<br>\n')}\n</p>`;

add('hero', hero(latest));
const heroHtml = themed('hero', SITE, art.get('hero'), art.get('hero').title);

const chips = LINKS.map(([id, label, href]) => {
  add(`link-${id}`, chip(label));
  return themed(`link-${id}`, href, art.get(`link-${id}`), label);
});

add('work', heading('Selected work', 'All repositories'));
const workLines = [themed('work', 'https://github.com/sarankumar1325?tab=repositories', art.get('work'), 'Selected work. All repositories.')];
for (const item of WORK) {
  add(`work-${item.id}`, workRow(item));
  workLines.push(themed(`work-${item.id}`, item.url, art.get(`work-${item.id}`), art.get(`work-${item.id}`).title));
}

add('writing', heading('Writing', 'All posts'));
const writingLines = [themed('writing', `${SITE}/blogs`, art.get('writing'), 'Writing. All posts.')];
posts.slice(0, 6).forEach((entry, i) => {
  add(`writing-${i + 1}`, writingRow(entry));
  writingLines.push(themed(`writing-${i + 1}`, entry.url, art.get(`writing-${i + 1}`), art.get(`writing-${i + 1}`).title));
});

// The ?ref=github ends the address before GitHub's theme fragment, so a mail app that keeps the
// fragment reads it as an unknown header and ignores it instead of mangling the address.
add('contact', closing());
const contactLines = [themed('contact', `mailto:${PROFILE.email}?ref=github`, art.get('contact'), art.get('contact').title)];

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

const readme = [
  '<!-- Written by scripts/build.mjs. Edit the content there, then run `npm run build`. -->',
  '',
  `<p>${heroHtml}</p>`,
  '',
  PROFILE.intro,
  '',
  `<p>${chips.join('')}</p>`,
  '',
  block(workLines),
  '',
  block(writingLines),
  '',
  block(contactLines),
  '',
].join('\n');
fs.writeFileSync(at('README.md'), readme);
console.log(`${art.size * 2} images, ${(bytes / 1024).toFixed(0)} KB; README.md written.`);
