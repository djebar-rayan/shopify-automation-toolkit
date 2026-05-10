# Shopify Email — Migration générique de templates Klaviyo

Ce dossier convertit des **templates HTML Klaviyo** (export brut)
en HTML compatible avec l'éditeur **Shopify Email**.

## Usage typique

```bash
# 1. Exporter Klaviyo (read-only)
node integrations/klaviyo/klaviyo-export.js

# 2. Adapter les templates
node integrations/shopify-email/adapt-templates.js
```

Sortie : `integrations/shopify-email/templates-adapted/<fichier>.html`
+ `integrations/shopify-email/migration-report.md`.

## Options

| Flag | Effet |
|---|---|
| `--src=<dir>` | Dossier source (défaut : `../klaviyo/templates/`) |
| `--out=<dir>` | Dossier de sortie (défaut : `./templates-adapted/`) |
| `--mapping=<file.json>` | Substitutions de variables supplémentaires |

## Format `--mapping`

```json
[
  { "pattern": "\\{\\{\\s*event\\.product_name\\s*\\}\\}", "replacement": "{{ product.title }}", "flags": "g" },
  { "pattern": "MyOldDomain", "replacement": "https://my-shop.com", "flags": "g" }
]
```

## Transformations appliquées (toutes locales, aucun appel réseau)

1. Retrait du header de commentaire de l'export Klaviyo.
2. Retrait des `<script>`.
3. Retrait des pixels et `@import` `klaviyo.com`.
4. Neutralisation des `href` de tracking (devient `href="#"`).
5. Retrait des `<klaviyo:*>`.
6. Retrait des conditionnels Outlook MSO.
7. Inlining des règles CSS simples (`.classe`, `#id`, `tag`).
8. Substitution des variables Klaviyo standard vers Liquid Shopify (`person.first_name` → `customer.first_name`, etc.).
9. Substitutions custom (si `--mapping`).
10. Annotation `<!-- KL -->` pour les variables non mappables.
11. Extraction du `<body>`, retrait des `<head>` / `<meta>` / `<title>` / `<style>` globaux.
12. Enveloppe dans un `<div max-width:600px>`.
13. Minification HTML.

## Règle métier

Shopify Email impose **50 ko max par template**. Le rapport
indique d'un coup d'œil quels templates dépassent.

## Variables Liquid Shopify Email principales

| Variable | Contexte |
|---|---|
| `{{ customer.first_name }}` | Profil client |
| `{{ customer.email }}` | Profil client |
| `{{ shop.name }}`, `{{ shop.url }}` | Boutique |
| `{{ checkout.line_items }}` | Paniers abandonnés |
| `{{ checkout.abandoned_checkout_url }}` | Paniers abandonnés |
| `{{ order.name }}`, `{{ order.total_price | money }}` | Confirmations / suivi |
| `{{ product.title }}`, `{{ product.url }}` | Browse abandonment |
| `{{ discount_code }}` | Codes promo automatiques |
| `{{ unsubscribe_link }}` | Footer obligatoire |

Référence : <https://shopify.dev/docs/themes/liquid/reference/objects>
