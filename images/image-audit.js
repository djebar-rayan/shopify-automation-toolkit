'use strict';

// ============================================================
// images/image-audit.js — Audit image counts and alt-text quality
// ------------------------------------------------------------
// Read-only. For each product in the filter:
//   - image count
//   - number of missing alt texts
//   - "image_count_low" flag if < SHOP_IMAGE_MIN
//
// Drivable through a task file OR direct flags.
//
// Usage:
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
    if (task.target.scope !== 'products') { console.error(`❌  scope=products required`); process.exit(1); }
    filter = task.target.filter;
    taskName = task.name;
  } else {
    filter = getFlag('filter', 'all');
    taskName = `Ad-hoc image audit — ${filter}`;
  }

  console.log(`\n━━━ image-audit ━━━`);
  console.log(`  Task  : ${taskName}`);
  console.log(`  Filter: ${filter}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  No target.'); return; }

  let totalImg = 0, totalNoAlt = 0, lowCount = 0;
  console.log(`  ${matched.length} products:\n`);
  for (const b of matched.slice(0, 100)) {
    const noAlt = (b.raw.match(/\| _\(missing\)_ \|/g) || []).length;
    totalImg += b.images;
    totalNoAlt += noAlt;
    if (b.images < config.IMAGE_MIN) lowCount++;
    const flag = b.images < config.IMAGE_MIN ? ' ⚠️ image_count_low' : '';
    console.log(`    ${(b.handle || '').padEnd(50)} images=${b.images} no_alt=${noAlt}${flag}`);
  }
  if (matched.length > 100) console.log(`    … (+${matched.length - 100} products)`);

  console.log(`\n  Summary:`);
  console.log(`    Total products audited : ${matched.length}`);
  console.log(`    Total images           : ${totalImg}`);
  console.log(`    Missing alt texts      : ${totalNoAlt}`);
  console.log(`    Products < ${config.IMAGE_MIN} images    : ${lowCount}`);

  if (task) {
    appendTaskResult(task.path, [
      `Mode: image audit (read-only)`,
      `Products audited: ${matched.length}`,
      `Total images: ${totalImg}`,
      `Missing alt texts: ${totalNoAlt}`,
      `Products < ${config.IMAGE_MIN} images: ${lowCount}`,
    ]);
    console.log(`\n  ✓ Results appended to ${path.basename(task.path)}`);
  }
  console.log('\n━━━ End image-audit ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
