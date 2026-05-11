# Multi-variant image generation (reference + variant)

> Recipe **not driven by a task file** — use the dedicated command.
> Designed for products whose variants share a common motif/design
> applied on their own shape/colour.
>
> Examples: phone cases, printed T-shirts, custom mugs.

## Step 1 — Generate (local, no Shopify mutation)

```
node images/image-generate.js --mode=multi-variant --handle=my-product \
  --canonical=0 \
  --prompt="Faithfully preserve the motif of image 1 (canonical). Apply it to the shape and colour of image 2 (variant). Studio photo, white background, uniform lighting, 4K quality."
```

Useful options:

- `--only="iPhone 14, iPhone 15"` — only these variants
- `--skip="iPhone 11"` — skip these variants
- `--canonical=2` — use image #2 as the canonical reference
- `--no-improve` — skip the Gemini Text prompt improvement
- `--dry-run` — do not call Gemini, just check the plan
- `--retries=5` — increase retry budget on rate-limit

## Step 2 — Visual validation

Inspect the files in `generated-images/`:

```
ls generated-images/my-product_*
```

Manually remove the images you find unsatisfactory.

## Step 3 — Upload + bind to variants

```
node images/image-upload.js --handle=my-product --dir=generated-images \
  --link-variants --confirm
```

To replace the previous images definitively:

```
node images/image-upload.js --handle=my-product --dir=generated-images \
  --link-variants --delete-old --confirm
```

⚠️ `--delete-old` is irreversible. Always validate visually first.

## Success criteria

- One validated image per variant (faithful motif + variant shape preserved)
- Variants bound to their new image (`productVariantsBulkUpdate`)
- No leftover unused images if `--delete-old`
