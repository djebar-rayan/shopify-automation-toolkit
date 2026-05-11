# Generate SEO meta titles

> This recipe uses the **formulas** in `lib/builders/seo-meta.js`
> (no Gemini, fast and deterministic).
>
> Run directly: `node seo/seo-update.js --target=titles --confirm`
>
> Or via a task file: copy this file to `tasks/`, adjust the filter,
> then `node content/update-products.js --task tasks/<this-file>` after
> replacing the value with the content of your choice.

## Target

- **Scope**: products
- **Filter**: status ACTIVE, seo_title missing
- **Entities affected**: 0

## Action

- **Type**: update
- **Field**: seo.title
- **Value**: generate via Gemini with this prompt: "Write an SEO meta title for this product, max 70 characters, format `[keyword] | [brand]`. No Markdown."

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- 100% of filtered products have an SEO meta title ≤ 70 characters
- Re-fetch `store-data/products.md` after the run

## Results
