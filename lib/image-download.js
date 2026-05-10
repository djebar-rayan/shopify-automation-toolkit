'use strict';

// ============================================================
// lib/image-download.js — Télécharge une image distante en base64
// ------------------------------------------------------------
// Suit jusqu'à 5 redirections HTTP. Retourne base64, mimeType
// et buffer brut (pour usage local ou base64 vers Gemini).
// ============================================================

const https = require('https');

function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const get = (u, hops = 0) => {
      if (hops > 5) return reject(new Error('Too many redirects'));
      https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location, hops + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const mimeType = (res.headers['content-type'] || 'image/jpeg').split(';')[0];
          resolve({
            base64: buf.toString('base64'),
            mimeType,
            buffer: buf,
          });
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

module.exports = { downloadImageAsBase64 };
