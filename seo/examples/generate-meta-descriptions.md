# Generate SEO meta descriptions

## Target

- **Scope**: products
- **Filter**: status ACTIVE, seo_description missing
- **Entities affected**: 0

## Action

- **Type**: update
- **Field**: seo.description
- **Value**: generate via Gemini with this prompt: "Write an SEO meta description for this product, between 80 and 160 characters, in a compelling style with a light call-to-action. No Markdown."

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- 100% of filtered products have an SEO meta description ≤ 160 characters

## Results
