'use strict';

// ============================================================
// audit/audit.js — Generic read-only audit driven by a task file
// ------------------------------------------------------------
// Reads store-data/<scope>.md, applies the filter declared in the
// task file, prints matching entities with their flags (missing
// SEO, few images, …) and appends a `## Results` block to the task.
//
// No Shopify mutation. No Gemini call.
//
// Usage:
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
    scope = task.target.scope;
    filter = task.target.filter;
    taskName = task.name;
  } else {
    scope = getFlag('scope', 'products');
    filter = getFlag('filter', 'all');
    taskName = `Ad-hoc audit — ${scope} — ${filter}`;
  }

  const file = SCOPE_TO_FILE[scope];
  if (!file) {
    console.error(`❌  Unknown scope: ${scope}. Valid: ${Object.keys(SCOPE_TO_FILE).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n━━━ Generic audit ━━━`);
  console.log(`  Task   : ${taskName}`);
  console.log(`  Scope  : ${scope}`);
  console.log(`  Filter : ${filter}\n`);

  const blocks = parseStoreDataBlocks(file);
  console.log(`  ${blocks.length} entities read from store-data/${file}`);

  const matched = applyFilter(blocks, filter);
  console.log(`  ${matched.length} entity(ies) match the filter\n`);

  if (matched.length) {
    console.log('  List:');
    for (const b of matched.slice(0, 50)) {
      const flags = [];
      if (b.seoTitleMissing) flags.push('seo_title_missing');
      if (b.seoDescMissing)  flags.push('seo_desc_missing');
      if (b.images < 3)      flags.push(`images=${b.images}`);
      if (b.descWords < 150) flags.push(`words=${b.descWords}`);
      if (b.noAlt)           flags.push('no_alt');
      console.log(`    • ${(b.handle || b.title || '').padEnd(50)} ${flags.join(' ') || 'OK'}`);
    }
    if (matched.length > 50) console.log(`    … (+${matched.length - 50} entities)`);
  }

  if (task) {
    appendTaskResult(task.path, [
      `Mode: audit (read-only)`,
      `Scope: ${scope}`,
      `Filter: ${filter}`,
      `Matching entities: ${matched.length} / ${blocks.length}`,
      `No Shopify mutation executed.`,
    ]);
    console.log(`\n  ✓ Results appended to ${path.basename(task.path)}`);
  }

  console.log('\n━━━ End of audit ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
