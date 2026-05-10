# Génération d'alt texts manquants

> Cette recette utilise directement la commande dédiée (formules locales,
> pas d'appel Gemini) :
>
> ```
> node seo/seo-update.js --target=alt           # dry-run
> node seo/seo-update.js --target=alt --confirm # applique
> ```
>
> Le format des alt texts est défini dans `lib/builders/seo-meta.js::generateAltText`.

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, no_alt
- **Nb entités concernées** : 0

## Action

- **Type** : update
- **Champ modifié** : (alt text par image, pas via productUpdate)
- **Valeur** : produit par les formules de `lib/builders/seo-meta.js`

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- 100 % des images des produits filtrés disposent d'un alt text non vide

## Résultats
