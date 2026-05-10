'use strict';

// ============================================================
// seo/seo-update.js — Génère + applique meta titles / descriptions / alt
// ------------------------------------------------------------
// Utilise les formules de lib/builders/seo-meta.js (sans Gemini)
// pour produire des meta SEO cohérents puis pousse les
// mutations Shopify productUpdate.
//
// Cibles : produits actifs qui n'ont pas encore de meta SEO,
// ou cible explicite via filtre DSL.
//
// Usage :
//   node seo/seo-update.js --target=titles      [--filter "..."] [--confirm] [--yes]
//   node seo/seo-update.js --target=descriptions
//   node seo/seo-update.js --target=alt
//
// --target : titles | descriptions | alt
// --filter : optionnel, mini-DSL (cf. tasks/_template.md)
// --confirm: applique réellement (sinon dry-run)
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
    console.error(`❌  --target invalide : ${target}. Valides : ${TARGETS.join(', ')}`);
    process.exit(1);
  }
  const apply = hasFlag('confirm');
  const userFilter = getFlag('filter');

  // Filtre par défaut selon la cible : ne traiter que ce qui manque
  const defaultFilter = {
    titles: 'status ACTIVE, seo_title manquant',
    descriptions: 'status ACTIVE, seo_description manquant',
    alt: 'status ACTIVE, no_alt',
  }[target];
  const filter = userFilter || defaultFilter;

  console.log(`\n━━━ seo-update (${target}) ━━━`);
  console.log(`  Mode   : ${apply ? 'APPLIQUER' : 'dry-run'}`);
  console.log(`  Filtre : ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  console.log(`  ${matched.length}/${blocks.length} produit(s) ciblé(s).`);
  if (!matched.length) return;

  // Pour chaque produit, on doit recharger title/productType/etc. depuis store-data
  // Les blocks contiennent déjà ces infos via enrichBlock.
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

  console.log(`\n  Préview (5 premières) :`);
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.block.handle.padEnd(40)} → ${item.newValue}`);
  }
  if (plan.length > 5) console.log(`    … (+${plan.length - 5} produits)`);

  if (!apply) {
    console.log('\n  (dry-run terminé — relancer avec --confirm pour appliquer)\n');
    return;
  }

  const ok = await confirm(`\n  Appliquer sur ${plan.length} produit(s) ?`, true);
  if (!ok) { console.log('  Annulé.'); return; }

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
  console.log(`\n  Résultat : ${okCount} ok, ${errors} erreur(s).\n`);
}

// ------------------------------------------------------------
// Cible "alt" : alt texts manquants → generateAltText par image
// ------------------------------------------------------------
async function runAltText(matched, apply) {
  // Recharge les détails images (ID + alt) via Shopify pour cibler avec précision.
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
  console.log(`\n  ${plan.length} alt text(s) à générer.`);
  console.log('  Préview (5 premiers) :');
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.handle} #${item.idx} → ${item.newAlt}`);
  }

  if (!apply) {
    console.log('\n  (dry-run terminé — relancer avec --confirm pour appliquer)\n');
    return;
  }

  const ok = await confirm(`\n  Appliquer ${plan.length} alt text(s) ?`, true);
  if (!ok) { console.log('  Annulé.'); return; }

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
  console.log(`\n  Résultat : ${okCount} ok, ${errors} erreur(s).\n`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
