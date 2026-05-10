'use strict';

// ============================================================
// content/update-collections.js — Mise à jour des collections
// ------------------------------------------------------------
// Champs supportés : descriptionHtml, seo.title, seo.description, handle.
// Pilotage identique à content/update-products.js.
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

async function main() {
  const taskPath = getFlag('task');
  if (!taskPath) { console.error('❌  --task <fichier.md> requis'); process.exit(1); }
  const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
  const task = parseTaskFile(abs);

  if (task.cible.scope !== 'collections') { console.error(`❌  scope=collections requis, reçu : ${task.cible.scope}`); process.exit(1); }
  if (task.action.type !== 'update') { console.error(`❌  type=update requis`); process.exit(1); }

  const fieldKey = FIELD_MAP[(task.action.field || '').toLowerCase()];
  if (!fieldKey) { console.error(`❌  Champ non supporté : ${task.action.field}. Valides : ${Object.keys(FIELD_MAP).join(', ')}`); process.exit(1); }

  console.log(`\n━━━ update-collections ━━━`);
  console.log(`  Tâche  : ${task.name}`);
  console.log(`  Filtre : ${task.cible.filter}`);
  console.log(`  Champ  : ${task.action.field}\n`);

  const blocks = parseStoreDataBlocks('collections.md');
  const matched = applyFilter(blocks, task.cible.filter);
  if (!matched.length) { console.log('  Aucune cible.'); return; }
  console.log(`  ${matched.length}/${blocks.length} collections ciblées.`);

  const useGemini = /^générer via gemini avec ce prompt\s*:/i.test(task.action.value);
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
          `Collection : ${b.title}`,
          `Handle : ${b.handle}`,
          '',
          'Rends UNIQUEMENT le contenu HTML, sans préambule, sans triples backticks.',
        ].join('\n');
        newValue = await callGeminiTextWithRetry(fullPrompt);
        console.log(` ✓ Gemini ${newValue.length}c`);
        await sleep(config.DELAY_GEMINI);
      } catch (e) { console.log(` ❌ Gemini : ${e.message.slice(0, 80)}`); continue; }
    } else { console.log(' (valeur littérale)'); }
    plan.push({ block: b, newValue });
  }

  if (task.validation.showDryRun) {
    console.log('\n  Préview (2 premières) :');
    for (const item of plan.slice(0, 2)) {
      console.log('  ──────────────────────────────────────');
      console.log(`  ${item.block.handle} → ${item.newValue.slice(0, 200)}${item.newValue.length > 200 ? '…' : ''}`);
    }
  }

  if (task.validation.askConfirm) {
    const ok = await confirm(`\n  Appliquer sur ${plan.length} collection(s) ?`, true);
    if (!ok) { console.log('  Annulé.'); return; }
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

  console.log(`\n  Résultat : ${ok} ok, ${errors} erreur(s).`);
  appendTaskResult(task.path, [
    `Entités ciblées : ${plan.length}`,
    `Entités modifiées : ${ok}`,
    `Erreurs : ${errors}`,
    `Champ modifié : ${task.action.field}`,
  ]);
  console.log('\n━━━ Fin update-collections ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
