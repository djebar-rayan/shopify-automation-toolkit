'use strict';

// ============================================================
// content/update-pages.js — Generic CMS page update
// ------------------------------------------------------------
// Supported fields: body, seo.title, seo.description, handle, title.
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
  'body':            'body',
  'bodyhtml':        'body',
  'seo.title':       'seoTitle',
  'seo_title':       'seoTitle',
  'seo.description': 'seoDescription',
  'seo_description': 'seoDescription',
  'handle':          'handle',
  'title':           'title',
};

const GEMINI_PREFIX = /^generate via gemini with this prompt\s*:/i;

async function main() {
  const taskPath = getFlag('task');
  if (!taskPath) { console.error('❌  --task is required'); process.exit(1); }
  const task = parseTaskFile(path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath));

  if (task.target.scope !== 'pages') { console.error(`❌  scope=pages required`); process.exit(1); }
  if (task.action.type !== 'update') { console.error(`❌  type=update required`); process.exit(1); }

  const fieldKey = FIELD_MAP[(task.action.field || '').toLowerCase()];
  if (!fieldKey) { console.error(`❌  Unsupported field: ${task.action.field}`); process.exit(1); }

  console.log(`\n━━━ update-pages ━━━`);
  console.log(`  Task: ${task.name}\n  Filter: ${task.target.filter}\n  Field: ${task.action.field}\n`);

  const blocks = parseStoreDataBlocks('pages.md');
  const matched = applyFilter(blocks, task.target.filter);
  if (!matched.length) { console.log('  No target.'); return; }

  const useGemini = GEMINI_PREFIX.test(task.action.value);
  const geminiPrompt = useGemini ? task.action.value.replace(/^[^:]*:\s*/i, '') : null;

  const plan = [];
  for (let i = 0; i < matched.length; i++) {
    const b = matched[i];
    process.stdout.write(`  [${i + 1}/${matched.length}] ${b.handle}…`);
    let newValue = task.action.value;
    if (useGemini) {
      try {
        newValue = await callGeminiTextWithRetry(
          [geminiPrompt, '', `Page: ${b.title}`, '', 'Return ONLY the HTML content, without preamble.'].join('\n')
        );
        console.log(` ✓ Gemini ${newValue.length}c`);
        await sleep(config.DELAY_GEMINI);
      } catch (e) { console.log(` ❌ ${e.message.slice(0, 80)}`); continue; }
    } else { console.log(' (literal)'); }
    plan.push({ block: b, newValue });
  }

  if (task.validation.showDryRun) {
    console.log('\n  Preview:');
    for (const item of plan.slice(0, 2)) console.log(`  ${item.block.handle} → ${item.newValue.slice(0, 150)}…`);
  }
  if (task.validation.askConfirm) {
    if (!await confirm(`\n  Apply to ${plan.length} page(s)?`, true)) { console.log('  Cancelled.'); return; }
  }

  const MUTATION = `
    mutation Upd($input: PageUpdateInput!, $id: ID!) {
      pageUpdate(id: $id, page: $input) {
        page { id handle }
        userErrors { field message }
      }
    }
  `;
  let ok = 0, errors = 0;
  for (const item of plan) {
    const input = {};
    if (fieldKey === 'body') input.body = item.newValue;
    else if (fieldKey === 'seoTitle') input.seo = { title: item.newValue };
    else if (fieldKey === 'seoDescription') input.seo = { description: item.newValue };
    else if (fieldKey === 'handle') input.handle = item.newValue;
    else if (fieldKey === 'title') input.title = item.newValue;

    process.stdout.write(`    ${item.block.handle}…`);
    const res = execMutation(MUTATION, { id: item.block.id, input });
    const errs = res?.pageUpdate?.userErrors || [];
    if (res._error || errs.length) { console.log(` ❌ ${errs[0]?.message || res._msg}`); errors++; }
    else { console.log(' ✓'); ok++; }
    await sleep(config.DELAY_SHOPIFY);
  }

  console.log(`\n  ${ok} ok, ${errors} error(s)`);
  appendTaskResult(task.path, [
    `Targeted entities: ${plan.length}`,
    `Modified entities: ${ok}`,
    `Errors: ${errors}`,
  ]);
  console.log('\n━━━ End update-pages ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
