'use strict';

// ============================================================
// lib/builders/content-prompts.js — Prompts Gemini Text
// ------------------------------------------------------------
// Construit des prompts paramétrés par marque/niche, à passer
// ensuite à callGeminiText(). Aucune valeur métier hard-codée.
// ============================================================

const config = require('../config');

/** Prompt : description HTML structurée >= DESC_MIN_WORDS mots. */
function buildDescriptionPrompt(product) {
  const tags = (product.tags || []).join(', ');
  const niche = config.BRAND_VOCABULARY.length
    ? `Vocabulaire de la niche à utiliser naturellement : ${config.BRAND_VOCABULARY.slice(0, 4).join(', ')}.`
    : '';
  return [
    `Tu es rédacteur web pour la boutique ${config.BRAND_NAME}.`,
    `Rédige une description HTML structurée pour ce produit.`,
    ``,
    `# Produit`,
    `- Titre : ${product.title || ''}`,
    `- Type : ${product.productType || ''}`,
    `- Vendor : ${product.vendor || ''}`,
    tags ? `- Tags : ${tags}` : '',
    ``,
    `# Contraintes`,
    `- Au moins ${config.DESC_MIN_WORDS} mots, idéalement ~${config.DESC_TARGET_WORDS}.`,
    `- HTML uniquement (h2, p, ul, li, strong, em).`,
    `- Pas de DOCTYPE/html/body, ni Markdown, ni triples backticks.`,
    `- Au moins une liste à puces (caractéristiques).`,
    niche,
    ``,
    `Retourne UNIQUEMENT le HTML.`,
  ].filter(Boolean).join('\n');
}

/** Prompt : description courte de collection (80-120 mots HTML). */
function buildCollectionDescriptionPrompt(collection) {
  return [
    `Tu rédiges une description de collection pour la boutique ${config.BRAND_NAME}.`,
    ``,
    `# Collection`,
    `- Titre : ${collection.title || ''}`,
    collection.handle ? `- Handle : ${collection.handle}` : '',
    ``,
    `# Contraintes`,
    `- 80 à 120 mots.`,
    `- HTML simple : <p>, <strong>, <em>.`,
    `- Pas de Markdown, pas de DOCTYPE.`,
    `- Mentionne brièvement le positionnement de la collection.`,
    ``,
    `Retourne UNIQUEMENT le HTML.`,
  ].filter(Boolean).join('\n');
}

/** Prompt : extraction de tags pertinents depuis un produit (5-8 tags). */
function buildTagsPrompt(product) {
  return [
    `Tu génères des tags Shopify pour le produit ci-dessous.`,
    `# Produit`,
    `- Titre : ${product.title || ''}`,
    `- Type : ${product.productType || ''}`,
    `- Description (texte) : ${(product.description || '').slice(0, 600)}`,
    ``,
    `# Contraintes`,
    `- 5 à 8 tags pertinents.`,
    `- Tags courts (1-3 mots), en minuscules, séparés par virgule.`,
    ``,
    `Retourne UNIQUEMENT la liste, séparée par virgules.`,
  ].join('\n');
}

module.exports = {
  buildDescriptionPrompt,
  buildCollectionDescriptionPrompt,
  buildTagsPrompt,
};
