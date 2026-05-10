'use strict';

// ============================================================
// lib/config.js — Configuration centrale du toolkit Shopify
// ------------------------------------------------------------
// Lit .env à la racine du repo et expose toutes les valeurs
// spécifiques à une boutique (store, marque, vocabulaire,
// livraison, seuils, modèles Gemini, délais, chemins).
// Tous les scripts en dépendent pour pouvoir tourner sur
// n'importe quelle boutique sans modification de code.
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

// ----- Helpers de lecture -----
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

// ----- Boutique -----
const STORE = process.env.SHOPIFY_STORE;
if (!STORE) {
  throw new Error('lib/config: SHOPIFY_STORE manquant. Copier .env.example vers .env et le remplir.');
}

const BRAND_NAME = envOr('SHOP_BRAND_NAME', 'Boutique');
const BRAND_DESCRIPTION = envOr(
  'SHOP_BRAND_DESCRIPTION',
  `Boutique e-commerce ${BRAND_NAME}.`
);

// Vocabulaire spécifique à la marque/niche.
// Vide par défaut → règle « terme culturel présent » désactivée.
const BRAND_VOCABULARY = envList('SHOP_BRAND_VOCABULARY');

// Bloc HTML livraison — placé EN DÉBUT de chaque description.
const LIVRAISON_BLOCK = envOr(
  'SHOP_LIVRAISON_HTML',
  '<p>📦 <strong>Livraison rapide</strong>. Expédition soignée depuis notre entrepôt.</p>'
);

// Regex de détection : si une description contient l'un de ces mots,
// elle est considérée comme ayant déjà une mention livraison.
const LIVRAISON_DETECT_RE = /(livraison|délai|expédition|shipping|delivery)/i;

// ----- Seuils contenu -----
const DESC_MIN_WORDS = envInt('SHOP_DESC_MIN_WORDS', 150);
const DESC_TARGET_WORDS = envInt('SHOP_DESC_TARGET_WORDS', 200);

// ----- Seuils SEO -----
const SEO_TITLE_MIN = envInt('SHOP_SEO_TITLE_MIN', 30);
const SEO_TITLE_MAX = envInt('SHOP_SEO_TITLE_MAX', 70);
const SEO_DESC_MIN = envInt('SHOP_SEO_DESC_MIN', 50);
const SEO_DESC_MAX = envInt('SHOP_SEO_DESC_MAX', 160);
const IMAGE_MIN = envInt('SHOP_IMAGE_MIN', 3);

// ----- Modèles Gemini -----
const GEMINI_API_KEY = envOr('GEMINI_API_KEY', '');
const GEMINI_MODEL = envOr('GEMINI_MODEL', 'gemini-3.1-flash-image-preview');
const GEMINI_TEXT_MODEL = envOr('GEMINI_TEXT_MODEL', 'gemini-3.1-flash-lite-preview');
const GEMINI_VISION_MODEL = envOr('GEMINI_VISION_MODEL', 'gemini-3.1-flash-lite-preview');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ----- Klaviyo -----
const KLAVIYO_API_KEY = envOr('KLAVIYO_API_KEY', '');

// ----- Délais & retries -----
const DELAY_GEMINI = envInt('SHOP_DELAY_GEMINI_MS', 6500);
const DELAY_SHOPIFY = envInt('SHOP_DELAY_SHOPIFY_MS', 500);
const MAX_RETRIES = envInt('SHOP_MAX_RETRIES', 3);

// ----- Chemins (absolus, ancrés sur la racine du repo) -----
const WORKSPACE = ROOT;
const TMP_DIR = path.join(WORKSPACE, '.audit-tmp');
const GEN_DIR = path.join(WORKSPACE, 'generated-images');
const STORE_DATA_DIR = path.join(WORKSPACE, 'store-data');
const ENV_PATH = path.join(WORKSPACE, '.env');

// ----- Vocabulaire helpers -----
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const BRAND_VOCAB_RE = BRAND_VOCABULARY.length
  ? new RegExp('(' + BRAND_VOCABULARY.map(escapeRegex).join('|') + ')', 'i')
  : /.|^/;

module.exports = {
  // Boutique
  STORE,
  BRAND_NAME,
  BRAND_DESCRIPTION,
  BRAND_VOCABULARY,
  BRAND_VOCAB_RE,
  // Livraison
  LIVRAISON_BLOCK,
  LIVRAISON_DETECT_RE,
  // Seuils
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
  // Délais
  DELAY_GEMINI,
  DELAY_SHOPIFY,
  MAX_RETRIES,
  // Chemins
  WORKSPACE,
  TMP_DIR,
  GEN_DIR,
  STORE_DATA_DIR,
  ENV_PATH,
  // Helpers
  loadEnv,
};
