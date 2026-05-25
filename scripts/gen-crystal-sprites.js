#!/usr/bin/env node
/**
 * gen-crystal-sprites.js — generates sapphire crystal evolution chain via Replicate recraft-v3
 *
 * Usage:
 *   node scripts/gen-crystal-sprites.js                — all 10 levels
 *   node scripts/gen-crystal-sprites.js --level 3      — only level 3
 *   node scripts/gen-crystal-sprites.js --fix-bg       — remove white bg from existing (no API)
 *   node scripts/gen-crystal-sprites.js --outline      — add programmatic outline to existing
 *   node scripts/gen-crystal-sprites.js --outline --outline-px 3
 */

const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const OUTLINE_PX = 2;
const FINAL_SIZE = 192;
const GEN_SIZE = 1024;

const OUT_DIR = path.join(__dirname, '../assets/crystal-cartoon');

const ANCHOR = [
  'glossy cartoon mobile game icon',
  'thick black outline bold linework',
  'vibrant saturated colors',
  'brilliant gemstone sparkle and light reflections',
  'soft inner glow on gemstone surfaces',
  'no shadow no drop shadow no cast shadow no ground shadow no reflection shadow',
  'flat even lighting on white background',
  'pure white background',
  'centered composition',
  'no text no labels no extra objects',
].join(', ');

// itemSize: how large the item appears inside the 192×192 canvas (px).
// The gen pipeline resizes the item to itemSize×itemSize, then pads to 192×192.
const CHAIN = [
  {
    level: 1,
    name: 'bubble',
    itemSize: 88,
    desc: 'a single smooth round sphere, dark grey-blue mineral pebble, completely matte dull surface, no shine no sparkle no transparency no facets, plain solid ball, NO eyes NO face NO character NO decoration, just a simple geometric sphere',
  },
  {
    level: 2,
    name: 'drop',
    itemSize: 118,
    desc: 'a vertical teardrop shape, wide rounded top narrowing to a sharp point at the bottom, translucent sapphire blue liquid drop, single bright specular highlight on upper rounded surface, smooth glassy surface, NOT a cut gemstone NOT a diamond NOT a round brilliant, simple liquid drop silhouette',
  },
  {
    level: 3,
    name: 'long-drop',
    itemSize: 148,
    desc: 'a tall elongated teardrop, narrow oval with a very sharp pointed bottom, vivid glowing sapphire blue, strong inner radiance and bright specular highlight, glassy transparent surface',
  },
  {
    level: 4,
    name: 'proto-crystal',
    itemSize: 158,
    desc: 'a blue crystal-drop hybrid, teardrop shape with flat angular facets forming on the sides, transitional form half-liquid half-crystal, sapphire blue with a few bright facet light reflections',
  },
  {
    level: 5,
    name: 'spike',
    itemSize: 164,
    desc: 'a single tall sharp sapphire crystal spike, pointed at both top and bottom, clean angular facets along the sides, vivid deep blue with strong specular reflections on each face, upright vertical orientation',
  },
  {
    level: 6,
    name: 'twin',
    itemSize: 168,
    desc: 'two tall sapphire crystal columns growing side by side from a shared rocky base, both pointing upward, slightly splayed apart at the top, each column has clean sharp angular facets, vivid deep blue with bright light reflections, front-facing view, NOT crossed NOT swords NOT weapons',
  },
  {
    level: 7,
    name: 'cluster',
    itemSize: 172,
    desc: 'a bouquet of four sapphire crystal spikes bound together at the middle, fanning outward and upward in all directions, isolated floating object, each spike has sharp angular facets, vivid deep blue with bright sparkle and light reflections, no ground no base no background elements, centered isolated single object',
  },
  {
    level: 8,
    name: 'druzy',
    itemSize: 178,
    desc: 'a sapphire crystal druzy geode, hundreds of tiny densely packed crystal points covering a dark rocky base like a glittering carpet, deep rich blue, surface completely blanketed in small crystal spikes with no large individual crystals visible, massive heavy form',
  },
  {
    level: 9,
    name: 'gem',
    itemSize: 182,
    desc: 'a large faceted sapphire gemstone, radiant-cut with many sharp triangular facets, vivid deep blue, strong sparkle and light dispersion reflections, floating centered, front-facing view, isolated single item',
  },
  {
    level: 10,
    name: 'solitaire',
    itemSize: 188,
    desc: 'a massive legendary sapphire solitaire gemstone, brilliant-cut with extraordinary rainbow prismatic light dispersion, iridescent reflections in all colors, majestic deep blue glow, symmetric centered view, opulent',
  },
];

// ---------- Dilation-based outline ----------
function applyOutlineToData(data, width, height, channels, outlinePx) {
  const total = width * height;
  const outlineMask = new Uint8Array(total);
  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      const oi = oy * width + ox;
      if (data[oi * channels + 3] > 128) continue;
      let nearOpaque = false;
      outer: for (let dy = -outlinePx; dy <= outlinePx; dy++) {
        for (let dx = -outlinePx; dx <= outlinePx; dx++) {
          if (dx * dx + dy * dy > outlinePx * outlinePx) continue;
          const nx = ox + dx, ny = oy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (data[(ny * width + nx) * channels + 3] > 128) { nearOpaque = true; break outer; }
        }
      }
      if (nearOpaque) outlineMask[oi] = 1;
    }
  }
  for (let i = 0; i < total; i++) {
    if (!outlineMask[i]) continue;
    const idx = i * channels;
    data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
  }
}

// ---------- Background removal — 5 passes ----------
async function removeWhiteBackground(inputBuf) {
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const total = width * height;

  const isWhite = (flat) => {
    const i = flat * channels;
    return data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230;
  };

  const transparent = new Uint8Array(total);

  // Pass 1: flood-fill from edges
  const q1 = [];
  const enqueue1 = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const flat = y * width + x;
    if (transparent[flat] || !isWhite(flat)) return;
    transparent[flat] = 1;
    q1.push(flat);
  };
  for (let x = 0; x < width; x++) { enqueue1(x, 0); enqueue1(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue1(0, y); enqueue1(width - 1, y); }
  while (q1.length > 0) {
    const flat = q1.pop();
    const x = flat % width, y = (flat / width) | 0;
    enqueue1(x - 1, y); enqueue1(x + 1, y);
    enqueue1(x, y - 1); enqueue1(x, y + 1);
  }

  // Pass 2: enclosed white regions ≥40px
  const MIN_HOLE_PX = 40;
  const visited = new Uint8Array(total);
  for (let start = 0; start < total; start++) {
    if (transparent[start] || visited[start] || !isWhite(start)) continue;
    const region = [start];
    visited[start] = 1;
    for (let head = 0; head < region.length; head++) {
      const flat = region[head];
      const x = flat % width, y = (flat / width) | 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nf = ny * width + nx;
        if (transparent[nf] || visited[nf] || !isWhite(nf)) continue;
        visited[nf] = 1;
        region.push(nf);
      }
    }
    if (region.length >= MIN_HOLE_PX) {
      for (const flat of region) transparent[flat] = 1;
    }
  }

  for (let i = 0; i < total; i++) {
    if (transparent[i]) data[i * channels + 3] = 0;
  }

  // Pass 3: feather antialiased fringe
  for (let i = 0; i < total; i++) {
    if (transparent[i]) continue;
    const x = i % width, y = (i / width) | 0;
    let hasTransparentNeighbor = false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (transparent[ny * width + nx]) { hasTransparentNeighbor = true; break; }
    }
    if (!hasTransparentNeighbor) continue;
    const idx = i * channels;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    if (brightness > 190) {
      const fringeRatio = (brightness - 190) / 65;
      data[idx + 3] = Math.round((1 - fringeRatio) * 255);
    }
  }

  // Pass 4: shadow flood-fill
  const isShadowLike = (flat) => {
    if (data[flat * channels + 3] === 0) return false;
    const i = flat * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const bright = (r + g + b) / 3;
    return sat < 40 && bright > 80 && bright < 230;
  };
  const shadowMark = new Uint8Array(total);
  const shadowQ = [];
  for (let i = 0; i < total; i++) {
    if (data[i * channels + 3] !== 0) continue;
    const x = i % width, y = (i / width) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nf = ny * width + nx;
      if (!shadowMark[nf] && isShadowLike(nf)) { shadowMark[nf] = 1; shadowQ.push(nf); }
    }
  }
  while (shadowQ.length > 0) {
    const flat = shadowQ.pop();
    data[flat * channels + 3] = 0;
    const x = flat % width, y = (flat / width) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nf = ny * width + nx;
      if (!shadowMark[nf] && isShadowLike(nf)) { shadowMark[nf] = 1; shadowQ.push(nf); }
    }
  }

  // Pass 5: programmatic outline
  applyOutlineToData(data, width, height, channels, OUTLINE_PX);

  return sharp(Buffer.from(data), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// ---------- Replicate with retry ----------
async function replicateRunWithRetry(model, input, maxRetries = 8) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const body = err.message || '';
      const match = body.match(/resets in ~(\d+)s/);
      const waitSec = match ? parseInt(match[1]) + 1 : 12;
      if (attempt < maxRetries && body.includes('429')) {
        console.log(`  rate limited — waiting ${waitSec}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }
}

async function downloadBuffer(url) {
  const resp = await fetch(String(url));
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ---------- Generate one level ----------
async function generateLevel(item) {
  const prompt = `${item.desc}, ${ANCHOR}`;
  console.log(`\n[L${item.level}] ${item.name}`);
  console.log(`  prompt: ${prompt.slice(0, 120)}...`);

  const output = await replicateRunWithRetry('recraft-ai/recraft-v3', {
    prompt,
    style: 'digital_illustration',
    width: GEN_SIZE,
    height: GEN_SIZE,
  });

  const url = Array.isArray(output) ? output[0] : output;
  console.log(`  url: ${String(url).slice(0, 72)}...`);

  const rawBuf = await downloadBuffer(url);

  const itemPx = item.itemSize;
  const pad = FINAL_SIZE - itemPx;
  const padSide = Math.floor(pad / 2);
  const padOther = pad - padSide;

  const resized = await sharp(rawBuf)
    .resize(itemPx, itemPx, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .extend({
      top: padSide, bottom: padOther,
      left: padSide, right: padOther,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const transparent = await removeWhiteBackground(resized);

  const filename = `crystal_${item.level}.png`;
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, transparent);
  console.log(`  saved → ${outPath}`);
}

// ---------- Main ----------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);

  if (args.includes('--fix-bg')) {
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
    console.log(`Removing white bg from ${files.length} files in ${OUT_DIR}`);
    for (const file of files) {
      const filePath = path.join(OUT_DIR, file);
      const buf = fs.readFileSync(filePath);
      const out = await removeWhiteBackground(buf);
      fs.writeFileSync(filePath, out);
      console.log(`  fixed: ${file}`);
    }
    console.log('Done!'); return;
  }

  if (args.includes('--outline')) {
    const outlinePx = args.includes('--outline-px')
      ? parseInt(args[args.indexOf('--outline-px') + 1])
      : OUTLINE_PX;
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
    console.log(`Adding ${outlinePx}px outline to ${files.length} files`);
    for (const file of files) {
      const filePath = path.join(OUT_DIR, file);
      const buf = fs.readFileSync(filePath);
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      applyOutlineToData(data, info.width, info.height, info.channels, outlinePx);
      const out = await sharp(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
      fs.writeFileSync(filePath, out);
      console.log(`  outlined: ${file}`);
    }
    console.log('Done!'); return;
  }

  const li = args.indexOf('--level');
  const items = li >= 0
    ? [CHAIN.find(c => c.level === parseInt(args[li + 1]))].filter(Boolean)
    : CHAIN;

  if (!items.length) { console.error('No matching level'); process.exit(1); }

  console.log(`Generating ${items.length} crystal sprite(s)...`);
  for (const item of items) {
    await generateLevel(item);
  }
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
