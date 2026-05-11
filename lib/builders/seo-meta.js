'use strict';

// ============================================================
// lib/builders/seo-meta.js — SEO formulas (title / description / alt)
// ------------------------------------------------------------
// All formulas are:
//   - parameterized through lib/config (BRAND_NAME, BRAND_VOCABULARY,
//     thresholds)
//   - network-free
//   - unit-testable
// ============================================================

const config = require('../config');
const { stripHtml } = require('../text');

const NICHE_SUFFIX = config.BRAND_VOCABULARY.slice(0, 2).join(' ');
const ALT_MAX = 512;

const STOPWORDS = /^(for|with|by|in|the|a|an|and|or|of|to|from|on|at|is|are)$/i;

/** Up to 3 significant words, removing common stopwords. */
function extractKeyword(title) {
  return (title || '')
    .split(/[\s\-—|]+/)
    .filter(w => w.length > 2 && !STOPWORDS.test(w))
    .slice(0, 3)
    .join(' ');
}

/** Detect a generic product type from title / Shopify productType. */
function detectProductType(title, productType) {
  const t = ((title || '') + ' ' + (productType || '')).toLowerCase();
  if (/t-?shirt|tshirt/.test(t)) return 'T-shirt';
  if (/sweat|hoodie/.test(t)) return 'Sweatshirt';
  if (/pullover|sweater|pull\b/.test(t)) return 'Sweater';
  if (/case|cover|coque/.test(t)) return 'Case';
  if (/cap|hat|beanie/.test(t)) return 'Cap';
  if (/mug/.test(t)) return 'Mug';
  if (/poster|print|affiche/.test(t)) return 'Poster';
  if (/cushion|pillow|coussin/.test(t)) return 'Cushion';
  if (/bag|sac/.test(t)) return 'Bag';
  if (/book|livre/.test(t)) return 'Book';
  if (/bodysuit|onesie/.test(t)) return 'Bodysuit';
  if (/crop top/.test(t)) return 'Crop Top';
  if (/game|jeu/.test(t)) return 'Game';
  return productType || 'Product';
}

/** Concatenates left + right while removing the duplicate of the first word.
 *  Example: joinUniq('T-shirt', 'T-shirt motif') → 'T-shirt motif' */
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

/** Meta description ≤ SEO_DESC_MAX chars, with simple benefit detection. */
function generateMetaDescription(product) {
  const keyword = extractKeyword(product.title);
  const type = detectProductType(product.title, product.productType);
  const brand = config.BRAND_NAME;
  const plain = stripHtml(product.descriptionHtml);
  const tags = (product.tags || []).map(t => t.toLowerCase()).join(' ');
  const haystack = plain.toLowerCase() + ' ' + tags;

  const benefits = [];
  if (/handmade|handcrafted|artisan/.test(haystack)) benefits.push('handcrafted');
  if (/organic|organic cotton/.test(haystack)) benefits.push('organic cotton');
  if (/made in [a-z]+/.test(haystack)) {
    const mif = haystack.match(/made in [a-z]+/);
    benefits.push(mif ? mif[0].replace(/\b\w/g, c => c.toUpperCase()) : 'made locally');
  }
  const benefitStr = benefits.length ? benefits.join(', ') + '. ' : '';

  const ctaPool = ['Discover', 'Shop', 'Available at', 'Fast shipping at'];
  const cta = ctaPool[(product.id || '').length % ctaPool.length];
  const headlineKeyword = joinUniq(type, keyword);
  const nicheTag = NICHE_SUFFIX ? ` ${NICHE_SUFFIX}` : '';

  const candidates = [
    `${headlineKeyword}${nicheTag}. ${benefitStr}${cta} ${brand}.`,
    `${keyword} authentic. ${benefitStr}${cta} ${brand}.`,
    `${headlineKeyword} — premium. ${benefitStr}${cta} ${brand}.`,
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

/** Alt text of one media — varies by index to avoid duplicates. */
function generateAltText(product, mediaIndex) {
  const keyword = extractKeyword(product.title);
  const type = detectProductType(product.title, product.productType);
  const brand = config.BRAND_NAME;
  const nicheTag = NICHE_SUFFIX ? ` ${NICHE_SUFFIX}` : '';
  let alt;
  if (mediaIndex === 0) alt = `${joinUniq(type, keyword)}${nicheTag} — ${brand}`;
  else if (mediaIndex === 1) alt = `${keyword}${nicheTag} detail | ${brand}`;
  else alt = `${product.title} view ${mediaIndex + 1} — ${brand}`;
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
