# Visual image audit via Gemini Vision

> This recipe calls **Gemini Vision** to classify each image into
> `ADEQUATE` / `REPLACE` / `NO_IMAGE`.
>
> Cost: 1 Gemini Vision call per image. The result is cached
> (`.audit-tmp/visual-audit.json`) so subsequent runs are free.

## Step 1 — Run the audit

```
node images/visual-audit.js --filter "status ACTIVE"
```

Output:

- `visual-audit-report.md` at the repo root
- `.audit-tmp/visual-audit.json` (reusable cache)

## Step 2 — Decide

List the `REPLACE` entries from the report and prepare an
image-generation task (`images/image-generate.js`).

## Options

- `--refresh` — ignore the cache and re-call Gemini Vision
- `--filter "handle my-product"` — restrict to one product

## Success criteria

- Every targeted product has a verdict for each image
- The report clearly separates ADEQUATE / REPLACE / NO_IMAGE
