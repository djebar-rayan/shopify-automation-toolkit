'use strict';

// ============================================================
// lib/config.js — Central configuration of the toolkit
// ------------------------------------------------------------
// Loads .env from the repo root and exposes every store-specific
// value (store domain, brand, vocabulary, shipping block, thresholds,
// Gemini models, delays, paths). All other scripts depend on this
// module so they can run against any Shopify store without code change.
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ----- .env loader (idempotent) -----
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}
loadEnv();

// ----- Helpers -----
function envInt(key, def) {
  const v = parseInt(process.env[key] || '', 10);
  return Number.isFinite(v) ? v : def;
}
function envList(key) {
  return (process.env[key] || '').split(',').map(s => s.trim()).filter(Boolean);
}
function envOr(key, def) {
  return process.env[key] && process.env[key].length ? process.env[key] : def;
}

// ----- Store -----
const STORE = process.env.SHOPIFY_STORE;
if (!STORE) {
  throw new Error('lib/config: SHOPIFY_STORE missing. Copy .env.example to .env and fill it in.');
}

const BRAND_NAME = envOr('SHOP_BRAND_NAME', 'Store');
const BRAND_DESCRIPTION = envOr(
  'SHOP_BRAND_DESCRIPTION',
  `E-commerce store ${BRAND_NAME}.`
);

// Brand/niche vocabulary. Empty by default → the "niche term present"
// rule is disabled.
const BRAND_VOCABULARY = envList('SHOP_BRAND_VOCABULARY');

// HTML shipping block — always placed at the START of every product
// description (business rule).
const SHIPPING_BLOCK = envOr(
  'SHOP_SHIPPING_HTML',
  '<p>📦 <strong>Fast shipping</strong>. Carefully packed from our warehouse.</p>'
);

// Detection regex: if a description contains one of these words, it is
// considered to already mention shipping.
const SHIPPING_DETECT_RE = /(shipping|delivery|expédition|livraison|delivery time)/i;

// ----- Content thresholds -----
const DESC_MIN_WORDS = envInt('SHOP_DESC_MIN_WORDS', 150);
const DESC_TARGET_WORDS = envInt('SHOP_DESC_TARGET_WORDS', 200);

// ----- SEO thresholds -----
const SEO_TITLE_MIN = envInt('SHOP_SEO_TITLE_MIN', 30);
const SEO_TITLE_MAX = envInt('SHOP_SEO_TITLE_MAX', 70);
const SEO_DESC_MIN = envInt('SHOP_SEO_DESC_MIN', 50);
const SEO_DESC_MAX = envInt('SHOP_SEO_DESC_MAX', 160);
const IMAGE_MIN = envInt('SHOP_IMAGE_MIN', 3);

// ----- Gemini models -----
const GEMINI_API_KEY = envOr('GEMINI_API_KEY', '');
const GEMINI_MODEL = envOr('GEMINI_MODEL', 'gemini-3.1-flash-image-preview');
const GEMINI_TEXT_MODEL = envOr('GEMINI_TEXT_MODEL', 'gemini-3.1-flash-lite-preview');
const GEMINI_VISION_MODEL = envOr('GEMINI_VISION_MODEL', 'gemini-3.1-flash-lite-preview');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ----- Klaviyo -----
const KLAVIYO_API_KEY = envOr('KLAVIYO_API_KEY', '');

// ----- Delays & retries -----
const DELAY_GEMINI = envInt('SHOP_DELAY_GEMINI_MS', 6500);
const DELAY_SHOPIFY = envInt('SHOP_DELAY_SHOPIFY_MS', 500);
const MAX_RETRIES = envInt('SHOP_MAX_RETRIES', 3);

// ----- Paths (absolute, anchored on the repo root) -----
const WORKSPACE = ROOT;
const TMP_DIR = path.join(WORKSPACE, '.audit-tmp');
const GEN_DIR = path.join(WORKSPACE, 'generated-images');
const STORE_DATA_DIR = path.join(WORKSPACE, 'store-data');
const ENV_PATH = path.join(WORKSPACE, '.env');

// ----- Vocabulary helper -----
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const BRAND_VOCAB_RE = BRAND_VOCABULARY.length
  ? new RegExp('(' + BRAND_VOCABULARY.map(escapeRegex).join('|') + ')', 'i')
  : /.|^/;

module.exports = {
  // Store
  STORE,
  BRAND_NAME,
  BRAND_DESCRIPTION,
  BRAND_VOCABULARY,
  BRAND_VOCAB_RE,
  // Shipping
  SHIPPING_BLOCK,
  SHIPPING_DETECT_RE,
  // Thresholds
  DESC_MIN_WORDS,
  DESC_TARGET_WORDS,
  SEO_TITLE_MIN,
  SEO_TITLE_MAX,
  SEO_DESC_MIN,
  SEO_DESC_MAX,
  IMAGE_MIN,
  // Gemini
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_TEXT_MODEL,
  GEMINI_VISION_MODEL,
  GEMINI_BASE,
  // Klaviyo
  KLAVIYO_API_KEY,
  // Delays
  DELAY_GEMINI,
  DELAY_SHOPIFY,
  MAX_RETRIES,
  // Paths
  WORKSPACE,
  TMP_DIR,
  GEN_DIR,
  STORE_DATA_DIR,
  ENV_PATH,
  // Helpers
  loadEnv,
};
