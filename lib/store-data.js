'use strict';

// ============================================================
// lib/store-data.js — Parser des fichiers store-data/<scope>.md
// ------------------------------------------------------------
// store-data/ est la source de vérité locale, peuplée par
// fetch-store-data.js. Chaque entité est un bloc Markdown :
//   ## <Titre>
//   - **Champ** : valeur
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
    throw new Error(`store-data introuvable : ${p}. Lancer fetch-store-data.js d'abord.`);
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
    const re = new RegExp(`^[-*]\\s*\\*\\*${key}\\*\\*\\s*:\\s*(.+)$`, 'mi');
    const m = b.raw.match(re);
    return m ? m[1].trim() : '';
  }
  b.id = pick('ID');
  b.handle = (pick('Handle') || '').replace(/^`|`$/g, '');
  b.status = pick('Statut');
  b.productType = pick('Type');
  b.vendor = pick('Vendor');
  b.tags = (pick('Tags') || '').split(/,\s*/).filter(Boolean);
  b.images = parseInt(pick('Nb images') || '0', 10);
  b.variants = parseInt(pick('Nb variantes') || '0', 10);
  b.descWords = parseInt(pick('Mots description') || '0', 10);
  b.seoTitleMissing = /_(absent)_/i.test(pick('SEO title')) || pick('SEO title') === '_(absent)_';
  b.seoDescMissing  = /_(absent)_/i.test(pick('SEO description')) || pick('SEO description') === '_(absent)_';
  b.noAlt = /\| _\(absent\)_ \|/.test(b.raw);
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
