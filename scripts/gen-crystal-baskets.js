#!/usr/bin/env node
/**
 * gen-crystal-baskets.js — generates 3 basket variants for the crystal chain
 *
 * Usage:
 *   node scripts/gen-crystal-baskets.js           — all 3 variants
 *   node scripts/gen-crystal-baskets.js --variant 1  — only variant 1
 *
 * Output: assets/crystal-baskets/basket_v1.png, basket_v2.png, basket_v3.png
 */

const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const GEN_SIZE = 1024;
const FINAL_SIZE = 192;
const OUT_DIR = path.join(__dirname, '../assets/crystal-baskets');

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
    name: 'crystal-source',
    label: 'Кристалл-источник',
    desc: 'a large ancient glowing blue crystal formation on a rocky cave base, sapphire-blue magical glow from within, small blue liquid droplets dripping from the crystal tips, mystical underground grotto, front-facing view',
  },
  {
    id: 2,
    name: 'mining-cart',
    label: 'Шахтёрская тачка',
    desc: 'a small rustic wooden mining cart filled with rough blue crystal chunks and rock fragments, worn wooden planks, single metal wheel, raw sapphire-blue minerals piled inside, front three-quarter view',
  },
  {
    id: 3,
    name: 'magic-spring',
    label: 'Магический источник',
    desc: 'a glowing blue crack in dark stone ground, luminous sapphire-blue liquid seeping upward through the crack, magical ethereal glow rays, mystical underground spring, top-down slightly angled view',
  },
];

async function replicateRunWithRetry(model, input, maxRetries = 3) {
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

async function removeWhiteBackground(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const d = new Uint8Array(data);

  // Pass 1: flood-fill white from edges → transparent
  const visited = new Uint8Array(width * height);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const i = y * width + x;
        const p = i * channels;
        if (d[p] > 200 && d[p + 1] > 200 && d[p + 2] > 200) {
          queue.push(i); visited[i] = 1;
        }
      }
    }
  }
  while (queue.length) {
    const i = queue.pop();
    const p = i * channels;
    d[p + 3] = 0;
    const x = i % width, y = Math.floor(i / width);
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni]) continue;
      const np = ni * channels;
      if (d[np] > 200 && d[np + 1] > 200 && d[np + 2] > 200) {
        visited[ni] = 1; queue.push(ni);
      }
    }
  }

  return sharp(Buffer.from(d), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

async function generateBasket(basket) {
  const prompt = `${basket.desc}, ${ANCHOR}`;
  console.log(`\n[V${basket.id}] ${basket.label}`);
  console.log(`  prompt: ${prompt.slice(0, 110)}...`);

  const output = await replicateRunWithRetry('recraft-ai/recraft-v3', {
    prompt,
    style: 'digital_illustration',
    width: GEN_SIZE,
    height: GEN_SIZE,
  });

  const url = Array.isArray(output) ? output[0] : output;
  console.log(`  url: ${String(url).slice(0, 72)}...`);

  const rawBuf = await downloadBuffer(url);

  const resized = await sharp(rawBuf)
    .resize(FINAL_SIZE, FINAL_SIZE, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const transparent = await removeWhiteBackground(resized);

  const filename = `basket_v${basket.id}.png`;
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, transparent);
  console.log(`  saved → ${outPath}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const vi = args.indexOf('--variant');
  const baskets = vi >= 0
    ? BASKETS.filter(b => b.id === parseInt(args[vi + 1]))
    : BASKETS;

  if (!baskets.length) { console.error('No matching variant'); process.exit(1); }

  console.log(`Generating ${baskets.length} crystal basket variant(s)...`);
  for (const basket of baskets) {
    await generateBasket(basket);
  }
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
