#!/usr/bin/env node
/**
 * gen-sprites.js — generates ruby jewelry evolution chain via Replicate recraft-v3
 *
 * Usage:
 *   node scripts/gen-sprites.js                        — all 10 levels, style 1
 *   node scripts/gen-sprites.js --style vector         — all 10, style 2
 *   node scripts/gen-sprites.js --level 3              — only level 3
 *   node scripts/gen-sprites.js --fix-bg               — remove white bg from existing (no API calls)
 *   node scripts/gen-sprites.js --outline              — add programmatic outline to existing sprites
 *   node scripts/gen-sprites.js --outline --outline-px 3  — same, 3px thickness (default: 2)
 */

const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const OUTLINE_PX = 2;

// Dilation-based outline: fills transparent pixels within outlinePx of any opaque pixel with black.
// Mutates data in place. Works on already-transparent sprites (no bg needed).
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

// ---------- Styles ----------
const STYLES = {
  cartoon: {
    replicateStyle: 'digital_illustration',
    outDir: 'assets/ruby-cartoon',
    filenameFn: (item) => `ruby_${item.level}.png`,
    anchor: [
      'glossy cartoon mobile game icon',
      'thick black outline bold linework',
      'vibrant saturated colors',
      'brilliant gemstone sparkle and light reflections',
      'luxury opulent jewelry',
      'soft inner glow on gemstone surfaces',
      'no shadow no drop shadow no cast shadow no ground shadow no reflection shadow',
      'flat even lighting on white background',
      'pure white background',
      'centered composition',
      'no text no labels no extra objects',
    ].join(', '),
  },
  vector: {
    replicateStyle: 'digital_illustration/2d_art_poster',
    outDir: 'assets/ruby-vector',
    filenameFn: (item) => `level${String(item.level).padStart(2, '0')}_${item.name}.png`,
    anchor: [
      'flat 2d poster game icon',
      'clean bold shapes',
      'vibrant saturated colors',
      'minimal shading',
      'white background',
      'centered composition',
      'no text no labels no extra objects',
    ].join(', '),
  },
};

// ---------- Ruby chain — 10 levels ----------
// itemSize: how large the item appears inside the 192×192 canvas (px).
// The gen pipeline resizes the item to itemSize×itemSize, then pads to 192×192.
// Smaller itemSize = more whitespace = visually "smaller" item in-game.
const CHAIN = [
  {
    level: 1,
    name: 'chip',
    itemSize: 88,
    desc: 'a tiny rough uncut raw ruby mineral fragment, jagged irregular shape, dull dark matte red, NO facets NO polish NO sparkle, looks like a broken pebble not a gemstone',
  },
  {
    level: 2,
    name: 'pebble',
    itemSize: 118,
    desc: 'a small ruby cabochon, smooth dome shape, deep red with a single bright specular highlight on top, clearly polished but uncut',
  },
  {
    level: 3,
    name: 'gem',
    itemSize: 148,
    desc: 'a brilliant-cut ruby gemstone, vivid deep red, many sharp triangular facets, strong light sparkle and reflections, floating centered',
  },
  {
    level: 4,
    name: 'ring',
    itemSize: 164,
    desc: 'a simple yellow gold ring with one small round ruby in a four-prong setting, thin delicate band, three-quarter view angle',
  },
  {
    level: 5,
    name: 'signet',
    itemSize: 170,
    desc: 'an ornate yellow gold signet ring with a large oval ruby, wide band with decorative floral engraving, three-quarter view angle',
  },
  {
    level: 6,
    name: 'stud',
    itemSize: 164,
    desc: 'a single gold stud earring with a round faceted ruby, martini-style bezel setting, front-facing flat view, no pin visible, centered, isolated single item',
  },
  {
    level: 7,
    name: 'drop',
    itemSize: 172,
    desc: 'a single gold drop earring, ONE earring only, a faceted teardrop ruby pendant hanging from a small gold loop, front-facing view, no stand no holder no display, isolated single item',
  },
  {
    level: 8,
    name: 'necklace',
    itemSize: 178,
    desc: 'a gold necklace with a large ruby teardrop pendant, chain in a U-shape, front view, ONLY the necklace, absolutely nothing else in the image, no extra stones no decorations outside the necklace',
  },
  {
    level: 9,
    name: 'tiara',
    itemSize: 182,
    desc: 'a delicate gold tiara adorned with multiple rubies, symmetrical front-facing view, elegant curved headpiece, ornate filigree',
  },
  {
    level: 10,
    name: 'crown',
    itemSize: 188,
    desc: 'a magnificent royal gold crown lavishly set with large rubies and diamond accents, ornate filigree, symmetrical front-facing view, majestic and opulent',
  },
];

const FINAL_SIZE = 192;
const GEN_SIZE = 1024;

// ---------- Background removal — 3-pass ----------
// Pass 1: flood-fill from edges → removes outer background
// Pass 2: find large enclosed white regions (e.g. ring hole) → remove them too
//         small white spots (gem sparkles) survive because they're below MIN_HOLE_PX
// Pass 3: feather antialiased fringe → pixels on the transparent border
//         get alpha reduced proportionally to their brightness
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

  // Pass 1: flood-fill from all four edges
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

  // Pass 2: find enclosed white regions; mark large ones as transparent
  const MIN_HOLE_PX = 40;
  const visited = new Uint8Array(total);
  for (let start = 0; start < total; start++) {
    if (transparent[start] || visited[start] || !isWhite(start)) continue;
    // BFS to collect connected white region
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

  // Apply transparency from passes 1+2
  for (let i = 0; i < total; i++) {
    if (transparent[i]) data[i * channels + 3] = 0;
  }

  // Pass 3: feather antialiased fringe at transparent/opaque border
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
      const fringeRatio = (brightness - 190) / 65; // 0..1
      data[idx + 3] = Math.round((1 - fringeRatio) * 255);
    }
  }

  // Pass 4: flood-fill shadow removal — desaturated gray pixels adjacent to
  // already-transparent regions (shadows are grayish; colored jewelry pixels are safe).
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
    if (data[i * channels + 3] !== 0) continue; // only seed from transparent pixels
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

  // Pass 5: programmatic black outline
  applyOutlineToData(data, width, height, channels, OUTLINE_PX);

  return sharp(Buffer.from(data), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// ---------- Outline-only on existing folder ----------
async function addOutlineOnly(dir, outlinePx) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  console.log(`Adding ${outlinePx}px outline to ${files.length} files in ${dir}`);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const buf = fs.readFileSync(filePath);
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    applyOutlineToData(data, width, height, channels, outlinePx);
    const out = await sharp(Buffer.from(data), { raw: { width, height, channels } }).png().toBuffer();
    fs.writeFileSync(filePath, out);
    console.log(`  outlined: ${file}`);
  }
  console.log('Done!');
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
  if (!resp.ok) throw new Error(`HTTP ${resp.status} while downloading`);
  return Buffer.from(await resp.arrayBuffer());
}

// ---------- Generate one level ----------
async function generateLevel(item, style, outDir) {
  const prompt = `${item.desc}, ${style.anchor}`;
  console.log(`\n[L${item.level}] ${item.name}`);
  console.log(`  prompt: ${prompt.slice(0, 110)}...`);

  const output = await replicateRunWithRetry('recraft-ai/recraft-v3', {
    prompt,
    style: style.replicateStyle,
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

  const filename = style.filenameFn(item);
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, transparent);
  console.log(`  saved → ${outPath}`);
}

// ---------- Fix bg on existing folder ----------
async function fixBgOnly(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  console.log(`Removing white bg from ${files.length} files in ${dir}`);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const buf = fs.readFileSync(filePath);
    const out = await removeWhiteBackground(buf);
    fs.writeFileSync(filePath, out);
    console.log(`  fixed: ${file}`);
  }
  console.log('Done!');
}

// ---------- Main ----------
async function main() {
  const args = process.argv.slice(2);

  // --fix-bg: post-process existing images only
  if (args.includes('--fix-bg')) {
    const dir = path.join(__dirname, '../assets/ruby-cartoon');
    await fixBgOnly(dir);
    return;
  }

  // --outline: add programmatic outline to existing sprites (no bg removal, no API calls)
  if (args.includes('--outline')) {
    const outlinePx = args.includes('--outline-px')
      ? parseInt(args[args.indexOf('--outline-px') + 1])
      : OUTLINE_PX;
    const dir = path.join(__dirname, '../assets/ruby-cartoon');
    await addOutlineOnly(dir, outlinePx);
    return;
  }

  // --resize-existing: re-apply itemSize sizing to existing PNGs (no API calls)
  if (args.includes('--resize-existing')) {
    const styleKey2 = args.includes('--style') && args[args.indexOf('--style') + 1] === 'vector'
      ? 'vector' : 'cartoon';
    const style2 = STYLES[styleKey2];
    const dir = path.join(__dirname, '..', style2.outDir);
    const li2 = args.indexOf('--level');
    const items = li2 !== -1
      ? [CHAIN.find(c => c.level === parseInt(args[li2 + 1]))].filter(Boolean)
      : CHAIN;
    console.log(`Re-sizing ${items.length} existing sprite(s) (${styleKey2}) with itemSize padding...`);
    for (const item of items) {
      const filename = style2.filenameFn(item);
      const filePath = path.join(dir, filename);
      if (!fs.existsSync(filePath)) {
        console.log(`  skip (not found): ${filename}`);
        continue;
      }
      const rawBuf = fs.readFileSync(filePath);
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
      fs.writeFileSync(filePath, transparent);
      console.log(`  resized: ${filename} (item=${itemPx}px)`);
    }
    console.log('Done!');
    return;
  }

  // --basket: generate basket sprite
  if (args.includes('--basket')) {
    const BASKET_PROMPT = [
      'an open ornate jewelry box filled with sparkling rubies and ruby jewelry pieces',
      'rich deep red velvet interior glowing with gem light',
      'dark atmospheric background with ruby sparkles and light rays',
      'gold decorative box frame with filigree details',
      'glossy cartoon game icon illustration',
      'thick black outline bold linework',
      'vibrant saturated colors',
      'self-contained scene with background',
      'centered composition',
      'no text no labels',
    ].join(', ');
    console.log(`\n[basket] ruby_basket`);
    console.log(`  prompt: ${BASKET_PROMPT.slice(0, 110)}...`);
    const output = await replicateRunWithRetry('recraft-ai/recraft-v3', {
      prompt: BASKET_PROMPT,
      style: 'digital_illustration',
      width: GEN_SIZE,
      height: GEN_SIZE,
    });
    const url = Array.isArray(output) ? output[0] : output;
    console.log(`  url: ${String(url).slice(0, 72)}...`);
    const rawBuf = await downloadBuffer(url);
    // No background removal — the scene background is intentional
    const resized = await sharp(rawBuf)
      .resize(FINAL_SIZE, FINAL_SIZE, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const outPath = path.join(__dirname, '../assets/ruby-cartoon/ruby_basket.png');
    fs.writeFileSync(outPath, resized);
    console.log(`  saved → ${outPath}`);
    return;
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Error: REPLICATE_API_TOKEN missing. Check .env file.');
    process.exit(1);
  }

  const styleKey = args.includes('--style') && args[args.indexOf('--style') + 1] === 'vector'
    ? 'vector'
    : 'cartoon';
  const style = STYLES[styleKey];
  const outDir = path.join(__dirname, '..', style.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const li = args.indexOf('--level');
  const items = li !== -1
    ? [CHAIN.find(c => c.level === parseInt(args[li + 1]))].filter(Boolean)
    : CHAIN;

  if (items.length === 0) {
    console.error('No matching levels. Use --level 1..10');
    process.exit(1);
  }

  console.log(`Style: ${styleKey} (${style.replicateStyle})`);
  console.log(`Generating ${items.length} sprite(s) → ${outDir}`);
  console.log(`Pipeline: ${GEN_SIZE}px → resize ${FINAL_SIZE}px → remove white bg\n`);

  for (const item of items) {
    try {
      await generateLevel(item, style, outDir);
    } catch (err) {
      console.error(`  ERROR level ${item.level}: ${err.message}`);
    }
  }

  console.log('\nAll done!');
}

main().catch(err => { console.error(err); process.exit(1); });
