---
name: shopify-liquid-analyzer
description: Analyse les fichiers .liquid du thème Shopify actif pour détecter les problèmes de performance (Core Web Vitals), accessibilité (a11y), et bonnes pratiques SEO. Use when the user wants to audit the active Shopify theme, analyze Liquid templates, check for performance issues, or review theme code quality.
---

# Shopify Liquid Analyzer

Analyse en profondeur les fichiers `.liquid` du thème Shopify actif et produit un rapport de qualité.

## Instructions

### Step 1 : Récupérer les fichiers du thème

Utiliser le skill `shopify-plugin:shopify-liquid` pour récupérer la structure du thème actif via :

```bash
shopify store auth --store <store> --scopes read_themes
shopify store execute --store <store> --query-file query.graphql --output-file theme.json
```

Query pour lister les assets :
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

Ou via `shopify theme pull` si le CLI le permet :
```bash
shopify theme pull --store <store> --theme <theme-id> --path ./theme-backup
```

### Step 2 : Catégoriser les fichiers

Organiser les fichiers par type :
- `layout/` — theme.liquid, password.liquid
- `templates/` — product.liquid, collection.liquid, index.liquid
- `sections/` — header, footer, product-form, etc.
- `snippets/` — réutilisables
- `assets/` — CSS, JS

### Step 3 : Analyse performance (Core Web Vitals)

Pour chaque fichier `.liquid`, détecter :

**LCP (Largest Contentful Paint)** :
- Images sans `loading="lazy"` sauf première image above-the-fold
- Images sans `width` et `height` définis (CLS)
- `{{ 'style.css' | asset_url | stylesheet_tag }}` en bloquant le render
- Absense de `fetchpriority="high"` sur l'image hero

**FID/INP (Interaction to Next Paint)** :
- Scripts `<script src="...">` sans `defer` ou `async`
- Event listeners inline dans le Liquid

**CLS (Cumulative Layout Shift)** :
- Images et vidéos sans dimensions fixes
- Fonts sans `font-display: swap`
- Éléments qui se chargent après le premier rendu

**Taille des assets** :
- CSS > 50KB non minifié
- JS > 100KB non minifié
- Images référencées sans filtre `| image_url: width: 800`

### Step 4 : Analyse SEO

Dans `layout/theme.liquid` et `templates/` :
- Présence de `<title>{{ page_title }}</title>`
- Présence de `<meta name="description" content="{{ page_description }}">`
- Balises Open Graph (`og:title`, `og:image`, `og:description`)
- Schema.org JSON-LD pour Product, BreadcrumbList, Organization
- Canonical URL `<link rel="canonical" href="{{ canonical_url }}">`
- Hreflang si multilingue
- H1 unique par page (vérifier dans product.liquid, collection.liquid)

### Step 5 : Analyse accessibilité (a11y)

- Images sans attribut `alt` (ou `alt=""` pour les décoratives)
- Liens sans texte visible (`<a href="">` vide)
- Formulaires sans `<label>` associé
- Contraste insuffisant (détecter les couleurs hardcodées)
- Absence de `aria-label` sur les boutons icônes
- Navigation au clavier : `tabindex` négatifs abusifs

### Step 6 : Rapport structuré

Générer `workspace-shopify/theme-audit-report.md` :

```markdown
# Audit Thème Liquid — {nom thème}

## Scores
| Dimension | Score | Problèmes |
|-----------|-------|-----------|
| Performance | X/10 | N |
| SEO | X/10 | N |
| Accessibilité | X/10 | N |

## Problèmes critiques
...

## Recommandations par fichier
...
```

### Step 7 : Corrections suggérées

Pour chaque problème, proposer le fix Liquid exact :

Exemple — Image sans lazy loading :
```liquid
<!-- Avant -->
<img src="{{ image | img_url: '800x' }}" alt="{{ image.alt }}">

<!-- Après -->
<img src="{{ image | image_url: width: 800 }}"
     alt="{{ image.alt | escape }}"
     width="800" height="800"
     loading="lazy">
```

Demander confirmation avant d'appliquer via `shopify theme push`.

## Références

- Shopify Liquid reference : https://shopify.dev/docs/api/liquid
- Core Web Vitals : LCP < 2.5s, FID < 100ms, CLS < 0.1
- Shopify image filters : `image_url`, `image_tag`
