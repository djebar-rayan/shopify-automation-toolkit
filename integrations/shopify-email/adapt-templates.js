'use strict';

// ============================================================
// integrations/shopify-email/adapt-templates.js
// Adaptation générique d'un dossier de templates HTML Klaviyo
// pour qu'ils passent dans l'éditeur Shopify Email.
// ------------------------------------------------------------
// Source par défaut : ../klaviyo/templates/
// Sortie  par défaut : ./templates-adapted/
//
// Les transformations appliquées :
//   1. retrait du header de commentaire de l'export Klaviyo
//   2. retrait des <script>
//   3. retrait des pixels / @import klaviyo.com
//   4. neutralisation des hrefs de tracking
//   5. retrait des balises <klaviyo:*>
//   6. retrait des conditionnels Outlook MSO
//   7. inlining des règles CSS simples (`.classe`, `#id`, `tag`)
//   8. substitution des variables Klaviyo standard vers Liquid Shopify
//   9. (optionnel) substitutions supplémentaires depuis --mapping=<file.json>
//   10. annotation HTML pour les variables non mappables (`<!-- KL -->`)
//   11. extraction du <body>, retrait des <head>/<meta>/<title>/<style> globaux
//   12. enveloppe dans un <div max-width:600px>
//   13. minification HTML
//
// Aucune mutation Shopify. Aucun appel réseau. Pure transformation locale.
//
// Usage :
//   node integrations/shopify-email/adapt-templates.js
//   node integrations/shopify-email/adapt-templates.js --src=./mes-templates --out=./out
//   node integrations/shopify-email/adapt-templates.js --mapping=./mymap.json
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../../lib/config');
const { getFlag } = require('../../lib/cli');

const DEFAULT_SRC = path.join(__dirname, '..', 'klaviyo', 'templates');
const DEFAULT_OUT = path.join(__dirname, 'templates-adapted');
const REPORT_PATH = path.join(__dirname, 'migration-report.md');

const SHOP_NAME = config.BRAND_NAME;
const SHOP_URL = `https://${config.STORE.replace(/\.myshopify\.com$/, '.myshopify.com')}/`;

// ------------------------------------------------------------
// Variables Klaviyo standard → Liquid Shopify Email
// (Liste de paires [regex, remplacement])
// ------------------------------------------------------------
const DEFAULT_VAR_MAP = [
  [/\{\{\s*person\.first_name\s*(\|[^}]*)?\s*\}\}/g, '{{ customer.first_name }}'],
  [/\{\{\s*first_name\s*(\|[^}]*)?\s*\}\}/g,         '{{ customer.first_name }}'],
  [/\{\{\s*person\.last_name\s*(\|[^}]*)?\s*\}\}/g,  '{{ customer.last_name }}'],
  [/\{\{\s*last_name\s*(\|[^}]*)?\s*\}\}/g,          '{{ customer.last_name }}'],
  [/\{\{\s*person\.email\s*\}\}/g,                   '{{ customer.email }}'],
  [/\{\{\s*email\s*\}\}/g,                           '{{ customer.email }}'],
  [/\{\{\s*organization\.name\s*\}\}/g,              SHOP_NAME],
  [/\{\{\s*organization\.url\s*\}\}/g,               SHOP_URL],
  [/\{\{\s*unsubscribe_url\s*\}\}/g,                 '{{ unsubscribe_link }}'],
  [/\{%\s*unsubscribe\s*%\}/g,                       '{{ unsubscribe_link }}'],
];

// Variables qui n'ont PAS d'équivalent natif → annotées en commentaire HTML
const NON_MAPPABLE_PATTERNS = [
  /\{\{\s*event\.[^}]+\}\}/g,
  /\{\{\s*item\.[^}]+\}\}/g,
  /\{\{\s*feeds\.[^}]+\}\}/g,
  /\{\{\s*person\s*\|\s*lookup[^}]+\}\}/g,
  /\{%\s*coupon_code[^%]+%\}/g,
  /\{\{\s*coupon_code\s*\}\}/g,
  /\{%\s*currency_format[^%]+%\}/g,
];

const LOOP_PATTERNS = [
  /\{%\s*for\s+[^%]+%\}/g,
  /\{%\s*if\s+(event|feeds|item|person\s*\|\s*lookup)[^%]+%\}/g,
];

// ============================================================
// Étapes de transformation
// ============================================================
function stripExportHeader(html) {
  return html.replace(/^\s*<!--[\s\S]*?Exporté\s*:[\s\S]*?-->\s*/i, '');
}

function stripScripts(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

function stripKlaviyoTracking(html) {
  return html
    .replace(/<img\b[^>]*\bsrc\s*=\s*["'][^"']*klaviyo\.com[^"']*["'][^>]*\/?>/gi, '')
    .replace(/@import\s+url\([^)]*klaviyo\.com[^)]*\)\s*;?/gi, '')
    .replace(/href\s*=\s*"https?:\/\/(?:trk\.klaviyomail\.com|email\.klaviyomail\.com|[^"]*klaviyo\.com\/_track)[^"]*"/gi, 'href="#"')
    .replace(/href\s*=\s*"https?:\/\/(?:www\.)?klaviyo\.com[^"]*"/gi, 'href="#" data-removed="klaviyo"')
    .replace(/<!--\s*TRACKING_PIXEL_(?:TOP|BOTTOM)\s*-->/gi, '');
}

function stripKlaviyoTags(html) {
  return html.replace(/<\/?klaviyo:[^>]+>/gi, '');
}

function stripOutlookConditionals(html) {
  return html
    .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/g, '')
    .replace(/<!--\[if[^\]]*\]><!-->/g, '')
    .replace(/<!--<!\[endif\]-->/g, '');
}

function fixKlaviyoFilters(html) {
  return html
    .replace(/\{\{\s*([^}]*?)\|\s*lookup\s*:[^}]*?(\|\s*default\s*:\s*["']([^"']+)["'])?\s*\}\}/g, (_m, _e, _g, def) => def || '')
    .replace(/\s*\|\s*floatformat\s*:\s*\d+/g, '')
    .replace(/\|\s*striptags\b/g, ' | strip_html')
    .replace(/\|\s*capfirst\b/g, ' | capitalize')
    .replace(/\s*\|\s*trim_slash\b/g, '')
    .replace(/\s*\|\s*missing_product_image\b/g, '');
}

function rewriteCurrencyFormat(html) {
  return html.replace(/\{%\s*currency_format\s+([^%]+?)\s*%\}/g, (_m, expr) => `{{ ${expr.trim()} | money }}`);
}

function annotateLoops(html) {
  let out = html;
  for (const re of LOOP_PATTERNS) {
    out = out.replace(re, m => `${m}<!-- KL: à adapter -->`);
  }
  return out;
}

function annotateNonMappable(html) {
  let out = html;
  for (const re of NON_MAPPABLE_PATTERNS) {
    out = out.replace(re, m => `${m}<!-- KL -->`);
  }
  return out;
}

function applyVarMap(html, varMap) {
  let out = html;
  for (const [re, repl] of varMap) out = out.replace(re, repl);
  return out;
}

// ------------------------------------------------------------
// CSS inlining (sélecteurs simples : .class, #id, tag)
// ------------------------------------------------------------
function parseSimpleSelector(sel) {
  const t = sel.trim();
  if (!t || /[\s,>+~]/.test(t)) return null;
  if (/[:[*]/.test(t)) return null;
  if (/^\.[a-zA-Z_][\w-]*$/.test(t)) return { kind: 'class', value: t.slice(1) };
  if (/^#[a-zA-Z_][\w-]*$/.test(t)) return { kind: 'id', value: t.slice(1) };
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(t)) return { kind: 'tag', value: t.toLowerCase() };
  return null;
}

function compactDecls(decls) {
  return decls.split(/;+/).map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+/g, ' ')).join('; ');
}

function mergeStyle(existing, additions) {
  const cur = (existing || '').trim().replace(/;\s*$/, '');
  if (!additions.trim()) return cur;
  if (!cur) return additions;
  return cur + '; ' + additions;
}

function inlineRule(html, sel, decls) {
  const inline = compactDecls(decls);
  if (!inline) return { html, applied: 0 };
  let applied = 0;
  let updated = html;
  const apply = (re) => {
    updated = updated.replace(re, (_m, head, end) => {
      applied++;
      const sm = head.match(/\bstyle\s*=\s*"([^"]*)"/);
      if (sm) return head.replace(/\bstyle\s*=\s*"[^"]*"/, `style="${mergeStyle(sm[1], inline)}"`) + end;
      return head + ` style="${inline}"` + end;
    });
  };
  if (sel.kind === 'class') apply(new RegExp(`(<[a-zA-Z][^>]*?\\sclass\\s*=\\s*"[^"]*?\\b${sel.value}\\b[^"]*?"[^>]*?)(/?>)`, 'g'));
  else if (sel.kind === 'id') apply(new RegExp(`(<[a-zA-Z][^>]*?\\sid\\s*=\\s*"${sel.value}"[^>]*?)(/?>)`, 'g'));
  else if (sel.kind === 'tag') {
    updated = updated.replace(new RegExp(`(<${sel.value}\\b)([^>]*?)(/?>)`, 'gi'), (_m, open, attrs, end) => {
      applied++;
      const sm = attrs.match(/\bstyle\s*=\s*"([^"]*)"/);
      if (sm) return open + attrs.replace(/\bstyle\s*=\s*"[^"]*"/, `style="${mergeStyle(sm[1], inline)}"`) + end;
      return open + attrs + ` style="${inline}"` + end;
    });
  }
  return { html: updated, applied };
}

function inlineCss(html) {
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks = [];
  let m;
  while ((m = styleRe.exec(html)) !== null) {
    blocks.push({ full: m[0], body: m[1] });
  }
  if (!blocks.length) return html;
  let working = html;
  for (const block of blocks) {
    let body = block.body;
    const residual = [];
    const atRules = [];
    body = body.replace(/@(media|keyframes|font-face|supports)[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/g, m => { atRules.push(m); return ''; });
    let rm;
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    while ((rm = ruleRe.exec(body)) !== null) {
      const selectorList = rm[1].trim();
      const decls = rm[2];
      if (!selectorList || !decls.trim()) continue;
      for (const sel of selectorList.split(',').map(s => s.trim()).filter(Boolean)) {
        const parsed = parseSimpleSelector(sel);
        if (!parsed) { residual.push(`${sel} { ${compactDecls(decls)} }`); continue; }
        const r = inlineRule(working, parsed, decls);
        working = r.html;
        if (r.applied === 0) residual.push(`${sel} { ${compactDecls(decls)} }`);
      }
    }
    const kept = [];
    if (atRules.length) kept.push(atRules.join('\n'));
    if (residual.length) kept.push(residual.join('\n'));
    working = working.replace(block.full, kept.length ? `<style>\n${kept.join('\n')}\n</style>` : '');
  }
  return working;
}

function extractBody(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let inner = m ? m[1] : html;
  inner = inner
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')
    .replace(/<!--\[if[^\]]*\]>/g, '')
    .replace(/<!--<!\[endif\]-->/g, '')
    .replace(/<!\[endif\]-->/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta\b[^>]*\/?>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?head\b[^>]*>/gi, '')
    .replace(/<\/?body\b[^>]*>/gi, '');
  return inner;
}

function wrap600px(html) {
  if (/^\s*(?:<style[\s\S]*?<\/style>\s*)*<(?:div|table)[^>]*max-width:\s*600px/i.test(html)) return html;
  return `<div style="max-width:600px;margin:0 auto;">\n${html}\n</div>`;
}

function minify(html) {
  const ph = [];
  let out = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, m => { ph.push(m); return `__PH_${ph.length - 1}__`; });
  out = out.replace(/[ \t]+/g, ' ').replace(/(?:\r?\n\s*){2,}/g, '\n').replace(/^[ \t]+/gm, '').replace(/[ \t]+$/gm, '').replace(/>\s+</g, '><');
  return out.replace(/__PH_(\d+)__/g, (_m, i) => ph[parseInt(i, 10)]);
}

// ============================================================
// Pipeline complet pour un fichier
// ============================================================
function adaptOne(srcPath, dstPath, varMap) {
  const before = fs.readFileSync(srcPath, 'utf8');
  let h = before;
  h = stripExportHeader(h);
  h = stripScripts(h);
  h = stripKlaviyoTracking(h);
  h = stripKlaviyoTags(h);
  h = stripOutlookConditionals(h);
  h = inlineCss(h);
  h = applyVarMap(h, varMap);
  h = fixKlaviyoFilters(h);
  h = rewriteCurrencyFormat(h);
  h = annotateLoops(h);
  h = annotateNonMappable(h);
  h = extractBody(h);
  h = wrap600px(h);
  h = minify(h);
  fs.writeFileSync(dstPath, h, 'utf8');
  return { sizeBefore: before.length, sizeAfter: h.length };
}

// ============================================================
// MAIN
// ============================================================
function main() {
  const src = getFlag('src', DEFAULT_SRC);
  const out = getFlag('out', DEFAULT_OUT);
  const mappingFile = getFlag('mapping');
  if (!fs.existsSync(src)) {
    console.error(`❌  Dossier source introuvable : ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(out, { recursive: true });

  const varMap = [...DEFAULT_VAR_MAP];
  if (mappingFile) {
    const extra = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    for (const { pattern, replacement, flags } of extra) {
      varMap.push([new RegExp(pattern, flags || 'g'), replacement]);
    }
    console.log(`+${extra.length} substitutions custom depuis ${path.basename(mappingFile)}`);
  }

  console.log(`\n━━━ adapt-templates ━━━`);
  console.log(`  Source : ${src}`);
  console.log(`  Sortie : ${out}\n`);

  const files = fs.readdirSync(src).filter(f => /\.html?$/i.test(f));
  if (!files.length) { console.log('  Aucun template HTML trouvé.'); return; }

  const results = [];
  for (const f of files) {
    const r = adaptOne(path.join(src, f), path.join(out, f), varMap);
    const ok = r.sizeAfter <= 50 * 1024;
    console.log(`  ${ok ? '✅' : '⚠️'} ${f} — ${(r.sizeAfter / 1024).toFixed(1)} ko (${r.sizeBefore} → ${r.sizeAfter})`);
    results.push({ file: f, ...r, ok });
  }

  // Rapport synthétique
  const md = [
    '# Rapport de migration des templates',
    `**Date** : ${new Date().toISOString()}`,
    `**Source** : ${src}`,
    `**Sortie** : ${out}`,
    `**Limite Shopify Email** : 50 ko par template`,
    '',
    '| Fichier | Taille avant | Taille après | OK |',
    '|---|---:|---:|:---:|',
    ...results.map(r => `| ${r.file} | ${(r.sizeBefore / 1024).toFixed(1)} ko | ${(r.sizeAfter / 1024).toFixed(1)} ko | ${r.ok ? '✅' : '⚠️'} |`),
    '',
    '## Étapes suivantes',
    '- Coller chaque template dans l\'éditeur HTML de Shopify Email',
    '- Vérifier visuellement, envoyer un email de test',
    '- Adapter manuellement les variables annotées `<!-- KL -->` (variables Klaviyo non mappables)',
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`\n  ✓ Rapport : ${REPORT_PATH}`);
}

main();
