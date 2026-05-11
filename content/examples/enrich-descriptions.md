# Enrich descriptions that are too short

## Target

- **Scope**: products
- **Filter**: status ACTIVE, desc_words < 150
- **Entities affected**: 0

## Action

- **Type**: update
- **Field**: descriptionHtml
- **Value**: generate via Gemini with this prompt: "Write an HTML structured product description of at least 150 words, with at least one h2, one bullet list (ul/li) and one strong tag highlighting a key benefit. No DOCTYPE/html/body, no Markdown."

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- 100% of filtered products have a description ≥ 150 words
- Structured HTML (h2, ul, li, strong)
- Re-fetch recommended after the run

## Results
