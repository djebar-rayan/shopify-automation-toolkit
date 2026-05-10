'use strict';

// ============================================================
// images/visual-audit.js — Audit qualité images via Gemini Vision
// ------------------------------------------------------------
// Pour chaque image des produits filtrés, demande à Gemini Vision
// de classifier la qualité (ADEQUATE | A_REMPLACER | NO_IMAGE)
// et de fournir un commentaire court.
//
// Le résultat est mis en cache JSON (.audit-tmp/visual-audit.json)
// pour pouvoir relancer la décision sans repayer les appels.
//
// Aucune mutation. Sortie : visual-audit-report.md
//
// Usage :
//   node images/visual-audit.js --filter "status ACTIVE"
//   node images/visual-audit.js --filter "handle mon-produit"
//   node images/visual-audit.js --refresh   # ignore le cache
// ============================================================

const fs = require('fs');
const path = require('path');

const { getFlag, hasFlag, sleep } = require('../lib/cli');
const { parseStoreDataBlocks } = require('../lib/store-data');
const { applyFilter } = require('../lib/filter-dsl');
const { execGql } = require('../lib/shopify-graphql');
const { downloadImageAsBase64 } = require('../lib/image-download');
const { callGeminiVisionWithRetry } = require('../lib/gemini-vision');
const config = require('../lib/config');

const CACHE_PATH = path.join(config.TMP_DIR, 'visual-audit.json');
const REPORT_PATH = path.join(config.WORKSPACE, 'visual-audit-report.md');

const PROMPT = [
  'Tu es un expert visuel e-commerce. Analyse cette image produit.',
  'Réponds UNIQUEMENT en JSON :',
  '{ "status": "ADEQUATE" | "A_REMPLACER" | "NO_IMAGE",',
  '  "reasons": ["raison 1", "raison 2"],',
  '  "summary": "phrase courte" }',
  'ADEQUATE = composition correcte, fond neutre, produit lisible.',
  'A_REMPLACER = floue / mal cadrée / produit difficile à identifier.',
  'NO_IMAGE = pas vraiment un produit (placeholder, watermark, blanc).',
].join('\n');

async function main() {
  const filter = getFlag('filter', 'status ACTIVE');
  const refresh = hasFlag('refresh');

  console.log(`\n━━━ visual-audit ━━━`);
  console.log(`  Filtre : ${filter}\n`);

  fs.mkdirSync(config.TMP_DIR, { recursive: true });
  const cache = (!refresh && fs.existsSync(CACHE_PATH))
    ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    : {};

  const blocks = parseStoreDataBlocks('products.md');
  const matched = applyFilter(blocks, filter);
  if (!matched.length) { console.log('  Aucune cible.'); return; }

  const Q = `
    query Get($id: ID!) {
      product(id: $id) {
        id title handle
        media(first: 30) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt image { url } }
          } }
        }
      }
    }
  `;

  const results = [];
  for (let i = 0; i < matched.length; i++) {
    const b = matched[i];
    console.log(`\n  [${i + 1}/${matched.length}] ${b.title}`);
    const r = execGql(Q, { id: b.id });
    const p = r?.product;
    if (!p) continue;
    const medias = (p.media?.edges || []).map(e => e.node).filter(m => m.mediaContentType === 'IMAGE');

    for (let idx = 0; idx < medias.length; idx++) {
      const m = medias[idx];
      const cacheKey = m.id;
      let verdict = cache[cacheKey];
      if (!verdict) {
        if (!m.image?.url) continue;
        process.stdout.write(`    image #${idx} → Vision…`);
        try {
          const img = await downloadImageAsBase64(m.image.url);
          const txt = await callGeminiVisionWithRetry(PROMPT, img.base64, img.mimeType, { json: true });
          verdict = JSON.parse(txt);
          cache[cacheKey] = verdict;
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
          console.log(` ${verdict.status}`);
          await sleep(config.DELAY_GEMINI);
        } catch (e) {
          console.log(` ❌ ${e.message.slice(0, 80)}`);
          continue;
        }
      } else {
        console.log(`    image #${idx} → ${verdict.status} (cache)`);
      }
      results.push({ handle: b.handle, title: b.title, mediaId: m.id, idx, verdict });
    }
  }

  // Génération du rapport
  const adequate = results.filter(r => r.verdict.status === 'ADEQUATE');
  const replace = results.filter(r => r.verdict.status === 'A_REMPLACER');
  const none = results.filter(r => r.verdict.status === 'NO_IMAGE');

  const md = [
    '# Audit visuel des images',
    `**Date** : ${new Date().toISOString()}  `,
    `**Filtre** : ${filter}  `,
    `**Total images analysées** : ${results.length}  `,
    `**ADEQUATE** : ${adequate.length}  |  **À REMPLACER** : ${replace.length}  |  **PAS UNE IMAGE PRODUIT** : ${none.length}`,
    '',
    '---',
    '',
    '## Images à remplacer',
    '',
    '| Produit | Handle | # | Raison | Résumé |',
    '|---|---|---|---|---|',
    ...replace.map(r => `| ${r.title} | \`${r.handle}\` | ${r.idx} | ${(r.verdict.reasons || []).join('; ')} | ${r.verdict.summary || ''} |`),
    '',
    '## Images de type "pas un produit"',
    '',
    '| Produit | Handle | # | Résumé |',
    '|---|---|---|---|',
    ...none.map(r => `| ${r.title} | \`${r.handle}\` | ${r.idx} | ${r.verdict.summary || ''} |`),
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\n  ✓ Rapport : ${REPORT_PATH}`);
  console.log(`  Cache    : ${CACHE_PATH}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
