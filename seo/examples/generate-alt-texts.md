# Generate missing alt texts

> This recipe uses the dedicated command (local formulas, no Gemini call):
>
> ```
> node seo/seo-update.js --target=alt           # dry-run
> node seo/seo-update.js --target=alt --confirm # apply
> ```
>
> The alt-text format lives in `lib/builders/seo-meta.js::generateAltText`.

## Target

- **Scope**: products
- **Filter**: status ACTIVE, no_alt
- **Entities affected**: 0

## Action

- **Type**: update
- **Field**: (alt text per image, not via productUpdate)
- **Value**: produced by formulas in `lib/builders/seo-meta.js`

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- 100% of images on filtered products have a non-empty alt text

## Results
