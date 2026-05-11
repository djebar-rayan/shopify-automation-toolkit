# Shopify Email — generic Klaviyo template migration

This folder converts **Klaviyo HTML templates** (raw export) into HTML
compatible with the **Shopify Email** editor.

## Typical usage

```bash
# 1. Export Klaviyo (read-only)
node integrations/klaviyo/klaviyo-export.js

# 2. Adapt the templates
node integrations/shopify-email/adapt-templates.js
```

Output: `integrations/shopify-email/templates-adapted/<file>.html`
+ `integrations/shopify-email/migration-report.md`.

## Options

| Flag | Effect |
|---|---|
| `--src=<dir>` | Source folder (default: `../klaviyo/templates/`) |
| `--out=<dir>` | Output folder (default: `./templates-adapted/`) |
| `--mapping=<file.json>` | Extra variable substitutions |

## `--mapping` format

```json
[
  { "pattern": "\\{\\{\\s*event\\.product_name\\s*\\}\\}", "replacement": "{{ product.title }}", "flags": "g" },
  { "pattern": "MyOldDomain", "replacement": "https://my-shop.com", "flags": "g" }
]
```

## Applied transformations (all local, no network call)

1. Strip the Klaviyo export comment header.
2. Strip `<script>` tags.
3. Strip pixels and `@import` `klaviyo.com`.
4. Neutralize tracking `href`s (replaced with `href="#"`).
5. Strip `<klaviyo:*>` tags.
6. Strip Outlook MSO conditional comments.
7. Inline simple CSS rules (`.class`, `#id`, `tag`).
8. Substitute standard Klaviyo variables to Shopify Liquid (`person.first_name` → `customer.first_name`, etc.).
9. Custom substitutions (if `--mapping`).
10. Annotate non-mappable variables with `<!-- KL -->`.
11. Extract the `<body>`, strip global `<head>` / `<meta>` / `<title>` / `<style>`.
12. Wrap inside a `<div max-width:600px>`.
13. HTML minification.

## Business rule

Shopify Email enforces a **50 KB max per template**. The report
flags any template exceeding the limit.

## Main Shopify Email Liquid variables

| Variable | Context |
|---|---|
| `{{ customer.first_name }}` | Customer profile |
| `{{ customer.email }}` | Customer profile |
| `{{ shop.name }}`, `{{ shop.url }}` | Store |
| `{{ checkout.line_items }}` | Abandoned checkouts |
| `{{ checkout.abandoned_checkout_url }}` | Abandoned checkouts |
| `{{ order.name }}`, `{{ order.total_price | money }}` | Order confirmations / tracking |
| `{{ product.title }}`, `{{ product.url }}` | Browse abandonment |
| `{{ discount_code }}` | Automatic discount codes |
| `{{ unsubscribe_link }}` | Mandatory footer |

Reference: <https://shopify.dev/docs/themes/liquid/reference/objects>
