'use strict';

// ============================================================
// fetch-store-data.js — Initial extraction of a Shopify store
// ------------------------------------------------------------
// Reads lib/config.js (which loads .env) and populates the
// store-data/ folder with one Markdown file per data category:
//   - products.md       (paginated)
//   - collections.md    (paginated)
//   - customers.md      (anonymized aggregate, requires read_customers)
//   - orders.md         (aggregate, requires read_orders)
//   - pages.md          (paginated)
//   - metafields.md     (synthesis per namespace, derived from products)
//   - redirects.md      (paginated up to 250)
//   - navigation.md     (stub — menus endpoint unavailable via store execute)
//   - store-meta.md     (global snapshot)
//
// No Shopify mutation. Read-only. Re-run as often as needed to
// refresh the local source of truth.
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('./lib/config');
const { execGql, isAccessDenied } = require('./lib/shopify-graphql');
const { stripHtml, wordCount, trunc, escapeMd } = require('./lib/text');
const { sleep } = require('./lib/cli');

const STORE = config.STORE;
const STORE_DATA = config.STORE_DATA_DIR;
const PAGE_DELAY_MS = 300;

function ensureDirs() {
  fs.mkdirSync(config.TMP_DIR, { recursive: true });
  fs.mkdirSync(STORE_DATA, { recursive: true });
}

function nowIso() { return new Date().toISOString(); }

function header(title, sourceCmd, extraLines) {
  return [
    `# ${title}`,
    `**Last extraction**: ${nowIso()}`,
    `**Source**: ${sourceCmd}`,
    `**Store**: ${STORE}`,
    ...(extraLines || []),
    '',
    '---',
    '',
  ].join('\n');
}

function writeFile(name, content) {
  const p = path.join(STORE_DATA, name);
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  ✓ ${name} (${Math.round(content.length / 1024)} KB)`);
}

// ============================================================
// 1. PRODUCTS
// ============================================================
const PRODUCTS_QUERY = `
  query FetchProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id title handle status productType vendor tags
        descriptionHtml
        seo { title description }
        priceRangeV2 {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        media(first: 30) {
          edges { node {
            id mediaContentType
            ... on MediaImage { id alt image { url width height } }
          } }
        }
        variants(first: 100) {
          edges { node {
            id title sku price inventoryQuantity
            selectedOptions { name value }
            image { id url }
          } }
        }
        metafields(first: 30) {
          edges { node { id namespace key type value } }
        }
      } }
    }
  }
`;

async function fetchAllProducts() {
  console.log('[1/9] Fetching products...');
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(PRODUCTS_QUERY, { first: 50, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.products?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.products?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const lines = [header('Products', '`fetch-store-data.js`', [`**Total**: ${all.length}`])];
  for (const p of all) {
    const media = (p.media?.edges || []).map(e => e.node);
    const variants = (p.variants?.edges || []).map(e => e.node);
    const metas = (p.metafields?.edges || []).map(e => e.node);
    const desc = p.descriptionHtml || '';
    const wc = wordCount(stripHtml(desc));
    const priceMin = p.priceRangeV2?.minVariantPrice;
    const priceMax = p.priceRangeV2?.maxVariantPrice;
    const priceLine = priceMin
      ? (priceMin.amount === priceMax?.amount
          ? `${priceMin.amount} ${priceMin.currencyCode}`
          : `${priceMin.amount}–${priceMax?.amount || ''} ${priceMin.currencyCode}`)
      : '—';

    lines.push(`## ${p.title}`);
    lines.push(`- **ID**: ${p.id}`);
    lines.push(`- **Handle**: \`${p.handle}\``);
    lines.push(`- **Status**: ${p.status}`);
    lines.push(`- **Type**: ${p.productType || '—'}`);
    lines.push(`- **Vendor**: ${p.vendor || '—'}`);
    lines.push(`- **Tags**: ${(p.tags || []).join(', ') || '—'}`);
    lines.push(`- **Price**: ${priceLine}`);
    lines.push(`- **Image count**: ${media.filter(m => m.mediaContentType === 'IMAGE').length}`);
    lines.push(`- **Variant count**: ${variants.length}`);
    lines.push(`- **SEO title**: ${p.seo?.title ? escapeMd(p.seo.title) : '_(missing)_'}`);
    lines.push(`- **SEO description**: ${p.seo?.description ? escapeMd(p.seo.description) : '_(missing)_'}`);
    lines.push(`- **Description words**: ${wc}`);
    lines.push(`- **Description**:`);
    lines.push('  > ' + escapeMd(trunc(stripHtml(desc), 500)));
    lines.push('');
    if (variants.length) {
      lines.push('### Variants');
      lines.push('| ID | Title | SKU | Price | Stock | Image |');
      lines.push('|---|---|---|---|---|---|');
      for (const v of variants) {
        lines.push(`| ${v.id} | ${escapeMd(v.title)} | ${v.sku || '—'} | ${v.price || '—'} | ${v.inventoryQuantity ?? '—'} | ${v.image ? 'yes' : 'no'} |`);
      }
      lines.push('');
    }
    if (media.length) {
      lines.push('### Images');
      lines.push('| ID | URL | Alt |');
      lines.push('|---|---|---|');
      for (const m of media.filter(m => m.mediaContentType === 'IMAGE')) {
        lines.push(`| ${m.id} | ${m.image?.url || '—'} | ${escapeMd(m.alt || '_(missing)_')} |`);
      }
      lines.push('');
    }
    if (metas.length) {
      lines.push('### Metafields');
      lines.push('| Namespace | Key | Type | Value (truncated 80c) |');
      lines.push('|---|---|---|---|');
      for (const m of metas) {
        lines.push(`| ${m.namespace} | ${m.key} | ${m.type} | ${escapeMd(trunc(m.value || '', 80))} |`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  writeFile('products.md', lines.join('\n'));
  return all;
}

// ============================================================
// 2. COLLECTIONS
// ============================================================
const COLLECTIONS_QUERY = `
  query FetchCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id title handle
        descriptionHtml
        seo { title description }
        image { url }
        productsCount { count }
      } }
    }
  }
`;

async function fetchAllCollections() {
  console.log('[2/9] Fetching collections...');
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(COLLECTIONS_QUERY, { first: 50, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.collections?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.collections?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const lines = [header('Collections', '`fetch-store-data.js`', [`**Total**: ${all.length}`])];
  for (const c of all) {
    const desc = c.descriptionHtml || '';
    const wc = wordCount(stripHtml(desc));
    lines.push(`## ${c.title}`);
    lines.push(`- **ID**: ${c.id}`);
    lines.push(`- **Handle**: \`${c.handle}\``);
    lines.push(`- **Product count**: ${c.productsCount?.count ?? '—'}`);
    lines.push(`- **Description**: ${wc > 0 ? `yes (${wc} words)` : 'no'}`);
    lines.push(`- **Image**: ${c.image?.url ? 'yes' : 'no'}`);
    lines.push(`- **SEO title**: ${c.seo?.title ? escapeMd(c.seo.title) : '_(missing)_'}`);
    lines.push(`- **SEO description**: ${c.seo?.description ? escapeMd(c.seo.description) : '_(missing)_'}`);
    if (desc) {
      lines.push(`- **Description (excerpt)**:`);
      lines.push('  > ' + escapeMd(trunc(stripHtml(desc), 300)));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  writeFile('collections.md', lines.join('\n'));
  return all;
}

// ============================================================
// 3. CUSTOMERS — anonymized aggregate (requires read_customers)
// ============================================================
async function fetchCustomers() {
  console.log('[3/9] Fetching customers aggregate...');
  const probe = execGql(`query { customers(first: 1) { edges { node { id } } } }`);
  if (isAccessDenied(probe) || probe._error) {
    const msg = probe._msg || probe._error || '';
    console.log(`  ⚠️  scope read_customers unavailable — stub written.`);
    const lines = [
      header('Customers (aggregate)', '`fetch-store-data.js`', ['**Status**: extraction unavailable']),
      '## ⚠️ Missing OAuth scope',
      '',
      'Customer extraction requires the `read_customers` scope, which is not granted on the current token.',
      '',
      'To enable this extraction:',
      '',
      '```bash',
      `shopify store auth --store ${STORE} \\`,
      '  --scopes read_products,write_products,read_content,write_content,read_themes,write_files,read_customers,read_orders',
      '```',
      '',
      `Technical detail: \`${trunc(escapeMd(msg), 200)}\``,
      '',
    ];
    writeFile('customers.md', lines.join('\n'));
    return null;
  }

  const QUERY = `
    query FetchCustomers($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id email tags numberOfOrders
          defaultAddress { country countryCodeV2 }
        } }
      }
    }
  `;
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(QUERY, { first: 100, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.customers?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.customers?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const total = all.length;
  const withEmail = all.filter(c => c.email).length;
  const withOrders = all.filter(c => (c.numberOfOrders || 0) > 0).length;
  const noOrders = total - withOrders;
  const countryCounts = {};
  for (const c of all) {
    const code = c.defaultAddress?.countryCodeV2 || '—';
    countryCounts[code] = (countryCounts[code] || 0) + 1;
  }
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tagSet = new Set();
  for (const c of all) for (const t of (c.tags || [])) tagSet.add(t);

  const lines = [
    header('Customers (anonymized aggregate)', '`fetch-store-data.js`', [`**Total**: ${total}`]),
    '## Customer summary',
    `- **Total customers**: ${total}`,
    `- **Customers with email**: ${withEmail}`,
    `- **Customers with orders**: ${withOrders}`,
    `- **Customers without orders**: ${noOrders}`,
    `- **Top countries**: ${topCountries.map(([k, v]) => `${k} (${Math.round(v / total * 100)}%)`).join(', ') || '—'}`,
    `- **Customer tags used**: ${[...tagSet].join(', ') || '_(none)_'}`,
    '',
    '> No personal data is exported (emails, names, addresses).',
    '',
  ];
  writeFile('customers.md', lines.join('\n'));
  return all;
}

// ============================================================
// 4. ORDERS — aggregate (requires read_orders)
// ============================================================
async function fetchOrders() {
  console.log('[4/9] Fetching orders aggregate...');
  const probe = execGql(`query { orders(first: 1) { edges { node { id } } } }`);
  if (isAccessDenied(probe) || probe._error) {
    const msg = probe._msg || probe._error || '';
    console.log(`  ⚠️  scope read_orders unavailable — stub written.`);
    const lines = [
      header('Orders (aggregate)', '`fetch-store-data.js`', ['**Status**: extraction unavailable']),
      '## ⚠️ Missing OAuth scope',
      '',
      'Order extraction requires the `read_orders` scope.',
      '',
      `Technical detail: \`${trunc(escapeMd(msg), 200)}\``,
      '',
    ];
    writeFile('orders.md', lines.join('\n'));
    return null;
  }

  const QUERY = `
    query FetchOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id name displayFinancialStatus displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 50) {
            edges { node {
              quantity
              product { id title handle }
            } }
          }
        } }
      }
    }
  `;
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(QUERY, { first: 100, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.orders?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.orders?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const total = all.length;
  const revenueByCcy = {};
  const fulfillmentCounts = {};
  const productSales = {};
  for (const o of all) {
    const amt = o.totalPriceSet?.shopMoney;
    if (amt) revenueByCcy[amt.currencyCode] = (revenueByCcy[amt.currencyCode] || 0) + parseFloat(amt.amount || 0);
    const f = o.displayFulfillmentStatus || 'UNKNOWN';
    fulfillmentCounts[f] = (fulfillmentCounts[f] || 0) + 1;
    for (const li of (o.lineItems?.edges || [])) {
      const t = li.node.product?.title || '_(deleted product)_';
      productSales[t] = (productSales[t] || 0) + (li.node.quantity || 0);
    }
  }
  const ccy = Object.keys(revenueByCcy)[0] || 'EUR';
  const totalRevenue = revenueByCcy[ccy] || 0;
  const avgOrder = total ? totalRevenue / total : 0;
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const lines = [
    header('Orders (aggregate)', '`fetch-store-data.js`', [`**Total**: ${total}`]),
    '## Order summary',
    `- **Total orders**: ${total}`,
    `- **Total revenue**: ${totalRevenue.toFixed(2)} ${ccy}`,
    `- **Average order**: ${avgOrder.toFixed(2)} ${ccy}`,
    `- **Fulfillment statuses**: ${Object.entries(fulfillmentCounts).map(([k, v]) => `${k} (${total ? Math.round(v / total * 100) : 0}%)`).join(', ')}`,
    '',
    '## Top 10 products sold',
    '| Product | Quantity sold |',
    '|---|---:|',
    ...topProducts.map(([t, q]) => `| ${escapeMd(t)} | ${q} |`),
    '',
  ];
  writeFile('orders.md', lines.join('\n'));
  return all;
}

// ============================================================
// 5. PAGES
// ============================================================
const PAGES_QUERY = `
  query FetchPages($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id title handle body bodySummary createdAt updatedAt
      } }
    }
  }
`;

async function fetchPages() {
  console.log('[5/9] Fetching pages...');
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(PAGES_QUERY, { first: 50, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.pages?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.pages?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const lines = [header('Pages', '`fetch-store-data.js`', [`**Total**: ${all.length}`])];
  for (const p of all) {
    const wc = wordCount(stripHtml(p.body || ''));
    lines.push(`## ${p.title}`);
    lines.push(`- **ID**: ${p.id}`);
    lines.push(`- **Handle**: \`${p.handle}\``);
    lines.push(`- **Words**: ${wc}`);
    lines.push(`- **Created**: ${p.createdAt || '—'}`);
    lines.push(`- **Updated**: ${p.updatedAt || '—'}`);
    if (p.bodySummary) {
      lines.push(`- **Summary**:`);
      lines.push('  > ' + escapeMd(trunc(p.bodySummary, 300)));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  writeFile('pages.md', lines.join('\n'));
  return all;
}

// ============================================================
// 6. METAFIELDS — synthesis from products
// ============================================================
function writeMetafieldsFromProducts(products) {
  console.log('[6/9] Building metafields synthesis...');
  const byNs = {};
  for (const p of products || []) {
    const metas = (p.metafields?.edges || []).map(e => e.node);
    for (const m of metas) {
      byNs[m.namespace] = byNs[m.namespace] || {};
      byNs[m.namespace][m.key] = byNs[m.namespace][m.key] || { count: 0, type: m.type, sample: '', owners: [] };
      byNs[m.namespace][m.key].count++;
      if (!byNs[m.namespace][m.key].sample) byNs[m.namespace][m.key].sample = trunc(m.value || '', 80);
      if (byNs[m.namespace][m.key].owners.length < 5) byNs[m.namespace][m.key].owners.push(p.handle);
    }
  }

  const lines = [
    header('Product metafields (synthesis)', '`fetch-store-data.js`', [`**Total namespaces**: ${Object.keys(byNs).length}`]),
    '> Product metafields are included in the `read_products` scope.',
    '',
  ];
  for (const ns of Object.keys(byNs).sort()) {
    lines.push(`## Namespace: \`${ns}\``);
    lines.push('| Key | Type | Occurrences | Sample | Example handles |');
    lines.push('|---|---|---:|---|---|');
    for (const k of Object.keys(byNs[ns]).sort()) {
      const e = byNs[ns][k];
      lines.push(`| ${k} | ${e.type} | ${e.count} | ${escapeMd(e.sample) || '—'} | ${e.owners.join(', ')} |`);
    }
    lines.push('');
  }
  writeFile('metafields.md', lines.join('\n'));
}

// ============================================================
// 7. REDIRECTS
// ============================================================
async function fetchRedirects() {
  console.log('[7/9] Fetching URL redirects...');
  const QUERY = `
    query FetchRedirects($first: Int!, $after: String) {
      urlRedirects(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id path target } }
      }
    }
  `;
  const all = [];
  let cursor = null, page = 0;
  do {
    page++;
    process.stdout.write(`  page ${page}…`);
    const res = execGql(QUERY, { first: 250, after: cursor });
    if (res._error) { console.log(` GraphQL error: ${res._msg || res._error}`); break; }
    const edges = res?.urlRedirects?.edges || [];
    for (const e of edges) all.push(e.node);
    const pi = res?.urlRedirects?.pageInfo || {};
    cursor = pi.hasNextPage ? pi.endCursor : null;
    console.log(` ${edges.length} → total ${all.length}`);
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);

  const lines = [
    header('URL redirects', '`fetch-store-data.js`', [`**Total**: ${all.length}`]),
    '| Source path | Target |',
    '|---|---|',
    ...all.map(r => `| ${escapeMd(r.path)} | ${escapeMd(r.target)} |`),
    '',
  ];
  writeFile('redirects.md', lines.join('\n'));
  return all;
}

// ============================================================
// 8. NAVIGATION — stub
// ============================================================
function writeNavigationStub() {
  console.log('[8/9] Navigation (stub)...');
  const lines = [
    header('Navigation / menus', '`fetch-store-data.js`', ['**Status**: not automatically extractable']),
    '## ⚠️ Endpoint unavailable through `shopify store execute`',
    '',
    'The `menus` GraphQL query returns ACCESS_DENIED even with `read_content`.',
    'The endpoint requires a private App with the `read_online_store_navigation` permission.',
    '',
    '### Current menu (fill in manually)',
    '',
    '| Position | Link name | URL/handle | Level |',
    '|---|---|---|---|',
    '| 1 | _(to fill)_ | _(to fill)_ | root |',
    '',
  ];
  writeFile('navigation.md', lines.join('\n'));
}

// ============================================================
// 9. STORE-META
// ============================================================
async function fetchStoreMeta(counts) {
  console.log('[9/9] Global store snapshot...');
  const QUERY = `
    query Shop {
      shop {
        name
        myshopifyDomain
        primaryDomain { url }
        currencyCode
        ianaTimezone
        plan { displayName partnerDevelopment shopifyPlus }
      }
    }
  `;
  const res = execGql(QUERY);
  const shop = res?.shop;
  if (!shop) {
    console.log('  ⚠️  shop not found — minimal stub written.');
    writeFile('store-meta.md', header('Store snapshot', '`fetch-store-data.js`', ['**Status**: partial extraction']));
    return;
  }

  const lines = [
    header('Store snapshot', '`fetch-store-data.js`'),
    '## Store information',
    `- **Name**: ${shop.name}`,
    `- **Primary domain**: ${shop.primaryDomain?.url || '—'}`,
    `- **myshopify domain**: ${shop.myshopifyDomain}`,
    `- **Plan**: ${shop.plan?.displayName || '—'}`,
    `- **Currency**: ${shop.currencyCode}`,
    `- **Timezone**: ${shop.ianaTimezone}`,
    '',
    '## Extracted volumes',
    `- **Products**: ${counts.products ?? '—'}`,
    `- **Collections**: ${counts.collections ?? '—'}`,
    `- **Pages**: ${counts.pages ?? '—'}`,
    `- **Redirects**: ${counts.redirects ?? '—'}`,
    `- **Customers**: ${counts.customers ?? 'n/a (missing scope)'}`,
    `- **Orders**: ${counts.orders ?? 'n/a (missing scope)'}`,
    '',
    '## Last extraction',
    `- **Timestamp**: ${nowIso()}`,
    `- **Target store**: \`${STORE}\``,
    '',
  ];
  writeFile('store-meta.md', lines.join('\n'));
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const banner = `store-data extraction — ${STORE}`;
  console.log('\n' + '━'.repeat(banner.length + 4));
  console.log('  ' + banner);
  console.log('━'.repeat(banner.length + 4) + '\n');
  ensureDirs();

  const t0 = Date.now();
  const counts = {};

  const products = await fetchAllProducts();      counts.products = products.length;
  const collections = await fetchAllCollections(); counts.collections = collections.length;
  const customers = await fetchCustomers();        counts.customers = customers ? customers.length : null;
  const orders = await fetchOrders();              counts.orders = orders ? orders.length : null;
  const pages = await fetchPages();                counts.pages = pages.length;
  writeMetafieldsFromProducts(products);
  const redirects = await fetchRedirects();        counts.redirects = redirects.length;
  writeNavigationStub();
  await fetchStoreMeta(counts);

  const dt = Math.round((Date.now() - t0) / 1000);
  console.log('\n═══════════════════════════════════════');
  console.log(`  ✅ Extraction completed in ${dt}s`);
  console.log(`     Products    : ${counts.products}`);
  console.log(`     Collections : ${counts.collections}`);
  console.log(`     Pages       : ${counts.pages}`);
  console.log(`     Redirects   : ${counts.redirects}`);
  console.log(`     Customers   : ${counts.customers ?? 'n/a (scope)'}`);
  console.log(`     Orders      : ${counts.orders ?? 'n/a (scope)'}`);
  console.log(`  💾 Output: ${STORE_DATA}`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n❌  Fatal error:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
