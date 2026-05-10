---
name: shopify-content-enricher
description: Génère des descriptions produit HTML structurées (>150 mots, balises h2/ul/strong, storytelling de marque) et les applique via productUpdate. Use when products have desc_missing, desc_too_short, or desc_no_html flags, or when the user asks to enrich/rewrite product descriptions for Shopify.
---

# Shopify Content Enricher

Réécrit des descriptions produit HTML structurées (≥ 150 mots) via Gemini Text et les
applique via `productUpdate`. La marque (`SHOP_BRAND_NAME`) et le vocabulaire de niche
(`SHOP_BRAND_VOCABULARY`) sont lus dans `.env`.

## Instructions

### Étape 1 — Identifier les produits concernés

```bash
node audit/audit.js --filter "status ACTIVE, desc_words < 150"
```

Ou lire `audit-report.md` pour les flags `desc_missing`, `desc_too_short`, `desc_no_html`.

### Étape 2 — Créer la tâche

```markdown
# tasks/enrich-descriptions.md

## Cible
- Scope : products
- Filtre : status ACTIVE, desc_words < 150

## Action
- Type : update
- Champ modifié : descriptionHtml
- Valeur : générer via Gemini avec ce prompt : "Rédige une description produit HTML structurée d'au moins 150 mots, avec au moins un h2, une liste à puces (ul/li), et un strong pour mettre en valeur un bénéfice principal. Inclure au moins un terme du vocabulaire de marque s'il est défini. Pas de DOCTYPE/html/body, pas de Markdown, pas de triples backticks."

## Validation avant application
- [x] Vérifier dans store-data/products.md
- [x] Afficher dry-run
- [x] Demander confirmation

## Critères de succès
- 100 % des produits ciblés ont une description ≥ 150 mots
- HTML structuré : h2, ul, li, strong
- Bloc livraison toujours en début (cf. lib/builders/livraison.js)
```

### Structure HTML recommandée

```html
<h2>Présentation</h2>
<p>{Phrase d'accroche orientée bénéfice principal}</p>

<h2>Caractéristiques</h2>
<ul>
  <li><strong>Matériau</strong> : …</li>
  <li><strong>Dimensions</strong> : …</li>
  <li><strong>Origine</strong> : …</li>
  <li><strong>Entretien</strong> : …</li>
</ul>

<h2>Pourquoi choisir ce produit</h2>
<p>{Argument différenciateur, lien avec le vocabulaire de marque}</p>
```

### Règles HTML

- Balises autorisées : `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`
- Au moins une `<ul>` (caractéristiques)
- Au moins un `<strong>` (bénéfice clé)
- Pas de Markdown résiduel (`#`, `**`, triples backticks)

### Étape 3 — Lancer

```bash
node content/update-products.js --task tasks/enrich-descriptions.md
```

Le script :
1. parse la tâche
2. applique le filtre sur `store-data/products.md`
3. pour chaque produit : Gemini Text avec contexte produit
4. dry-run sur les 3 premiers
5. demande confirmation o/N
6. applique `productUpdate` (délai 500 ms entre chaque)
7. append le bloc « Résultats » à la tâche

### Convention « livraison en début »

Si la marque utilise un bloc livraison HTML (`SHOP_LIVRAISON_HTML`),
celui-ci doit **toujours ouvrir** la description. Pour repositionner :

```javascript
const { repositionLivraison, injectLivraison } = require('./lib/builders/livraison');
```

### Étape 4 — Re-fetch

```bash
node fetch-store-data.js
```

## Limitations

- Rate limit Gemini : 10 req/min en tier gratuit → délai 6.5 s entre appels.
- Sur erreur 429/503 : retry automatique après 60 s (configuré dans `lib/gemini-text.js`).
