'use strict';

// ============================================================
// lib/builders/seo-meta.js — Formules SEO (titre / description / alt)
// ------------------------------------------------------------
// Toutes les formules sont :
//   - paramétrées via lib/config (BRAND_NAME, BRAND_VOCABULARY, seuils)
//   - sans dépendance réseau
//   - testables unitairement
// ============================================================

const config = require('../config');
const { stripHtml } = require('../text');

const NICHE_SUFFIX = config.BRAND_VOCABULARY.slice(0, 2).join(' ');
const ALT_MAX = 512;

/** 3 mots significatifs max, sans stopwords français usuels. */
function extractKeyword(title) {
  return (title || '')
    .split(/[\s\-—|]+/)
    .filter(w => w.length > 2 && !/^(pour|avec|par|en|le|la|les|de|du|des)$/i.test(w))
    .slice(0, 3)
    .join(' ');
}

/** Détecte un type de produit générique depuis le titre / productType Shopify. */
function detectProductType(title, productType) {
  const t = ((title || '') + ' ' + (productType || '')).toLowerCase();
  if (/t-?shirt|tshirt/.test(t)) return 'T-shirt';
  if (/sweat|hoodie|capuche/.test(t)) return 'Sweat';
  if (/pull|pullover/.test(t)) return 'Pull';
  if (/coque/.test(t)) return 'Coque';
  if (/casquette|bonnet|bob\b/.test(t)) return 'Casquette';
  if (/mug/.test(t)) return 'Mug';
  if (/affiche|poster/.test(t)) return 'Affiche';
  if (/coussin|housse/.test(t)) return 'Coussin';
  if (/sac/.test(t)) return 'Sac';
  if (/livre/.test(t)) return 'Livre';
  if (/bod[ye]/.test(t)) return 'Body';
  if (/crop top/.test(t)) return 'Crop Top';
  if (/jeu/.test(t)) return 'Jeu';
  return productType || 'Produit';
}

/** Concatène left+right en supprimant le doublon du 1er mot.
 *  Ex: joinUniq('T-shirt', 'T-shirt motif') → 'T-shirt motif' */
function joinUniq(left, right) {
  if (!left) return right;
  if (!right) return left;
  const re = new RegExp('^' + left.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
  return left + ' ' + right.replace(re, '');
}

/** Meta title ≤ SEO_TITLE_MAX chars. */
function generateMetaTitle(product) {
  const keyword = extractKeyword(product.title);
  const type = detectProductType(product.title, product.productType);
  const brand = config.BRAND_NAME;
  const candidates = [
    `${joinUniq(type, keyword)} | ${brand}`,
    `${keyword} | ${brand}`,
    NICHE_SUFFIX ? `${keyword} ${NICHE_SUFFIX} | ${brand}` : null,
  ].filter(Boolean).map(c => c.replace(/\s+/g, ' ').trim());
  let chosen = candidates.find(c => c.length >= config.SEO_TITLE_MIN && c.length <= config.SEO_TITLE_MAX);
  if (!chosen) {
    chosen = candidates[0];
    if (chosen.length > config.SEO_TITLE_MAX) {
      chosen = chosen.substring(0, config.SEO_TITLE_MAX - 1).replace(/\s+\S*$/, '') + '…';
    }
  }
  return chosen;
}

/** Meta description ≤ SEO_DESC_MAX chars, avec détection bénéfices simples. */
function generateMetaDescription(product) {
  const keyword = extractKeyword(product.title);
  const type = detectProductType(product.title, product.productType);
  const brand = config.BRAND_NAME;
  const plain = stripHtml(product.descriptionHtml);
  const tags = (product.tags || []).map(t => t.toLowerCase()).join(' ');
  const haystack = plain.toLowerCase() + ' ' + tags;

  const benefits = [];
  if (/artisanal|fait main|brodé|brode/.test(haystack)) benefits.push('artisanal');
  if (/bio|coton bio|organic/.test(haystack)) benefits.push('coton bio');
  if (/made in france|imprimé en france|fabriqué en france/.test(haystack)) benefits.push('Made in France');
  const benefitStr = benefits.length ? benefits.join(', ') + '. ' : '';

  const ctaPool = ['Découvrez', 'Commandez sur', 'Disponible chez', 'Livraison rapide chez'];
  const cta = ctaPool[(product.id || '').length % ctaPool.length];
  const headlineKeyword = joinUniq(type, keyword);
  const nicheTag = NICHE_SUFFIX ? ` ${NICHE_SUFFIX}` : '';

  const candidates = [
    `${headlineKeyword}${nicheTag}. ${benefitStr}${cta} ${brand}.`,
    `${keyword} authentique. ${benefitStr}${cta} ${brand}.`,
    `${headlineKeyword} — qualité. ${benefitStr}${cta} ${brand}.`,
    `${headlineKeyword}. ${cta} ${brand}.`,
  ].map(c => c.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim());

  let chosen = candidates.find(c => c.length >= 80 && c.length <= config.SEO_DESC_MAX);
  if (!chosen) {
    chosen = candidates[candidates.length - 1];
    if (chosen.length > config.SEO_DESC_MAX) {
      chosen = chosen.substring(0, config.SEO_DESC_MAX - 1).replace(/\s+\S*$/, '') + '…';
    }
  }
  return chosen;
}

/** Alt text d'une media — différencié par index pour éviter les doublons. */
function generateAltText(product, mediaIndex) {
  const keyword = extractKeyword(product.title);
  const type = detectProductType(product.title, product.productType);
  const brand = config.BRAND_NAME;
  const nicheTag = NICHE_SUFFIX ? ` ${NICHE_SUFFIX}` : '';
  let alt;
  if (mediaIndex === 0) alt = `${joinUniq(type, keyword)}${nicheTag} — ${brand}`;
  else if (mediaIndex === 1) alt = `Détail ${keyword}${nicheTag} | ${brand}`;
  else alt = `${product.title} vue ${mediaIndex + 1} — ${brand}`;
  return alt.slice(0, ALT_MAX);
}

module.exports = {
  extractKeyword,
  detectProductType,
  joinUniq,
  generateMetaTitle,
  generateMetaDescription,
  generateAltText,
  NICHE_SUFFIX,
  ALT_MAX,
};
