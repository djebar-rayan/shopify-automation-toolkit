# Image audit — count and missing alts

> Task-driven recipe. For a faster ad-hoc audit:
>
> ```
> node images/image-audit.js --filter "status ACTIVE, images < 3"
> ```

## Target

- **Scope**: products
- **Filter**: status ACTIVE, images < 3
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

- List of products with fewer than `SHOP_IMAGE_MIN` images
- Total missing alt texts known
- No Shopify mutation

## Results
