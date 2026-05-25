#!/usr/bin/env node
/**
 * gen-coffee-baskets.js — generates 2 basket candidates for the coffee chain
 *
 * Usage:
 *   node scripts/gen-coffee-baskets.js              — both variants
 *   node scripts/gen-coffee-baskets.js --variant 1  — only variant 1
 *
 * Output: assets/coffee/basket_tree.png, assets/coffee/basket_sack.png
 */

const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const GEN_SIZE   = 1024;
const FINAL_SIZE = 192;
const OUTLINE_PX = 3;
const OUT_DIR    = path.join(__dirname, '../assets/coffee');

const ANCHOR = [
  'glossy cartoon mobile game icon',
  'thick black outline bold linework',
  'vibrant saturated colors',
  'no shadow no drop shadow no cast shadow no ground shadow',
  'flat even lighting on white background',
  'pure white background',
  'centered composition square format',
  'no text no labels no extra objects',
].join(', ');

const BASKETS = [
  {
    id: 1,
    filename: 'basket_tree.png',
    label: 'Кофейное дерево',
    desc: 'a single small young coffee plant in a terracotta pot, compact rounded canopy, lush dark green leaves, clusters of bright red ripe coffee cherries hanging from branches, front-facing view, whole plant visible',
  },
  {
    id: 2,
    filename: 'basket_sack.png',
    label: 'Джутовый мешок',
    desc: 'a single plump burlap jute coffee sack tied at the top with thick brown rope, bulging with coffee beans inside, warm brown burlap texture with woven pattern, front-facing view, standalone object',
  },
];

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

// ---------- Dilation outline ----------
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

async function applyOutline(inputBuf) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  applyOutlineToData(data, info.width, info.height, info.channels, OUTLINE_PX);
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

// ---------- Generate one basket ----------
async function generateBasket(basket) {
  const prompt = `${basket.desc}, ${ANCHOR}`;
  console.log(`\n[V${basket.id}] ${basket.label}`);
  console.log(`  prompt: ${prompt.slice(0, 120)}...`);

  // Step 1: generate 1024px
  const output = await replicateRunWithRetry('recraft-ai/recraft-v3', {
    prompt,
    style: 'digital_illustration',
    width: GEN_SIZE,
    height: GEN_SIZE,
  });
  const url = Array.isArray(output) ? output[0] : output;
  console.log(`  generated: ${String(url).slice(0, 72)}...`);
  const rawBuf = await downloadBuffer(String(url));

  // Step 2: ML background removal
  console.log('  removing background (ML)...');
  const noBgBuf = await removeBgML(rawBuf);

  // Step 3: resize to 192px
  const resized = await sharp(noBgBuf)
    .resize(FINAL_SIZE, FINAL_SIZE, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Step 4: programmatic outline
  const outlined = await applyOutline(resized);

  const outPath = path.join(OUT_DIR, basket.filename);
  fs.writeFileSync(outPath, outlined);
  console.log(`  saved → ${outPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const vi = args.indexOf('--variant');
  const baskets = vi >= 0
    ? BASKETS.filter(b => b.id === parseInt(args[vi + 1]))
    : BASKETS;

  if (!baskets.length) { console.error('No matching variant'); process.exit(1); }

  console.log(`Generating ${baskets.length} coffee basket variant(s)...`);
  for (const basket of baskets) {
    await generateBasket(basket);
  }
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
