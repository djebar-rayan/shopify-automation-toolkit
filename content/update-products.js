'use strict';

// ============================================================
// content/update-products.js — Generic product update
// ------------------------------------------------------------
// Driven by a task file tasks/<task>.md.
// Supported fields (case-insensitive):
//   - descriptionHtml | description
//   - seo.title       | seo_title
//   - seo.description | seo_description
//   - tags
//   - handle
//   - status
// The value can be:
//   - a literal (HTML, text, comma-separated tag list)
//   - "generate via Gemini with this prompt: …" → callGeminiText
//
// Usage: node content/update-products.js --task tasks/<file>.md [--yes]
// ============================================================

const path = require('path');

const { getFlag, confirm, sleep } = require('../lib/cli');
const { parseTaskFile, appendTaskResult } = require('../lib/task-file');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const { execMutation } = require('../lib/shopify-graphql');
const { callGeminiTextWithRetry } = require('../lib/gemini-text');
const config = require('../lib/config');

const FIELD_MAP = {
  'descriptionhtml':  'descriptionHtml',
  'description':      'descriptionHtml',
  'seo.title':        'seoTitle',
  'seo_title':        'seoTitle',
  'seo.description':  'seoDescription',
  'seo_description':  'seoDescription',
  'tags':             'tags',
  'handle':           'handle',
  'status':           'status',
};

const GEMINI_PREFIX = /^generate via gemini with this prompt\s*:/i;

async function main() {
  const taskPath = getFlag('task');
  if (!taskPath) { console.error('❌  --task <file.md> is required'); process.exit(1); }
  const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
  const task = parseTaskFile(abs);

  if (task.target.scope !== 'products') {
    console.error(`❌  This script handles scope=products, got: ${task.target.scope}`);
    process.exit(1);
  }
  if (task.action.type !== 'update') {
    console.error(`❌  This script handles type=update, got: ${task.action.type}`);
    process.exit(1);
  }

  const fieldKey = FIELD_MAP[(task.action.field || '').toLowerCase()];
  if (!fieldKey) {
    console.error(`❌  Unsupported field: ${task.action.field}. Valid: ${Object.keys(FIELD_MAP).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n━━━ update-products ━━━`);
  console.log(`  Task   : ${task.name}`);
  console.log(`  Filter : ${task.target.filter}`);
  console.log(`  Field  : ${task.action.field} → ${fieldKey}`);
  console.log(`  Value  : ${task.action.value.slice(0, 80)}${task.action.value.length > 80 ? '…' : ''}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, task.target.filter);
  if (!matched.length) { console.log('  No target. Stopping.'); return; }
  console.log(`  ${matched.length}/${blocks.length} products targeted.`);

  const useGemini = GEMINI_PREFIX.test(task.action.value);
  const geminiPrompt = useGemini ? task.action.value.replace(/^[^:]*:\s*/i, '') : null;

  const plan = [];
  for (let i = 0; i < matched.length; i++) {
    const b = matched[i];
    process.stdout.write(`  [${i + 1}/${matched.length}] ${b.handle}…`);
    let newValue = task.action.value;
    if (useGemini) {
      try {
        const fullPrompt = [
          geminiPrompt,
          '',
          `Product: ${b.title}`,
          `Type: ${b.productType || ''}`,
          `Vendor: ${b.vendor || ''}`,
          `Tags: ${b.tags.join(', ')}`,
          '',
          'Return ONLY the HTML content (or text depending on the field), without preamble, without triple backticks.',
        ].join('\n');
        newValue = await callGeminiTextWithRetry(fullPrompt);
        console.log(` ✓ Gemini ${newValue.length}c`);
        await sleep(config.DELAY_GEMINI);
      } catch (e) {
        console.log(` ❌ Gemini: ${e.message.slice(0, 80)}`);
        continue;
      }
    } else {
      console.log(' (literal value)');
    }
    plan.push({ block: b, newValue });
  }

  if (task.validation.showDryRun) {
    console.log('\n  Preview (first 3 targets):');
    for (const item of plan.slice(0, 3)) {
      console.log('  ──────────────────────────────────────────────');
      console.log(`  ${item.block.handle}`);
      console.log(`  New value (200c): ${item.newValue.slice(0, 200)}${item.newValue.length > 200 ? '…' : ''}`);
    }
    if (plan.length > 3) console.log(`  … (+${plan.length - 3} products)`);
  }

  if (task.validation.askConfirm) {
    const ok = await confirm(`\n  Apply to ${plan.length} product(s)?`, true);
    if (!ok) { console.log('  Cancelled by user.'); return; }
  }

  console.log('\n  Applying...');
  const MUTATION = `
    mutation Upd($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id handle }
        userErrors { field message }
      }
    }
  `;
  let ok = 0, errors = 0;
  for (const item of plan) {
    const input = { id: item.block.id };
    if (fieldKey === 'descriptionHtml')      input.descriptionHtml = item.newValue;
    else if (fieldKey === 'seoTitle')        input.seo = { title: item.newValue };
    else if (fieldKey === 'seoDescription')  input.seo = { description: item.newValue };
    else if (fieldKey === 'tags')            input.tags = item.newValue.split(',').map(s => s.trim()).filter(Boolean);
    else if (fieldKey === 'handle')          input.handle = item.newValue;
    else if (fieldKey === 'status')          input.status = item.newValue.toUpperCase();

    process.stdout.write(`    ${item.block.handle}…`);
    const res = execMutation(MUTATION, { input });
    const errs = res?.productUpdate?.userErrors || [];
    if (res._error || errs.length) {
      console.log(` ❌ ${errs[0]?.message || res._msg || res._error}`);
      errors++;
    } else {
      console.log(' ✓');
      ok++;
    }
    await sleep(config.DELAY_SHOPIFY);
  }

  console.log(`\n  Result: ${ok} ok, ${errors} error(s).`);

  appendTaskResult(task.path, [
    `Targeted entities: ${plan.length}`,
    `Modified entities: ${ok}`,
    `Errors: ${errors}`,
    `Field modified: ${task.action.field}`,
    `Re-fetch recommended: node fetch-store-data.js`,
  ]);
  console.log(`  ✓ Results appended to ${path.basename(task.path)}`);
  console.log('\n━━━ End update-products ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
