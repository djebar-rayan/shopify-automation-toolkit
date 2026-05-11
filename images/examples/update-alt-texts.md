# Update missing alt texts

> Recipe: uses either local formulas (`lib/builders/seo-meta.js`)
> or Gemini Vision for richer image descriptions.

## Formula mode (fast, free)

```
node images/image-alt.js                   # dry-run
node images/image-alt.js --confirm         # apply
```

## Vision mode (rich, paid)

```
node images/image-alt.js --mode=vision --confirm
```

## Filters

```
node images/image-alt.js --filter "status ACTIVE, no_alt" --confirm
node images/image-alt.js --filter "handle my-product" --confirm
```

## Success criteria

- Every image of every targeted product has a non-empty alt text
- Length ≤ 512 characters (Shopify limit)
- No duplicate output (formula mode uses `joinUniq`)
