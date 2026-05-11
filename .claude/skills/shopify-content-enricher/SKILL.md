---
name: shopify-content-enricher
description: Generates structured HTML product descriptions (>150 words, h2/ul/strong tags, brand storytelling) and applies them via productUpdate. Use when products have desc_missing, desc_too_short, or desc_no_html flags, or when the user asks to enrich/rewrite product descriptions for Shopify.
---

# Shopify Content Enricher

Rewrites HTML structured product descriptions (≥ 150 words) through
Gemini Text and applies them via `productUpdate`. The brand
(`SHOP_BRAND_NAME`) and the niche vocabulary (`SHOP_BRAND_VOCABULARY`)
are read from `.env`.

## Instructions

### Step 1 — Identify the affected products

```bash
node audit/audit.js --filter "status ACTIVE, desc_words < 150"
```

Or read `audit-report.md` for the `desc_missing`, `desc_too_short`,
`desc_no_html` flags.

### Step 2 — Create the task

```markdown
# tasks/enrich-descriptions.md

## Target
- Scope: products
- Filter: status ACTIVE, desc_words < 150

## Action
- Type: update
- Field: descriptionHtml
- Value: generate via Gemini with this prompt: "Write an HTML structured product description of at least 150 words, with at least one h2, one bullet list (ul/li), and one strong tag highlighting a main benefit. Include at least one term from the brand vocabulary when defined. No DOCTYPE/html/body, no Markdown, no triple backticks."

## Validation
- [x] Verify in store-data/products.md
- [x] Show dry-run
- [x] Ask confirmation

## Success criteria
- 100% of targeted products have a description ≥ 150 words
- Structured HTML: h2, ul, li, strong
- Shipping block always at the start (see lib/builders/shipping.js)
```

### Recommended HTML structure

```html
<h2>Overview</h2>
<p>{Hook sentence built around the main benefit}</p>

<h2>Features</h2>
<ul>
  <li><strong>Material</strong>: …</li>
  <li><strong>Dimensions</strong>: …</li>
  <li><strong>Origin</strong>: …</li>
  <li><strong>Care</strong>: …</li>
</ul>

<h2>Why choose this product</h2>
<p>{Differentiating argument, tied to the brand vocabulary}</p>
```

### HTML rules

- Allowed tags: `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`
- At least one `<ul>` (features)
- At least one `<strong>` (key benefit)
- No leftover Markdown (`#`, `**`, triple backticks)

### Step 3 — Run

```bash
node content/update-products.js --task tasks/enrich-descriptions.md
```

The script:
1. parses the task
2. applies the filter against `store-data/products.md`
3. for each product: Gemini Text with product context
4. dry-run on the first 3
5. asks confirmation y/N
6. applies `productUpdate` (500 ms delay between calls)
7. appends the `## Results` block to the task

### "Shipping at the start" convention

If the brand uses an HTML shipping block (`SHOP_SHIPPING_HTML`), it must
always **open** the description. To reposition:

```javascript
const { repositionShipping, injectShipping } = require('./lib/builders/shipping');
```

### Step 4 — Re-fetch

```bash
node fetch-store-data.js
```

## Limitations

- Gemini rate limit: 10 req/min on the free tier → 6.5 s delay between calls.
- On 429/503 errors: automatic retry after 60 s (configured in `lib/gemini-text.js`).
