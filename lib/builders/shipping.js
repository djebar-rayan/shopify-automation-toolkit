'use strict';

// ============================================================
// lib/builders/shipping.js — HTML "shipping" block
// ------------------------------------------------------------
// Business rule: SHOP_SHIPPING_HTML must always open the product
// description (not appear at the end). This module provides:
//   - hasShipping(html)
//   - injectShipping(html)        prepends the block if missing
//   - repositionShipping(html)    moves the block to the start if elsewhere
// ============================================================

const config = require('../config');

function hasShipping(html) {
  if (!html) return false;
  return config.SHIPPING_DETECT_RE.test(html);
}

function startsWithShipping(html) {
  if (!html) return false;
  // We consider the description starts with shipping when the regex matches
  // within the first 200 characters.
  return config.SHIPPING_DETECT_RE.test(String(html).slice(0, 200));
}

/** Prepends the shipping block if no shipping mention is found. */
function injectShipping(html) {
  if (hasShipping(html)) return html;
  const cleaned = (html || '').trim();
  return config.SHIPPING_BLOCK + (cleaned ? '\n' + cleaned : '');
}

/** When the description mentions shipping somewhere other than the start,
 *  remove the <p>...</p> blocks containing the regex and prefix with the
 *  canonical block. */
function repositionShipping(html) {
  if (!html) return config.SHIPPING_BLOCK;
  if (startsWithShipping(html)) return html;
  // Remove every <p>…shipping…</p> from the body
  const cleaned = String(html).replace(
    /<p[^>]*>[^<]*(?:<[^>]*>[^<]*)*<\/p>/gi,
    (block) => (config.SHIPPING_DETECT_RE.test(block) ? '' : block)
  ).trim();
  return config.SHIPPING_BLOCK + (cleaned ? '\n' + cleaned : '');
}

module.exports = {
  hasShipping,
  startsWithShipping,
  injectShipping,
  repositionShipping,
};
