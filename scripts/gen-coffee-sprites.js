#!/usr/bin/env node
/**
 * gen-coffee-sprites.js — generates coffee cherry → coffee bar chain via Replicate recraft-v3
 *
 * Usage:
 *   node scripts/gen-coffee-sprites.js                — all 10 levels
 *   node scripts/gen-coffee-sprites.js --level 3      — only level 3
 *   node scripts/gen-coffee-sprites.js --fix-bg       — remove white bg from existing (no API)
 *   node scripts/gen-coffee-sprites.js --outline      — add programmatic outline to existing
 */

const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const OUTLINE_PX = 2;
const FINAL_SIZE = 192;
const GEN_SIZE   = 1024;
const OUT_DIR    = path.join(__dirname, '../assets/coffee');

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
    name: 'coffee-cherries',
    itemSize: 88,
    desc: 'a cluster of three bright red ripe coffee cherries hanging from a short green woody branch, round glossy red berries each with a small circular indentation at the tip, two dark green coffee leaves visible, horizontal branch composition, front-facing view',
  },
  {
    level: 2,
    name: 'roasted-bean',
    itemSize: 99,
    desc: 'a single large roasted coffee bean, dark rich brown color, prominent central crease running lengthwise along the oval, smooth slightly glossy surface, close-up front-facing view, isolated single object',
  },
  {
    level: 3,
    name: 'cezve',
    itemSize: 110,
    desc: 'a traditional copper cezve turkish coffee pot with a long flat handle extending to the right, warm polished copper and brass tones, small bright orange flame rising beneath the flat base, front-facing view, single object',
  },
  {
    level: 4,
    name: 'espresso',
    itemSize: 121,
    desc: 'a small white porcelain demitasse espresso cup on a matching white saucer, cup filled with dark espresso and a golden-brown crema layer on top, wide low cup proportions, front-facing slightly above view, cup and saucer only',
  },
  {
    level: 5,
    name: 'latte',
    itemSize: 132,
    desc: 'a tall clear glass filled with layered latte, dark brown espresso at the bottom and creamy white steamed milk filling the upper portion, warm caramel gradient visible through the glass, front-facing view, glass only',
  },
  {
    level: 6,
    name: 'affogato',
    itemSize: 143,
    desc: 'a small white ceramic cup with a large round scoop of vanilla ice cream placed on top, dark espresso poured over the ice cream creating dark drizzles down the white sides, strong white and dark brown contrast, front-facing view, single item only',
  },
  {
    level: 7,
    name: 'frappuccino',
    itemSize: 154,
    desc: 'a tall plastic disposable cup with a clear dome lid, layered brown coffee frappuccino drink inside, a green drinking straw inserted through the dome top, front-facing view, single cup only',
  },
  {
    level: 8,
    name: 'coffee-croissant',
    itemSize: 165,
    desc: 'a round white ceramic plate with a small white espresso cup placed on the left and a golden flaky croissant on the right, neat café presentation, front-facing slightly above view, ONLY the plate with the two items on it',
  },
  {
    level: 9,
    name: 'coffee-tray',
    itemSize: 176,
    desc: 'a rectangular dark wooden serving tray with a white espresso cup in the center-left, two almond biscotti cookies beside it, a small glass of sparkling water, and a tiny white sugar bowl, front-facing slightly above view, ONLY the tray with items on it',
  },
  {
    level: 10,
    name: 'coffee-bar',
    itemSize: 188,
    desc: 'a glass Chemex coffee maker with dark coffee inside and a wooden collar around the middle, two small white espresso cups placed beside it, a small neat cluster of roasted coffee beans arranged in front, horizontal composition, front-facing slightly above view, isolated objects only no background',
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

async function applyOutline(inputBuf, outlinePx = OUTLINE_PX) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  applyOutlineToData(data, info.width, info.height, info.channels, outlinePx);
  return sharp(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

// ---------- Flood-fill bg removal (--fix-bg mode only) ----------
async function removeBg(inputBuf) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const total = width * height;
  const isWhite = (flat) => {
    const i = flat * channels;
    return data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230;
  };
  const transparent = new Uint8Array(total);
  const q = [];
  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const flat = y * width + x;
    if (transparent[flat] || !isWhite(flat)) return;
    transparent[flat] = 1; q.push(flat);
  };
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }
  while (q.length > 0) {
    const flat = q.pop();
    const x = flat % width, y = (flat / width) | 0;
    enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
  }
  for (let i = 0; i < total; i++) {
    if (transparent[i]) data[i * channels + 3] = 0;
  }
  return sharp(Buffer.from(data), { raw: { width, height, channels } }).png().toBuffer();
}

// ---------- ML background removal ----------
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

  console.log('  removing background (ML)...');
  const cleanBuf = await removeBgML(rawBuf);

  const itemPx = item.itemSize;
  const pad = FINAL_SIZE - itemPx;
  const padSide = Math.floor(pad / 2);
  const padOther = pad - padSide;

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

  const outlined = await applyOutline(resized, OUTLINE_PX);

  const filename = `coffee_${item.level}.png`;
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, outlined);
  console.log(`  saved → ${outPath}`);
}

// ---------- Main ----------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);

  if (args.includes('--fix-bg')) {
    const files = fs.readdirSync(OUT_DIR).filter(f => f.startsWith('coffee_') && f.endsWith('.png'));
    console.log(`Removing white bg from ${files.length} files in ${OUT_DIR}`);
    for (const file of files) {
      const filePath = path.join(OUT_DIR, file);
      const buf = fs.readFileSync(filePath);
      const out = await removeBg(buf);
      fs.writeFileSync(filePath, out);
      console.log(`  fixed: ${file}`);
    }
    console.log('Done!'); return;
  }

  if (args.includes('--outline')) {
    const outlinePx = args.includes('--outline-px')
      ? parseInt(args[args.indexOf('--outline-px') + 1])
      : OUTLINE_PX;
    const files = fs.readdirSync(OUT_DIR).filter(f => f.startsWith('coffee_') && f.endsWith('.png'));
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

  console.log(`Generating ${items.length} coffee sprite(s)...`);
  for (const item of items) {
    await generateLevel(item);
  }
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
