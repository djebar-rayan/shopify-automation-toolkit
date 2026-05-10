'use strict';

// ============================================================
// lib/builders/livraison.js — Bloc HTML « livraison »
// ------------------------------------------------------------
// Convention métier : SHOP_LIVRAISON_HTML doit toujours ouvrir
// la description produit (pas en fin). Ce module fournit :
//   - hasLivraison(html)
//   - injectLivraison(html)       ajoute le bloc en début si absent
//   - repositionLivraison(html)   déplace le bloc en début s'il est ailleurs
// ============================================================

const config = require('../config');

function hasLivraison(html) {
  if (!html) return false;
  return config.LIVRAISON_DETECT_RE.test(html);
}

function startsWithLivraison(html) {
  if (!html) return false;
  // On considère qu'on commence par livraison si dans les 200 premiers chars.
  return config.LIVRAISON_DETECT_RE.test(String(html).slice(0, 200));
}

/** Ajoute le bloc livraison en tête si non détecté. */
function injectLivraison(html) {
  if (hasLivraison(html)) return html;
  const cleaned = (html || '').trim();
  return config.LIVRAISON_BLOCK + (cleaned ? '\n' + cleaned : '');
}

/** Si la description contient une mention livraison ailleurs qu'au début,
 *  retire les blocs <p>...</p> contenant la regex et préfixe par le bloc canonique. */
function repositionLivraison(html) {
  if (!html) return config.LIVRAISON_BLOCK;
  if (startsWithLivraison(html)) return html;
  // Retire tous les <p>…livraison…</p> du corps
  const cleaned = String(html).replace(
    /<p[^>]*>[^<]*(?:<[^>]*>[^<]*)*<\/p>/gi,
    (block) => (config.LIVRAISON_DETECT_RE.test(block) ? '' : block)
  ).trim();
  return config.LIVRAISON_BLOCK + (cleaned ? '\n' + cleaned : '');
}

module.exports = {
  hasLivraison,
  startsWithLivraison,
  injectLivraison,
  repositionLivraison,
};
