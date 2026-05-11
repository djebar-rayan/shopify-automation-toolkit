'use strict';

// ============================================================
// audit/full-audit.js — Full audit of a Shopify store
// ------------------------------------------------------------
// Extracts the complete store state (products, collections,
// pages, navigation, theme), detects quality flags and computes
// per-dimension scores:
//   - SEO       (meta tags, alt texts, handles)
//   - UX        (images, HTML structure)
//   - Content   (descriptions, tags)
//   - Operations (SKU, variants)
//
// Output: audit-report.md at the repo root.
// Read-only, no mutation.
//
// Usage: node audit/full-audit.js
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../lib/config');
const { execGql } = require('../lib/shopify-graphql');
const { stripHtml, wordCount } = require('../lib/text');
const { sleep } = require('../lib/cli');

const REPORT_PATH = path.join(config.WORKSPACE, 'audit-report.md');

const THRESHOLDS = {
  DESC_MIN_WORDS: config.DESC_MIN_WORDS,
  SEO_TITLE_MIN: config.SEO_TITLE_MIN,
  SEO_TITLE_MAX: config.SEO_TITLE_MAX,
  SEO_DESC_MAX: config.SEO_DESC_MAX,
  IMAGE_MIN: config.IMAGE_MIN,
};

// ============================================================
// PERMISSIONS
// ============================================================
async function checkPermissions() {
  const tests = [
    { name: 'read_products', query: 'query { products(first:1) { edges { node { id } } } }' },
    { name: 'read_orders',   query: 'query { orders(first:1) { edges { node { id } } } }' },
    { name: 'read_content',  query: 'query { pages(first:1) { edges { node { id } } } }' },
    { name: 'read_themes',   query: 'query { themes(first:1) { edges { node { id } } } }' },
  ];
  const permissions = {};
  for (const t of tests) {
    const r = execGql(t.query);
    permissions[t.name] = !r._error;
    console.log(`  ${permissions[t.name] ? '✓' : '✗'} ${t.name}`);
  }
  permissions.write_products = true; // assumed if auth included write_products
  permissions.write_content = permissions.read_content;
  return permissions;
}

// ============================================================
// COLLECT
// ============================================================
function collectShopInfo() {
  const r = execGql(`
    query AuditShop {
      shop { name email myshopifyDomain currencyCode plan { displayName } createdAt }
    }
  `);
  return r?.shop || {};
}

async function collectAllProducts() {
  const q = `
    query AuditProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id title handle descriptionHtml tags vendor productType status
          images(first: 10) { edges { node { id url altText } } }
          variants(first: 20) { edges { node { id price compareAtPrice sku inventoryQuantity } } }
          metafields(first: 10, namespace: "global") { edges { node { namespace key value type } } }
        } }
      }
    }
  `;
  const products = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`\r  Fetching products page ${page}... (${products.length} so far)`);
    const r = execGql(q, { first: 50, after: cursor });
    if (r._error) { console.log('\n  [SKIP] Products: ' + (r._msg || r._error)); break; }
    products.push(...(r.products.edges || []).map(e => e.node));
    const pi = r.products.pageInfo;
    cursor = pi.hasNextPage ? pi.endCursor : null;
    if (cursor) await sleep(300);
  } while (cursor);
  console.log(`\n  ${products.length} products fetched.`);
  return products;
}

async function collectCollections() {
  const q = `
    query AuditCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id title handle descriptionHtml
          productsCount { count }
          image { url altText }
        } }
      }
    }
  `;
  const all = [];
  let cursor = null;
  do {
    const r = execGql(q, { first: 50, after: cursor });
    if (r._error) { console.log('  [SKIP] Collections: ' + (r._msg || r._error)); break; }
    all.push(...r.collections.edges.map(e => e.node));
    cursor = r.collections.pageInfo.hasNextPage ? r.collections.pageInfo.endCursor : null;
  } while (cursor);
  console.log(`  ${all.length} collections fetched.`);
  return all;
}

function collectPages(permissions) {
  if (!permissions.read_content) return [];
  const r = execGql(`
    query AuditPages($first: Int!) {
      pages(first: $first) { edges { node { id title handle bodySummary createdAt updatedAt } } }
    }
  `, { first: 100 });
  if (r._error) return [];
  return (r.pages?.edges || []).map(e => e.node);
}

function collectTheme(permissions) {
  if (!permissions.read_themes) return null;
  const r = execGql(`
    query AuditTheme {
      themes(first: 5) { edges { node { id name role updatedAt } } }
    }
  `);
  if (r._error) return null;
  return (r.themes?.edges || []).map(e => e.node).find(t => t.role === 'MAIN') || null;
}

// ============================================================
// ANALYZE
// ============================================================
function analyzeProduct(product) {
  const html = product.descriptionHtml || '';
  const plain = stripHtml(html);
  const wc = wordCount(plain);
  const hasHtml = /<(p|ul|li|h[1-6]|strong|em)[^>]*>/i.test(html);
  const images = (product.images.edges || []).map(e => e.node);
  const variants = (product.variants.edges || []).map(e => e.node);
  const metafields = (product.metafields.edges || []).map(e => e.node);
  const seoTitle = metafields.find(m => m.key === 'title_tag');
  const seoDesc = metafields.find(m => m.key === 'description_tag');
  const imagesNoAlt = images.filter(img => !img.altText || img.altText.trim() === '');

  const flags = [];
  const add = (code, priority, dimension, message) => flags.push({ code, priority, dimension, message });

  if (wc === 0) add('desc_missing', 1, 'Content', 'Description missing');
  else if (wc < THRESHOLDS.DESC_MIN_WORDS) add('desc_too_short', 1, 'Content', `Description too short (${wc} words)`);
  if (wc > 0 && !hasHtml) add('desc_no_html', 2, 'Content', 'Description without HTML structure');

  if (images.length === 0) add('image_missing', 1, 'UX', 'No image');
  else if (images.length < THRESHOLDS.IMAGE_MIN) add('image_count_low', 2, 'UX', `Only ${images.length} image(s)`);
  if (imagesNoAlt.length > 0) add('image_no_alttext', 1, 'SEO', `${imagesNoAlt.length} image(s) without alt`);

  if (!seoTitle) add('seo_title_missing', 1, 'SEO', 'Missing SEO meta title');
  else if (seoTitle.value.length > THRESHOLDS.SEO_TITLE_MAX) add('seo_title_long', 2, 'SEO', `Meta title too long (${seoTitle.value.length}c)`);
  else if (seoTitle.value.length < THRESHOLDS.SEO_TITLE_MIN) add('seo_title_short', 2, 'SEO', `Meta title too short (${seoTitle.value.length}c)`);

  if (!seoDesc) add('seo_desc_missing', 1, 'SEO', 'Missing SEO meta description');
  else if (seoDesc.value.length > THRESHOLDS.SEO_DESC_MAX) add('seo_desc_long', 2, 'SEO', `Meta desc too long (${seoDesc.value.length}c)`);

  if (!product.tags || product.tags.length === 0) add('no_tags', 2, 'Content', 'No tag');
  if (/[^a-z0-9\-]/.test(product.handle)) add('handle_bad_chars', 2, 'SEO', `Non-compliant handle: ${product.handle}`);

  const variantsNoSku = variants.filter(v => !v.sku || v.sku.trim() === '');
  if (variantsNoSku.length > 0) add('variant_no_sku', 3, 'Operations', `${variantsNoSku.length} variant(s) without SKU`);

  let penalty = 0;
  for (const f of flags) penalty += f.priority === 1 ? 2 : f.priority === 2 ? 1 : 0.5;
  const score = Math.max(0, 10 - penalty).toFixed(1);

  return { ...product, _a: { plain, wc, hasHtml, images, variants, metafields, seoTitle, seoDesc, imagesNoAlt, flags, score } };
}

function computeScores(analyzed) {
  const n = analyzed.length;
  if (n === 0) return { SEO: 10, UX: 10, Content: 10, Operations: 10, overall: 10 };
  const dimFlags = {
    SEO: ['image_no_alttext', 'seo_title_missing', 'seo_desc_missing', 'seo_title_long', 'seo_title_short', 'seo_desc_long', 'handle_bad_chars'],
    UX: ['image_missing', 'image_count_low', 'desc_no_html'],
    Content: ['desc_missing', 'desc_too_short', 'no_tags'],
    Operations: ['variant_no_sku'],
  };
  const scores = {};
  for (const [dim, list] of Object.entries(dimFlags)) {
    let pen = 0;
    for (const p of analyzed) for (const f of p._a.flags) {
      if (list.includes(f.code)) pen += f.priority === 1 ? 2 : f.priority === 2 ? 1 : 0.5;
    }
    scores[dim] = Math.max(0, 10 - pen / n).toFixed(1);
  }
  const vals = Object.values(scores).map(Number);
  scores.overall = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  return scores;
}

function statusEmoji(score) {
  const s = parseFloat(score);
  if (s >= 7.5) return '🟢 Good';
  if (s >= 5) return '🟡 Average';
  return '🔴 Low';
}

function buildP1P2(analyzed) {
  const p1 = [], p2 = [];
  for (const p of analyzed) {
    for (const f of p._a.flags) {
      const e = { product: p.title, handle: p.handle, flag: f };
      if (f.priority === 1) p1.push(e);
      else if (f.priority === 2) p2.push(e);
    }
  }
  return { p1, p2 };
}

// ============================================================
// REPORT
// ============================================================
function generateReport(ctx) {
  const { shopInfo, analyzed, collections, pages, theme, scores, issues, permissions } = ctx;
  const today = new Date().toISOString().split('T')[0];
  const plan = shopInfo.plan ? shopInfo.plan.displayName : 'Unknown';
  const lines = [];
  const h = (level, text) => lines.push('#'.repeat(level) + ' ' + text);
  const br = () => lines.push('');
  const rule = () => lines.push('---');

  h(1, `Shopify audit — ${shopInfo.name || config.BRAND_NAME}`);
  lines.push(`**Date:** ${today}  `);
  lines.push(`**Store:** ${config.STORE}  `);
  lines.push(`**Plan:** ${plan}  |  **Currency:** ${shopInfo.currencyCode || '?'}  |  **Products:** ${analyzed.length}  |  **Collections:** ${collections.length}`);
  lines.push(`**Mode:** ${permissions.write_products ? 'Read + Write' : 'Read-only'}`);
  rule();

  h(2, 'Overall scores');
  br();
  lines.push('| Dimension | Score /10 | Status |');
  lines.push('|---|---|---|');
  for (const [dim, score] of Object.entries(scores)) {
    if (dim === 'overall') continue;
    lines.push(`| ${dim} | ${score}/10 | ${statusEmoji(score)} |`);
  }
  lines.push(`| **Overall** | **${scores.overall}/10** | ${statusEmoji(scores.overall)} |`);
  br();
  rule();

  h(2, 'Critical issues (Priority 1)');
  br();
  if (issues.p1.length === 0) lines.push('✅ No critical issue detected.');
  else {
    lines.push('| # | Product | Issue | Dimension |');
    lines.push('|---|---|---|---|');
    issues.p1.slice(0, 50).forEach((e, i) =>
      lines.push(`| ${i + 1} | ${e.product} (\`${e.handle}\`) | ${e.flag.message} | ${e.flag.dimension} |`));
    if (issues.p1.length > 50) lines.push(`\n_… and ${issues.p1.length - 50} more P1 issues_`);
  }
  br();

  h(2, 'Important improvements (Priority 2)');
  br();
  if (issues.p2.length === 0) lines.push('✅ No urgent improvement.');
  else {
    lines.push('| # | Product | Issue | Dimension |');
    lines.push('|---|---|---|---|');
    issues.p2.slice(0, 50).forEach((e, i) =>
      lines.push(`| ${i + 1} | ${e.product} (\`${e.handle}\`) | ${e.flag.message} | ${e.flag.dimension} |`));
    if (issues.p2.length > 50) lines.push(`\n_… and ${issues.p2.length - 50} more P2 issues_`);
  }
  br();
  rule();

  h(2, 'Per-product analysis');
  br();
  lines.push('| Product | Desc words | Images | Missing alts | SEO title | SEO desc | Tags | Score |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const p of analyzed) {
    const a = p._a;
    lines.push(`| ${p.title.substring(0, 40)} | ${a.wc} | ${a.images.length} | ${a.imagesNoAlt.length} | ${a.seoTitle ? '✓' : '✗'} | ${a.seoDesc ? '✓' : '✗'} | ${(p.tags || []).length} | ${a.score}/10 |`);
  }
  br();
  rule();

  h(2, 'Collections');
  br();
  lines.push('| Collection | Handle | Products | Description | Image |');
  lines.push('|---|---|---|---|---|');
  for (const c of collections) {
    const count = c.productsCount?.count ?? '?';
    const hasDesc = c.descriptionHtml && stripHtml(c.descriptionHtml).length > 10 ? '✓' : '✗';
    const hasImg = c.image ? '✓' : '✗';
    lines.push(`| ${c.title} | ${c.handle} | ${count} | ${hasDesc} | ${hasImg} |`);
  }
  br();

  if (pages.length > 0) {
    rule();
    h(2, 'Pages');
    br();
    lines.push('| Page | Handle | Created |');
    lines.push('|---|---|---|');
    for (const pg of pages) lines.push(`| ${pg.title} | ${pg.handle} | ${(pg.createdAt || '').split('T')[0]} |`);
    br();

    const handles = pages.map(p => p.handle.toLowerCase());
    const important = ['about', 'contact', 'faq', 'terms', 'returns', 'privacy', 'shipping'];
    const missing = important.filter(h => !handles.some(hh => hh.includes(h)));
    if (missing.length > 0) {
      h(3, 'Missing important pages');
      missing.forEach(m => lines.push(`- ⚠️ \`${m}\``));
      br();
    }
  }

  if (theme) {
    rule();
    h(2, 'Active theme');
    lines.push(`**${theme.name}** (role: ${theme.role})`);
    lines.push(`Last updated: ${(theme.updatedAt || '').split('T')[0]}`);
    br();
  }

  rule();
  h(2, 'Action items');
  br();
  const countFlag = code => analyzed.filter(p => p._a.flags.some(f => f.code === code)).length;
  const todo = (n, label) => `- [${n === 0 ? 'x' : ' '}] ${label}: **${n} product(s)**`;
  lines.push(todo(countFlag('seo_title_missing'), 'Missing SEO titles → `seo/seo-update.js`'));
  lines.push(todo(countFlag('seo_desc_missing'), 'Missing SEO descriptions → `seo/seo-update.js`'));
  const nAlt = analyzed.reduce((acc, p) => acc + p._a.imagesNoAlt.length, 0);
  lines.push(`- [${nAlt === 0 ? 'x' : ' '}] Missing alt texts: **${nAlt} image(s)** → \`images/image-alt.js\``);
  lines.push(todo(countFlag('desc_missing') + countFlag('desc_too_short'), 'Descriptions too short → `content/update-products.js`'));
  lines.push(todo(countFlag('desc_no_html'), 'Descriptions without HTML → `content/update-products.js`'));
  lines.push(todo(countFlag('image_count_low') + countFlag('image_missing'), 'Not enough images → `images/image-generate.js`'));
  lines.push(todo(countFlag('handle_bad_chars'), 'Non-compliant handles → `content/handle-normalize.js`'));
  br();

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('━━━ Full audit ━━━\n');
  console.log('Phase 0: Permission check');
  const permissions = await checkPermissions();

  console.log('\nPhase 1: Data collection');
  const shopInfo = collectShopInfo();
  const products = await collectAllProducts();
  const collections = await collectCollections();
  const pages = collectPages(permissions);
  const theme = collectTheme(permissions);

  console.log('\nPhase 2: Analysis');
  const analyzed = products.map(analyzeProduct);
  const scores = computeScores(analyzed);
  const issues = buildP1P2(analyzed);
  console.log(`  Overall score: ${scores.overall}/10 ${statusEmoji(scores.overall)}`);
  console.log(`  P1: ${issues.p1.length} critical issues`);
  console.log(`  P2: ${issues.p2.length} improvements`);

  console.log('\nPhase 3: Report generation');
  generateReport({ shopInfo, analyzed, collections, pages, theme, scores, issues, permissions });
  console.log(`  ✓ ${REPORT_PATH}`);

  console.log('\n━━━ End of audit ━━━\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
