'use strict';

// ============================================================
// lib/store-data.js — Parser for store-data/<scope>.md files
// ------------------------------------------------------------
// store-data/ is the local source of truth, populated by
// fetch-store-data.js. Each entity is one Markdown block:
//   ## <Title>
//   - **Field** : value
//   …
//   ---
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('./config');
const STORE_DATA = config.STORE_DATA_DIR;

function parseStoreDataBlocks(filename) {
  const p = path.join(STORE_DATA, filename);
  if (!fs.existsSync(p)) {
    throw new Error(`store-data not found: ${p}. Run fetch-store-data.js first.`);
  }
  const raw = fs.readFileSync(p, 'utf8');
  const blocks = [];
  const lines = raw.split('\n');
  let cur = null;
  let inHeader = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inHeader && line === '---') { inHeader = false; continue; }
    if (inHeader) continue;
    if (line.startsWith('## ')) {
      if (cur) blocks.push(cur);
      cur = { title: line.slice(3).trim(), raw: line + '\n', lines: [line] };
    } else if (line === '---' && cur) {
      cur.raw = cur.lines.join('\n');
      blocks.push(cur);
      cur = null;
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) { cur.raw = cur.lines.join('\n'); blocks.push(cur); }

  for (const b of blocks) enrichBlock(b);
  return blocks;
}

function enrichBlock(b) {
  function pick(key) {
    // Restrict whitespace to spaces/tabs (no newline) so empty-value
    // fields don't accidentally capture the following line.
    const re = new RegExp(`^[-*][ \\t]*\\*\\*${key}\\*\\*[ \\t]*:[ \\t]*(.+)$`, 'mi');
    const m = b.raw.match(re);
    return m ? m[1].trim() : '';
  }
  b.id = pick('ID');
  b.handle = (pick('Handle') || '').replace(/^`|`$/g, '');
  b.status = pick('Status');
  b.productType = pick('Type');
  b.vendor = pick('Vendor');
  b.tags = (pick('Tags') || '').split(/,\s*/).filter(Boolean);
  b.images = parseInt(pick('Image count') || '0', 10);
  b.variants = parseInt(pick('Variant count') || '0', 10);
  b.descWords = parseInt(pick('Description words') || '0', 10);
  b.seoTitleMissing = /_\(missing\)_/i.test(pick('SEO title')) || pick('SEO title') === '_(missing)_';
  b.seoDescMissing  = /_\(missing\)_/i.test(pick('SEO description')) || pick('SEO description') === '_(missing)_';
  b.noAlt = /\| _\(missing\)_ \|/.test(b.raw);
}

function replaceBlockInStoreData(filename, identifier, newBlock) {
  const p = path.join(STORE_DATA, filename);
  const raw = fs.readFileSync(p, 'utf8');
  const re = /(## [^\n]*\n[\s\S]*?\n---\n)/g;
  let replaced = false;
  const updated = raw.replace(re, (block) => {
    if (block.includes(identifier) && !replaced) {
      replaced = true;
      return newBlock + '\n';
    }
    return block;
  });
  if (replaced) fs.writeFileSync(p, updated, 'utf8');
  return replaced;
}

module.exports = { parseStoreDataBlocks, replaceBlockInStoreData };
