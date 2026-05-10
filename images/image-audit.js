'use strict';

// ============================================================
// images/image-audit.js — Audit du volume et de la qualité des images
// ------------------------------------------------------------
// Lecture seule. Pour chaque produit du filtre :
//   - nombre d'images
//   - nombre d'alt texts manquants
//   - flag "image_count_low" si < SHOP_IMAGE_MIN
//
// Pilotable par fichier de tâche OU par flags directs.
//
// Usage :
//   node images/image-audit.js --task tasks/audit-images.md
//   node images/image-audit.js --filter "status ACTIVE, images < 3"
// ============================================================

const path = require('path');

const { getFlag } = require('../lib/cli');
const { parseTaskFile, appendTaskResult } = require('../lib/task-file');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const config = require('../lib/config');

async function main() {
  const taskPath = getFlag('task');
  let filter, task, taskName;
  if (taskPath) {
    const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
    task = parseTaskFile(abs);
    if (task.cible.scope !== 'products') { console.error(`❌  scope=products requis`); process.exit(1); }
    filter = task.cible.filter;
    taskName = task.name;
  } else {
    filter = getFlag('filter', 'tous');
    taskName = `Audit images ad-hoc — ${filter}`;
  }

  console.log(`\n━━━ image-audit ━━━`);
  console.log(`  Tâche  : ${taskName}`);
  console.log(`  Filtre : ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  Aucune cible.'); return; }

  let totalImg = 0, totalNoAlt = 0, lowCount = 0;
  console.log(`  ${matched.length} produits :\n`);
  for (const b of matched.slice(0, 100)) {
    const noAlt = (b.raw.match(/\| _\(absent\)_ \|/g) || []).length;
    totalImg += b.images;
    totalNoAlt += noAlt;
    if (b.images < config.IMAGE_MIN) lowCount++;
    const flag = b.images < config.IMAGE_MIN ? ' ⚠️ image_count_low' : '';
    console.log(`    ${(b.handle || '').padEnd(50)} images=${b.images} no_alt=${noAlt}${flag}`);
  }
  if (matched.length > 100) console.log(`    … (+${matched.length - 100} produits)`);

  console.log(`\n  Synthèse :`);
  console.log(`    Total produits audités : ${matched.length}`);
  console.log(`    Total images           : ${totalImg}`);
  console.log(`    Alt texts manquants    : ${totalNoAlt}`);
  console.log(`    Produits < ${config.IMAGE_MIN} images   : ${lowCount}`);

  if (task) {
    appendTaskResult(task.path, [
      `Mode : audit images (lecture seule)`,
      `Produits audités : ${matched.length}`,
      `Total images : ${totalImg}`,
      `Alt manquants : ${totalNoAlt}`,
      `Produits < ${config.IMAGE_MIN} images : ${lowCount}`,
    ]);
    console.log(`\n  ✓ Résultats appendés à ${path.basename(task.path)}`);
  }
  console.log('\n━━━ Fin image-audit ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
