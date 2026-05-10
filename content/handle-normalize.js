'use strict';

// ============================================================
// content/handle-normalize.js — Normalise les handles produits
// ------------------------------------------------------------
// Détecte les produits dont le handle contient des caractères
// non-ASCII et génère un nouveau handle ASCII conforme ([a-z0-9-]+).
//
// Les diacritiques latins (é, ç, à, ñ…) sont gérés nativement.
// Pour les alphabets non-latins, fournir un preset de translittération
// avec --map=<file.json> (ex: lib/builders/translit-presets/tifinagh.json).
//
// Mode par défaut : dry-run.
//
// Usage :
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
  console.log(`  Mode : ${apply ? 'APPLIQUER (--confirm)' : 'dry-run'}`);
  if (customMap) console.log(`  Map custom : ${path.basename(mapFile)} (${Object.keys(customMap).length} entrées)`);
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
    console.log('  ✅ Aucun handle non-ASCII détecté.');
    return;
  }

  console.log(`  ${candidates.length} produit(s) à renommer :`);
  for (const c of candidates) {
    console.log(`    • ${c.oldHandle.padEnd(40)} → ${c.newHandle}`);
  }

  if (!apply) {
    console.log('\n  (dry-run terminé — relancer avec --confirm pour appliquer)\n');
    return;
  }

  const ok = await confirm(`\n  Appliquer ${candidates.length} renommages ?`, true);
  if (!ok) { console.log('  Annulé.'); return; }

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

  console.log(`\n  Résultat : ${okCount} ok, ${errors} erreur(s).`);
  console.log('  ⚠️  Shopify crée automatiquement des redirections 301 depuis les anciens handles.');
  console.log('  Re-fetch recommandé : node fetch-store-data.js');
  console.log('\n━━━ Fin handle-normalize ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
