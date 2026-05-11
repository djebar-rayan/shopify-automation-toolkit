# Audit — Descriptions under 150 words

**Script used**: `audit/audit.js`
**Reference files read**: `store-data/products.md`

## Target

- **Scope**: products
- **Filter**: status ACTIVE, desc_words < 150
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

- List of products whose description is shorter than 150 words
- Prepares a `content/update-products.js` task that will rewrite the descriptions through Gemini

## Results
