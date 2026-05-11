# Example — Audit products with fewer than 3 images

**Date**: 2026-01-15
**Script used**: `audit/audit.js`
**Reference files read**: `store-data/products.md`

## Target

- **Scope**: products
- **Filter**: status ACTIVE, images < 3
- **Entities affected**: 0 (recomputed)

## Action

- **Type**: audit
- **Field**: —
- **Value**: —

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [ ] Show planned changes (dry-run) — not applicable for audit
- [ ] Ask confirmation y/N before mutation — not applicable for audit

## Success criteria

- Exhaustive list of active products with fewer than 3 images
- No Shopify mutation triggered
- Lets you plan an `images/image-generate.js` task or a photo shoot

## Results
