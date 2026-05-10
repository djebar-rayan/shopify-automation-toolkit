# Mise à jour des alt texts manquants

> Recette : utilise les formules locales (`lib/builders/seo-meta.js`)
> ou Gemini Vision pour des descriptions d'image plus riches.

## Mode formule (rapide, gratuit)

```
node images/image-alt.js                   # dry-run
node images/image-alt.js --confirm         # applique
```

## Mode Vision (riche, payant)

```
node images/image-alt.js --mode=vision --confirm
```

## Filtres

```
node images/image-alt.js --filter "status ACTIVE, no_alt" --confirm
node images/image-alt.js --filter "handle mon-produit" --confirm
```

## Critères de succès

- Toutes les images des produits filtrés ont un alt text non vide
- Longueur ≤ 512 caractères (limite Shopify)
- Pas de doublons grossiers (formula utilise `joinUniq`)
