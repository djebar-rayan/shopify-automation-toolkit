'use strict';

// ============================================================
// integrations/klaviyo/klaviyo-export.js — Export Klaviyo (lecture seule)
// ------------------------------------------------------------
// Ce script effectue UNIQUEMENT des requêtes GET vers l'API Klaviyo.
// Aucune mutation (POST/PUT/PATCH/DELETE) — règle stricte.
//
// Sortie dans le dossier de ce script :
//   - flows.md, lists.md, segments.md, metrics.md, profiles-summary.md
//   - templates/<flow-slug>_<n>.html        (un fichier par email du flow)
//   - klaviyo-summary.md                     (vue d'ensemble agrégée)
//
// Aucune donnée personnelle (PII) n'est stockée — uniquement des compteurs
// et des templates HTML désincorporés du tracking.
//
// Variables d'environnement :
//   - KLAVIYO_API_KEY (obligatoire) — clé Private API "pk_*"
// ============================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const config = require('../../lib/config');
const { sleep } = require('../../lib/cli');

const KLAVIYO_HOST = 'a.klaviyo.com';
const KLAVIYO_REVISION = '2024-02-15';
const DELAY_MS = 500;
const TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;

const OUT_DIR = __dirname;
const TPL_DIR = path.join(OUT_DIR, 'templates');

function ensureDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TPL_DIR, { recursive: true });
}

function writeFile(filename, content) {
  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf8');
  console.log(`  ✅ ${filename} (${content.length} car.)`);
}

function writeTemplate(filename, content) {
  fs.writeFileSync(path.join(TPL_DIR, filename), content, 'utf8');
}

function slugify(s) {
  return String(s || 'sans-nom')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sans-nom';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// HTTP — GET only
// ------------------------------------------------------------
function klaviyoGet(pathOrUrl, attempt = 1) {
  return new Promise(async (resolve) => {
    await sleep(DELAY_MS);
    let urlObj;
    try {
      urlObj = pathOrUrl.startsWith('http')
        ? new URL(pathOrUrl)
        : new URL(`https://${KLAVIYO_HOST}${pathOrUrl}`);
    } catch (_) {
      console.log(`  ❌ URL invalide: ${pathOrUrl}`);
      return resolve(null);
    }
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Authorization: `Klaviyo-API-Key ${config.KLAVIYO_API_KEY}`,
        revision: KLAVIYO_REVISION,
        Accept: 'application/json',
      },
      timeout: TIMEOUT_MS,
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', async () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const code = res.statusCode;
        if (code === 200) {
          try { return resolve(JSON.parse(raw)); }
          catch (e) { console.log(`  ⚠️ JSON invalide ${urlObj.pathname}: ${e.message}`); return resolve(null); }
        }
        if (code === 403 || code === 404) {
          console.log(`  ⚠️ ${code} sur ${urlObj.pathname}, on continue`);
          return resolve(null);
        }
        if (code === 429 && attempt === 1) {
          console.log(`  ⚠️ 429 rate limit ${urlObj.pathname}, retry dans 60s`);
          await sleep(60000);
          return resolve(await klaviyoGet(pathOrUrl, 2));
        }
        console.log(`  ⚠️ HTTP ${code} sur ${urlObj.pathname}: ${raw.slice(0, 200)}`);
        return resolve(null);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', async (err) => {
      if (attempt < MAX_RETRIES) {
        const wait = 2000 * attempt;
        console.log(`  ⚠️ erreur réseau ${urlObj.pathname}: ${err.message} — retry dans ${wait}ms`);
        await sleep(wait);
        return resolve(await klaviyoGet(pathOrUrl, attempt + 1));
      }
      console.log(`  ⚠️ erreur réseau persistante ${urlObj.pathname}: ${err.message}`);
      return resolve(null);
    });
    req.end();
  });
}

async function klaviyoGetAll(endpoint) {
  const out = [];
  let next = endpoint;
  while (next) {
    const page = await klaviyoGet(next);
    if (!page) break;
    if (Array.isArray(page.data)) out.push(...page.data);
    next = page.links && page.links.next ? page.links.next : null;
  }
  return out;
}

// ------------------------------------------------------------
// Flows + actions
// ------------------------------------------------------------
async function fetchFlowsWithActions() {
  console.log('\n📥 Flows…');
  const flows = await klaviyoGetAll('/api/flows/');
  console.log(`  ${flows.length} flows`);
  const enriched = [];
  for (const f of flows) {
    console.log(`  ↳ "${f.attributes?.name}"`);
    const actions = await klaviyoGetAll(`/api/flows/${f.id}/flow-actions/`);
    enriched.push({ flow: f, actions });
  }
  return enriched;
}

function detectTrigger(attrs) {
  if (!attrs) return '—';
  return attrs.trigger_type
    || attrs.definition?.trigger_type
    || attrs.definition?.type
    || '—';
}

function isEmailAction(ac) {
  const at = ac.attributes?.action_type || ac.attributes?.type || '';
  return /^SEND_EMAIL$/i.test(at) || /send.?email/i.test(at);
}

function writeFlowsMd(enriched) {
  const lines = [
    '# Flows Klaviyo',
    `**Exporté le** : ${new Date().toISOString()}`,
    `**Total** : ${enriched.length}`,
    '',
  ];
  for (const { flow, actions } of enriched) {
    const a = flow.attributes || {};
    const emailCount = actions.filter(isEmailAction).length;
    lines.push('---');
    lines.push(`## ${a.name || '(sans nom)'}`);
    lines.push(`- **ID** : ${flow.id}`);
    lines.push(`- **Statut** : ${a.status || '—'}`);
    lines.push(`- **Trigger** : ${detectTrigger(a)}`);
    lines.push(`- **Nb actions** : ${actions.length}`);
    lines.push(`- **Nb emails** : ${emailCount}`);
    lines.push(`- **Créé le** : ${fmtDate(a.created)}`);
    lines.push(`- **Modifié le** : ${fmtDate(a.updated)}`);
    lines.push('');
  }
  writeFile('flows.md', lines.join('\n'));
}

// ------------------------------------------------------------
// Templates HTML par email
// ------------------------------------------------------------
async function exportTemplates(enriched) {
  console.log('\n📥 Templates email…');
  let total = 0, withTpl = 0, withoutTpl = 0;
  for (const { flow, actions } of enriched) {
    const slug = slugify(flow.attributes?.name);
    let idx = 0;
    for (const ac of actions) {
      if (!isEmailAction(ac)) continue;
      const msgsRes = await klaviyoGet(`/api/flow-actions/${ac.id}/flow-messages/`);
      const messages = (msgsRes && Array.isArray(msgsRes.data)) ? msgsRes.data : [];
      if (messages.length === 0) {
        idx += 1; total += 1; withoutTpl += 1;
        writeTemplate(`${slug}_${idx}-no-message.txt`, `Flow : ${flow.attributes?.name}\nAction ${ac.id} sans flow-message.`);
        continue;
      }
      for (const msg of messages) {
        idx += 1; total += 1;
        const ma = msg.attributes || {};
        const subject = ma.content?.subject || ma.name || '';
        const fromEmail = ma.content?.from_email || '';
        const fromLabel = ma.content?.from_label || '';
        const previewText = ma.content?.preview_text || '';
        const tplRes = await klaviyoGet(`/api/flow-messages/${msg.id}/template/`);
        const tpl = tplRes?.data;
        if (!tpl) {
          withoutTpl += 1;
          writeTemplate(`${slug}_${idx}-no-template.txt`, [
            `Flow : ${flow.attributes?.name}`,
            `Subject : ${subject}`,
            `From : ${fromLabel} <${fromEmail}>`,
            `Preview : ${previewText}`,
            'Pas de template HTML lié (éditeur drag&drop ?).',
          ].join('\n'));
          continue;
        }
        const html = tpl.attributes?.html || '';
        const head = [
          '<!--',
          `  Flow    : ${flow.attributes?.name} (${flow.id})`,
          `  Action  : ${ac.id}  index ${idx}`,
          `  Subject : ${subject}`,
          `  From    : ${fromLabel} <${fromEmail}>`,
          `  Preview : ${previewText}`,
          `  Exporté : ${new Date().toISOString()}`,
          '-->',
          '',
        ].join('\n');
        writeTemplate(`${slug}_${idx}.html`, head + html);
        withTpl += 1;
      }
    }
  }
  console.log(`  ${total} messages — ${withTpl} avec template, ${withoutTpl} sans`);
  return { total, withTpl, withoutTpl };
}

// ------------------------------------------------------------
// Lists / Segments / Metrics
// ------------------------------------------------------------
async function exportLists() {
  console.log('\n📥 Listes…');
  const lists = await klaviyoGetAll('/api/lists/');
  const lines = [
    '# Listes Klaviyo',
    `**Exporté le** : ${new Date().toISOString()}`,
    `**Total** : ${lists.length}`,
    '',
    '| Nom | ID | Nb profils | Créée le |',
    '|---|---|---|---|',
  ];
  for (const l of lists) {
    const a = l.attributes || {};
    lines.push(`| ${a.name || '—'} | ${l.id} | ${a.profile_count ?? '—'} | ${fmtDate(a.created)} |`);
  }
  writeFile('lists.md', lines.join('\n'));
  return lists;
}

async function exportSegments() {
  console.log('\n📥 Segments…');
  const segs = await klaviyoGetAll('/api/segments/');
  const lines = [
    '# Segments Klaviyo',
    `**Exporté le** : ${new Date().toISOString()}`,
    `**Total** : ${segs.length}`,
    '',
    '| Nom | ID | Définition (200c) | Créé le |',
    '|---|---|---|---|',
  ];
  for (const s of segs) {
    const a = s.attributes || {};
    const def = a.definition ? JSON.stringify(a.definition).replace(/\|/g, '\\|').slice(0, 200) : '—';
    lines.push(`| ${a.name || '—'} | ${s.id} | ${def} | ${fmtDate(a.created)} |`);
  }
  writeFile('segments.md', lines.join('\n'));
  return segs;
}

async function exportMetrics() {
  console.log('\n📥 Métriques…');
  const metrics = await klaviyoGetAll('/api/metrics/');
  const lines = [
    '# Métriques Klaviyo',
    `**Exporté le** : ${new Date().toISOString()}`,
    `**Total** : ${metrics.length}`,
    '',
    '| Nom | ID | Intégration |',
    '|---|---|---|',
  ];
  for (const m of metrics) {
    const a = m.attributes || {};
    lines.push(`| ${a.name || '—'} | ${m.id} | ${a.integration?.name || '—'} |`);
  }
  writeFile('metrics.md', lines.join('\n'));
  return metrics;
}

// ------------------------------------------------------------
// Profils — agrégats UNIQUEMENT (zéro PII)
// ------------------------------------------------------------
async function exportProfilesSummary() {
  console.log('\n📥 Profils (agrégats sans PII)…');
  let total = 0, subscribed = 0, unsubscribed = 0, suppressed = 0;
  const propCounts = new Map();
  let next = '/api/profiles/?page[size]=100&additional-fields[profile]=subscriptions';
  let pages = 0;
  while (next) {
    const page = await klaviyoGet(next);
    if (!page) break;
    pages += 1;
    for (const p of (page.data || [])) {
      total += 1;
      const a = p.attributes || {};
      const subs = a.subscriptions?.email?.marketing;
      if (subs) {
        if (subs.consent === 'SUBSCRIBED') subscribed += 1;
        else if (subs.consent === 'UNSUBSCRIBED') unsubscribed += 1;
        else if (Array.isArray(subs.suppression) && subs.suppression.length) suppressed += 1;
      }
      if (a.properties && typeof a.properties === 'object') {
        for (const k of Object.keys(a.properties)) propCounts.set(k, (propCounts.get(k) || 0) + 1);
      }
    }
    next = page.links?.next || null;
    if (pages % 5 === 0) console.log(`    … ${pages} pages, ${total} profils`);
  }
  const topProps = [...propCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = [
    '# Profils Klaviyo — Agrégats (sans PII)',
    `**Exporté le** : ${new Date().toISOString()}`,
    '',
    '> Aucune PII (email/nom/téléphone/adresse) n\'est exportée — uniquement des compteurs.',
    '',
    '## Vue d\'ensemble',
    `- **Total** : ${total}`,
    `- **SUBSCRIBED** : ${subscribed}`,
    `- **UNSUBSCRIBED** : ${unsubscribed}`,
    `- **Supprimés (suppression active)** : ${suppressed}`,
    '',
    '## Top 5 clés de propriétés custom',
    '| Clé | Nb profils |',
    '|---|---|',
    ...(topProps.length ? topProps.map(([k, c]) => `| ${k} | ${c} |`) : ['| _aucune_ | 0 |']),
    '',
  ];
  writeFile('profiles-summary.md', lines.join('\n'));
  return { total, subscribed, unsubscribed, suppressed };
}

// ------------------------------------------------------------
// Résumé final
// ------------------------------------------------------------
function writeSummary({ enriched, lists, segments, metrics, profilesAgg, tplStats }) {
  const live = enriched.filter(e => e.flow.attributes?.status === 'live').length;
  const flowRows = enriched.map(({ flow, actions }) => {
    const a = flow.attributes || {};
    const emails = actions.filter(isEmailAction).length;
    return `| ${a.name || '—'} | ${detectTrigger(a)} | ${emails} | ${a.status || '—'} |`;
  }).join('\n');
  const md = [
    '# Résumé Klaviyo',
    `**Exporté le** : ${new Date().toISOString()}`,
    '',
    '## Vue d\'ensemble',
    `- Total flows : ${enriched.length} (${live} actifs)`,
    `- Total listes : ${lists.length}`,
    `- Total segments : ${segments.length}`,
    `- Total métriques : ${metrics.length}`,
    `- Total profils : ${profilesAgg.total} (dont ${profilesAgg.subscribed} abonnés, ${profilesAgg.unsubscribed} désabonnés)`,
    `- Templates : ${tplStats.withTpl}/${tplStats.total} (${tplStats.withoutTpl} sans)`,
    '',
    '## Flows détaillés',
    '| Flow | Trigger | Nb emails | Statut |',
    '|---|---|---|---|',
    flowRows,
    '',
    '## Étapes suivantes',
    '- Adapter les templates HTML : `node integrations/shopify-email/adapt-templates.js`',
    '- Recréer chaque flow dans **Shopify Email** ou un autre ESP',
    '- Désactiver Klaviyo flow par flow après validation',
    '',
  ].join('\n');
  writeFile('klaviyo-summary.md', md);
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  console.log('🚀 Klaviyo Export — lecture seule (GET only)\n');
  if (!config.KLAVIYO_API_KEY) {
    console.error('❌  KLAVIYO_API_KEY manquante dans .env');
    process.exit(1);
  }
  ensureDirs();
  console.log(`📁 Sortie : ${OUT_DIR}`);

  const enriched = await fetchFlowsWithActions();
  writeFlowsMd(enriched);
  const tplStats = await exportTemplates(enriched);
  const lists = await exportLists();
  const segments = await exportSegments();
  const metrics = await exportMetrics();
  const profilesAgg = await exportProfilesSummary();
  writeSummary({ enriched, lists, segments, metrics, profilesAgg, tplStats });
  console.log('\n✅ Export Klaviyo terminé.');
}

main().catch(e => {
  console.error('❌  Erreur fatale:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
