---
name: shopify-image-generator
description: Improves and generates Shopify product images via Gemini Flash Image. In multi-variant mode, uses a canonical image (motif/design) + each variant's existing image as references. Use when products have low-quality images, image_count_low flag, or when the user asks to regenerate/improve product photos using AI.
---

# Shopify Image Generator

Generates product images via **Gemini Flash Image (Nano Banana)** —
either for a single product or for every variant while preserving a
common motif.

## Mode 1 — Single

For a product where you want to add or replace one image:

```bash
node images/image-generate.js --mode=single --handle=<product-handle> \
  --prompt="Studio photo on white background, soft lighting, square framing, 4K quality"
```

The reference image (if available) is the product's first image — this
keeps the visual identity consistent.

## Mode 2 — Multi-variant (with a canonical image)

For a product where every variant must display the same motif/design
applied on its own shape/colour (phone cases, printed T-shirts, mugs…):

```bash
node images/image-generate.js --mode=multi-variant --handle=<product-handle> \
  --canonical=0 \
  --prompt="Faithfully preserve the motif of image 1 (canonical). Apply it to the shape of image 2 (variant). Studio photo, white background, uniform lighting, 4K quality."
```

Useful options:

- `--canonical=N` — use image #N as the canonical reference
- `--only="variant 1, variant 2"` — only these variants
- `--skip="variant 3"` — skip these variants
- `--retries=5` — increase the retry budget on rate-limit
- `--no-improve` — do not run the prompt through Gemini Text first
- `--dry-run` — check the plan without calling Gemini

## Step 1 — Visual audit (recommended)

Before regeneration, identify the images to replace:

```bash
node images/visual-audit.js --filter "status ACTIVE"
```

→ produces `visual-audit-report.md` which classifies each image as
`ADEQUATE` / `REPLACE` / `NO_IMAGE`.

## Step 2 — Local generation

Images are saved to `generated-images/`. No Shopify upload at this
stage — visual validation is mandatory.

Check the files:
- size ≥ 50 KB
- resolution ≥ 800×800
- motif faithful / shape preserved

Manually remove the images you find unsatisfactory.

## Step 3 — Upload + variant binding

```bash
# Simple upload
node images/image-upload.js --handle=<handle> --dir=generated-images --confirm

# Upload + automatic variant binding (matched by filename)
node images/image-upload.js --handle=<handle> --dir=generated-images --link-variants --confirm

# Upload + full replacement (deletes the previous images, IRREVERSIBLE)
node images/image-upload.js --handle=<handle> --dir=generated-images --link-variants --delete-old --confirm
```

## Limitations

- Gemini Flash Image: 1 call = 1 image (no native batch).
- Rate limit: 10 req/min on the free tier. Retry on 429/503 waits 60 s
  automatically.
- Cost: depends on your Google AI Studio tier.
- White background + uniform framing need a very precise prompt;
  adding visual references (a canonical image) drastically improves
  the result.

## Reference

- Model: `GEMINI_MODEL=gemini-3.1-flash-image-preview` (configurable in `.env`).
- Pipeline: `lib/gemini-image.js` → `lib/image-validate.js` → `lib/image-upload.js`.
