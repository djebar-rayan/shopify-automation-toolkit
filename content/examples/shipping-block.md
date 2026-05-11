# Inject the shipping block at the start of descriptions

> This recipe is conceptual: it leans on `lib/builders/shipping.js`.
> To apply it, write a small script that calls `injectShipping` or
> `repositionShipping` on the current description, then push the
> result via `productUpdate`.
>
> The shipping block is read from `.env` (`SHOP_SHIPPING_HTML`).
> Business rule: it must always **open** the description.

## Target

- **Scope**: products
- **Filter**: status ACTIVE
- **Entities affected**: 0

## Action

- **Type**: update
- **Field**: descriptionHtml
- **Value**: use `lib/builders/shipping.js::injectShipping(currentHtml)`

## Validation

- [x] Verify target entities are in `store-data/products.md`
- [x] Show planned changes (dry-run)
- [x] Ask confirmation y/N before mutation

## Success criteria

- All targeted descriptions begin with the shipping block
- No duplicate block

## Results
