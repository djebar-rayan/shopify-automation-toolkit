# Audit — Products with fewer than 3 images

**Script used**: `audit/audit.js`
**Reference files read**: `store-data/products.md`

## Target

- **Scope**: products
- **Filter**: status ACTIVE, images < 3
- **Entities affected**: 0 (recomputed by the script)

## Action

- **Type**: audit
- **Field**: —
- **Value**: —

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [ ] Show planned changes (dry-run) — not applicable
- [ ] Ask confirmation y/N before mutation — not applicable

## Success criteria

- A count of active products with fewer than 3 images is produced
- No Shopify mutation triggered

## Results
