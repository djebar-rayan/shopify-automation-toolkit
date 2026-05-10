'use strict';

// ============================================================
// lib/builders/handle.js — Normalisation d'un handle produit
// ------------------------------------------------------------
// Convertit n'importe quelle chaîne en handle ASCII conforme :
//   - translittération de scripts non-latins via une map fournie
//   - décomposition Unicode NFKD (retire les diacritiques latins)
//   - transformation en kebab-case ([a-z0-9-])
//
// La translittération est ENTIÈREMENT paramétrable :
//   - aucune map par défaut (seuls les diacritiques latins sont gérés
//     nativement par NFKD : é → e, ç → c, à → a, etc.)
//   - pour les alphabets non-latins (cyrillique, arabe, hébreu,
//     tifinagh, devanagari, …) passer une map JSON via le flag
//     --map=<file.json> de content/handle-normalize.js
//
// Des presets peuvent être placés dans `lib/builders/translit-presets/`
// (un fichier JSON par script). Format : { "ⵜ": "t", "ⴽ": "k", … }.
// ============================================================

const fs = require('fs');
const path = require('path');

const PRESET_DIR = path.join(__dirname, 'translit-presets');

/** Charge une map JSON depuis lib/builders/translit-presets/<name>.json */
function loadPreset(name) {
  const p = path.join(PRESET_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Applique une map de translittération caractère par caractère. */
function translit(s, map) {
  if (!map) return s;
  let out = '';
  for (const ch of s) out += map[ch] !== undefined ? map[ch] : ch;
  return out;
}

/** Renvoie true si la chaîne contient au moins un caractère non-ASCII. */
function isNonAscii(s) {
  return /[^\x00-\x7F]/.test(s || '');
}

/**
 * Normalise un handle :
 *   - translittération via opts.translitMap (optionnelle)
 *   - décomposition NFKD pour retirer les diacritiques latins
 *   - kebab-case [a-z0-9-]
 */
function normalizeHandle(input, opts = {}) {
  if (!input) return '';
  let s = String(input);
  if (opts.translitMap) s = translit(s, opts.translitMap);
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

module.exports = {
  loadPreset,
  translit,
  isNonAscii,
  normalizeHandle,
};
