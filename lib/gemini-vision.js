'use strict';

// ============================================================
// lib/gemini-vision.js — Analyse d'image via Gemini Flash Lite
// ------------------------------------------------------------
// Modèle utilisé : config.GEMINI_VISION_MODEL
// Prend une image base64 + un prompt → retourne du texte
// (souvent JSON si responseMimeType configuré).
// ============================================================

const https = require('https');

const config = require('./config');
const { sleep } = require('./cli');

function callGeminiVision(prompt, imageBase64, mimeType, opts = {}) {
  if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIza')) {
    return Promise.reject(new Error('GEMINI_API_KEY invalide ou manquante.'));
  }
  const body = JSON.stringify({
    contents: [{ parts: [
      { text: prompt },
      { inlineData: { mimeType, data: imageBase64 } },
    ] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxTokens ?? 400,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.GEMINI_BASE}/${config.GEMINI_VISION_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 60000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          const err = new Error(`Gemini Vision ${res.statusCode}: ${raw.slice(0, 200)}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          const json = JSON.parse(raw);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Gemini Vision timeout (60s)')));
    req.write(body);
    req.end();
  });
}

async function callGeminiVisionWithRetry(prompt, imageBase64, mimeType, opts = {}) {
  const max = opts.retries ?? config.MAX_RETRIES;
  let lastErr;
  for (let i = 0; i < max; i++) {
    try { return await callGeminiVision(prompt, imageBase64, mimeType, opts); }
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

module.exports = { callGeminiVision, callGeminiVisionWithRetry };
