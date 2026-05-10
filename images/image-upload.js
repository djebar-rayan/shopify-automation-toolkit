'use strict';

// ============================================================
// images/image-upload.js — Upload d'images locales vers Shopify
// ------------------------------------------------------------
// Pipeline staged upload + productCreateMedia.
// Optionnel : --link-variants pour lier chaque image à la variante
// dont le titre correspond au nom du fichier (ex: foo_iphone-14.jpg → variante iPhone 14).
// Optionnel : --delete-old pour supprimer les anciennes images
// après upload réussi (IRRÉVERSIBLE — protégé par --confirm + prompt).
//
// Usage :
//   node images/image-upload.js --handle mon-produit --file ./img.jpg
//   node images/image-upload.js --handle mon-produit --dir ./generated-images --confirm
//   node images/image-upload.js --handle mon-produit --dir ./generated-images --link-variants --confirm
//   node images/image-upload.js --handle mon-produit --dir ./gen --delete-old --confirm
// ============================================================

const fs = require('fs');
const path = require('path');

const { getFlag, hasFlag, confirm, sleep } = require('../lib/cli');
const { execGql } = require('../lib/shopify-graphql');
const {
  stagedUploadFromFile,
  attachMedia,
  linkVariantToMedia,
  deleteMedia,
} = require('../lib/image-upload');
const config = require('../lib/config');

function listImages(dirPath) {
  return fs.readdirSync(dirPath)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .map(f => path.join(dirPath, f));
}

function mimeFor(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function main() {
  const handle = getFlag('handle');
  const file = getFlag('file');
  const dir = getFlag('dir');
  const apply = hasFlag('confirm');
  const linkVariants = hasFlag('link-variants');
  const deleteOld = hasFlag('delete-old');

  if (!handle) { console.error('❌  --handle <product-handle> requis'); process.exit(1); }
  if (!file && !dir) { console.error('❌  --file <path> OU --dir <dossier> requis'); process.exit(1); }

  const files = file ? [file] : listImages(dir);
  if (!files.length) { console.error(`❌  Aucune image trouvée dans ${dir}`); process.exit(1); }

  console.log(`\n━━━ image-upload ━━━`);
  console.log(`  Handle   : ${handle}`);
  console.log(`  Fichiers : ${files.length}`);
  console.log(`  Mode     : ${apply ? 'APPLIQUER' : 'dry-run'}`);
  console.log(`  Liaison variantes : ${linkVariants ? 'oui' : 'non'}`);
  console.log(`  Suppression anciennes : ${deleteOld ? '⚠️ OUI (IRREVERSIBLE)' : 'non'}\n`);

  const Q = `
    query Get($handle: String!) {
      productByHandle(handle: $handle) {
        id title
        media(first: 50) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id }
          } }
        }
        variants(first: 100) {
          edges { node { id title } }
        }
      }
    }
  `;
  const r = execGql(Q, { handle });
  const product = r?.productByHandle;
  if (!product) { console.error(`❌  Produit introuvable : ${handle}`); process.exit(1); }
  console.log(`  Produit : ${product.title}`);

  const oldMediaIds = (product.media?.edges || [])
    .map(e => e.node).filter(m => m.mediaContentType === 'IMAGE').map(m => m.id);

  console.log(`\n  Plan :`);
  for (const f of files) console.log(`    upload ${path.basename(f)}`);
  if (deleteOld) console.log(`    puis supprimer ${oldMediaIds.length} ancienne(s) image(s)`);

  if (!apply) {
    console.log('\n  (dry-run terminé — relancer avec --confirm pour appliquer)\n');
    return;
  }

  const ok = await confirm(`\n  Confirmer l'upload de ${files.length} fichier(s) ?`, true);
  if (!ok) { console.log('  Annulé.'); return; }

  const variants = (product.variants?.edges || []).map(e => e.node);
  let uploaded = 0, errors = 0;
  const newMediaByVariant = [];

  for (const f of files) {
    const filename = path.basename(f);
    const mime = mimeFor(f);
    process.stdout.write(`  ${filename}…`);
    try {
      const resourceUrl = await stagedUploadFromFile(f, mime, filename);
      await sleep(config.DELAY_SHOPIFY);
      const altText = `${product.title} — ${path.basename(f, path.extname(f))}`.slice(0, 512);
      const res = attachMedia(product.id, resourceUrl, altText);
      const errs = res?.productCreateMedia?.mediaUserErrors || [];
      if (errs.length) { console.log(` ❌ ${errs[0].message}`); errors++; continue; }
      const newMedia = res?.productCreateMedia?.media?.[0];
      console.log(` ✓ ${newMedia?.id || '(no id)'}`);
      uploaded++;

      if (linkVariants && newMedia?.id) {
        const v = matchVariantByFilename(filename, variants);
        if (v) {
          process.stdout.write(`    lier à variante "${v.title}"…`);
          const r2 = linkVariantToMedia(product.id, v.id, newMedia.id);
          const e2 = r2?.productVariantsBulkUpdate?.userErrors || [];
          if (e2.length) console.log(` ❌ ${e2[0].message}`);
          else console.log(' ✓');
        }
      }
    } catch (e) {
      console.log(` ❌ ${e.message.slice(0, 100)}`);
      errors++;
    }
    await sleep(config.DELAY_SHOPIFY);
  }

  console.log(`\n  Upload : ${uploaded} ok, ${errors} erreur(s).`);

  if (deleteOld && uploaded > 0 && oldMediaIds.length > 0) {
    const confirmDelete = await confirm(
      `  ⚠️  Supprimer définitivement ${oldMediaIds.length} ancienne(s) image(s) ? IRRÉVERSIBLE`, true
    );
    if (confirmDelete) {
      const r = deleteMedia(product.id, oldMediaIds);
      const errs = r?.productDeleteMedia?.mediaUserErrors || [];
      if (errs.length) console.log(`  ❌ ${errs[0].message}`);
      else console.log(`  ✓ ${oldMediaIds.length} anciennes images supprimées.`);
    }
  }

  console.log('\n━━━ Fin image-upload ━━━\n');
}

/** Cherche une variante dont le titre correspond au nom du fichier (slug-friendly). */
function matchVariantByFilename(filename, variants) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();
  return variants.find(v => {
    const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return base.includes(slug);
  });
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
