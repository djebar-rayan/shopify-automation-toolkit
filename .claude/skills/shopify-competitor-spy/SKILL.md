---
name: shopify-competitor-spy
description: Analyse la concurrence e-commerce d'une boutique Shopify via WebSearch pour comparer prix, mots-clés, positionnement SEO et stratégie produit. Use when the user wants to analyze competitors, benchmark pricing, find SEO keywords, or understand market positioning in their Shopify niche.
---

# Shopify Competitor Spy

Analyse concurrentielle d'une niche e-commerce via recherche web structurée.

La niche, la zone géographique et les concurrents pertinents sont **paramètres**
(lus dans `.env` via `SHOP_BRAND_VOCABULARY` ou demandés à l'utilisateur).

## Instructions

### Étape 1 — Définir le périmètre

Lire `SHOP_BRAND_NAME` et `SHOP_BRAND_VOCABULARY` dans `.env` (ou demander à l'utilisateur) :

- **Niche principale** : déduite du vocabulaire (ex: « bijoux artisanaux », « cosmétiques bio », …)
- **Zone géographique** : France / Europe / global
- **Gamme de prix** : à déterminer via recherche
- **Type de comparaison** : prix / SEO / positionnement / offre produit

### Étape 2 — Recherche concurrents directs

Utiliser WebSearch avec des queries paramétrées :

```
"<niche>" boutique en ligne site:fr
"<niche>" jewelry france
"<keyword 1>" "<keyword 2>" achat boutique
<niche> <zone géographique> livraison
"<BRAND_NAME>" concurrents alternatives
```

Pour chaque résultat pertinent, noter :

- Nom de la boutique / marque
- URL
- Type de produits proposés
- Fourchette de prix visible
- Présence d'un blog / contenu SEO

### Étape 3 — Analyse SEO

Pour les 5 meilleurs concurrents :

```
site:<domaine-concurrent> <niche>
"<nom-concurrent>" avis clients
"<nom-concurrent>" mots-clés positionnement
```

Identifier :

- Mots-clés positionnés (titres pages, meta descriptions visibles dans SERPs)
- Volume de contenu (blog, guides, storytelling)
- Présence réseaux sociaux (Instagram, Pinterest, TikTok)
- Avis clients (Trustpilot, Google, Trustmary)

### Étape 4 — Benchmark des prix

Rechercher les prix pour les catégories comparables :

| Catégorie | Query WebSearch |
|---|---|
| Catégorie A | "<keyword A>" prix site:fr |
| Catégorie B | "<keyword B>" boutique |
| … | … |

Construire un tableau :

| Concurrent | Produit équivalent | Prix | Notes |
|---|---|---|---|
| <BRAND_NAME> | … | X € | référence |
| Concurrent 1 | … | X € | … |

### Étape 5 — Mots-clés manquants

Rechercher les mots-clés à fort potentiel non couverts :

```
"<niche>" tendances 2026
"<niche>" cadeau
"<niche>" guide d'achat
```

Identifier les **gaps de contenu** : sujets souvent recherchés mais mal couverts.

### Étape 6 — Rapport

Générer `competitor-analysis.md` (à la racine du repo) :

```markdown
# Analyse concurrentielle — <BRAND_NAME> vs marché

**Date** : YYYY-MM-DD

## Résumé exécutif
{3-5 points clés}

## Carte du marché
{tableau concurrents}

## Benchmark prix
{tableau prix par catégorie}

## Mots-clés opportunités
{liste des gaps à exploiter}

## Recommandations stratégiques
### Court terme (1 mois)
### Moyen terme (3 mois)
### Long terme (6+ mois)
```

### Étape 7 — Opportunités actionnables

Traduire l'analyse en actions concrètes :

- Mots-clés à ajouter dans les meta titles manquants → tâche `seo/seo-update.js`
- Catégories de produits sous-représentées → ajout au catalogue
- Angles de contenu pour blog → tâche `content/update-pages.js`
- Prix à ajuster si hors marché
