# Describe empty collections

## Target

- **Scope**: collections
- **Filter**: all
- **Entities affected**: 0

> ⚠️ The `all` filter targets **every** collection. If you only want to
> address those without a description, the upstream scripts
> (audit/audit.js) should pre-select by handle first.

## Action

- **Type**: update
- **Field**: descriptionHtml
- **Value**: generate via Gemini with this prompt: "Write an HTML collection description, 80–120 words, with one introduction paragraph and a short positioning statement. No Markdown, no DOCTYPE."

## Validation

- [x] Verify target entities are in `store-data/collections.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- Each targeted collection has an 80–120 word description
- No residual Markdown markup in the HTML

## Results
