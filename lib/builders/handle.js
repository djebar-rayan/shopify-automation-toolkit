'use strict';

// ============================================================
// lib/builders/handle.js — Product handle normalization
// ------------------------------------------------------------
// Converts any string into a compliant ASCII handle:
//   - transliterates non-Latin scripts via a user-supplied map
//   - decomposes Unicode NFKD (strips Latin diacritics)
//   - kebab-cases it ([a-z0-9-])
//
// Transliteration is FULLY parameterizable:
//   - no default map (Latin diacritics are handled natively by
//     NFKD: é → e, ç → c, à → a, etc.)
//   - for non-Latin alphabets (Cyrillic, Arabic, Hebrew, Tifinagh,
//     Devanagari, …) pass a JSON map via the --map=<file.json>
//     flag of content/handle-normalize.js
//
// Presets can live under `lib/builders/translit-presets/` (one
// JSON file per script). Format: { "ⵜ": "t", "ⴽ": "k", … }.
// ============================================================

const fs = require('fs');
const path = require('path');

const PRESET_DIR = path.join(__dirname, 'translit-presets');

/** Loads a JSON map from lib/builders/translit-presets/<name>.json */
function loadPreset(name) {
  const p = path.join(PRESET_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Applies a transliteration map character by character. */
function translit(s, map) {
  if (!map) return s;
  let out = '';
  for (const ch of s) out += map[ch] !== undefined ? map[ch] : ch;
  return out;
}

/** Returns true when the string contains at least one non-ASCII character. */
function isNonAscii(s) {
  return /[^\x00-\x7F]/.test(s || '');
}

/**
 * Normalizes a handle:
 *   - transliteration via opts.translitMap (optional)
 *   - NFKD decomposition to strip Latin diacritics
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
