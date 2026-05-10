'use strict';

// ============================================================
// lib/image-upload.js — Upload d'image vers Shopify
// ------------------------------------------------------------
// Pipeline complet :
//   1. stagedUploadsCreate → resourceUrl + parameters + url
//   2. multipartPost → upload binaire vers le bucket de staging
//   3. productCreateMedia → attache la resourceUrl au produit
//
// IMPORTANT : utiliser resource: 'PRODUCT_IMAGE' (pas 'IMAGE').
// ============================================================

const fs = require('fs');
const https = require('https');

const { execMutation } = require('./shopify-graphql');

/** Étape 2 : POST multipart/form-data vers le bucket de staging. */
function multipartPost(uploadUrl, params, filename, mimeType, fileBuffer) {
  const boundary = '----WFBoundary' + Date.now().toString(16);
  const partsHeader = params.map(({ name, value }) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  );
  const body = Buffer.concat([
    Buffer.from(partsHeader.join(''), 'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8'),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);
  const parsed = new URL(uploadUrl);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Staging upload HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
        } else {
          resolve();
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Étape 1 + 2 combinées : staged upload → résourceUrl utilisable par productCreateMedia. */
async function stagedUploadFromFile(localPath, mimeType, filename) {
  const stageRes = execMutation(`
    mutation StagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `, { input: [{ resource: 'PRODUCT_IMAGE', filename, mimeType, httpMethod: 'POST' }] });

  const target = stageRes?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    throw new Error('stagedUploadsCreate échoué : ' + JSON.stringify(stageRes));
  }
  await multipartPost(target.url, target.parameters, filename, mimeType, fs.readFileSync(localPath));
  return target.resourceUrl;
}

/** Étape 3 : attache une resourceUrl à un produit via productCreateMedia. */
function attachMedia(productId, resourceUrl, altText) {
  return execMutation(`
    mutation CreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id alt mediaContentType status }
        mediaUserErrors { field message }
      }
    }
  `, {
    productId,
    media: [{ originalSource: resourceUrl, alt: altText, mediaContentType: 'IMAGE' }],
  });
}

/** Lie une variante à une media déjà attachée au produit. */
function linkVariantToMedia(productId, variantId, mediaId) {
  return execMutation(`
    mutation LinkVariantMedia($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id }
        userErrors { field message }
      }
    }
  `, {
    productId,
    variants: [{ id: variantId, mediaId }],
  });
}

/** Supprime des médias d'un produit (irréversible). */
function deleteMedia(productId, mediaIds) {
  return execMutation(`
    mutation DeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
      productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
        deletedMediaIds
        mediaUserErrors { field message }
      }
    }
  `, { productId, mediaIds });
}

module.exports = {
  multipartPost,
  stagedUploadFromFile,
  attachMedia,
  linkVariantToMedia,
  deleteMedia,
};
