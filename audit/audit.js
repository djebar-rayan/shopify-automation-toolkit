'use strict';

// ============================================================
// audit/audit.js — Audit générique read-only piloté par tâche
// ------------------------------------------------------------
// Lit store-data/<scope>.md, applique le filtre déclaré dans
// le fichier de tâche, affiche les entités correspondantes
// avec leurs flags (SEO manquants, peu d'images, …) et
// append un bloc « ## Résultats » à la tâche.
//
// Aucune mutation Shopify. Aucun appel Gemini.
//
// Usage :
//   node audit/audit.js --task tasks/audit-images.md
//   node audit/audit.js --scope products --filter "images < 3"
// ============================================================

const path = require('path');

const { getFlag } = require('../lib/cli');
const { parseTaskFile, appendTaskResult } = require('../lib/task-file');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');

const SCOPE_TO_FILE = {
  products: 'products.md',
  collections: 'collections.md',
  pages: 'pages.md',
  redirects: 'redirects.md',
};

async function main() {
  const taskPath = getFlag('task');
  let scope, filter, taskName, task;
  if (taskPath) {
    const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
    task = parseTaskFile(abs);
    scope = task.cible.scope;
    filter = task.cible.filter;
    taskName = task.name;
  } else {
    scope = getFlag('scope', 'products');
    filter = getFlag('filter', 'tous');
    taskName = `Audit ad-hoc — ${scope} — ${filter}`;
  }

  const file = SCOPE_TO_FILE[scope];
  if (!file) {
    console.error(`❌  Scope inconnu : ${scope}. Valides : ${Object.keys(SCOPE_TO_FILE).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n━━━ Audit générique ━━━`);
  console.log(`  Tâche  : ${taskName}`);
  console.log(`  Scope  : ${scope}`);
  console.log(`  Filtre : ${filter}\n`);

  const blocks = parseStoreDataBlocks(file);
  console.log(`  ${blocks.length} entités lues depuis store-data/${file}`);

  const matched = applyFilter(blocks, filter);
  console.log(`  ${matched.length} entité(s) correspondent au filtre\n`);

  if (matched.length) {
    console.log('  Liste :');
    for (const b of matched.slice(0, 50)) {
      const flags = [];
      if (b.seoTitleMissing) flags.push('seo_title_missing');
      if (b.seoDescMissing)  flags.push('seo_desc_missing');
      if (b.images < 3)      flags.push(`images=${b.images}`);
      if (b.descWords < 150) flags.push(`words=${b.descWords}`);
      if (b.noAlt)           flags.push('no_alt');
      console.log(`    • ${(b.handle || b.title || '').padEnd(50)} ${flags.join(' ') || 'OK'}`);
    }
    if (matched.length > 50) console.log(`    … (+${matched.length - 50} entités)`);
  }

  if (task) {
    appendTaskResult(task.path, [
      `Mode : audit (lecture seule)`,
      `Scope : ${scope}`,
      `Filtre : ${filter}`,
      `Entités correspondantes : ${matched.length} / ${blocks.length}`,
      `Aucune mutation Shopify exécutée.`,
    ]);
    console.log(`\n  ✓ Résultats appendés à ${path.basename(task.path)}`);
  }

  console.log('\n━━━ Fin de l\'audit ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
