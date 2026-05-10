'use strict';

// ============================================================
// lib/gemini-image.js — Génération/édition d'image via Gemini
// ------------------------------------------------------------
// Modèle utilisé : config.GEMINI_MODEL (Flash Image / Nano Banana)
// Accepte un prompt + 0..N images de référence (base64) et
// retourne une image base64 (jpeg/png).
// ============================================================

const https = require('https');

const config = require('./config');
const { sleep } = require('./cli');

/**
 * @param {string} prompt
 * @param {Array<{base64:string,mimeType:string}>} refImages
 *        — 0..N images de référence (utiles pour preserver un motif,
 *        une forme, ou un produit existant).
 */
function callGeminiImage(prompt, refImages = []) {
  if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIza')) {
    return Promise.reject(new Error('GEMINI_API_KEY invalide ou manquante.'));
  }
  const parts = [{ text: prompt }];
  for (const img of refImages) {
    if (img && img.base64 && img.mimeType) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.GEMINI_BASE}/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 120000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 429 || res.statusCode === 503) {
          const err = new Error(`Gemini Image ${res.statusCode}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Gemini Image ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
        try {
          const json = JSON.parse(raw);
          const partsOut = json.candidates?.[0]?.content?.parts || [];
          const imgPart = partsOut.find(p => p.inlineData?.mimeType?.startsWith('image/'));
          if (!imgPart) {
            return reject(new Error("Pas d'image dans la réponse Gemini Image"));
          }
          resolve({
            base64: imgPart.inlineData.data,
            mimeType: imgPart.inlineData.mimeType,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Gemini Image timeout (120s)')));
    req.write(body);
    req.end();
  });
}

async function callGeminiImageWithRetry(prompt, refImages = [], opts = {}) {
  const max = opts.retries ?? config.MAX_RETRIES;
  let lastErr;
  for (let i = 0; i < max; i++) {
    try { return await callGeminiImage(prompt, refImages); }
    catch (e) {
      lastErr = e;
      if (e.statusCode === 429 || e.statusCode === 503) {
        console.log(`  [${e.statusCode}] attente 60s (tentative ${i + 1}/${max})...`);
        await sleep(60000);
      } else if (i < max - 1) {
        await sleep(2000);
      }
    }
  }
  throw lastErr;
}

module.exports = { callGeminiImage, callGeminiImageWithRetry };
