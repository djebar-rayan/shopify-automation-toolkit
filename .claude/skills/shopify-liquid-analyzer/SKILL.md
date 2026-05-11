---
name: shopify-liquid-analyzer
description: Analyzes the `.liquid` files of the active Shopify theme to detect performance issues (Core Web Vitals), accessibility (a11y) issues, and SEO best practices. Use when the user wants to audit the active Shopify theme, analyze Liquid templates, check for performance issues, or review theme code quality.
---

# Shopify Liquid Analyzer

In-depth analysis of the `.liquid` files of the active Shopify theme,
producing a quality report.

## Instructions

### Step 1 — Fetch the theme files

Use the `shopify-plugin:shopify-liquid` skill to retrieve the active
theme structure via:

```bash
shopify store auth --store <store> --scopes read_themes
shopify store execute --store <store> --query-file query.graphql --output-file theme.json
```

Query to list assets:

```graphql
query {
  theme(id: "gid://shopify/Theme/XXX") {
    id name role
    files(first: 250) {
      edges {
        node {
          filename
          size
          updatedAt
          body { ... on OnlineStoreThemeFileBodyText { content } }
        }
      }
    }
  }
}
```

Or via `shopify theme pull` if the CLI allows:

```bash
shopify theme pull --store <store> --theme <theme-id> --path ./theme-backup
```

### Step 2 — Categorize files

Organize files by type:

- `layout/` — theme.liquid, password.liquid
- `templates/` — product.liquid, collection.liquid, index.liquid
- `sections/` — header, footer, product-form, etc.
- `snippets/` — reusable fragments
- `assets/` — CSS, JS

### Step 3 — Performance analysis (Core Web Vitals)

For each `.liquid` file, detect:

**LCP (Largest Contentful Paint)**:

- Images without `loading="lazy"` except the first above-the-fold image
- Images without `width` and `height` defined (causes CLS)
- `{{ 'style.css' | asset_url | stylesheet_tag }}` blocking the render
- Missing `fetchpriority="high"` on the hero image

**FID/INP (Interaction to Next Paint)**:

- `<script src="...">` tags without `defer` or `async`
- Inline event listeners in Liquid

**CLS (Cumulative Layout Shift)**:

- Images and videos without fixed dimensions
- Fonts without `font-display: swap`
- Elements that load after the first render

**Asset size**:

- CSS > 50 KB unminified
- JS > 100 KB unminified
- Images referenced without `| image_url: width: 800`

### Step 4 — SEO analysis

In `layout/theme.liquid` and `templates/`:

- Presence of `<title>{{ page_title }}</title>`
- Presence of `<meta name="description" content="{{ page_description }}">`
- Open Graph tags (`og:title`, `og:image`, `og:description`)
- Schema.org JSON-LD for Product, BreadcrumbList, Organization
- Canonical URL `<link rel="canonical" href="{{ canonical_url }}">`
- Hreflang for multilingual stores
- Unique H1 per page (check `product.liquid`, `collection.liquid`)

### Step 5 — Accessibility analysis (a11y)

- Images without `alt` attribute (or `alt=""` for decorative ones)
- Links with no visible text (`<a href="">` empty)
- Forms without an associated `<label>`
- Insufficient contrast (detect hard-coded colors)
- Missing `aria-label` on icon-only buttons
- Keyboard navigation: abusive negative `tabindex`

### Step 6 — Structured report

Generate `theme-audit-report.md` at the repo root:

```markdown
# Liquid theme audit — {theme name}

## Scores
| Dimension | Score | Issues |
|---|---|---|
| Performance | X/10 | N |
| SEO | X/10 | N |
| Accessibility | X/10 | N |

## Critical issues
...

## Per-file recommendations
...
```

### Step 7 — Suggested fixes

For each issue, propose the exact Liquid fix.

Example — image without lazy loading:

```liquid
<!-- Before -->
<img src="{{ image | img_url: '800x' }}" alt="{{ image.alt }}">

<!-- After -->
<img src="{{ image | image_url: width: 800 }}"
     alt="{{ image.alt | escape }}"
     width="800" height="800"
     loading="lazy">
```

Ask for confirmation before applying via `shopify theme push`.

## References

- Shopify Liquid reference: https://shopify.dev/docs/api/liquid
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Shopify image filters: `image_url`, `image_tag`
