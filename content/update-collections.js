'use strict';

// ============================================================
// content/update-collections.js — Generic collection update
// ------------------------------------------------------------
// Supported fields: descriptionHtml, seo.title, seo.description, handle.
// Driving identical to content/update-products.js.
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
  'handle':           'handle',
};

const GEMINI_PREFIX = /^generate via gemini with this prompt\s*:/i;

async function main() {
  const taskPath = getFlag('task');
  if (!taskPath) { console.error('❌  --task <file.md> is required'); process.exit(1); }
  const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
  const task = parseTaskFile(abs);

  if (task.target.scope !== 'collections') { console.error(`❌  scope=collections required, got: ${task.target.scope}`); process.exit(1); }
  if (task.action.type !== 'update') { console.error(`❌  type=update required`); process.exit(1); }

  const fieldKey = FIELD_MAP[(task.action.field || '').toLowerCase()];
  if (!fieldKey) { console.error(`❌  Unsupported field: ${task.action.field}. Valid: ${Object.keys(FIELD_MAP).join(', ')}`); process.exit(1); }

  console.log(`\n━━━ update-collections ━━━`);
  console.log(`  Task   : ${task.name}`);
  console.log(`  Filter : ${task.target.filter}`);
  console.log(`  Field  : ${task.action.field}\n`);

  const blocks = parseStoreDataBlocks('collections.md');
  const matched = applyFilter(blocks, task.target.filter);
  if (!matched.length) { console.log('  No target.'); return; }
  console.log(`  ${matched.length}/${blocks.length} collections targeted.`);

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
          `Collection: ${b.title}`,
          `Handle: ${b.handle}`,
          '',
          'Return ONLY the HTML content, without preamble, without triple backticks.',
        ].join('\n');
        newValue = await callGeminiTextWithRetry(fullPrompt);
        console.log(` ✓ Gemini ${newValue.length}c`);
        await sleep(config.DELAY_GEMINI);
      } catch (e) { console.log(` ❌ Gemini: ${e.message.slice(0, 80)}`); continue; }
    } else { console.log(' (literal value)'); }
    plan.push({ block: b, newValue });
  }

  if (task.validation.showDryRun) {
    console.log('\n  Preview (first 2):');
    for (const item of plan.slice(0, 2)) {
      console.log('  ──────────────────────────────────────');
      console.log(`  ${item.block.handle} → ${item.newValue.slice(0, 200)}${item.newValue.length > 200 ? '…' : ''}`);
    }
  }

  if (task.validation.askConfirm) {
    const ok = await confirm(`\n  Apply to ${plan.length} collection(s)?`, true);
    if (!ok) { console.log('  Cancelled.'); return; }
  }

  const MUTATION = `
    mutation Upd($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection { id handle }
        userErrors { field message }
      }
    }
  `;
  let ok = 0, errors = 0;
  for (const item of plan) {
    const input = { id: item.block.id };
    if (fieldKey === 'descriptionHtml') input.descriptionHtml = item.newValue;
    else if (fieldKey === 'seoTitle') input.seo = { title: item.newValue };
    else if (fieldKey === 'seoDescription') input.seo = { description: item.newValue };
    else if (fieldKey === 'handle') input.handle = item.newValue;

    process.stdout.write(`    ${item.block.handle}…`);
    const res = execMutation(MUTATION, { input });
    const errs = res?.collectionUpdate?.userErrors || [];
    if (res._error || errs.length) { console.log(` ❌ ${errs[0]?.message || res._msg || res._error}`); errors++; }
    else { console.log(' ✓'); ok++; }
    await sleep(config.DELAY_SHOPIFY);
  }

  console.log(`\n  Result: ${ok} ok, ${errors} error(s).`);
  appendTaskResult(task.path, [
    `Targeted entities: ${plan.length}`,
    `Modified entities: ${ok}`,
    `Errors: ${errors}`,
    `Field modified: ${task.action.field}`,
  ]);
  console.log('\n━━━ End update-collections ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
