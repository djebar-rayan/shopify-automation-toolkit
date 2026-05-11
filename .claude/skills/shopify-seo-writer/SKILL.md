---
name: shopify-seo-writer
description: Generates optimized SEO meta titles and descriptions for a Shopify store, product by product, with keyword + brand + CTA formulas and 70/160 character limits. Use when products are missing seo_title_missing or seo_desc_missing flags, or when the user asks to fix/generate SEO meta for Shopify products.
---

# Shopify SEO Writer

Generates and applies SEO meta titles + descriptions via `shopify store execute`
(`productUpdate` mutation or `metafieldsSet`, depending on preference).

## Instructions

### Step 1 — Identify the affected products

Prefer the generic audit:

```bash
node audit/audit.js --filter "status ACTIVE, seo_title missing"
node audit/audit.js --filter "status ACTIVE, seo_description missing"
```

Or read `audit-report.md` (produced by `node audit/full-audit.js`).

### Step 2 — Prepare the product data

Confirm that `store-data/products.md` contains the target products
(otherwise: `node fetch-store-data.js`).

Required fields: `id`, `title`, `vendor`, `productType`,
`descriptionHtml`, `tags`.

### Step 3 — Choose the generation method

**Option A — Local formulas (fast, free)**:

```bash
node seo/seo-update.js --target=titles --confirm
node seo/seo-update.js --target=descriptions --confirm
```

The formulas live in `lib/builders/seo-meta.js`. They use
`SHOP_BRAND_NAME` and `SHOP_BRAND_VOCABULARY` from `.env`.

**Option B — Gemini (more narrative descriptions)**:

Create a task `tasks/seo-titles.md`:

```markdown
## Target
- Scope: products
- Filter: status ACTIVE, seo_title missing

## Action
- Type: update
- Field: seo.title
- Value: generate via Gemini with this prompt: "Write an SEO meta title ≤ 70 characters in the format `[keyword] [type] | [brand]`. No Markdown."

## Validation
- [x] Verify in store-data/products.md
- [x] Show dry-run
- [x] Ask confirmation
```

Then: `node content/update-products.js --task tasks/seo-titles.md`

### SEO rules

**Meta title**:
- ≤ 70 characters
- Format `<keyword> | <BRAND>` or `<type> <keyword> | <BRAND>`
- First word = the most distinctive word of the title

**Meta description**:
- ≤ 160 characters
- Include at least one term from `SHOP_BRAND_VOCABULARY`
- End with a light CTA ("Discover…", "Shop at …")
- NEVER write in full uppercase

### Step 4 — Validate before writing

Always dry-run first. The script prints:

| Product | Meta Title (chars) | Meta Description (chars) |
|---|---|---|
| … | … (XX) | … (XXX) |

### Step 5 — Apply

Add `--confirm` to the command to perform the mutations.

### Step 6 — Re-fetch

```bash
node fetch-store-data.js
```

## References

- Google meta title limit: ~70 characters
- Google meta description limit: ~160 characters
- Shopify mutation: `productUpdate(input: { seo: { title, description } })`
- Alternative: `metafieldsSet` with `namespace=global`, `key=title_tag` / `description_tag`
