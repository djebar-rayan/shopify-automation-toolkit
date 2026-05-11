---
name: seo-researcher
description: Performs in-depth SEO keyword research via WebSearch to identify high-volume/low-competition terms in a given niche, and produces a prioritized keyword list with search intents. Use when the user needs keyword research, wants to find SEO opportunities, identify content gaps, or build a keyword strategy for any niche or product category.
---

# SEO Researcher

Structured keyword research via WebSearch to identify high-potential
SEO opportunities for an e-commerce store. The niche and seeds are
**parameters** (read from `.env` via
`SHOP_BRAND_NAME`/`SHOP_BRAND_VOCABULARY` or asked from the user).

## Instructions

### Step 1 — Define the niche and seeds

Ask the user (or derive from `.env`):

- **Niche**: e.g. "organic cosmetics", "running accessories", …
- **Target language**: English (primary), French (secondary)
- **Geographic zone**: US, UK, France, …
- **Content type**: product pages, collections, blog, landing pages

Prepare a list of **seeds** (5–10 root keywords) drawn from the brand
vocabulary or the main product types.

### Step 2 — Semantic expansion via WebSearch

For each seed, search variants and related questions:

```
"<seed>" meaning history
"<seed>" gift idea
"<seed>" women men kids
"<seed>" material
```

And the **common questions**:

```
site:quora.com OR site:reddit.com "<seed>"
"how to choose" "<seed>"
"which <type>" "<seed>" criteria
```

### Step 3 — Classify by intent

| Intent | Description | Examples |
|---|---|---|
| Transactional | Immediate buy | "buy X", "X price" |
| Navigational | Looking for a brand | "<brand> X" |
| Informational | Wants to learn | "X meaning", "X history" |
| Commercial | Compares before buying | "best X", "X review" |

Prioritize: **Transactional > Commercial > Informational**.

### Step 4 — Estimate competition via SERPs

For the 20 most promising keywords:

```
"<keyword>" -site:wikipedia.org
"<keyword>" store <region>
"<keyword>" <current year>
```

Assess:

- Number of e-commerce stores in the top 10
- Presence of giants (Amazon, Etsy) = high competition
- Presence of small artisan stores = opportunity

### Step 5 — Prioritization matrix

```
High priority : High volume + Low difficulty
Opportunity   : Medium volume + Low difficulty
Long term     : High volume + High difficulty
Avoid         : Low volume + High difficulty
```

### Step 6 — Long-tail

Find 4+ word phrases with high conversion intent:

```
"<product type> <specific attribute> <occasion>"
"<product> <material> <audience>"
```

### Step 7 — Report

Generate `keyword-research.md` at the repo root:

```markdown
# Keyword research — <niche>
**Date**: YYYY-MM-DD

## Top 20 priority keywords
| Keyword | Intent | Priority | Use in |
|---|---|---|---|
| … | Trans. | P1 | meta title, collection |

## Long-tail keywords
…

## Blog opportunities
…

## Keywords to avoid (too competitive)
…
```

### Step 8 — Map to existing pages

For each priority keyword, propose where to integrate it:

- Existing product meta title (see `seo/seo-update.js`)
- Collection title / description (see `content/update-collections.js`)
- Blog post topic to create
- CMS page description (see `content/update-pages.js`)
