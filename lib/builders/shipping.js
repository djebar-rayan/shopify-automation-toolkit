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
  // We consider the description "starts with shipping" when the first
  // <p>...</p> block (or the leading 200 chars if there is no <p>)
  // contains a shipping mention.
  const s = String(html).trimStart();
  const firstBlock = s.match(/^<p[^>]*>[\s\S]*?<\/p>/i);
  const probe = firstBlock ? firstBlock[0] : s.slice(0, 200);
  return config.SHIPPING_DETECT_RE.test(probe);
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
  // Remove every <p>…shipping…</p> from the body (non-greedy match).
  const cleaned = String(html).replace(
    /<p[^>]*>[\s\S]*?<\/p>/gi,
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
