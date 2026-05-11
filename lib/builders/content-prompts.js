'use strict';

// ============================================================
// lib/builders/content-prompts.js — Gemini Text prompts
// ------------------------------------------------------------
// Builds prompts parameterized by brand/niche, ready to be passed
// to callGeminiText(). No business value hard-coded here.
// ============================================================

const config = require('../config');

/** Prompt: HTML structured description ≥ DESC_MIN_WORDS words. */
function buildDescriptionPrompt(product) {
  const tags = (product.tags || []).join(', ');
  const niche = config.BRAND_VOCABULARY.length
    ? `Niche vocabulary to use naturally: ${config.BRAND_VOCABULARY.slice(0, 4).join(', ')}.`
    : '';
  return [
    `You are a web copywriter for the ${config.BRAND_NAME} store.`,
    `Write an HTML structured description for this product.`,
    ``,
    `# Product`,
    `- Title: ${product.title || ''}`,
    `- Type: ${product.productType || ''}`,
    `- Vendor: ${product.vendor || ''}`,
    tags ? `- Tags: ${tags}` : '',
    ``,
    `# Constraints`,
    `- At least ${config.DESC_MIN_WORDS} words, ideally ~${config.DESC_TARGET_WORDS}.`,
    `- HTML only (h2, p, ul, li, strong, em).`,
    `- No DOCTYPE/html/body, no Markdown, no triple backticks.`,
    `- At least one bulleted list (features).`,
    niche,
    ``,
    `Return ONLY the HTML.`,
  ].filter(Boolean).join('\n');
}

/** Prompt: short collection description (80–120 words HTML). */
function buildCollectionDescriptionPrompt(collection) {
  return [
    `You are writing a collection description for the ${config.BRAND_NAME} store.`,
    ``,
    `# Collection`,
    `- Title: ${collection.title || ''}`,
    collection.handle ? `- Handle: ${collection.handle}` : '',
    ``,
    `# Constraints`,
    `- 80 to 120 words.`,
    `- Simple HTML: <p>, <strong>, <em>.`,
    `- No Markdown, no DOCTYPE.`,
    `- Mention the collection's positioning briefly.`,
    ``,
    `Return ONLY the HTML.`,
  ].filter(Boolean).join('\n');
}

/** Prompt: extract relevant tags from a product (5–8 tags). */
function buildTagsPrompt(product) {
  return [
    `You generate Shopify tags for the product below.`,
    `# Product`,
    `- Title: ${product.title || ''}`,
    `- Type: ${product.productType || ''}`,
    `- Description (text): ${(product.description || '').slice(0, 600)}`,
    ``,
    `# Constraints`,
    `- 5 to 8 relevant tags.`,
    `- Short tags (1–3 words), lowercase, comma separated.`,
    ``,
    `Return ONLY the list, comma-separated.`,
  ].join('\n');
}

module.exports = {
  buildDescriptionPrompt,
  buildCollectionDescriptionPrompt,
  buildTagsPrompt,
};
