---
name: seo-researcher
description: Effectue une recherche de mots-clés SEO approfondie via WebSearch pour identifier les termes à fort volume/faible concurrence dans une niche donnée, et produit une liste de mots-clés priorisés avec intentions de recherche. Use when the user needs keyword research, wants to find SEO opportunities, identify content gaps, or build a keyword strategy for any niche or product category.
---

# SEO Researcher

Recherche de mots-clés structurée via WebSearch pour identifier les opportunités SEO
à fort potentiel pour une boutique e-commerce. La niche et les seeds sont **paramètres**
(lus dans `.env` via `SHOP_BRAND_NAME`/`SHOP_BRAND_VOCABULARY` ou demandés à l'utilisateur).

## Instructions

### Étape 1 — Définir la niche et les seeds

Demander à l'utilisateur (ou déduire de `.env`) :

- **Niche** : ex. « cosmétiques bio », « accessoires running », …
- **Langue cible** : français (principal), anglais (secondaire)
- **Zone géo** : France, Belgique, Suisse, …
- **Type de contenu** : pages produit, collections, blog, landing

Préparer une liste de **seeds** (5-10 mots-clés racines) à partir du vocabulaire
de marque ou des principaux types de produits.

### Étape 2 — Expansion sémantique via WebSearch

Pour chaque seed, rechercher les variantes et questions associées :

```
"<seed>" signification histoire
"<seed>" cadeau idée
"<seed>" femme homme enfant
"<seed>" argent or matériau
```

Et les **questions fréquentes** :

```
site:quora.com OR site:reddit.com "<seed>"
"comment choisir" "<seed>"
"quel <type>" "<seed>" critères
```

### Étape 3 — Classer par intention

| Intention | Description | Exemples |
|---|---|---|
| Transactionnelle | Achat immédiat | « acheter X », « X prix » |
| Navigationnelle | Cherche une marque | « <brand> X » |
| Informationnelle | Veut apprendre | « signification X », « histoire X » |
| Commerciale | Compare avant achat | « meilleur X », « X avis » |

Prioriser : **Transactionnelle > Commerciale > Informationnelle**.

### Étape 4 — Estimer la concurrence via SERPs

Pour les 20 mots-clés les plus prometteurs :

```
"<mot-clé>" -site:wikipedia.org
"<mot-clé>" boutique <zone>
"<mot-clé>" <année courante>
```

Évaluer :

- Nombre de boutiques e-commerce dans les 10 premiers
- Présence de gros sites (Amazon, Etsy) = forte concurrence
- Présence de petites boutiques artisanales = opportunité

### Étape 5 — Matrice de priorisation

```
Haute priorité : Volume fort + Difficulté faible
Opportunité    : Volume moyen + Difficulté faible
Long terme     : Volume fort + Difficulté forte
Éviter         : Volume faible + Difficulté forte
```

### Étape 6 — Longue traîne

Identifier les phrases de 4+ mots à fort taux de conversion :

```
"<type produit> <attribut spécifique> <occasion>"
"<produit> <matériau> <cible>"
```

### Étape 7 — Rapport

Générer `keyword-research.md` à la racine du repo :

```markdown
# Recherche de mots-clés — <niche>
**Date** : YYYY-MM-DD

## Top 20 mots-clés prioritaires
| Mot-clé | Intention | Priorité | Utilisable dans |
|---|---|---|---|
| … | Transac. | P1 | meta title, collection |

## Mots-clés longue traîne
…

## Opportunités blog
…

## Mots-clés à éviter (trop compétitifs)
…
```

### Étape 8 — Mapping aux pages existantes

Pour chaque mot-clé prioritaire, proposer où l'intégrer :

- Meta title d'une page produit existante (cf. `seo/seo-update.js`)
- Titre / description d'une collection (cf. `content/update-collections.js`)
- Sujet d'un article de blog à créer
- Description de page CMS (cf. `content/update-pages.js`)
