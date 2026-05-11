---
name: shopify-competitor-spy
description: Analyzes the competitive landscape of a Shopify store via WebSearch to compare prices, keywords, SEO positioning and product strategy. Use when the user wants to analyze competitors, benchmark pricing, find SEO keywords, or understand market positioning in their Shopify niche.
---

# Shopify Competitor Spy

Structured competitive analysis of an e-commerce niche via web search.

The niche, geographic zone and relevant competitors are **parameters**
(read from `.env` via `SHOP_BRAND_VOCABULARY` or asked from the user).

## Instructions

### Step 1 — Define the scope

Read `SHOP_BRAND_NAME` and `SHOP_BRAND_VOCABULARY` from `.env` (or ask
the user):

- **Main niche**: derived from the vocabulary (e.g. "handcrafted jewelry", "organic cosmetics", …)
- **Geographic zone**: France / Europe / global
- **Price range**: to be determined via search
- **Comparison type**: prices / SEO / positioning / product offering

### Step 2 — Direct competitor search

Use WebSearch with parameterized queries:

```
"<niche>" online store site:fr
"<niche>" jewelry france
"<keyword 1>" "<keyword 2>" buy store
<niche> <region> shipping
"<BRAND_NAME>" competitors alternatives
```

For each relevant result, capture:

- Store / brand name
- URL
- Product types
- Visible price range
- Blog / SEO content presence

### Step 3 — SEO analysis

For the top 5 competitors:

```
site:<competitor-domain> <niche>
"<competitor-name>" customer reviews
"<competitor-name>" keywords positioning
```

Identify:

- Keywords positioned (page titles, meta descriptions visible in SERPs)
- Content volume (blog, guides, storytelling)
- Social-media presence (Instagram, Pinterest, TikTok)
- Customer reviews (Trustpilot, Google, Trustmary)

### Step 4 — Price benchmark

Search prices for comparable categories:

| Category | WebSearch query |
|---|---|
| Category A | "<keyword A>" price site:fr |
| Category B | "<keyword B>" store |
| … | … |

Build a comparison table:

| Competitor | Equivalent product | Price | Notes |
|---|---|---|---|
| <BRAND_NAME> | … | $ X | reference |
| Competitor 1 | … | $ X | … |

### Step 5 — Missing keywords

Search for high-potential keywords not yet covered:

```
"<niche>" trends 2026
"<niche>" gift
"<niche>" buying guide
```

Identify the **content gaps**: topics often searched but poorly covered.

### Step 6 — Report

Generate `competitor-analysis.md` at the repo root:

```markdown
# Competitive analysis — <BRAND_NAME> vs market

**Date**: YYYY-MM-DD

## Executive summary
{3–5 key points}

## Market map
{competitor table}

## Price benchmark
{price table per category}

## Keyword opportunities
{list of gaps to exploit}

## Strategic recommendations
### Short term (1 month)
### Medium term (3 months)
### Long term (6+ months)
```

### Step 7 — Actionable opportunities

Translate the analysis into concrete actions:

- Keywords to add to missing meta titles → `seo/seo-update.js` task
- Under-represented product categories → catalog expansion
- Blog angles → `content/update-pages.js` task
- Prices to adjust if off-market
