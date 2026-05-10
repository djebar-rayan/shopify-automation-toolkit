'use strict';

// ============================================================
// content/update-products.js — Mise à jour générique des produits
// ------------------------------------------------------------
// Pilotée par fichier de tâche tasks/<task>.md.
// Champs supportés (case-insensitive) :
//   - descriptionHtml | description
//   - seo.title       | seo_title
//   - seo.description | seo_description
//   - tags
//   - handle
//   - status
// La valeur peut être :
//   - littérale (HTML, texte, liste de tags séparés par virgule)
//   - « générer via Gemini avec ce prompt : … » → callGeminiText
//
// Usage : node content/update-products.js --task tasks/<file>.md [--yes]
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

async function main() {
  const taskPath = getFlag('task');
  if (!taskPath) { console.error('❌  --task <fichier.md> requis'); process.exit(1); }
  const abs = path.isAbsolute(taskPath) ? taskPath : path.join(process.cwd(), taskPath);
  const task = parseTaskFile(abs);

  if (task.cible.scope !== 'products') {
    console.error(`❌  Ce script gère scope=products, reçu : ${task.cible.scope}`);
    process.exit(1);
  }
  if (task.action.type !== 'update') {
    console.error(`❌  Ce script gère type=update, reçu : ${task.action.type}`);
    process.exit(1);
  }

  const fieldKey = FIELD_MAP[(task.action.field || '').toLowerCase()];
  if (!fieldKey) {
    console.error(`❌  Champ non supporté : ${task.action.field}. Valides : ${Object.keys(FIELD_MAP).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n━━━ update-products ━━━`);
  console.log(`  Tâche  : ${task.name}`);
  console.log(`  Filtre : ${task.cible.filter}`);
  console.log(`  Champ  : ${task.action.field} → ${fieldKey}`);
  console.log(`  Valeur : ${task.action.value.slice(0, 80)}${task.action.value.length > 80 ? '…' : ''}\n`);

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, task.cible.filter);
  if (!matched.length) { console.log('  Aucune cible. Arrêt.'); return; }
  console.log(`  ${matched.length}/${blocks.length} produits ciblés.`);

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
          `Produit : ${b.title}`,
          `Type : ${b.productType || ''}`,
          `Vendor : ${b.vendor || ''}`,
          `Tags : ${b.tags.join(', ')}`,
          '',
          'Rends UNIQUEMENT le contenu HTML (ou texte selon le champ), sans préambule, sans triples backticks.',
        ].join('\n');
        newValue = await callGeminiTextWithRetry(fullPrompt);
        console.log(` ✓ Gemini ${newValue.length}c`);
        await sleep(config.DELAY_GEMINI);
      } catch (e) {
        console.log(` ❌ Gemini : ${e.message.slice(0, 80)}`);
        continue;
      }
    } else {
      console.log(' (valeur littérale)');
    }
    plan.push({ block: b, newValue });
  }

  if (task.validation.showDryRun) {
    console.log('\n  Préview (3 premières cibles) :');
    for (const item of plan.slice(0, 3)) {
      console.log('  ──────────────────────────────────────────────');
      console.log(`  ${item.block.handle}`);
      console.log(`  Nouvelle valeur (200c) : ${item.newValue.slice(0, 200)}${item.newValue.length > 200 ? '…' : ''}`);
    }
    if (plan.length > 3) console.log(`  … (+${plan.length - 3} produits)`);
  }

  if (task.validation.askConfirm) {
    const ok = await confirm(`\n  Appliquer sur ${plan.length} produit(s) ?`, true);
    if (!ok) { console.log('  Annulé par l\'utilisateur.'); return; }
  }

  console.log('\n  Application...');
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

  console.log(`\n  Résultat : ${ok} ok, ${errors} erreur(s).`);

  appendTaskResult(task.path, [
    `Entités ciblées : ${plan.length}`,
    `Entités modifiées : ${ok}`,
    `Erreurs : ${errors}`,
    `Champ modifié : ${task.action.field}`,
    `Re-fetch recommandé : node fetch-store-data.js`,
  ]);
  console.log(`  ✓ Résultats appendés à ${path.basename(task.path)}`);
  console.log('\n━━━ Fin update-products ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1); });
