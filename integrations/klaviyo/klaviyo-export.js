'use strict';

// ============================================================
// integrations/klaviyo/klaviyo-export.js — Klaviyo export (read-only)
// ------------------------------------------------------------
// This script ONLY performs GET requests against the Klaviyo API.
// No mutation (POST/PUT/PATCH/DELETE) — strict rule.
//
// Output in this folder:
//   - flows.md, lists.md, segments.md, metrics.md, profiles-summary.md
//   - templates/<flow-slug>_<n>.html        (one file per flow email)
//   - klaviyo-summary.md                     (aggregated overview)
//
// No personal data (PII) is stored — counts only and HTML templates
// stripped of tracking.
//
// Environment variables:
//   - KLAVIYO_API_KEY (required) — Private API key "pk_*"
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
  console.log(`  ✅ ${filename} (${content.length} chars)`);
}

function writeTemplate(filename, content) {
  fs.writeFileSync(path.join(TPL_DIR, filename), content, 'utf8');
}

function slugify(s) {
  return String(s || 'no-name')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'no-name';
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
      console.log(`  ❌ Invalid URL: ${pathOrUrl}`);
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
          catch (e) { console.log(`  ⚠️ Invalid JSON ${urlObj.pathname}: ${e.message}`); return resolve(null); }
        }
        if (code === 403 || code === 404) {
          console.log(`  ⚠️ ${code} on ${urlObj.pathname}, continuing`);
          return resolve(null);
        }
        if (code === 429 && attempt === 1) {
          console.log(`  ⚠️ 429 rate limit on ${urlObj.pathname}, retry in 60s`);
          await sleep(60000);
          return resolve(await klaviyoGet(pathOrUrl, 2));
        }
        console.log(`  ⚠️ HTTP ${code} on ${urlObj.pathname}: ${raw.slice(0, 200)}`);
        return resolve(null);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', async (err) => {
      if (attempt < MAX_RETRIES) {
        const wait = 2000 * attempt;
        console.log(`  ⚠️ Network error ${urlObj.pathname}: ${err.message} — retry in ${wait}ms`);
        await sleep(wait);
        return resolve(await klaviyoGet(pathOrUrl, attempt + 1));
      }
      console.log(`  ⚠️ Persistent network error ${urlObj.pathname}: ${err.message}`);
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
    '# Klaviyo flows',
    `**Exported on**: ${new Date().toISOString()}`,
    `**Total**: ${enriched.length}`,
    '',
  ];
  for (const { flow, actions } of enriched) {
    const a = flow.attributes || {};
    const emailCount = actions.filter(isEmailAction).length;
    lines.push('---');
    lines.push(`## ${a.name || '(no name)'}`);
    lines.push(`- **ID**: ${flow.id}`);
    lines.push(`- **Status**: ${a.status || '—'}`);
    lines.push(`- **Trigger**: ${detectTrigger(a)}`);
    lines.push(`- **Action count**: ${actions.length}`);
    lines.push(`- **Email count**: ${emailCount}`);
    lines.push(`- **Created**: ${fmtDate(a.created)}`);
    lines.push(`- **Updated**: ${fmtDate(a.updated)}`);
    lines.push('');
  }
  writeFile('flows.md', lines.join('\n'));
}

// ------------------------------------------------------------
// HTML templates per email
// ------------------------------------------------------------
async function exportTemplates(enriched) {
  console.log('\n📥 Email templates…');
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
        writeTemplate(`${slug}_${idx}-no-message.txt`, `Flow: ${flow.attributes?.name}\nAction ${ac.id} has no flow-message.`);
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
            `Flow: ${flow.attributes?.name}`,
            `Subject: ${subject}`,
            `From: ${fromLabel} <${fromEmail}>`,
            `Preview: ${previewText}`,
            'No HTML template linked (drag-and-drop editor?).',
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
          `  Exported: ${new Date().toISOString()}`,
          '-->',
          '',
        ].join('\n');
        writeTemplate(`${slug}_${idx}.html`, head + html);
        withTpl += 1;
      }
    }
  }
  console.log(`  ${total} messages — ${withTpl} with template, ${withoutTpl} without`);
  return { total, withTpl, withoutTpl };
}

// ------------------------------------------------------------
// Lists / Segments / Metrics
// ------------------------------------------------------------
async function exportLists() {
  console.log('\n📥 Lists…');
  const lists = await klaviyoGetAll('/api/lists/');
  const lines = [
    '# Klaviyo lists',
    `**Exported on**: ${new Date().toISOString()}`,
    `**Total**: ${lists.length}`,
    '',
    '| Name | ID | Profile count | Created |',
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
    '# Klaviyo segments',
    `**Exported on**: ${new Date().toISOString()}`,
    `**Total**: ${segs.length}`,
    '',
    '| Name | ID | Definition (truncated 200c) | Created |',
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
  console.log('\n📥 Metrics…');
  const metrics = await klaviyoGetAll('/api/metrics/');
  const lines = [
    '# Klaviyo metrics',
    `**Exported on**: ${new Date().toISOString()}`,
    `**Total**: ${metrics.length}`,
    '',
    '| Name | ID | Integration |',
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
// Profiles — aggregates ONLY (zero PII)
// ------------------------------------------------------------
async function exportProfilesSummary() {
  console.log('\n📥 Profiles (PII-free aggregates)…');
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
    if (pages % 5 === 0) console.log(`    … ${pages} pages, ${total} profiles`);
  }
  const topProps = [...propCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = [
    '# Klaviyo profiles — Aggregates (PII-free)',
    `**Exported on**: ${new Date().toISOString()}`,
    '',
    '> No PII (email/name/phone/address) is exported — counters only.',
    '',
    '## Overview',
    `- **Total**: ${total}`,
    `- **SUBSCRIBED**: ${subscribed}`,
    `- **UNSUBSCRIBED**: ${unsubscribed}`,
    `- **Suppressed (active suppression)**: ${suppressed}`,
    '',
    '## Top 5 custom property keys',
    '| Key | Profile count |',
    '|---|---|',
    ...(topProps.length ? topProps.map(([k, c]) => `| ${k} | ${c} |`) : ['| _none_ | 0 |']),
    '',
  ];
  writeFile('profiles-summary.md', lines.join('\n'));
  return { total, subscribed, unsubscribed, suppressed };
}

// ------------------------------------------------------------
// Final summary
// ------------------------------------------------------------
function writeSummary({ enriched, lists, segments, metrics, profilesAgg, tplStats }) {
  const live = enriched.filter(e => e.flow.attributes?.status === 'live').length;
  const flowRows = enriched.map(({ flow, actions }) => {
    const a = flow.attributes || {};
    const emails = actions.filter(isEmailAction).length;
    return `| ${a.name || '—'} | ${detectTrigger(a)} | ${emails} | ${a.status || '—'} |`;
  }).join('\n');
  const md = [
    '# Klaviyo summary',
    `**Exported on**: ${new Date().toISOString()}`,
    '',
    '## Overview',
    `- Total flows: ${enriched.length} (${live} active)`,
    `- Total lists: ${lists.length}`,
    `- Total segments: ${segments.length}`,
    `- Total metrics: ${metrics.length}`,
    `- Total profiles: ${profilesAgg.total} (${profilesAgg.subscribed} subscribed, ${profilesAgg.unsubscribed} unsubscribed)`,
    `- Templates: ${tplStats.withTpl}/${tplStats.total} (${tplStats.withoutTpl} without)`,
    '',
    '## Flows detail',
    '| Flow | Trigger | Email count | Status |',
    '|---|---|---|---|',
    flowRows,
    '',
    '## Next steps',
    '- Adapt HTML templates: `node integrations/shopify-email/adapt-templates.js`',
    '- Recreate each flow in **Shopify Email** or another ESP',
    '- Disable Klaviyo flow by flow once validated',
    '',
  ].join('\n');
  writeFile('klaviyo-summary.md', md);
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  console.log('🚀 Klaviyo export — read-only (GET only)\n');
  if (!config.KLAVIYO_API_KEY) {
    console.error('❌  KLAVIYO_API_KEY missing in .env');
    process.exit(1);
  }
  ensureDirs();
  console.log(`📁 Output: ${OUT_DIR}`);

  const enriched = await fetchFlowsWithActions();
  writeFlowsMd(enriched);
  const tplStats = await exportTemplates(enriched);
  const lists = await exportLists();
  const segments = await exportSegments();
  const metrics = await exportMetrics();
  const profilesAgg = await exportProfilesSummary();
  writeSummary({ enriched, lists, segments, metrics, profilesAgg, tplStats });
  console.log('\n✅ Klaviyo export completed.');
}

main().catch(e => {
  console.error('❌  Fatal error:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
