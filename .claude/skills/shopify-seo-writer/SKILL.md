---
name: shopify-seo-writer
description: Génère des meta titles et meta descriptions SEO optimisés produit par produit pour une boutique Shopify, avec formules keyword + marque + CTA, respect des limites 70/160 chars. Use when products are missing seo_title_missing or seo_desc_missing flags, or when the user asks to fix/generate SEO meta for Shopify products.
---

# Shopify SEO Writer

Génère et applique des meta titles + descriptions SEO via `shopify store execute`
(mutation `productUpdate` ou `metafieldsSet` selon préférence).

## Instructions

### Étape 1 — Identifier les produits concernés

Privilégier l'audit générique :

```bash
node audit/audit.js --filter "status ACTIVE, seo_title manquant"
node audit/audit.js --filter "status ACTIVE, seo_description manquant"
```

Ou lire `audit-report.md` (généré par `node audit/full-audit.js`).

### Étape 2 — Préparer les données produit

Vérifier que `store-data/products.md` contient bien les produits cibles
(sinon : `node fetch-store-data.js`).

Champs nécessaires : `id`, `title`, `vendor`, `productType`, `descriptionHtml`, `tags`.

### Étape 3 — Choisir la méthode de génération

**Option A — Formules locales (rapide, gratuit)** :

```bash
node seo/seo-update.js --target=titles --confirm
node seo/seo-update.js --target=descriptions --confirm
```

Les formules sont dans `lib/builders/seo-meta.js`. Elles utilisent
`SHOP_BRAND_NAME` et `SHOP_BRAND_VOCABULARY` lus dans `.env`.

**Option B — Gemini (descriptions plus narratives)** :

Créer une tâche `tasks/seo-titles.md` :

```markdown
## Cible
- Scope : products
- Filtre : status ACTIVE, seo_title manquant

## Action
- Type : update
- Champ modifié : seo.title
- Valeur : générer via Gemini avec ce prompt : "Rédige un meta title SEO ≤ 70 caractères au format `[keyword] [type] | [marque]`. Pas de Markdown."

## Validation avant application
- [x] Vérifier dans store-data/products.md
- [x] Afficher dry-run
- [x] Demander confirmation
```

Puis : `node content/update-products.js --task tasks/seo-titles.md`

### Règles SEO

**Meta title** :
- ≤ 70 caractères
- Format `<keyword> | <BRAND>` ou `<type> <keyword> | <BRAND>`
- Premier mot = mot le plus distinctif du titre

**Meta description** :
- ≤ 160 caractères
- Inclure au moins un terme sémantique de `SHOP_BRAND_VOCABULARY`
- Terminer par un CTA léger (« Découvrez… », « Commandez chez … »)
- Ne JAMAIS écrire en majuscules complètes

### Étape 4 — Valider avant d'écrire

Toujours en dry-run d'abord. Le script affiche :

| Produit | Meta Title (chars) | Meta Description (chars) |
|---|---|---|
| … | … (XX) | … (XXX) |

### Étape 5 — Appliquer

Ajouter `--confirm` à la commande pour effectuer les mutations.

### Étape 6 — Re-fetch

```bash
node fetch-store-data.js
```

## Références

- Limite Google meta title : ~70 caractères
- Limite Google meta description : ~160 caractères
- Mutation Shopify : `productUpdate(input: { seo: { title, description } })`
- Alternative : `metafieldsSet` sur `namespace=global`, `key=title_tag` / `description_tag`
