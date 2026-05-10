'use strict';

// ============================================================
// lib/gemini-text.js — Génération de texte via Gemini Flash Lite
// ------------------------------------------------------------
// Modèle utilisé : config.GEMINI_TEXT_MODEL
// Retry automatique sur 429/503 (attente 60s) et autres erreurs (2s).
// ============================================================

const https = require('https');

const config = require('./config');
const { sleep } = require('./cli');

function callGeminiText(prompt, opts = {}) {
  if (!config.GEMINI_API_KEY || !config.GEMINI_API_KEY.startsWith('AIza')) {
    return Promise.reject(new Error('GEMINI_API_KEY invalide ou manquante (doit commencer par AIza).'));
  }
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 1200,
    },
  });
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.GEMINI_BASE}/${config.GEMINI_TEXT_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`);
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
          const err = new Error(`Gemini Text ${res.statusCode}: ${raw.slice(0, 200)}`);
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
    req.on('timeout', () => req.destroy(new Error('Gemini Text timeout (60s)')));
    req.write(body);
    req.end();
  });
}

async function callGeminiTextWithRetry(prompt, opts = {}) {
  const max = opts.retries ?? config.MAX_RETRIES;
  let lastErr;
  for (let i = 0; i < max; i++) {
    try { return await callGeminiText(prompt, opts); }
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

module.exports = { callGeminiText, callGeminiTextWithRetry };
