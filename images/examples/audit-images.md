# Audit images — comptage et alt manquants

> Recette pilotée par fichier de tâche. Pour un audit ad-hoc plus rapide :
>
> ```
> node images/image-audit.js --filter "status ACTIVE, images < 3"
> ```

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, images < 3
- **Nb entités concernées** : 0

## Action

- **Type** : audit
- **Champ modifié** : —
- **Valeur** : —

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [ ] Afficher les changements prévus avant d'appliquer
- [ ] Demander confirmation `o/N` avant la mutation

## Critères de succès

- Liste des produits avec moins de `SHOP_IMAGE_MIN` images
- Total alt texts manquants connu
- Aucune mutation Shopify

## Résultats
