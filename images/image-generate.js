'use strict';

// ============================================================
// images/image-generate.js — Image generation via Gemini Image
// ------------------------------------------------------------
// 2 usage modes:
//
//   1) "single" — for one product, generate N images from a text
//      prompt + (optional) one reference image. Output images go to
//      generated-images/.
//
//   2) "multi-variant" — for a product with N variants, generate one
//      image per variant using 2 references:
//        - a canonical image (motif, design, etc.)
//        - the variant's existing image (to preserve its shape)
//      The prompt instructs Gemini to combine the two.
//
// No Shopify mutation: images are kept locally for visual validation.
// Then use images/image-upload.js.
//
// Usage:
//   node images/image-generate.js --mode=single --handle=my-product \
//     --prompt="Studio photo on white background, 4K, square framing"
//
//   node images/image-generate.js --mode=multi-variant --handle=my-product \
//     --canonical=0 --prompt="Preserve the motif of image 1 and apply it to the shape of image 2."
// ============================================================

const fs = require('fs');
const path = require('path');

const { getFlag, hasFlag, sleep } = require('../lib/cli');
const { execGql } = require('../lib/shopify-graphql');
const { downloadImageAsBase64 } = require('../lib/image-download');
const { validateGeneratedImage } = require('../lib/image-validate');
const { callGeminiImageWithRetry } = require('../lib/gemini-image');
const { callGeminiTextWithRetry } = require('../lib/gemini-text');
const config = require('../lib/config');

const GEN_DIR = config.GEN_DIR;

async function main() {
  const mode = getFlag('mode', 'single');
  const handle = getFlag('handle');
  if (!handle) { console.error('❌  --handle <product-handle> is required'); process.exit(1); }

  const prompt = getFlag('prompt') || '';
  const noImprove = hasFlag('no-improve');
  const dryRun = hasFlag('dry-run');
  const canonicalIdx = parseInt(getFlag('canonical', '0'), 10);
  const onlyArg = getFlag('only');
  const skipArg = getFlag('skip');
  const onlyList = onlyArg ? String(onlyArg).split(',').map(s => s.trim()) : null;
  const skipList = skipArg ? String(skipArg).split(',').map(s => s.trim()) : null;

  fs.mkdirSync(GEN_DIR, { recursive: true });

  console.log(`\n━━━ image-generate (${mode}) ━━━`);
  console.log(`  Handle: ${handle}`);
  console.log(`  Prompt: ${prompt ? prompt.slice(0, 100) : '(default for this mode)'}`);
  console.log(`  Output: ${GEN_DIR}\n`);

  // Fetch the product + its media + variants
  const Q = `
    query Get($handle: String!) {
      productByHandle(handle: $handle) {
        id title handle productType vendor tags
        media(first: 30) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt image { url } }
          } }
        }
        variants(first: 100) {
          edges { node {
            id title sku
            image { id url }
          } }
        }
      }
    }
  `;
  const r = execGql(Q, { handle });
  const product = r?.productByHandle;
  if (!product) { console.error(`❌  Product not found: ${handle}`); process.exit(1); }
  console.log(`  Product: ${product.title}`);

  const images = (product.media?.edges || []).map(e => e.node).filter(m => m.mediaContentType === 'IMAGE');
  const variants = (product.variants?.edges || []).map(e => e.node);

  if (mode === 'single') {
    return runSingle(product, images, prompt, noImprove, dryRun);
  }
  if (mode === 'multi-variant') {
    return runMultiVariant(product, images, variants, prompt, canonicalIdx, onlyList, skipList, noImprove, dryRun);
  }
  console.error(`❌  Invalid mode: ${mode}. Valid: single | multi-variant`);
  process.exit(1);
}

// ------------------------------------------------------------
// "single" mode — one image (with optional ref = image[0])
// ------------------------------------------------------------
async function runSingle(product, images, userPrompt, noImprove, dryRun) {
  const refImage = images[0];
  let prompt = userPrompt || `Generate a professional product photo for ${product.title}, neutral white background, studio lighting, square framing, 4K quality.`;
  if (!noImprove) {
    try {
      const meta = `Improve and expand this product-image generation prompt (style, lighting, framing) without changing its meaning. Keep it short and precise. Return ONLY the improved prompt.\n\nInitial prompt: ${prompt}`;
      prompt = await callGeminiTextWithRetry(meta);
      console.log(`  Improved prompt: ${prompt.slice(0, 120)}…`);
    } catch (e) {
      console.log(`  ⚠️  Prompt improvement failed: ${e.message.slice(0, 80)} — keeping the initial prompt.`);
    }
  }

  const refs = [];
  if (refImage?.image?.url) {
    process.stdout.write(`  Downloading reference image…`);
    refs.push(await downloadImageAsBase64(refImage.image.url));
    console.log(' ✓');
  }

  if (dryRun) {
    console.log('\n  (dry-run — no generation performed)\n');
    return;
  }

  console.log(`  Generating via Gemini Image…`);
  const out = await callGeminiImageWithRetry(prompt, refs);
  const validation = validateGeneratedImage(out.base64, out.mimeType);
  if (!validation.valid) {
    console.log(`  ❌ Image rejected: ${validation.reason}`);
    return;
  }
  const ext = out.mimeType.includes('png') ? 'png' : 'jpg';
  const filename = `${product.handle}_${Date.now()}.${ext}`;
  const filepath = path.join(GEN_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(out.base64, 'base64'));
  console.log(`  ✓ Saved: ${filepath} (${validation.sizeKB} KB, ${validation.width}×${validation.height})`);
  console.log(`\n  To upload to Shopify:`);
  console.log(`    node images/image-upload.js --handle ${product.handle} --file "${filepath}" --confirm\n`);
}

// ------------------------------------------------------------
// "multi-variant" mode — one image per variant
// ------------------------------------------------------------
async function runMultiVariant(product, images, variants, userPrompt, canonicalIdx, onlyList, skipList, noImprove, dryRun) {
  if (variants.length === 0) {
    console.error('❌  This product has no variant — use --mode=single.');
    process.exit(1);
  }
  const canonical = images[canonicalIdx];
  if (!canonical?.image?.url) {
    console.error(`❌  Canonical image not found at index ${canonicalIdx}.`);
    process.exit(1);
  }
  console.log(`  ${variants.length} variants detected, canonical = image #${canonicalIdx}`);

  let basePrompt = userPrompt || 'Preserve the motif/design of image 1 (canonical). Apply it to the shape/colour of image 2 (variant). Studio photo, white background, uniform lighting, 4K quality.';
  if (!noImprove) {
    try {
      basePrompt = await callGeminiTextWithRetry(`Improve this image generation prompt (style, framing, lighting) without changing its meaning. Return ONLY the improved prompt.\n\n${basePrompt}`);
    } catch (_) {}
  }

  process.stdout.write('  Downloading canonical image…');
  const canonicalImg = await downloadImageAsBase64(canonical.image.url);
  console.log(' ✓');

  const filtered = variants.filter(v => {
    if (onlyList && !onlyList.some(o => v.title.toLowerCase().includes(o.toLowerCase()))) return false;
    if (skipList && skipList.some(s => v.title.toLowerCase().includes(s.toLowerCase()))) return false;
    return true;
  });
  console.log(`  ${filtered.length} variants to process.\n`);

  let ok = 0, errors = 0;
  for (let i = 0; i < filtered.length; i++) {
    const v = filtered[i];
    process.stdout.write(`  [${i + 1}/${filtered.length}] ${v.title}…`);
    if (!v.image?.url) { console.log(' ⚠️  no variant image, skipping'); continue; }

    const safeTitle = v.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const out_filename = `${product.handle}_${safeTitle}.jpg`;
    const out_path = path.join(GEN_DIR, out_filename);

    if (dryRun) { console.log(' (dry-run)'); continue; }

    try {
      const variantImg = await downloadImageAsBase64(v.image.url);
      const out = await callGeminiImageWithRetry(basePrompt, [canonicalImg, variantImg]);
      const validation = validateGeneratedImage(out.base64, out.mimeType);
      if (!validation.valid) {
        console.log(` ❌ ${validation.reason}`);
        errors++;
        continue;
      }
      fs.writeFileSync(out_path, Buffer.from(out.base64, 'base64'));
      console.log(` ✓ ${out_filename} (${validation.sizeKB} KB)`);
      ok++;
      await sleep(config.DELAY_GEMINI);
    } catch (e) {
      console.log(` ❌ ${e.message.slice(0, 100)}`);
      errors++;
    }
  }
  console.log(`\n  Result: ${ok} generated, ${errors} error(s).`);
  console.log('  ⚠️  Manual visual validation recommended BEFORE upload.\n');
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
