'use strict';

// ============================================================
// images/image-upload.js — Upload local images to Shopify
// ------------------------------------------------------------
// Pipeline: staged upload + productCreateMedia.
// Optional: --link-variants to bind each image to the variant whose
// title matches the file name (e.g. foo_iphone-14.jpg → iPhone 14 variant).
// Optional: --delete-old to remove the previous images after a
// successful upload (IRREVERSIBLE — gated by --confirm + prompt).
//
// Usage:
//   node images/image-upload.js --handle my-product --file ./img.jpg
//   node images/image-upload.js --handle my-product --dir ./generated-images --confirm
//   node images/image-upload.js --handle my-product --dir ./generated-images --link-variants --confirm
//   node images/image-upload.js --handle my-product --dir ./gen --delete-old --confirm
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

  if (!handle) { console.error('❌  --handle <product-handle> is required'); process.exit(1); }
  if (!file && !dir) { console.error('❌  --file <path> OR --dir <folder> is required'); process.exit(1); }

  const files = file ? [file] : listImages(dir);
  if (!files.length) { console.error(`❌  No image found in ${dir}`); process.exit(1); }

  console.log(`\n━━━ image-upload ━━━`);
  console.log(`  Handle: ${handle}`);
  console.log(`  Files : ${files.length}`);
  console.log(`  Mode  : ${apply ? 'APPLY' : 'dry-run'}`);
  console.log(`  Link variants: ${linkVariants ? 'yes' : 'no'}`);
  console.log(`  Delete previous: ${deleteOld ? '⚠️ YES (IRREVERSIBLE)' : 'no'}\n`);

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
  if (!product) { console.error(`❌  Product not found: ${handle}`); process.exit(1); }
  console.log(`  Product: ${product.title}`);

  const oldMediaIds = (product.media?.edges || [])
    .map(e => e.node).filter(m => m.mediaContentType === 'IMAGE').map(m => m.id);

  console.log(`\n  Plan:`);
  for (const f of files) console.log(`    upload ${path.basename(f)}`);
  if (deleteOld) console.log(`    then delete ${oldMediaIds.length} previous image(s)`);

  if (!apply) {
    console.log('\n  (dry-run completed — rerun with --confirm to apply)\n');
    return;
  }

  const ok = await confirm(`\n  Confirm uploading ${files.length} file(s)?`, true);
  if (!ok) { console.log('  Cancelled.'); return; }

  const variants = (product.variants?.edges || []).map(e => e.node);
  let uploaded = 0, errors = 0;

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
          process.stdout.write(`    link to variant "${v.title}"…`);
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

  console.log(`\n  Upload: ${uploaded} ok, ${errors} error(s).`);

  if (deleteOld && uploaded > 0 && oldMediaIds.length > 0) {
    const confirmDelete = await confirm(
      `  ⚠️  Permanently delete ${oldMediaIds.length} previous image(s)? IRREVERSIBLE`, true
    );
    if (confirmDelete) {
      const r = deleteMedia(product.id, oldMediaIds);
      const errs = r?.productDeleteMedia?.mediaUserErrors || [];
      if (errs.length) console.log(`  ❌ ${errs[0].message}`);
      else console.log(`  ✓ ${oldMediaIds.length} previous images deleted.`);
    }
  }

  console.log('\n━━━ End image-upload ━━━\n');
}

/** Finds the variant whose title matches the filename slug. */
function matchVariantByFilename(filename, variants) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();
  return variants.find(v => {
    const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return base.includes(slug);
  });
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
