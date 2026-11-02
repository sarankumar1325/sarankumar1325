#!/usr/bin/env node
// Draws the koi pond at the top of the README as a looping GIF for each GitHub theme.
//   node scripts/pond.mjs                    write assets/pond-dark.gif and assets/pond-light.gif
//   node scripts/pond.mjs --stills 0,90,180  write PNG stills of those frames to .preview/ instead
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => path.join(ROOT, ...parts);

const NAME = 'sarankumar';
// The pond is drawn in coarse pixels, each a 2×2 block in the GIF, which comes out 846 pixels
// wide: the width of a profile README on a desktop screen, so browsers show it unscaled.
const W = 423;
const H = 176;
const SCALE = 2;
const FRAMES = 300;
const DELAY = 6; // hundredths of a second, so the loop lasts 18 seconds
const TAU = Math.PI * 2;

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Ordered dithering against a fixed 8×8 Bayer matrix keeps the pattern still while things move through it.
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);
const th = (x, y) => BAYER[((y & 7) << 3) | (x & 7)];

function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------------------------------------
// Palette. Both GIFs share every frame and differ only in their colour table, so each ramp
// lists its dark-theme colours and then the light-theme colours in the same order.

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETTE = { dark: [[0, 0, 0]], light: [[255, 255, 255]] }; // index 0 is transparent
const RAMP = {};
function ramp(name, dark, light) {
  RAMP[name] = dark.map((hex, i) => {
    PALETTE.dark.push(rgb(hex));
    PALETTE.light.push(rgb(light[i]));
    return PALETTE.dark.length - 1;
  });
}

ramp('floor',
  ['#07121a', '#0a1820', '#0d1e27', '#11252e', '#162d36', '#1f3d45', '#2d5459', '#447471', '#6aa093'],
  ['#8fadb3', '#a2bec3', '#b3cbcf', '#c2d6d9', '#cfdfe1', '#dae7e8', '#e4eeee', '#eef5f5', '#f9fcfc']);
ramp('letter',
  ['#1f4950', '#2b5e64', '#3a777a', '#519389', '#78b2a2', '#acd6c3'],
  ['#163e49', '#1f4b56', '#2b5a65', '#3d6d77', '#56858e', '#7aa3aa']);
ramp('red',
  ['#4a140a', '#8a2612', '#c23d1d', '#e8592a', '#f88a4e'],
  ['#5e180a', '#9e2c14', '#d0441f', '#ec5f2d', '#f98f55']);
ramp('white',
  ['#4b565c', '#7f8b8d', '#b5bdb8', '#dcdfd6', '#f8f4ea'],
  ['#7d8a8d', '#a3aeae', '#c9d0cc', '#e8eae3', '#fffdf6']);
ramp('black',
  ['#06090b', '#1a2226', '#2e3a40', '#4d5b62'],
  ['#0a0d0f', '#171c20', '#283035', '#424b51']);
ramp('gold',
  ['#5a3f0e', '#9a6c1b', '#d09e34', '#ecc55a', '#fbe7a4'],
  ['#6e4c0f', '#ab7a1f', '#d8a73b', '#efca61', '#fcebb0']);
// Translucent white fins: the faintest tone shows the most water through it.
ramp('fin',
  ['#24363c', '#3d5257', '#62777a', '#8b9c9c'],
  ['#b9c6c8', '#a0adaf', '#8a979a', '#768386']);
ramp('pad',
  ['#0a1813', '#11261d', '#193628', '#244a35', '#386347'],
  ['#3a6a4c', '#4a7d5c', '#5e9270', '#7cab8a', '#a5c9ab']);
ramp('petal',
  ['#a8667e', '#e2a3b8', '#fbe2ea'],
  ['#c26a8a', '#ec9fb9', '#fad4e1']);
ramp('glint',
  ['#8fc9c1', '#e6faf4'],
  ['#ffffff', '#ffffff']);

function pick(r, v, t) {
  const s = clamp(v) * (r.length - 1);
  const i = Math.floor(s);
  return r[Math.min(r.length - 1, i + (s - i > t ? 1 : 0))];
}

// ---------------------------------------------------------------------------------------------
// The pond: a rounded rectangle whose shore dissolves into the page through the dither.

const SHORE = 12;
const opaque = new Uint8Array(W * H);
const floorTone = new Float32Array(W * H);
{
  const ax = W / 2 - 1;
  const by = H / 2 - 1;
  const n = 5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const nx = Math.abs((x + 0.5 - W / 2) / ax);
      const ny = Math.abs((y + 0.5 - H / 2) / by);
      const r = Math.pow(nx ** n + ny ** n, 1 / n);
      const grad = r > 1e-3 ? Math.pow(r, 1 - n) * Math.hypot(nx ** (n - 1) / ax, ny ** (n - 1) / by) : 1e-6;
      const dist = (1 - r) / grad;
      opaque[i] = clamp(dist / SHORE) > th(x, y) ? 1 : 0;
      const sand = noise(x / 38, y / 30, 3) * 0.6 + noise(x / 13, y / 11, 4) * 0.4;
      floorTone[i] = 0.3 + 0.1 * (sand - 0.5) + 0.12 * (1 - smoothstep(0, 46, dist));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The name, set in Inter (the closest open relative of the system fonts GitHub uses), laid on
// the floor of the pond as a coverage map that the water bends.

function flatten(commands, polys) {
  let poly = null;
  let cx = 0;
  let cy = 0;
  const close = () => {
    if (poly && poly.length > 2) polys.push(poly);
    poly = null;
  };
  for (const c of commands) {
    if (c.type === 'M') {
      close();
      poly = [[c.x, c.y]];
    } else if (c.type === 'L') {
      poly.push([c.x, c.y]);
    } else if (c.type === 'Q') {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const m = 1 - t;
        poly.push([m * m * cx + 2 * m * t * c.x1 + t * t * c.x, m * m * cy + 2 * m * t * c.y1 + t * t * c.y]);
      }
    } else if (c.type === 'C') {
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        const m = 1 - t;
        poly.push([
          m * m * m * cx + 3 * m * m * t * c.x1 + 3 * m * t * t * c.x2 + t * t * t * c.x,
          m * m * m * cy + 3 * m * m * t * c.y1 + 3 * m * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
    } else if (c.type === 'Z') {
      close();
    }
    if (c.type !== 'Z') {
      cx = c.x;
      cy = c.y;
    }
  }
  close();
}

// Nonzero-winding scanline fill with eight sub-rows per pixel and exact horizontal coverage.
function rasterize(polys, rows = 8) {
  const cov = new Float32Array(W * H);
  const edges = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a[1] !== b[1]) edges.push(a[0], a[1], b[0], b[1]);
    }
  }
  const hits = [];
  for (let sy = 0; sy < H * rows; sy++) {
    const y = (sy + 0.5) / rows;
    hits.length = 0;
    for (let e = 0; e < edges.length; e += 4) {
      const y0 = edges[e + 1];
      const y1 = edges[e + 3];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        hits.push({ x: edges[e] + ((y - y0) * (edges[e + 2] - edges[e])) / (y1 - y0), w: y1 > y0 ? 1 : -1 });
      }
    }
    hits.sort((a, b) => a.x - b.x);
    let winding = 0;
    const row = Math.floor(y);
    for (let i = 0; i < hits.length - 1; i++) {
      winding += hits[i].w;
      if (!winding) continue;
      const xa = Math.max(0, hits[i].x);
      const xb = Math.min(W, hits[i + 1].x);
      for (let x = Math.floor(xa); x < xb; x++) cov[row * W + x] += (Math.min(xb, x + 1) - Math.max(xa, x)) / rows;
    }
  }
  return cov;
}

function nameCoverage() {
  const buf = fs.readFileSync(at('scripts', 'fonts', 'inter-700.woff'));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const tracking = 0.025;
  const layout = (size) => {
    const glyphs = font.stringToGlyphs(NAME);
    const placed = [];
    let x = 0;
    glyphs.forEach((g, i) => {
      placed.push({ g, x });
      x += (g.advanceWidth * size) / font.unitsPerEm;
      if (glyphs[i + 1]) x += (font.getKerningValue(g, glyphs[i + 1]) * size) / font.unitsPerEm + tracking * size;
    });
    return placed;
  };
  const inkOf = (placed, size, left, baseline) => {
    let x1 = Infinity;
    let x2 = -Infinity;
    for (const { g, x } of placed) {
      const box = g.getPath(left + x, baseline, size).getBoundingBox();
      if (box.x1 < box.x2) {
        x1 = Math.min(x1, box.x1);
        x2 = Math.max(x2, box.x2);
      }
    }
    return { x1, x2 };
  };
  const probe = inkOf(layout(100), 100, 0, 0);
  const size = (100 * NAME_WIDTH) / (probe.x2 - probe.x1);
  const placed = layout(size);
  const ink = inkOf(placed, size, 0, 0);
  const left = W / 2 - (ink.x1 + ink.x2) / 2;
  const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * size;
  const baseline = H / 2 + xHeight / 2 + 3;
  const polys = [];
  for (const { g, x } of placed) flatten(g.getPath(left + x, baseline, size).commands, polys);
  return rasterize(polys);
}
const NAME_WIDTH = 262;
const nameCov = nameCoverage();

function sampleName(x, y) {
  x -= 0.5;
  y -= 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * W + x0;
  const top = nameCov[i] + (nameCov[i + 1] - nameCov[i]) * fx;
  const bottom = nameCov[i + W] + (nameCov[i + W + 1] - nameCov[i + W]) * fx;
  return top + (bottom - top) * fy;
}

// ---------------------------------------------------------------------------------------------
// Light through the moving surface. The surface is a handful of slow travelling waves, each a
// whole number of cycles per loop. Every beam of sunlight bends by the slope where it enters;
// where beams crowd together on the floor they draw the bright threads of a caustic.

const WAVES = Array.from({ length: 7 }, (_, k) => {
  const angle = hash(k, 1, 5) * TAU;
  const lambda = 30 + 40 * hash(k, 2, 5);
  const kk = TAU / lambda;
  return { kx: Math.cos(angle) * kk, ky: Math.sin(angle) * kk, cycles: 1 + Math.floor(hash(k, 3, 5) * 3), phase: hash(k, 4, 5) * TAU, amp: (0.25 * lambda) / 70 };
});
const FOCUS = 110; // how far below the surface the floor lies, in slope units: deeper water, sharper threads
const BEAMS = 2; // beams per pixel along each axis

function slope(x, y, a, out) {
  let gx = 0;
  let gy = 0;
  for (const w of WAVES) {
    const c = w.amp * Math.cos(w.kx * x + w.ky * y - w.cycles * a + w.phase);
    gx += c * w.kx;
    gy += c * w.ky;
  }
  out[0] = gx;
  out[1] = gy;
}

// The slope under every pixel, for bending the floor as seen from above, and the light that
// reaches the floor, 0 where it is no brighter than calm water would leave it.
function water(u) {
  const a = TAU * u;
  const g = [0, 0];
  const sx = new Float32Array(W * H);
  const sy = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      slope(x + 0.5, y + 0.5, a, g);
      sx[y * W + x] = g[0];
      sy[y * W + x] = g[1];
    }
  }
  const density = new Float32Array(W * H);
  const margin = 12;
  for (let by = -margin * BEAMS; by < (H + margin) * BEAMS; by++) {
    const y = (by + 0.5) / BEAMS;
    for (let bx = -margin * BEAMS; bx < (W + margin) * BEAMS; bx++) {
      const x = (bx + 0.5) / BEAMS;
      slope(x, y, a, g);
      const lx = x - FOCUS * g[0] - 0.5;
      const ly = y - FOCUS * g[1] - 0.5;
      const x0 = Math.floor(lx);
      const y0 = Math.floor(ly);
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
      const fx = lx - x0;
      const fy = ly - y0;
      const i = y0 * W + x0;
      density[i] += (1 - fx) * (1 - fy);
      density[i + 1] += fx * (1 - fy);
      density[i + W] += (1 - fx) * fy;
      density[i + W + 1] += fx * fy;
    }
  }
  const light = new Float32Array(W * H);
  for (let i = 0; i < light.length; i++) light[i] = clamp((density[i] / (BEAMS * BEAMS) - 1) / 3);
  return { sx, sy, light };
}

function sampleLight(light, x, y) {
  x -= 0.5;
  y -= 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * W + x0;
  const top = light[i] + (light[i + 1] - light[i]) * fx;
  const bottom = light[i + W] + (light[i + W + 1] - light[i + W]) * fx;
  return top + (bottom - top) * fy;
}

// ---------------------------------------------------------------------------------------------
// Koi. Each swims a closed loop drawn as a short Fourier series, a whole number of laps per
// loop of the GIF; its body follows its own path behind the head, with a wave running down to the tail.

function track({ cx, cy, terms, dir }) {
  const M = 4096;
  const px = new Float64Array(M + 1);
  const py = new Float64Array(M + 1);
  const len = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) {
    const a = (TAU * i * dir) / M;
    let x = cx;
    let y = cy;
    for (const [k, ax, bx, ay, by] of terms) {
      x += ax * Math.cos(k * a) + bx * Math.sin(k * a);
      y += ay * Math.cos(k * a) + by * Math.sin(k * a);
    }
    px[i] = x;
    py[i] = y;
    if (i) len[i] = len[i - 1] + Math.hypot(x - px[i - 1], y - py[i - 1]);
  }
  const total = len[M];
  const R = 2048;
  const rx = new Float64Array(R);
  const ry = new Float64Array(R);
  for (let r = 0, j = 0; r < R; r++) {
    const target = (total * r) / R;
    while (len[j + 1] < target) j++;
    const f = (target - len[j]) / (len[j + 1] - len[j]);
    rx[r] = px[j] + (px[j + 1] - px[j]) * f;
    ry[r] = py[j] + (py[j + 1] - py[j]) * f;
  }
  return {
    total,
    at(l, out) {
      let q = (l / total) * R;
      q = ((q % R) + R) % R;
      const i0 = Math.floor(q);
      const i1 = (i0 + 1) % R;
      const f = q - i0;
      out[0] = rx[i0] + (rx[i1] - rx[i0]) * f;
      out[1] = ry[i0] + (ry[i1] - ry[i0]) * f;
      return out;
    },
  };
}

// Patches are ellipses in the koi's own coordinates: s runs from the nose (0) to the root of the
// tail (1), u across the back from one flank (-1) to the other (1). [colour, s, u, radius s, radius u, ragged]
const VARIETY = {
  kohaku: { base: 'white', fins: 'white', patches: [['red', 0.14, 0.05, 0.08, 0.95, 1], ['red', 0.41, 0.12, 0.13, 0.95, 1], ['red', 0.67, -0.2, 0.085, 0.8, 1]] },
  showa: {
    base: 'black', fins: 'white', finRoot: 'black',
    patches: [['red', 0.14, 0.1, 0.085, 0.9, 1], ['white', 0.3, 0.62, 0.07, 0.55, 1], ['red', 0.47, -0.3, 0.11, 0.8, 1], ['white', 0.6, 0.5, 0.1, 0.7, 1], ['white', 0.8, -0.4, 0.06, 0.6, 1]],
  },
  ogon: { base: 'gold', fins: 'gold', metallic: true, patches: [] },
  tancho: { base: 'white', fins: 'white', patches: [['red', 0.12, 0, 0.055, 0.6, 0.15]] },
  sanke: {
    base: 'white', fins: 'white',
    patches: [['red', 0.15, 0, 0.08, 0.9, 1], ['red', 0.47, 0.2, 0.12, 0.9, 1], ['black', 0.36, -0.55, 0.04, 0.35, 0.6], ['black', 0.6, 0.55, 0.035, 0.3, 0.6], ['black', 0.72, -0.2, 0.03, 0.3, 0.6]],
  },
};

// [kind, length, loop, laps, phase, tail beats per loop, surge [px, turns, phase], depth [mid, swing, turns, phase], kiss]
const KOI = [
  { kind: 'kohaku', L: 60, seed: 1, loop: { cx: 211, cy: 90, terms: [[1, 150, 0, 0, 54], [2, 0, 10, 8, 0], [3, 4, 0, 0, 3]], dir: 1 }, laps: 1, phase: 0.25, beats: 18, surge: [10, 2, 0.3], depth: [0.22, 0.2, 1, 0.4], kiss: true },
  { kind: 'showa', L: 51, seed: 2, loop: { cx: 116, cy: 92, terms: [[1, 78, 0, 0, 0], [2, 0, 0, 0, 42]], dir: -1 }, laps: 1, phase: 0.5, beats: 20, surge: [8, 3, 1.1], depth: [0.42, 0.28, 1, 2.0], kiss: false },
  { kind: 'ogon', L: 50, seed: 3, loop: { cx: 318, cy: 88, terms: [[1, 82, 0, 0, 54], [2, 6, 0, 0, -6]], dir: -1 }, laps: 1, phase: 0.9, beats: 20, surge: [8, 2, 2.2], depth: [0.32, 0.26, 2, 0.9], kiss: true },
  { kind: 'tancho', L: 43, seed: 4, loop: { cx: 220, cy: 104, terms: [[1, 118, 0, 0, 26], [3, 0, 8, 6, 0]], dir: 1 }, laps: 1, phase: 0.4, beats: 22, surge: [6, 2, 0.7], depth: [0.5, 0.3, 1, 3.1], kiss: false },
  { kind: 'sanke', L: 37, seed: 5, loop: { cx: 96, cy: 64, terms: [[1, 52, 0, 0, 34], [2, 0, 6, 5, 0]], dir: 1 }, laps: 2, phase: 0.85, beats: 30, surge: [5, 4, 0.2], depth: [0.3, 0.22, 2, 1.7], kiss: false },
];
for (const k of KOI) k.track = track(k.loop);

const WIDTH = [[0, 0], [0.03, 0.5], [0.08, 0.76], [0.16, 0.93], [0.27, 1], [0.4, 0.95], [0.54, 0.79], [0.68, 0.54], [0.8, 0.33], [0.9, 0.2], [1, 0.15]];
const halfWidthTable = new Float32Array(513);
for (let i = 0; i <= 512; i++) {
  const s = i / 512;
  let j = 0;
  while (j < WIDTH.length - 2 && WIDTH[j + 1][0] < s) j++;
  const [s0, w0] = WIDTH[j];
  const [s1, w1] = WIDTH[j + 1];
  const t = (1 - Math.cos((Math.PI * (s - s0)) / (s1 - s0))) / 2;
  halfWidthTable[i] = w0 + (w1 - w0) * t;
}
const halfWidth = (s) => (s <= 0 || s >= 1 ? 0 : halfWidthTable[Math.round(s * 512)]);

const S_END = 1.32; // the spine runs on past the body to the tip of the tail fin
const TAIL = 0.86; // where the tail fin starts
const FIN_TONE = { white: 0.3, gold: 0.55, black: 0.8, red: 0.6 };
const NS = 30;
const LIGHT = [-0.55, -0.83]; // light falls from the top left

const depthOf = (k, u) => clamp(k.depth[0] + k.depth[1] * Math.sin(TAU * k.depth[2] * u + k.depth[3]));
const headOf = (k, u) => k.track.total * (k.phase + k.laps * u) + k.surge[0] * Math.sin(TAU * k.surge[1] * u + k.surge[2]);

function material(name, shade, t) {
  if (name === 'white') return pick(RAMP.white, shade, t);
  if (name === 'red') return pick(RAMP.red, shade * 0.86, t);
  if (name === 'black') return pick(RAMP.black, shade * 0.62, t);
  return pick(RAMP.gold, shade * 0.95, t);
}

function patternAt(k, s, u) {
  const v = VARIETY[k.kind];
  let m = v.base;
  for (const [name, ps, pu, rs, ru, ragged] of v.patches) {
    const e = ((s - ps) / rs) ** 2 + ((u - pu) / ru) ** 2 + (noise(s * 7 + k.seed * 7, u * 1.8 + k.seed, 9) - 0.5) * 0.7 * ragged;
    if (e < 1) m = name;
  }
  return m;
}

// Draws one koi into a small local buffer: the colour it leaves (0 where it leaves nothing) and how
// much light it blocks, for its shadow on the floor.
function koiFrame(k, u) {
  const L = k.L;
  const head = headOf(k, u);
  const depth = depthOf(k, u);
  const xs = new Float64Array(NS);
  const ys = new Float64Array(NS);
  const ss = new Float64Array(NS);
  const p = [0, 0];
  const q = [0, 0];
  for (let i = 0; i < NS; i++) {
    const s = (S_END * i) / (NS - 1);
    k.track.at(head - s * L * 0.94, p);
    k.track.at(head - s * L * 0.94 + 1, q);
    let tx = q[0] - p[0];
    let ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const amp = L * (0.006 + 0.085 * Math.pow(s, 2.4));
    const wave = Math.sin(TAU * (s * 0.9 - k.beats * u));
    xs[i] = p[0] - ty * amp * wave;
    ys[i] = p[1] + tx * amp * wave;
    ss[i] = s;
  }

  // Pectoral fins near the head and smaller pelvic fins behind them, paddling out of step.
  const fins = [];
  for (const [s, len, wid, spread] of [[0.2, 0.25, 0.13, 1.1], [0.5, 0.13, 0.07, 0.8]]) {
    const i = Math.round((s / S_END) * (NS - 1));
    let hx = xs[i - 1] - xs[i + 1];
    let hy = ys[i - 1] - ys[i + 1];
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl;
    hy /= hl;
    const nx = -hy;
    const ny = hx;
    for (const side of [-1, 1]) {
      const flap = 0.28 * Math.sin(TAU * (k.beats / 2) * u + side * 0.8 + s * 4);
      const a = spread + flap;
      let dx = -hx * Math.cos(a) + side * nx * Math.sin(a);
      let dy = -hy * Math.cos(a) + side * ny * Math.sin(a);
      const dl = Math.hypot(dx, dy);
      dx /= dl;
      dy /= dl;
      const root = halfWidth(s) * 0.135 * L * 0.8;
      const ra = (len * L) / 2;
      fins.push({ cx: xs[i] + side * nx * root + dx * ra, cy: ys[i] + side * ny * root + dy * ra, dx, dy, ra, rb: (wid * L) / 2 });
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < NS; i++) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }
  const pad = L * 0.3;
  const x0 = Math.max(0, Math.floor(minX - pad));
  const y0 = Math.max(0, Math.floor(minY - pad));
  const x1 = Math.min(W - 1, Math.ceil(maxX + pad));
  const y1 = Math.min(H - 1, Math.ceil(maxY + pad));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const color = new Uint8Array(Math.max(0, w * h));
  const block = new Float32Array(Math.max(0, w * h));
  if (w <= 0 || h <= 0) return { x0, y0, w: 0, h: 0, color, block, depth };

  const v = VARIETY[k.kind];
  const maxHalf = 0.135 * L;
  const fade = 1 - 0.55 * smoothstep(0.5, 1, depth); // koi on a deep dive dissolve into the water
  const dim = 1 - 0.15 * depth;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      let best = Infinity;
      let bs = 0;
      let side = 1;
      let nsx = 0;
      let nsy = 0;
      for (let i = 0; i < NS - 1; i++) {
        const ex = xs[i + 1] - xs[i];
        const ey = ys[i + 1] - ys[i];
        const l2 = ex * ex + ey * ey || 1e-9;
        let t = ((cx - xs[i]) * ex + (cy - ys[i]) * ey) / l2;
        const hi = i === NS - 2 ? 4 : 1;
        t = t < 0 ? 0 : t > hi ? hi : t;
        const qx = xs[i] + ex * t - cx;
        const qy = ys[i] + ey * t - cy;
        const d2 = qx * qx + qy * qy;
        if (d2 < best) {
          best = d2;
          bs = ss[i] + (ss[i + 1] - ss[i]) * t;
          side = ex * (cy - ys[i]) - ey * (cx - xs[i]) >= 0 ? 1 : -1;
          const el = Math.sqrt(l2);
          nsx = -ey / el;
          nsy = ex / el;
        }
      }
      const d = Math.sqrt(best);
      const half = halfWidth(bs) * maxHalf;
      const body = bs < 1 ? clamp((half - d) * 1.5 + 0.5) : 0;

      let tail = 0;
      let tailAlong = 0;
      if (bs > TAIL) {
        // The fin fans out from the root of the tail; the middle of its trailing edge is cut back into a fork.
        const qn = (bs - TAIL) / (S_END - TAIL);
        const spread = L * (0.02 + 0.15 * Math.pow(Math.min(qn, 1), 0.85));
        const lobe = Math.min(1, d / (L * 0.17));
        const edge = 1 - 0.32 * (1 - lobe * lobe);
        tail = clamp((spread - d) * 1.3 + 0.5) * clamp((edge - qn) * (S_END - TAIL) * L * 0.94 * 1.3 + 0.5);
        tailAlong = Math.min(qn, 1);
      }
      let fin = 0;
      let finAlong = 0;
      for (const f of fins) {
        const vx = cx - f.cx;
        const vy = cy - f.cy;
        const a = vx * f.dx + vy * f.dy;
        const b = -vx * f.dy + vy * f.dx;
        const rb = f.rb * (0.7 + 0.3 * clamp(a / f.ra, -1, 1));
        const e = Math.sqrt((a / f.ra) ** 2 + (b / rb) ** 2);
        const c = clamp((1 - e) * Math.min(f.ra, rb) * 1.4 + 0.5);
        if (c > fin) {
          fin = c;
          finAlong = a / f.ra;
        }
      }
      const li = (py - y0) * w + (px - x0);
      block[li] = Math.max(body, 0.55 * Math.max(tail, fin));
      const t1 = th(px + 2, py + 5);
      const t2 = th(px, py);
      // Fins are drawn solid; their translucency is in their colours, which fade towards the water at the tips.
      const finAlpha = Math.max(tail, fin);
      if (body * fade > t1) {
        const uu = clamp((side * d) / Math.max(half, 0.5), -1, 1);
        const lit = (nsx * LIGHT[0] + nsy * LIGHT[1]) * Math.sign(uu);
        const rim = smoothstep(0.5, 1, Math.abs(uu));
        let shade = (0.95 - rim * (0.45 - 0.3 * lit)) * dim;
        if (v.metallic) {
          if (Math.abs(uu) < 0.25 && bs > 0.1 && bs < 0.62) shade += 0.12;
          if (hash(Math.floor((bs * L) / 2.2), Math.floor(uu * 3 + 3), k.seed) > 0.84) shade += 0.18;
        }
        let m = patternAt(k, bs, uu);
        const eye = bs > 0.055 && bs < 0.095 && Math.abs(uu) > 0.55 && Math.abs(uu) < 0.9;
        color[li] = eye ? RAMP.black[0] : material(m, clamp(shade), t2);
      } else if (finAlpha * fade > t1) {
        let m = v.fins;
        if (v.finRoot && fin > tail && finAlong < -0.15) m = v.finRoot;
        const along = tail > fin ? tailAlong : Math.max(0, finAlong);
        const rays = Math.sin(along * 9 + (tail > fin ? d : 0) * 1.3) * along;
        if (m === 'white') {
          color[li] = pick(RAMP.fin, clamp((0.8 - 0.55 * along + 0.2 * rays) * dim), t2);
        } else {
          color[li] = material(m, clamp((FIN_TONE[m] + 0.07 * rays) * dim), t2);
        }
      }
    }
  }
  return { x0, y0, w, h, color, block, depth };
}

// ---------------------------------------------------------------------------------------------
// Ripples: where a koi kisses the surface, and where a petal lands.

// Cherry petals land on the water, drift on the current and sink. [x, y, landing, life, drift x, drift y, angle, spin]
const PETALS = [
  [286, 40, 0.42, 0.6, 46, 14, 0.4, 1.2],
  [150, 140, 0.8, 0.55, 40, -12, 2.1, -0.9],
  [372, 66, 0.1, 0.5, -30, 22, 4, 0.8],
].map(([x, y, u0, life, vx, vy, angle, spin]) => ({ x, y, u0, life, vx, vy, angle, spin }));
const RIPPLES = PETALS.map((p) => ({ x: p.x, y: p.y, u0: p.u0 }));
for (const k of KOI.filter((k) => k.kiss)) {
  let best = 0;
  for (let i = 0; i < 600; i++) if (depthOf(k, i / 600) < depthOf(k, best / 600)) best = i;
  const u0 = best / 600;
  const p = k.track.at(headOf(k, u0) + 2, [0, 0]);
  RIPPLES.push({ x: p[0], y: p[1], u0 });
}
const RIPPLE_LIFE = 0.15;
const RIPPLE_REACH = 40;

function activeRipples(u) {
  const out = [];
  for (const r of RIPPLES) {
    const age = (((u - r.u0) % 1) + 1) % 1;
    if (age >= RIPPLE_LIFE) continue;
    const p = age / RIPPLE_LIFE;
    out.push({ x: r.x, y: r.y, radius: 1 + RIPPLE_REACH * (1 - (1 - p) ** 2), amp: (1 - p) ** 1.6 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Lily pads sit on the surface, over everything else, and shade the floor beneath them.

const PADS = [
  { x: 30, y: 36, r: 17, notch: 0.9, seed: 1 },
  { x: 57, y: 22, r: 9, notch: 2.4, seed: 2 },
  { x: 392, y: 138, r: 20, notch: 3.9, seed: 3 },
  { x: 363, y: 159, r: 11, notch: 5.2, seed: 4 },
];
const padColor = new Uint8Array(W * H);
const padShadow = new Float32Array(W * H);
for (const pad of PADS) {
  for (let y = Math.floor(pad.y - pad.r - 2); y <= pad.y + pad.r + 2; y++) {
    for (let x = Math.floor(pad.x - pad.r - 2); x <= pad.x + pad.r + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - pad.x;
      const dy = y + 0.5 - pad.y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const edge = pad.r * (1 + 0.05 * (noise(Math.cos(ang) * 2 + pad.seed * 5, Math.sin(ang) * 2, 21) - 0.5));
      let off = ang - pad.notch;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      const notched = Math.abs(off) < 0.2 && dist > 1.2;
      const cov = notched ? 0 : clamp(edge - dist + 0.5);
      const i = y * W + x;
      if (cov > 0.5) {
        const lightSide = -(dx * LIGHT[0] + dy * LIGHT[1]) / pad.r;
        const rr = dist / edge;
        let tone = 0.5 + 0.2 * lightSide - 0.24 * smoothstep(0.8, 1, rr);
        if (Math.abs(Math.sin(off * 4)) * dist < 0.55 && rr > 0.12 && rr < 0.86) tone += 0.13;
        if (rr > 0.84 && lightSide > 0.2) tone += 0.3;
        padColor[i] = pick(RAMP.pad, tone, th(x, y));
      }
    }
  }
}
// Shadows fall down and to the right of whatever casts them.
for (let y = H - 1; y >= 0; y--) {
  for (let x = W - 1; x >= 0; x--) {
    const sx = x - 3;
    const sy = y - 4;
    if (sx >= 0 && sy >= 0 && padColor[sy * W + sx]) padShadow[y * W + x] = 0.6;
  }
}

// ---------------------------------------------------------------------------------------------
// One frame of the pond as palette indices, one per pond pixel.

const shadow = new Float32Array(W * H);
const surface = new Float32Array(W * H);
const WOBBLE = 16; // how far the floor seems to shift for a given surface slope
let waterCache = null;

// Sun glints: a pixel flares and fades, here and there, now and then.
const GLINTS = Array.from({ length: 16 }, (_, n) => ({
  x: Math.round(24 + hash(n, 1, 77) * (W - 48)),
  y: Math.round(16 + hash(n, 2, 77) * (H - 32)),
  u0: hash(n, 3, 77),
  life: 0.03 + hash(n, 4, 77) * 0.025,
}));

// The light on the floor changes on every fourth frame, everything else on every frame: it drifts
// too slowly for anyone to see the steps, and the GIF is lighter for it.
const WATER_STEP = 4;

function renderFrame(f) {
  const u = f / FRAMES;
  const ub = (WATER_STEP * Math.floor(f / WATER_STEP)) / FRAMES;
  const out = new Uint8Array(W * H);
  shadow.set(padShadow);
  surface.fill(0);

  const koi = KOI.map((k) => koiFrame(k, u));
  for (const k of koi) {
    // A koi near the surface throws its shadow further and softer onto the floor.
    const lift = 1 - k.depth;
    const ox = Math.round(3 + 4 * lift);
    const oy = Math.round(4 + 5 * lift);
    const strength = 0.62 - 0.22 * lift;
    for (let y = 1; y < k.h - 1; y++) {
      for (let x = 1; x < k.w - 1; x++) {
        const li = y * k.w + x;
        const b = k.block;
        const soft = (b[li] * 4 + b[li - 1] + b[li + 1] + b[li - k.w] + b[li + k.w]) / 8;
        if (soft <= 0) continue;
        const gx = k.x0 + x + ox;
        const gy = k.y0 + y + oy;
        if (gx >= W || gy >= H) continue;
        const gi = gy * W + gx;
        shadow[gi] = Math.max(shadow[gi], soft * strength);
      }
    }
  }

  const ripples = activeRipples(u);
  if (!waterCache || waterCache.u !== ub) waterCache = { u: ub, ...water(ub) };
  const { sx, sy, light: lightMap } = waterCache;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!opaque[i]) continue;
      let dx = 0;
      let dy = 0;
      let high = 0;
      let trough = 0;
      for (const r of ripples) {
        const rx = x + 0.5 - r.x;
        const ry = y + 0.5 - r.y;
        const dist = Math.hypot(rx, ry);
        if (dist > r.radius + 6) continue;
        const ring = dist - r.radius;
        const inner = dist - r.radius * 0.62;
        // Crests catch the light on the side facing it; the trough behind each crest darkens the floor.
        const facing = dist > 0.01 ? 0.5 - 0.5 * ((rx * LIGHT[0] + ry * LIGHT[1]) / dist) : 0.5;
        high += (1.25 * Math.exp(-(ring * ring) / 2) + 0.55 * Math.exp(-(inner * inner) / 1.5)) * r.amp * (0.35 + 0.65 * facing);
        const back = ring + 2.6;
        trough += Math.exp(-(back * back) / 2.5) * r.amp * 0.5;
        const push = -ring * Math.exp(-(ring * ring) / 5) * r.amp * 1.1;
        if (dist > 0.01) {
          dx += (rx / dist) * push;
          dy += (ry / dist) * push;
        }
      }
      surface[i] = high;
      const shade = Math.min(1, shadow[i] + trough);
      const light = sampleLight(lightMap, x + 0.5 + dx * 1.5, y + 0.5 + dy * 1.5) * (1 - shade);
      dx -= WOBBLE * sx[i];
      dy -= WOBBLE * sy[i];
      const letter = sampleName(x + 0.5 + dx, y + 0.5 + dy);
      if (letter > th(x + 3, y + 5)) {
        out[i] = pick(RAMP.letter, 0.6 + 0.4 * light - 0.36 * shade, th(x, y));
      } else {
        // The letters stand a little proud of the floor and shade it down and to the right.
        const lee = sampleName(x - 1.5 + dx, y - 2 + dy) * 0.42;
        out[i] = pick(RAMP.floor, floorTone[i] + 0.36 * light - 0.3 * Math.min(1, shade + lee), th(x, y));
      }
    }
  }

  koi.sort((p, q) => q.depth - p.depth);
  for (const k of koi) {
    for (let y = 0; y < k.h; y++) {
      for (let x = 0; x < k.w; x++) {
        const c = k.color[y * k.w + x];
        if (!c) continue;
        const gi = (k.y0 + y) * W + k.x0 + x;
        if (opaque[gi]) out[gi] = c;
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!opaque[i]) continue;
      if (surface[i] * 0.9 > th(x + 5, y + 1)) out[i] = RAMP.glint[surface[i] > 0.7 ? 1 : 0];
      if (padColor[i]) out[i] = padColor[i];
    }
  }

  for (const p of PETALS) {
    const age = (((u - p.u0) % 1) + 1) % 1;
    if (age >= p.life) continue;
    const q = age / p.life;
    const cx = p.x + p.vx * q + 2.5 * Math.sin(q * 5 + p.angle);
    const cy = p.y + p.vy * q + 2 * Math.sin(q * 4 + p.spin);
    const ang = p.angle + p.spin * q * 3;
    const ax = Math.cos(ang);
    const ay = Math.sin(ang);
    // Lands at once, then sinks: fades through the dither over the last fifth of its life.
    const alpha = 1 - smoothstep(0.8, 1, q);
    for (let y = Math.floor(cy - 5); y <= cy + 5; y++) {
      for (let x = Math.floor(cx - 5); x <= cx + 5; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!opaque[i] || padColor[i]) continue;
        const vx = x + 0.5 - cx;
        const vy = y + 0.5 - cy;
        const a = vx * ax + vy * ay;
        const b = -vx * ay + vy * ax;
        const half = 2.1 * Math.sqrt(Math.max(0, 1 - (a / 3.6) ** 2)) * (0.75 + 0.25 * (a / 3.6));
        const notch = a > 2.4 && Math.abs(b) < 0.7;
        const cov = notch ? 0 : clamp((half - Math.abs(b)) * 1.5 + 0.5) * clamp((3.6 - Math.abs(a)) * 1.5 + 0.5);
        if (cov * alpha > th(x + 1, y + 6)) out[i] = pick(RAMP.petal, 0.6 - 0.2 * (b * LIGHT[1] + a * LIGHT[0]) / 2.5 - 0.3 * q, th(x, y));
      }
    }
  }

  for (const g of GLINTS) {
    const age = (((u - g.u0) % 1) + 1) % 1;
    if (age >= g.life) continue;
    const s = Math.sin((Math.PI * age) / g.life);
    const spots = s > 0.75 ? [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] : s > 0.3 ? [[0, 0, 1]] : [];
    for (const [ox, oy, bright] of spots) {
      const i = (g.y + oy) * W + g.x + ox;
      if (opaque[i] && !padColor[i]) out[i] = RAMP.glint[bright];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// GIF89a, written by hand: a global colour table, then each frame cropped to what changed since
// the one before, with unchanged pixels left transparent so they keep what is already shown.

function lzw(minCode, data) {
  const A = 1 << minCode;
  const clear = A;
  const end = A + 1;
  const child = new Int16Array(4096 * A);
  const out = [];
  let size = minCode + 1;
  let next = end + 1;
  let acc = 0;
  let bits = 0;
  const emit = (code) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i];
    const key = prefix * A + k;
    const c = child[key];
    if (c) {
      prefix = c;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      child.fill(0);
      size = minCode + 1;
      next = end + 1;
    } else {
      if (next >= 1 << size) size++;
      child[key] = next++;
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) out.push(acc & 255);
  return out;
}

function gif(frames, palette) {
  const bytes = [];
  const u16 = (v) => bytes.push(v & 255, (v >> 8) & 255);
  const str = (s) => [...s].forEach((ch) => bytes.push(ch.charCodeAt(0)));
  const depth = 6;
  str('GIF89a');
  u16(W * SCALE);
  u16(H * SCALE);
  bytes.push(0x80 | ((depth - 1) << 4) | (depth - 1), 0, 0);
  for (let i = 0; i < 1 << depth; i++) bytes.push(...(palette[i] || [0, 0, 0]));
  bytes.push(0x21, 0xff, 11);
  str('NETSCAPE2.0');
  bytes.push(3, 1, 0, 0, 0);
  for (const fr of frames) {
    bytes.push(0x21, 0xf9, 4, (1 << 2) | 1, DELAY & 255, DELAY >> 8, 0, 0);
    bytes.push(0x2c);
    u16(fr.x * SCALE);
    u16(fr.y * SCALE);
    u16(fr.w * SCALE);
    u16(fr.h * SCALE);
    bytes.push(0);
    const big = new Uint8Array(fr.w * SCALE * fr.h * SCALE);
    for (let y = 0; y < fr.h * SCALE; y++) {
      const src = Math.floor(y / SCALE) * fr.w;
      for (let x = 0; x < fr.w * SCALE; x++) big[y * fr.w * SCALE + x] = fr.data[src + Math.floor(x / SCALE)];
    }
    bytes.push(depth);
    const code = lzw(depth, big);
    for (let i = 0; i < code.length; i += 255) {
      const n = Math.min(255, code.length - i);
      bytes.push(n);
      for (let j = 0; j < n; j++) bytes.push(code[i + j]);
    }
    bytes.push(0);
  }
  bytes.push(0x3b);
  return Buffer.from(bytes);
}

function crop(prev, cur) {
  if (!prev) return { x: 0, y: 0, w: W, h: H, data: cur };
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (prev[y * W + x] !== cur[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1, data: new Uint8Array(1) };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y0 + y) * W + x0 + x;
      data[y * w + x] = prev[i] === cur[i] ? 0 : cur[i];
    }
  }
  return { x: x0, y: y0, w, h, data };
}

// ---------------------------------------------------------------------------------------------
// PNG stills for checking the look without a browser.

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function png(width, height, rgb) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let c = -1;
    for (const b of body) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeInt32BE(~c, body.length + 4);
    return out;
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const PAGE = { dark: [13, 17, 23], light: [255, 255, 255] };
function sheet(frames, theme) {
  const gap = 12;
  const width = W * SCALE;
  const height = frames.length * (H * SCALE + gap) - gap;
  const out = Buffer.alloc(width * height * 3);
  frames.forEach((fr, n) => {
    for (let y = 0; y < H * SCALE; y++) {
      for (let x = 0; x < width; x++) {
        const idx = fr[Math.floor(y / SCALE) * W + Math.floor(x / SCALE)];
        const c = idx ? PALETTE[theme][idx] : PAGE[theme];
        const o = ((n * (H * SCALE + gap) + y) * width + x) * 3;
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
      }
    }
    for (let y = H * SCALE; y < H * SCALE + gap && n < frames.length - 1; y++) {
      for (let x = 0; x < width; x++) {
        const o = ((n * (H * SCALE + gap) + y) * width + x) * 3;
        out.set(PAGE[theme], o);
      }
    }
  });
  return png(width, height, out);
}

const stillsArg = process.argv.indexOf('--stills');
if (stillsArg > 0) {
  const list = process.argv[stillsArg + 1].split(',').map(Number);
  const frames = list.map((f) => renderFrame(f));
  fs.mkdirSync(at('.preview'), { recursive: true });
  for (const theme of ['dark', 'light']) fs.writeFileSync(at('.preview', `pond-${theme}.png`), sheet(frames, theme));
  console.log(`Wrote ${list.length} stills to .preview/.`);
} else {
  const started = Date.now();
  const frames = [];
  let prev = null;
  for (let f = 0; f < FRAMES; f++) {
    const cur = renderFrame(f);
    frames.push(crop(prev, cur));
    prev = cur;
  }
  const rendered = Date.now();
  fs.mkdirSync(at('assets'), { recursive: true });
  const changed = frames.slice(1).reduce((n, fr) => n + fr.data.reduce((m, v) => m + (v ? 1 : 0), 0), 0) / (FRAMES - 1);
  console.log(`${Math.round(changed)} pond pixels change per frame on average (of ${W * H}).`);
  for (const theme of ['dark', 'light']) {
    const out = gif(frames, PALETTE[theme]);
    fs.writeFileSync(at('assets', `pond-${theme}.gif`), out);
    console.log(`assets/pond-${theme}.gif: ${(out.length / 1024).toFixed(0)} KB`);
  }
  console.log(`${FRAMES} frames drawn in ${((rendered - started) / 1000).toFixed(1)}s, encoded in ${((Date.now() - rendered) / 1000).toFixed(1)}s.`);
}
