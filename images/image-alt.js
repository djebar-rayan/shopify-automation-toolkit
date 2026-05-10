'use strict';

// ============================================================
// images/image-alt.js — Mise à jour des alt texts manquants
// ------------------------------------------------------------
// Pour chaque produit du filtre :
//   1. Récupère ses médias (id, alt actuel) via GraphQL.
//   2. Pour les alts manquants, génère un alt avec :
//      - mode=formula (défaut)  → lib/builders/seo-meta::generateAltText
//      - mode=vision            → Gemini Vision analyse l'image
//   3. Pousse productUpdateMedia (mutation).
//
// Usage :
//   node images/image-alt.js                                 # dry-run, formulas
//   node images/image-alt.js --confirm                       # applique
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
  console.log(`  Mode   : ${apply ? 'APPLIQUER' : 'dry-run'}  |  Source : ${mode}`);
  console.log(`  Filtre : ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  Aucune cible.'); return; }
  console.log(`  ${matched.length} produit(s) à inspecter.`);

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
  console.log(`  ${plan.length} alt text(s) à générer.\n`);

  // Génère
  for (const item of plan) {
    if (mode === 'vision' && item.imageUrl) {
      try {
        const img = await downloadImageAsBase64(item.imageUrl);
        const prompt = `Décris ce produit en une phrase courte (max 100 caractères) pour un attribut alt SEO. Pas de Markdown, pas de guillemets autour de la phrase.`;
        const txt = await callGeminiVisionWithRetry(prompt, img.base64, img.mimeType);
        item.newAlt = (txt || '').slice(0, 512);
        await sleep(config.DELAY_GEMINI);
      } catch (e) {
        console.log(`  ⚠️  ${item.handle} #${item.idx} Vision a échoué (${e.message.slice(0, 60)}), fallback formula.`);
        item.newAlt = generateAltText(item.product, item.idx);
      }
    } else {
      item.newAlt = generateAltText(item.product, item.idx);
    }
  }

  console.log('  Préview (5 premiers) :');
  for (const item of plan.slice(0, 5)) {
    console.log(`    ${item.handle.padEnd(40)} #${item.idx} → ${item.newAlt}`);
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
