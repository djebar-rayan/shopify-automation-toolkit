'use strict';

// ============================================================
// seo/seo-update.js — Generate + apply meta titles / descriptions / alt
// ------------------------------------------------------------
// Uses the formulas of lib/builders/seo-meta.js (no Gemini) to
// produce coherent SEO meta and push Shopify productUpdate mutations.
//
// Default target: active products missing SEO meta, or an explicit
// target via filter DSL.
//
// Usage:
//   node seo/seo-update.js --target=titles       [--filter "..."] [--confirm] [--yes]
//   node seo/seo-update.js --target=descriptions
//   node seo/seo-update.js --target=alt
//
// --target : titles | descriptions | alt
// --filter : optional, mini-DSL (see tasks/_template.md)
// --confirm: actually applies (otherwise dry-run)
// ============================================================

const { getFlag, hasFlag, confirm, sleep } = require('../lib/cli');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const { execGql, execMutation } = require('../lib/shopify-graphql');
const seo = require('../lib/builders/seo-meta');
const config = require('../lib/config');

const TARGETS = ['titles', 'descriptions', 'alt'];

async function main() {
  const target = getFlag('target', 'titles');
  if (!TARGETS.includes(target)) {
    console.error(`❌  Invalid --target: ${target}. Valid: ${TARGETS.join(', ')}`);
    process.exit(1);
  }
  const apply = hasFlag('confirm');
  const userFilter = getFlag('filter');

  // Default filter per target: only handle missing fields
  const defaultFilter = {
    titles: 'status ACTIVE, seo_title missing',
    descriptions: 'status ACTIVE, seo_description missing',
    alt: 'status ACTIVE, no_alt',
  }[target];
  const filter = userFilter || defaultFilter;

  console.log(`\n━━━ seo-update (${target}) ━━━`);
  console.log(`  Mode  : ${apply ? 'APPLY' : 'dry-run'}`);
  console.log(`  Filter: ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  console.log(`  ${matched.length}/${blocks.length} product(s) targeted.`);
  if (!matched.length) return;

  if (target === 'alt') {
    return runAltText(matched, apply);
  }

  const plan = matched.map(b => {
    const product = {
      id: b.id,
      title: b.title,
      productType: b.productType,
      vendor: b.vendor,
      tags: b.tags,
      descriptionHtml: '',
    };
    const newValue = target === 'titles'
      ? seo.generateMetaTitle(product)
      : seo.generateMetaDescription(product);
    return { block: b, newValue };
  });

  console.log(`\n  Preview (first 5):`);
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.block.handle.padEnd(40)} → ${item.newValue}`);
  }
  if (plan.length > 5) console.log(`    … (+${plan.length - 5} products)`);

  if (!apply) {
    console.log('\n  (dry-run completed — rerun with --confirm to apply)\n');
    return;
  }

  const ok = await confirm(`\n  Apply to ${plan.length} product(s)?`, true);
  if (!ok) { console.log('  Cancelled.'); return; }

  const MUTATION = `
    mutation Upd($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id handle }
        userErrors { field message }
      }
    }
  `;
  let okCount = 0, errors = 0;
  for (const item of plan) {
    const input = { id: item.block.id };
    if (target === 'titles') input.seo = { title: item.newValue };
    else if (target === 'descriptions') input.seo = { description: item.newValue };
    process.stdout.write(`  ${item.block.handle}…`);
    const res = execMutation(MUTATION, { input });
    const errs = res?.productUpdate?.userErrors || [];
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

// ------------------------------------------------------------
// "alt" target: missing alt texts → generateAltText per image
// ------------------------------------------------------------
async function runAltText(matched, apply) {
  const Q = `
    query GetMedia($id: ID!) {
      product(id: $id) {
        id title productType vendor tags
        media(first: 50) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt }
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
    medias.forEach((m, idx) => {
      if (!m.alt || m.alt.trim() === '') {
        const newAlt = seo.generateAltText(p, idx);
        plan.push({ productId: p.id, mediaId: m.id, handle: b.handle, idx, newAlt });
      }
    });
  }
  console.log(`\n  ${plan.length} alt text(s) to generate.`);
  console.log('  Preview (first 5):');
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.handle} #${item.idx} → ${item.newAlt}`);
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
