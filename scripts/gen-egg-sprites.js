#!/usr/bin/env node
/**
 * gen-egg-sprites.js — generates egg → brunch evolution chain via Replicate recraft-v3
 *
 * Usage:
 *   node scripts/gen-egg-sprites.js                — all 10 levels
 *   node scripts/gen-egg-sprites.js --level 3      — only level 3
 *   node scripts/gen-egg-sprites.js --fix-bg       — remove white bg from existing (no API)
 *   node scripts/gen-egg-sprites.js --outline      — add programmatic outline to existing
 *   node scripts/gen-egg-sprites.js --outline --outline-px 3
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

const OUT_DIR = path.join(__dirname, '../assets/eggs');

const ANCHOR = [
  'glossy cartoon mobile game icon',
  'thick black outline bold linework',
  'vibrant saturated colors',
  'no shadow no drop shadow no cast shadow no ground shadow no reflection shadow',
  'flat even lighting on white background',
  'pure white background',
  'centered composition',
  'no text no labels no extra objects',
].join(', ');

const CHAIN = [
  {
    level: 1,
    name: 'egg',
    itemSize: 88,
    desc: 'a single whole white egg, smooth clean eggshell, upright oval, unbroken shell, cartoon game icon, simple isolated object',
  },
  {
    level: 2,
    name: 'cracking',
    itemSize: 108,
    desc: 'a round cream-colored ceramic mixing bowl, a raw egg being cracked open above it with two eggshell halves splitting apart, bright golden yolk and white dripping down into the bowl, front-facing view, isolated composition',
  },
  {
    level: 3,
    name: 'fried-egg',
    itemSize: 128,
    desc: 'a single fried egg on a round black frying pan with a short red handle, one round bright golden yolk centered in white egg white, slightly crisped edges, pan handle pointing to the right, front-facing three-quarter view',
  },
  {
    level: 4,
    name: 'two-eggs',
    itemSize: 142,
    desc: 'exactly two fried eggs side by side on a round black frying pan with a short red handle, exactly two round bright golden yolks, white egg whites merged together, pan handle pointing to the right, front-facing three-quarter view',
  },
  {
    level: 5,
    name: 'bacon-eggs',
    itemSize: 152,
    desc: 'a fried egg and two strips of crispy brown-pink bacon arranged horizontally on a round black frying pan with a short red handle, golden yolk, bacon strips laid across the lower half of the pan, front-facing three-quarter view',
  },
  {
    level: 6,
    name: 'eggs-benedict',
    itemSize: 160,
    desc: 'one single portion of eggs benedict: one round toasted English muffin topped with one slice of Canadian bacon, one round poached egg, rich golden hollandaise sauce dripping down the sides, served on a dark round slate plate, tall stacked silhouette, front-facing view, one item only',
  },
  {
    level: 7,
    name: 'omelette',
    itemSize: 166,
    desc: 'a folded yellow omelette on a round dark wooden board, classic half-moon shape, open fold revealing warm mushroom and melted cheese filling, rich golden yellow color, front-facing slightly-above view, isolated single item',
  },
  {
    level: 8,
    name: 'plate',
    itemSize: 172,
    desc: 'a round dark ceramic plate neatly arranged with a folded yellow omelette, two slices of golden-brown toast, and two strips of crispy bacon, three distinct food items visible, front-facing slightly-above view, ONLY the plate with food',
  },
  {
    level: 9,
    name: 'full-english',
    itemSize: 180,
    desc: 'a full English breakfast on a large oval white plate, two fried eggs with golden yolks, two brown pork sausages, a scoop of orange baked beans, two rashers of bacon, and a slice of golden toast, colorful and abundant, viewed from slightly above, ONLY the plate',
  },
  {
    level: 10,
    name: 'brunch-tray',
    itemSize: 188,
    desc: 'a full English breakfast on a large dark oval plate — two fried eggs with golden yolks, two brown pork sausages, baked beans, two rashers of bacon, golden toast — served on a dark wooden rectangular board, with a tall glass of fresh orange juice placed beside the plate, complete restaurant brunch, front-facing slightly-above view',
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

// ---------- Background removal — passes 1–4 (no outline) ----------
// fillHoles: Pass 2 removes enclosed white regions (needed for rings/loops, harmful for food/gems)
async function removeBg(inputBuf, fillHoles = false) {
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

  // Pass 2: enclosed white regions ≥40px (rings/loops only — skip for food/gems)
  if (fillHoles) {
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

  return sharp(Buffer.from(data), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// ---------- ML background removal via recraft-ai/recraft-remove-background ----------
async function removeBgML(inputBuf, maxRetries = 8) {
  const blob = new Blob([inputBuf], { type: 'image/png' });
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const output = await replicate.run('recraft-ai/recraft-remove-background', {
        input: { image: blob },
      });
      const url = Array.isArray(output) ? output[0] : output;
      return downloadBuffer(String(url));
    } catch (err) {
      const body = err.message || '';
      const match = body.match(/resets in ~(\d+)s/);
      const waitSec = match ? parseInt(match[1]) + 1 : 10;
      if (attempt < maxRetries && body.includes('429')) {
        console.log(`  remove-bg rate limited — waiting ${waitSec}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        throw err;
      }
    }
  }
}

// ---------- Outline application (pass 5) ----------
async function applyOutline(inputBuf, outlinePx = OUTLINE_PX) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  applyOutlineToData(data, info.width, info.height, info.channels, outlinePx);
  return sharp(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: info.channels } })
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

  // ML bg removal on full 1024px image — handles gradients and open shapes correctly
  const cleanBuf = await removeBgML(rawBuf);

  const itemPx = item.itemSize;
  const pad = FINAL_SIZE - itemPx;
  const padSide = Math.floor(pad / 2);
  const padOther = pad - padSide;

  // Resize transparent PNG — Lanczos naturally produces smooth semi-transparent edges
  const resized = await sharp(cleanBuf)
    .resize(itemPx, itemPx, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: padSide, bottom: padOther,
      left: padSide, right: padOther,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Apply outline last, on the small image
  const transparent = await applyOutline(resized, OUTLINE_PX);

  const filename = `egg_${item.level}.png`;
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
      const out = await removeBg(buf, false);
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
      const out = await applyOutline(buf, outlinePx);
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

  console.log(`Generating ${items.length} egg sprite(s)...`);
  for (const item of items) {
    await generateLevel(item);
  }
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
