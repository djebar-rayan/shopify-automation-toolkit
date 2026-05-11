'use strict';

// ============================================================
// lib/filter-dsl.js — Mini-DSL filter applied to store-data blocks
// ------------------------------------------------------------
// Accepted syntax (combinable with comma = AND):
//   • "all" / "all products"
//   • "handle <h>"
//   • "handles <h1>, <h2>, …"
//   • "tag <t>"
//   • "status active|draft|archived"
//   • "images < N" / "images > N" / "images = 0"
//   • "desc_words < N" / "desc_words > N"
//   • "seo_title missing"
//   • "seo_description missing"
//   • "no_alt"
//   • "variants > N"
//   • "vendor <v>"
// ============================================================

function applyFilter(blocks, filterStr) {
  const f = (filterStr || '').toLowerCase().trim();
  if (!f || /^all(\s+\w+)?$/.test(f)) return blocks;
  const clauses = splitClauses(f);
  return blocks.filter(b => clauses.every(c => testClause(b, c)));
}

// Split on commas, but keep commas that belong to a `handles a, b, c` list together.
function splitClauses(f) {
  const out = [];
  let buf = '';
  let inHandles = false;
  const parts = f.split(',');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;
    if (/^handles?\s+/.test(p)) {
      if (buf) out.push(buf.trim());
      buf = p;
      inHandles = /^handles\s+/.test(p);
      continue;
    }
    // A token like "baz" with no keyword inside a multi-handle list
    if (inHandles && !/^(handle|tag|status|images?|desc_words?|seo_(title|description)|no_alt|variants?|vendor)\b/.test(p)) {
      buf += ' ' + p;
      continue;
    }
    if (buf) out.push(buf.trim());
    buf = p;
    inHandles = false;
  }
  if (buf) out.push(buf.trim());
  return out;
}

function testClause(b, c) {
  let m;
  if ((m = c.match(/^handle\s+(.+)$/))) {
    return b.handle === m[1].trim();
  }
  if ((m = c.match(/^handles\s+(.+)$/))) {
    const list = m[1].split(/\s+/).map(s => s.replace(/[`,]/g, '').trim()).filter(Boolean);
    return list.includes(b.handle);
  }
  if ((m = c.match(/^tag\s+(.+)$/))) {
    return b.tags.map(t => t.toLowerCase()).includes(m[1].trim());
  }
  if ((m = c.match(/^status\s+(active|draft|archived)$/i))) {
    return (b.status || '').toUpperCase() === m[1].toUpperCase();
  }
  if ((m = c.match(/^images?\s*<\s*(\d+)$/))) {
    return b.images < parseInt(m[1], 10);
  }
  if ((m = c.match(/^images?\s*=\s*0$/))) {
    return b.images === 0;
  }
  if ((m = c.match(/^images?\s*>\s*(\d+)$/))) {
    return b.images > parseInt(m[1], 10);
  }
  if ((m = c.match(/^desc_words?\s*<\s*(\d+)$/))) {
    return b.descWords < parseInt(m[1], 10);
  }
  if ((m = c.match(/^desc_words?\s*>\s*(\d+)$/))) {
    return b.descWords > parseInt(m[1], 10);
  }
  if (/^seo_title\s+missing$/.test(c)) return b.seoTitleMissing;
  if (/^seo_description\s+missing$/.test(c)) return b.seoDescMissing;
  if (/^no_alt$/.test(c)) return b.noAlt;
  if ((m = c.match(/^variants?\s*>\s*(\d+)$/))) return b.variants > parseInt(m[1], 10);
  if ((m = c.match(/^vendor\s+(.+)$/))) {
    return (b.vendor || '').toLowerCase() === m[1].toLowerCase();
  }
  console.warn(`  ⚠️  Unknown filter clause ignored: "${c}"`);
  return true;
}

module.exports = { applyFilter, testClause };
