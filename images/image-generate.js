'use strict';

// ============================================================
// images/image-generate.js — Génération d'images via Gemini Image
// ------------------------------------------------------------
// 2 modes d'utilisation :
//
//   1) Mode "single" — pour un produit, on génère N images
//      à partir d'un prompt textuel + (optionnel) une image de référence.
//      Toutes les images générées sont sauvegardées dans generated-images/.
//
//   2) Mode "multi-variant" — pour un produit avec N variantes,
//      on génère une image par variante, en utilisant 2 références :
//        - une image canonique (motif, design, etc.)
//        - l'image existante de la variante (pour préserver sa forme)
//      Le prompt instruit Gemini à combiner les deux.
//
// Aucune mutation Shopify : les images sont laissées en local pour
// validation visuelle. Utiliser ensuite images/image-upload.js.
//
// Usage :
//   node images/image-generate.js --mode=single --handle=mon-produit \
//     --prompt="Photo studio fond blanc, 4K, cadrage carré"
//
//   node images/image-generate.js --mode=multi-variant --handle=mon-produit \
//     --canonical=0 --prompt="Préserve le motif de l'image 1, applique-le sur la forme de l'image 2."
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
  if (!handle) { console.error('❌  --handle <product-handle> requis'); process.exit(1); }

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
  console.log(`  Handle   : ${handle}`);
  console.log(`  Prompt   : ${prompt ? prompt.slice(0, 100) : '(défini par mode)'}`);
  console.log(`  Sortie   : ${GEN_DIR}\n`);

  // 1. Récupérer le produit + ses médias + variantes
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
  if (!product) { console.error(`❌  Produit introuvable : ${handle}`); process.exit(1); }
  console.log(`  Produit : ${product.title}`);

  const images = (product.media?.edges || []).map(e => e.node).filter(m => m.mediaContentType === 'IMAGE');
  const variants = (product.variants?.edges || []).map(e => e.node);

  if (mode === 'single') {
    return runSingle(product, images, prompt, noImprove, dryRun);
  }
  if (mode === 'multi-variant') {
    return runMultiVariant(product, images, variants, prompt, canonicalIdx, onlyList, skipList, noImprove, dryRun);
  }
  console.error(`❌  Mode invalide : ${mode}. Valides : single | multi-variant`);
  process.exit(1);
}

// ------------------------------------------------------------
// Mode "single" — une image (avec ref optionnelle = image[0])
// ------------------------------------------------------------
async function runSingle(product, images, userPrompt, noImprove, dryRun) {
  const refImage = images[0]; // utilise la première image existante comme référence si dispo
  let prompt = userPrompt || `Génère une photo produit professionnelle pour ${product.title}, fond blanc neutre, éclairage studio, cadrage carré, qualité 4K.`;
  if (!noImprove) {
    try {
      const meta = `Améliore et étoffe ce prompt de génération d'image produit (style, lumière, cadre) sans en changer le sens. Garde le ton court et précis. Ne rends QUE le prompt amélioré.\n\nPrompt initial : ${prompt}`;
      prompt = await callGeminiTextWithRetry(meta);
      console.log(`  Prompt amélioré : ${prompt.slice(0, 120)}…`);
    } catch (e) {
      console.log(`  ⚠️  Amélioration prompt échouée : ${e.message.slice(0, 80)} — on garde le prompt initial.`);
    }
  }

  const refs = [];
  if (refImage?.image?.url) {
    process.stdout.write(`  Téléchargement de l'image de référence…`);
    refs.push(await downloadImageAsBase64(refImage.image.url));
    console.log(' ✓');
  }

  if (dryRun) {
    console.log('\n  (dry-run — aucune génération effectuée)\n');
    return;
  }

  console.log(`  Génération via Gemini Image…`);
  const out = await callGeminiImageWithRetry(prompt, refs);
  const validation = validateGeneratedImage(out.base64, out.mimeType);
  if (!validation.valid) {
    console.log(`  ❌ Image rejetée : ${validation.reason}`);
    return;
  }
  const ext = out.mimeType.includes('png') ? 'png' : 'jpg';
  const filename = `${product.handle}_${Date.now()}.${ext}`;
  const filepath = path.join(GEN_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(out.base64, 'base64'));
  console.log(`  ✓ Sauvegardée : ${filepath} (${validation.sizeKB} KB, ${validation.width}×${validation.height})`);
  console.log(`\n  Pour l'uploader vers Shopify :`);
  console.log(`    node images/image-upload.js --handle ${product.handle} --file "${filepath}" --confirm\n`);
}

// ------------------------------------------------------------
// Mode "multi-variant" — une image par variante
// ------------------------------------------------------------
async function runMultiVariant(product, images, variants, userPrompt, canonicalIdx, onlyList, skipList, noImprove, dryRun) {
  if (variants.length === 0) {
    console.error('❌  Ce produit n\'a pas de variantes — utiliser --mode=single.');
    process.exit(1);
  }
  const canonical = images[canonicalIdx];
  if (!canonical?.image?.url) {
    console.error(`❌  Image canonique introuvable à l'index ${canonicalIdx}.`);
    process.exit(1);
  }
  console.log(`  ${variants.length} variantes détectées, canonique = image #${canonicalIdx}`);

  let basePrompt = userPrompt || 'Préserve le motif/design de l\'image 1 (canonique). Applique-le sur la forme/couleur de l\'image 2 (variante). Photo studio fond blanc, qualité 4K.';
  if (!noImprove) {
    try {
      basePrompt = await callGeminiTextWithRetry(`Améliore ce prompt de génération d'image (style, cadrage, lumière) sans en changer le sens. Rends UNIQUEMENT le prompt amélioré.\n\n${basePrompt}`);
    } catch (_) {}
  }

  process.stdout.write('  Téléchargement de l\'image canonique…');
  const canonicalImg = await downloadImageAsBase64(canonical.image.url);
  console.log(' ✓');

  const filtered = variants.filter(v => {
    if (onlyList && !onlyList.some(o => v.title.toLowerCase().includes(o.toLowerCase()))) return false;
    if (skipList && skipList.some(s => v.title.toLowerCase().includes(s.toLowerCase()))) return false;
    return true;
  });
  console.log(`  ${filtered.length} variantes à traiter.\n`);

  let ok = 0, errors = 0;
  for (let i = 0; i < filtered.length; i++) {
    const v = filtered[i];
    process.stdout.write(`  [${i + 1}/${filtered.length}] ${v.title}…`);
    if (!v.image?.url) { console.log(' ⚠️  pas d\'image variante, skip'); continue; }

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
  console.log(`\n  Résultat : ${ok} générées, ${errors} erreur(s).`);
  console.log('  ⚠️  Validation visuelle recommandée AVANT upload.\n');
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
