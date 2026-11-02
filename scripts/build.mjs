#!/usr/bin/env node
// Draws the README artwork in assets/ from the fonts, product screenshots and post list in this repo.
//   node scripts/build.mjs            redraw every panel from data/writing.json
//   node scripts/build.mjs --refresh  fetch the latest posts from the blog first
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => path.join(ROOT, ...parts);
const SITE = 'https://www.sarankumar.space';

function loadFont(file) {
  const buf = fs.readFileSync(at('scripts', 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Text is drawn as outlines because an SVG shown through <img> cannot load web fonts.
const FONTS = { r: loadFont('epilogue-400.woff'), m: loadFont('epilogue-500.woff'), b: loadFont('epilogue-900.woff') };
const ELLIPSIS = FONTS.r.charToGlyphIndex('…') ? '…' : '...';

const COLOR = {
  charcoal: '#191919',
  white: '#ffffff',
  grey: '#9a9a9a',
  teal: '#0c7866',
  red: '#d71e1e',
  blue: '#1e4bd7',
  yellow: '#ffe927',
  black: '#111111',
};

const W = 1200;
const M = 56;
const AXIS = Math.round(W * 0.42);
const TIGHT = -0.04;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// GitHub's renderer pulls <img> out of <picture>, so each SVG carries its own phone layout.
// Media queries inside an SVG image measure the rendered image, not the page.
const PHONE = '.m{display:none}@media (max-width:600px){.d{display:none}.m{display:inline}}';
const CALM = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

const round = (n) => Math.round(n * 10) / 10;
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
    const kern = kerning
      ? font.position.getKerningValue(kerning, glyph.index, next.index)
      : font.getKerningValue(glyph, next);
    x += kern * scale + tracking * size;
  });
  return { face, size, placed, width: x };
}

const capHeight = (face, size) => (FONTS[face].tables.os2.sCapHeight / FONTS[face].unitsPerEm) * size;

function fitSize(lines, face, tracking, width, max = 400) {
  const widest = Math.max(...lines.map((line) => shape(line, face, 100, tracking).width));
  return Math.min(max, Math.floor((100 * width) / widest));
}

function wrap(text, face, size, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && shape(next, face, size).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Minimum-raggedness line breaking: no line is left short just because the next word missed by a little.
function balance(widths, space, max) {
  const n = widths.length;
  const best = new Array(n + 1).fill(Infinity);
  const from = new Array(n + 1).fill(0);
  best[0] = 0;
  for (let end = 1; end <= n; end++) {
    let width = -space;
    for (let start = end; start >= 1; start--) {
      width += widths[start - 1] + space;
      if (width > max && start < end) break;
      const slack = Math.max(0, max - width);
      const cost = best[start - 1] + (end === n ? slack * slack / 4 : slack * slack);
      if (cost < best[end]) {
        best[end] = cost;
        from[end] = start - 1;
      }
    }
  }
  const lines = [];
  for (let end = n; end > 0; end = from[end]) lines.unshift([from[end], end]);
  return lines;
}

function clip(text, face, size, width) {
  if (shape(text, face, size).width <= width) return text;
  const words = text.split(' ');
  while (words.length > 1) {
    words.pop();
    const cut = `${words.join(' ').replace(/[\s,:;.\-]+$/, '')}${ELLIPSIS}`;
    if (shape(cut, face, size).width <= width) return cut;
  }
  return text;
}

class Svg {
  constructor(height, background, title) {
    this.height = height;
    this.background = background;
    this.title = title;
    this.glyphs = new Map();
    this.styles = [CALM];
    this.defs = [];
    this.body = [];
  }

  glyph(face, glyph) {
    const id = face + glyph.index;
    if (!this.glyphs.has(id)) this.glyphs.set(id, glyph.getPath(0, 0, FONTS[face].unitsPerEm).toPathData(0));
    return this.glyphs.get(id) ? id : null;
  }

  text(shaped, x, y, { fill, anchor = 'start', className } = {}) {
    const scale = shaped.size / FONTS[shaped.face].unitsPerEm;
    const left = anchor === 'end' ? x - shaped.width : x;
    const uses = shaped.placed
      .map(({ glyph, x: gx }) => {
        const id = this.glyph(shaped.face, glyph);
        return id ? `<use href="#${id}" x="${Math.round(gx / scale)}"/>` : '';
      })
      .join('');
    const attrs = `${fill ? ` fill="${fill}"` : ''}${className ? ` class="${className}"` : ''}`;
    return `<g transform="translate(${round(left)} ${round(y)}) scale(${scale.toFixed(5)})"${attrs}>${uses}</g>`;
  }

  render() {
    const paths = [...this.glyphs]
      .filter(([, d]) => d)
      .map(([id, d]) => `<path id="${id}" d="${d}"/>`)
      .join('');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${this.height}" width="${W}" height="${this.height}" role="img" aria-labelledby="title">`,
      `<title id="title">${escape(this.title)}</title>`,
      `<style>${this.styles.join('')}</style>`,
      `<defs>${paths}${this.defs.join('')}</defs>`,
      `<rect width="${W}" height="${this.height}" fill="${this.background}"/>`,
      ...this.body,
      '</svg>',
      '',
    ].join('\n');
  }
}

function hero() {
  const height = 740;
  const svg = new Svg(height, COLOR.charcoal, 'Saran Kumar S. AI that holds up. Applied AI engineer at goML in Coimbatore, India.');
  svg.styles.push(PHONE, `.fade{animation:fade .8s ease-out 1s both}@keyframes fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`);
  const statement = ['AI that', 'holds up.'];
  const last = height - 72;

  const statementIn = (cls, x, size) => {
    svg.styles.push(`@keyframes rise-${cls}{from{transform:translateY(${round(size * 1.3)}px)}to{transform:none}}.rise-${cls}{animation:rise-${cls} .9s ${EASE} both}`);
    return statement
      .map((line, i) => {
        const base = last - (statement.length - 1 - i) * size * 0.9;
        const id = `line-${cls}${i}`;
        svg.defs.push(`<clipPath id="${id}"><rect x="0" y="${round(base - size)}" width="${W}" height="${round(size * 1.3)}"/></clipPath>`);
        const text = svg.text(shape(line, 'b', size, TIGHT), x, base, { fill: COLOR.white });
        return `<g clip-path="url(#${id})"><g class="rise-${cls}" style="animation-delay:${(0.15 + i * 0.11).toFixed(2)}s">${text}</g></g>`;
      })
      .join('');
  };

  // Desktop: everything hangs from one axis at 42% of the width, with the upper half left empty.
  const small = 30;
  const top = M + capHeight('m', small);
  const sentence = wrap('I build agent harnesses and inference pipelines, and test new frontier models against enterprise work.', 'r', small, AXIS - M - 56);
  const leading = small * 1.36;
  const sentenceLines = sentence
    .map((line, i) => svg.text(shape(line, 'r', small), M, last - (sentence.length - 1 - i) * leading, { fill: COLOR.white }))
    .join('');
  const desktop = [
    svg.text(shape('Saran Kumar S.', 'm', small), M, top, { fill: COLOR.white }),
    svg.text(shape('Applied AI engineer', 'm', small), AXIS, top, { fill: COLOR.grey }),
    svg.text(shape('goML, Coimbatore', 'm', small), W - M, top, { fill: COLOR.grey, anchor: 'end' }),
    `<g class="fade">${sentenceLines}</g>`,
    statementIn('d', AXIS, fitSize(statement, 'b', TIGHT, W - M - AXIS)),
  ].join('');

  // Phone: the axis collapses to the margin and the statement takes the full width.
  const phone = [
    svg.text(shape('Saran Kumar S.', 'm', 50), M, M + capHeight('m', 50), { fill: COLOR.white }),
    statementIn('m', M, fitSize(statement, 'b', TIGHT, W - 2 * M)),
  ].join('');

  svg.body.push(`<g class="d">${desktop}</g>`, `<g class="m">${phone}</g>`);
  return svg.render();
}

function capabilities() {
  const heading = 'Most of my week:';
  const items = ['Agent harnesses', 'Frontier model testing', 'Inference on vLLM', 'Agents on Amazon Bedrock', 'Retrieval that cites', 'LangGraph workflows', 'Full-stack TypeScript'];
  const size = fitSize([heading, ...items], 'b', TIGHT, W - 2 * M, 84);
  const step = size * 1.02;
  const first = 64 + capHeight('b', size);
  const height = Math.round(first + items.length * step + 64 + size * 0.22);
  const svg = new Svg(height, COLOR.teal, `${heading} ${items.join(', ')}.`);
  svg.body.push(svg.text(shape(heading, 'b', size, TIGHT), W - M, first, { fill: COLOR.yellow, anchor: 'end' }));
  items.forEach((item, i) => {
    svg.body.push(svg.text(shape(item, 'b', size, TIGHT), W - M, first + (i + 1) * step, { fill: COLOR.white, anchor: 'end' }));
  });
  return svg.render();
}

const WORK = [
  'Manicule',
  'QueryShift',
  'Retrace',
  'Shortly',
  'Free for Students',
  'Aetheria PDF',
  'Chronicle Seed',
  'GoML Review Pilot',
  'Mixture-of-Experts',
  'QARAG',
  'MCP from Scratch',
  'UNSLOP',
  'RoastMyCV',
  'Job Insight',
];

function work() {
  const tracking = -0.03;
  const beat = 2.4;
  const measure = W - 2 * M;
  const texts = ['Selected work:', ...WORK.map((name, i) => `${name}${i === WORK.length - 1 ? '.' : ','}`)];

  // The largest size at which every line but the last fills at least two thirds of the measure.
  let fit;
  for (let size = 64; size >= 52 && !fit?.even; size--) {
    const space = shape(' ', 'b', size).width;
    const units = texts.map((text, i) => ({ text, heading: i === 0, index: i - 1, shaped: shape(text, 'b', size, tracking) }));
    const lines = balance(units.map((unit) => unit.shaped.width), space, measure).map(([from, to]) => units.slice(from, to));
    const widths = lines.slice(0, -1).map((row) => row.reduce((sum, unit) => sum + unit.shaped.width, 0) + space * (row.length - 1));
    fit = { size, space, lines, even: Math.min(...widths) >= measure * 0.66 };
  }
  const { size, space, lines } = fit;
  const step = size * 1.12;

  const first = 72 + capHeight('b', size);
  const height = Math.round(first + (lines.length - 1) * step + 84);
  const svg = new Svg(height, COLOR.red, `Selected work: ${WORK.join(', ')}.`);
  const share = 100 / WORK.length;
  svg.styles.push(
    `@keyframes reading{0%{fill:${COLOR.white}}${(share * 0.12).toFixed(2)}%,${(share * 0.88).toFixed(2)}%{fill:${COLOR.yellow}}${share.toFixed(2)}%,100%{fill:${COLOR.white}}}`,
    `.n{animation:reading ${(beat * WORK.length).toFixed(1)}s linear infinite}`,
  );

  lines.forEach((row, li) => {
    const y = first + li * step;
    let x = M;
    for (const unit of row) {
      if (unit.heading) {
        svg.body.push(svg.text(unit.shaped, x, y, { fill: COLOR.black }));
      } else {
        const delay = (0.8 + unit.index * beat).toFixed(1);
        svg.body.push(`<g class="n" fill="${COLOR.white}" style="animation-delay:${delay}s">${svg.text(unit.shaped, x, y)}</g>`);
      }
      x += unit.shaped.width + space;
    }
  });
  return svg.render();
}

const PRODUCTS = [
  ['Shortly', 'Link shortener', 'shortly'],
  ['Free for Students', 'Directory', 'freeforstudents'],
  ['Chronicle Seed', 'Time capsule', 'chronicle'],
  ['RoastMyCV', 'Résumé feedback', 'roastmycv'],
];

function products() {
  const gap = 24;
  const tileW = (W - 2 * M - gap) / 2;
  const tileH = tileW / 1.6;
  const band = 88;
  const height = Math.round(M + 2 * (tileH + band) + 14);
  const svg = new Svg(height, COLOR.charcoal, `${PRODUCTS.map(([name]) => name).join(', ')}, each on its first screen.`);
  svg.styles.push(PHONE);
  const desktop = [];
  const phone = [];
  PRODUCTS.forEach(([name, what, file], i) => {
    const x = M + (i % 2) * (tileW + gap);
    const y = M + Math.floor(i / 2) * (tileH + band);
    const data = fs.readFileSync(at('scripts', 'shots', `${file}.jpg`)).toString('base64');
    svg.body.push(
      `<image href="data:image/jpeg;base64,${data}" x="${round(x)}" y="${round(y)}" width="${round(tileW)}" height="${round(tileH)}" preserveAspectRatio="xMidYMid slice"/>`,
    );
    const label = shape(name, 'm', 30);
    const note = shape(what, 'r', 30);
    desktop.push(svg.text(label, x, y + tileH + 46, { fill: COLOR.white }));
    if (label.width + 40 + note.width <= tileW) {
      desktop.push(svg.text(note, x + tileW, y + tileH + 46, { fill: COLOR.grey, anchor: 'end' }));
    }
    phone.push(svg.text(shape(name, 'm', 52), x, y + tileH + 66, { fill: COLOR.white }));
  });
  svg.body.push(`<g class="d">${desktop.join('')}</g>`, `<g class="m">${phone.join('')}</g>`);
  return svg.render();
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
    label,
    kind,
    day: `${date.getDate()} ${short}`,
    full: `${date.getDate()} ${short} ${date.getFullYear()}`,
    month: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

function writing(posts) {
  const rows = posts.slice(0, 10).map(describe);
  const svg = new Svg(0, COLOR.blue, `Latest writing: ${rows.map((r) => `${r.label} (${r.kind.toLowerCase()}, ${r.full})`).join('; ')}.`);
  svg.styles.push(PHONE, '.soft{opacity:.78}');

  // Desktop: a line-up at one size; the fixed column starts do the organising.
  const size = 30;
  const kindX = Math.round(W * 0.66);
  const desktop = [];
  let y = 72 + capHeight('r', size);
  let month = null;
  for (const row of rows) {
    if (row.month !== month) {
      if (month !== null) y += 56;
      desktop.push(svg.text(shape(row.month, 'r', size), M, y, { fill: COLOR.yellow }));
      y += 52;
      month = row.month;
    }
    desktop.push(
      svg.text(shape(clip(row.label, 'r', size, kindX - M - 40), 'r', size), M, y, { fill: COLOR.white }),
      svg.text(shape(row.kind, 'r', size), kindX, y, { fill: COLOR.white }),
      svg.text(shape(row.day, 'r', size), W - M, y, { fill: COLOR.white, anchor: 'end' }),
    );
    y += 45;
  }
  svg.height = Math.round(y - 45 + 72);

  // Phone: fewer entries, each on two lines, large enough to read at a third of the size.
  const big = 60;
  const meta = 46;
  const head = M + capHeight('m', big);
  const phone = [svg.text(shape('Latest writing', 'm', big), M, head, { fill: COLOR.yellow })];
  // The entries share the height under the heading evenly, so the last one lands on the bottom margin.
  const firstTitle = head + 140;
  const lastTitle = svg.height - M - 58;
  const count = Math.max(1, Math.min(rows.length, Math.floor((lastTitle - firstTitle) / 162) + 1));
  const stepY = count > 1 ? (lastTitle - firstTitle) / (count - 1) : 0;
  rows.slice(0, count).forEach((row, i) => {
    const py = firstTitle + i * stepY;
    phone.push(
      svg.text(shape(clip(row.label, 'm', big, W - 2 * M), 'm', big), M, py, { fill: COLOR.white }),
      svg.text(shape(`${row.kind}, ${row.full}`, 'r', meta), M, py + 58, { fill: COLOR.white, className: 'soft' }),
    );
  });

  svg.body.push(`<g class="d">${desktop.join('')}</g>`, `<g class="m">${phone.join('')}</g>`);
  return svg.render();
}

function footer() {
  const height = 720;
  const svg = new Svg(height, COLOR.yellow, 'Write to me at sarankumar131313@gmail.com');
  svg.styles.push(PHONE);
  const lines = ['sarankumar131313', '@gmail.com'];
  const size = fitSize(lines, 'b', TIGHT, W - 2 * M, 220);
  const last = height - 150;
  const display = lines
    .map((line, i) => svg.text(shape(line, 'b', size, TIGHT), M, last - (lines.length - 1 - i) * size * 0.92, { fill: COLOR.black }))
    .join('');
  const small = 30;
  const top = M + capHeight('m', small);
  const bottom = height - M;
  const notes = [
    ['Saran Kumar S.', M, top, 'start'],
    ['Applied AI engineer', AXIS, top, 'start'],
    ['goML, Coimbatore', W - M, top, 'end'],
    ['Write any time', M, bottom, 'start'],
    ['Set in Epilogue', AXIS, bottom, 'start'],
    ['IST, UTC+5:30', W - M, bottom, 'end'],
  ]
    .map(([text, x, y, anchor]) => svg.text(shape(text, 'm', small), x, y, { fill: COLOR.black, anchor }))
    .join('');
  const phone = [
    svg.text(shape('Saran Kumar S.', 'm', 50), M, M + capHeight('m', 50), { fill: COLOR.black }),
    svg.text(shape('Write any time', 'm', 50), M, bottom, { fill: COLOR.black }),
  ].join('');
  svg.body.push(display, `<g class="d">${notes}</g>`, `<g class="m">${phone}</g>`);
  return svg.render();
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

function updateReadme(posts) {
  const file = at('README.md');
  const readme = fs.readFileSync(file, 'utf8');
  const rows = posts.slice(0, 10).map(describe);
  const alt = `Latest writing: ${rows.map((r) => `${r.label}, ${r.kind.toLowerCase()}, ${r.full}`).join('; ')}.`;
  const block = `<!-- writing:start -->\n<p><a href="${SITE}/blogs"><img src="assets/writing.svg" width="100%" alt="${escape(alt)}"></a></p>\n<!-- writing:end -->`;
  if (!/<!-- writing:start -->[\s\S]*?<!-- writing:end -->/.test(readme)) {
    console.warn('README.md has no writing markers; left it alone.');
    return;
  }
  fs.writeFileSync(file, readme.replace(/<!-- writing:start -->[\s\S]*?<!-- writing:end -->/, block));
}

if (process.argv.includes('--refresh')) await refresh();
const posts = JSON.parse(fs.readFileSync(at('data', 'writing.json'), 'utf8'));
fs.mkdirSync(at('assets'), { recursive: true });
const panels = {
  'hero.svg': hero(),
  'capabilities.svg': capabilities(),
  'work.svg': work(),
  'products.svg': products(),
  'writing.svg': writing(posts),
  'footer.svg': footer(),
};
for (const [name, svg] of Object.entries(panels)) {
  fs.writeFileSync(at('assets', name), svg);
  console.log(`assets/${name}  ${(svg.length / 1024).toFixed(0)} KB`);
}
updateReadme(posts);
