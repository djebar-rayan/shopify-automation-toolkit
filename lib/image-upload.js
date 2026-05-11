'use strict';

// ============================================================
// lib/image-upload.js — Upload an image to Shopify
// ------------------------------------------------------------
// Full pipeline:
//   1. stagedUploadsCreate → resourceUrl + parameters + url
//   2. multipartPost → binary upload to the staging bucket
//   3. productCreateMedia → attach resourceUrl to the product
//
// IMPORTANT: use resource: 'PRODUCT_IMAGE' (NOT 'IMAGE').
// ============================================================

const fs = require('fs');
const https = require('https');

const { execMutation } = require('./shopify-graphql');

/** Step 2: multipart/form-data POST to the staging bucket. */
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

/** Steps 1+2 combined: staged upload → resourceUrl usable by productCreateMedia. */
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
    throw new Error('stagedUploadsCreate failed: ' + JSON.stringify(stageRes));
  }
  await multipartPost(target.url, target.parameters, filename, mimeType, fs.readFileSync(localPath));
  return target.resourceUrl;
}

/** Step 3: attach a resourceUrl to a product via productCreateMedia. */
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

/** Link a variant to a media already attached to the product. */
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

/** Delete media from a product (irreversible). */
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
