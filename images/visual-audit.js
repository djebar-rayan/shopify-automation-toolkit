'use strict';

// ============================================================
// images/visual-audit.js — Image quality audit via Gemini Vision
// ------------------------------------------------------------
// For each image of each product in the filter, asks Gemini Vision
// to classify the quality (ADEQUATE | REPLACE | NO_IMAGE) and to
// provide a short comment.
//
// The result is cached as JSON (.audit-tmp/visual-audit.json) so the
// decision can be re-run without paying again.
//
// No mutation. Output: visual-audit-report.md
//
// Usage:
//   node images/visual-audit.js --filter "status ACTIVE"
//   node images/visual-audit.js --filter "handle my-product"
//   node images/visual-audit.js --refresh   # ignore cache
// ============================================================

const fs = require('fs');
const path = require('path');

const { getFlag, hasFlag, sleep } = require('../lib/cli');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const { execGql } = require('../lib/shopify-graphql');
const { downloadImageAsBase64 } = require('../lib/image-download');
const { callGeminiVisionWithRetry } = require('../lib/gemini-vision');
const config = require('../lib/config');

const CACHE_PATH = path.join(config.TMP_DIR, 'visual-audit.json');
const REPORT_PATH = path.join(config.WORKSPACE, 'visual-audit-report.md');

const PROMPT = [
  'You are an e-commerce visual expert. Analyze this product image.',
  'Reply ONLY in JSON:',
  '{ "status": "ADEQUATE" | "REPLACE" | "NO_IMAGE",',
  '  "reasons": ["reason 1", "reason 2"],',
  '  "summary": "short sentence" }',
  'ADEQUATE = correct composition, neutral background, product readable.',
  'REPLACE = blurry / poorly framed / product hard to identify.',
  'NO_IMAGE = not actually a product (placeholder, watermark, blank).',
].join('\n');

async function main() {
  const filter = getFlag('filter', 'status ACTIVE');
  const refresh = hasFlag('refresh');

  console.log(`\n━━━ visual-audit ━━━`);
  console.log(`  Filter: ${filter}\n`);

  fs.mkdirSync(config.TMP_DIR, { recursive: true });
  const cache = (!refresh && fs.existsSync(CACHE_PATH))
    ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    : {};

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  No target.'); return; }

  const Q = `
    query Get($id: ID!) {
      product(id: $id) {
        id title handle
        media(first: 30) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt image { url } }
          } }
        }
      }
    }
  `;

  const results = [];
  for (let i = 0; i < matched.length; i++) {
    const b = matched[i];
    console.log(`\n  [${i + 1}/${matched.length}] ${b.title}`);
    const r = execGql(Q, { id: b.id });
    const p = r?.product;
    if (!p) continue;
    const medias = (p.media?.edges || []).map(e => e.node).filter(m => m.mediaContentType === 'IMAGE');

    for (let idx = 0; idx < medias.length; idx++) {
      const m = medias[idx];
      const cacheKey = m.id;
      let verdict = cache[cacheKey];
      if (!verdict) {
        if (!m.image?.url) continue;
        process.stdout.write(`    image #${idx} → Vision…`);
        try {
          const img = await downloadImageAsBase64(m.image.url);
          const txt = await callGeminiVisionWithRetry(PROMPT, img.base64, img.mimeType, { json: true });
          verdict = JSON.parse(txt);
          cache[cacheKey] = verdict;
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
          console.log(` ${verdict.status}`);
          await sleep(config.DELAY_GEMINI);
        } catch (e) {
          console.log(` ❌ ${e.message.slice(0, 80)}`);
          continue;
        }
      } else {
        console.log(`    image #${idx} → ${verdict.status} (cache)`);
      }
      results.push({ handle: b.handle, title: b.title, mediaId: m.id, idx, verdict });
    }
  }

  // Build the report
  const adequate = results.filter(r => r.verdict.status === 'ADEQUATE');
  const replace = results.filter(r => r.verdict.status === 'REPLACE');
  const none = results.filter(r => r.verdict.status === 'NO_IMAGE');

  const md = [
    '# Visual image audit',
    `**Date**: ${new Date().toISOString()}  `,
    `**Filter**: ${filter}  `,
    `**Total images analyzed**: ${results.length}  `,
    `**ADEQUATE**: ${adequate.length}  |  **REPLACE**: ${replace.length}  |  **NOT A PRODUCT IMAGE**: ${none.length}`,
    '',
    '---',
    '',
    '## Images to replace',
    '',
    '| Product | Handle | # | Reason | Summary |',
    '|---|---|---|---|---|',
    ...replace.map(r => `| ${r.title} | \`${r.handle}\` | ${r.idx} | ${(r.verdict.reasons || []).join('; ')} | ${r.verdict.summary || ''} |`),
    '',
    '## Images that are not actual products',
    '',
    '| Product | Handle | # | Summary |',
    '|---|---|---|---|',
    ...none.map(r => `| ${r.title} | \`${r.handle}\` | ${r.idx} | ${r.verdict.summary || ''} |`),
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\n  ✓ Report : ${REPORT_PATH}`);
  console.log(`  Cache   : ${CACHE_PATH}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
