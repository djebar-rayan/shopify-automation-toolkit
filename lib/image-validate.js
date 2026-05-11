'use strict';

// ============================================================
// lib/image-validate.js — Validation of a generated image
// ------------------------------------------------------------
// Safety net before upload:
//   - file size ≥ 50 KB
//   - dimensions ≥ 800×800 (when readable from PNG/JPEG)
// ============================================================

const MIN_SIZE_KB = 50;
const MIN_DIM = 800;

function validateGeneratedImage(base64, mimeType) {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < MIN_SIZE_KB * 1024) {
    return {
      valid: false,
      reason: `Too small (${Math.round(buf.length / 1024)} KB < ${MIN_SIZE_KB} KB)`,
    };
  }
  let w = 0, h = 0;
  if (mimeType.includes('png') && buf.length > 24) {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    for (let i = 0; i < buf.length - 9; i++) {
      if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
        h = buf.readUInt16BE(i + 5);
        w = buf.readUInt16BE(i + 7);
        break;
      }
    }
  }
  if (w > 0 && h > 0 && (w < MIN_DIM || h < MIN_DIM)) {
    return { valid: false, reason: `Resolution too low (${w}×${h})` };
  }
  return { valid: true, width: w, height: h, sizeKB: Math.round(buf.length / 1024) };
}

module.exports = { validateGeneratedImage };
