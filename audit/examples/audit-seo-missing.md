# Audit — Products with missing SEO meta

**Script used**: `audit/audit.js`
**Reference files read**: `store-data/products.md`

## Target

- **Scope**: products
- **Filter**: status ACTIVE, seo_title missing
- **Entities affected**: 0

## Action

- **Type**: audit
- **Field**: —
- **Value**: —

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [ ] Show planned changes (dry-run)
- [ ] Ask confirmation y/N before mutation

## Success criteria

- Exhaustive list of products without an SEO meta title
- Lets you prepare a `seo/seo-update.js` task

## Results
