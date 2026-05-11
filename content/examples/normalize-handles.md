# Normalize non-ASCII handles

> This recipe uses the dedicated command:
>
> ```
> node content/handle-normalize.js              # dry-run, Latin diacritics
> node content/handle-normalize.js --confirm    # apply
> ```
>
> Latin diacritics (é, ç, à, ñ, ü…) are handled natively by NFKD.
> For non-Latin alphabets (Cyrillic, Arabic, Devanagari, Tifinagh…)
> pass a JSON preset via `--map=lib/builders/translit-presets/<name>.json`
> (or write your own — see `lib/builders/translit-presets/README.md`).

## Target

- **Scope**: products
- **Filter**: all products
- **Entities affected**: (computed at runtime — only those whose handle contains non-ASCII characters)

## Action

- **Type**: update
- **Field**: handle
- **Value**: produced by `lib/builders/handle.js::normalizeHandle()`

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- 100% of non-ASCII handles are replaced with their ASCII equivalent
- Shopify automatically creates 301 redirects from the old handles
- `store-data/redirects.md` should be re-fetched after the run

## Results
