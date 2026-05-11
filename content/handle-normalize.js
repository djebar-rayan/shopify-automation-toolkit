'use strict';

// ============================================================
// content/handle-normalize.js — Normalize product handles
// ------------------------------------------------------------
// Detects products whose handle contains non-ASCII characters and
// produces an ASCII-compliant handle ([a-z0-9-]+).
//
// Latin diacritics (é, ç, à, ñ…) are handled natively.
// For non-Latin scripts, pass a transliteration preset via
// --map=<file.json> (e.g. lib/builders/translit-presets/tifinagh.json).
//
// Default mode: dry-run.
//
// Usage:
//   node content/handle-normalize.js
//   node content/handle-normalize.js --confirm
//   node content/handle-normalize.js --confirm --yes
//   node content/handle-normalize.js --map=lib/builders/translit-presets/tifinagh.json --confirm
// ============================================================

const fs = require('fs');
const path = require('path');

const { getFlag, hasFlag, confirm, sleep } = require('../lib/cli');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { execMutation } = require('../lib/shopify-graphql');
const { isNonAscii, normalizeHandle } = require('../lib/builders/handle');
const config = require('../lib/config');

async function main() {
  const apply = hasFlag('confirm');
  const mapFile = getFlag('map');
  const customMap = mapFile ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : null;

  console.log(`\n━━━ handle-normalize ━━━`);
  console.log(`  Mode: ${apply ? 'APPLY (--confirm)' : 'dry-run'}`);
  if (customMap) console.log(`  Custom map: ${path.basename(mapFile)} (${Object.keys(customMap).length} entries)`);
  console.log();

  const blocks = parseStoreDataBlocks('products.md');
  const candidates = blocks
    .filter(b => isNonAscii(b.handle))
    .map(b => ({
      id: b.id,
      title: b.title,
      oldHandle: b.handle,
      newHandle: normalizeHandle(b.title || b.handle, { translitMap: customMap }),
    }))
    .filter(c => c.newHandle && c.newHandle !== c.oldHandle);

  if (!candidates.length) {
    console.log('  ✅ No non-ASCII handle detected.');
    return;
  }

  console.log(`  ${candidates.length} product(s) to rename:`);
  for (const c of candidates) {
    console.log(`    • ${c.oldHandle.padEnd(40)} → ${c.newHandle}`);
  }

  if (!apply) {
    console.log('\n  (dry-run completed — rerun with --confirm to apply)\n');
    return;
  }

  const ok = await confirm(`\n  Apply ${candidates.length} renames?`, true);
  if (!ok) { console.log('  Cancelled.'); return; }

  const MUTATION = `
    mutation Rename($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id handle }
        userErrors { field message }
      }
    }
  `;

  let okCount = 0, errors = 0;
  for (const c of candidates) {
    process.stdout.write(`  ${c.oldHandle} → ${c.newHandle}…`);
    const res = execMutation(MUTATION, { input: { id: c.id, handle: c.newHandle } });
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

  console.log(`\n  Result: ${okCount} ok, ${errors} error(s).`);
  console.log('  ⚠️  Shopify automatically creates 301 redirects from the old handles.');
  console.log('  Re-fetch recommended: node fetch-store-data.js');
  console.log('\n━━━ End handle-normalize ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
