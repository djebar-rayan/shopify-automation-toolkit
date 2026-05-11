'use strict';

// ============================================================
// images/image-alt.js — Update missing alt texts
// ------------------------------------------------------------
// For each product in the filter:
//   1. Fetch its media (id, current alt) via GraphQL.
//   2. For missing alts, generate one of:
//      - mode=formula (default) → lib/builders/seo-meta::generateAltText
//      - mode=vision            → Gemini Vision analyzes the image
//   3. Push productUpdateMedia (mutation).
//
// Usage:
//   node images/image-alt.js                                 # dry-run, formulas
//   node images/image-alt.js --confirm                       # apply
//   node images/image-alt.js --mode=vision --confirm         # Gemini Vision
//   node images/image-alt.js --filter "status ACTIVE, no_alt"
// ============================================================

const { getFlag, hasFlag, confirm, sleep } = require('../lib/cli');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const { execGql, execMutation } = require('../lib/shopify-graphql');
const { generateAltText } = require('../lib/builders/seo-meta');
const { downloadImageAsBase64 } = require('../lib/image-download');
const { callGeminiVisionWithRetry } = require('../lib/gemini-vision');
const config = require('../lib/config');

async function main() {
  const apply = hasFlag('confirm');
  const mode = getFlag('mode', 'formula');
  const filter = getFlag('filter', 'status ACTIVE, no_alt');

  console.log(`\n━━━ image-alt ━━━`);
  console.log(`  Mode  : ${apply ? 'APPLY' : 'dry-run'}  |  Source: ${mode}`);
  console.log(`  Filter: ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  No target.'); return; }
  console.log(`  ${matched.length} product(s) to inspect.`);

  const Q = `
    query GetMedia($id: ID!) {
      product(id: $id) {
        id title productType vendor tags
        media(first: 50) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt image { url } }
          } }
        }
      }
    }
  `;

  const plan = [];
  for (const b of matched) {
    const r = execGql(Q, { id: b.id });
    const p = r?.product;
    if (!p) continue;
    const medias = (p.media?.edges || []).map(e => e.node).filter(m => m.mediaContentType === 'IMAGE');
    let idx = 0;
    for (const m of medias) {
      if (!m.alt || m.alt.trim() === '') {
        plan.push({ productId: p.id, mediaId: m.id, imageUrl: m.image?.url, idx, handle: b.handle, product: p });
      }
      idx++;
    }
  }
  console.log(`  ${plan.length} alt text(s) to generate.\n`);

  for (const item of plan) {
    if (mode === 'vision' && item.imageUrl) {
      try {
        const img = await downloadImageAsBase64(item.imageUrl);
        const prompt = `Describe this product in one short sentence (max 100 characters) suitable as an SEO alt attribute. No Markdown, no surrounding quotes.`;
        const txt = await callGeminiVisionWithRetry(prompt, img.base64, img.mimeType);
        item.newAlt = (txt || '').slice(0, 512);
        await sleep(config.DELAY_GEMINI);
      } catch (e) {
        console.log(`  ⚠️  ${item.handle} #${item.idx} Vision failed (${e.message.slice(0, 60)}), falling back to formula.`);
        item.newAlt = generateAltText(item.product, item.idx);
      }
    } else {
      item.newAlt = generateAltText(item.product, item.idx);
    }
  }

  console.log('  Preview (first 5):');
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.handle.padEnd(40)} #${item.idx} → ${item.newAlt}`);
  }

  if (!apply) {
    console.log('\n  (dry-run completed — rerun with --confirm to apply)\n');
    return;
  }

  const ok = await confirm(`\n  Apply ${plan.length} alt text(s)?`, true);
  if (!ok) { console.log('  Cancelled.'); return; }

  const M = `
    mutation UpdMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
      productUpdateMedia(productId: $productId, media: $media) {
        media { id alt }
        mediaUserErrors { field message }
      }
    }
  `;
  let okCount = 0, errors = 0;
  for (const item of plan) {
    process.stdout.write(`  ${item.handle} #${item.idx}…`);
    const res = execMutation(M, {
      productId: item.productId,
      media: [{ id: item.mediaId, alt: item.newAlt }],
    });
    const errs = res?.productUpdateMedia?.mediaUserErrors || [];
    if (res._error || errs.length) {
      console.log(` ❌ ${errs[0]?.message || res._msg || res._error}`);
      errors++;
    } else {
      console.log(' ✓');
      okCount++;
    }
    await sleep(config.DELAY_SHOPIFY);
  }
  console.log(`\n  Result: ${okCount} ok, ${errors} error(s).\n`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
