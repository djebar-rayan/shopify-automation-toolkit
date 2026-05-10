# Exemple — Audit des produits avec moins de 3 images

**Date** : 2026-01-15
**Script utilisé** : `audit/audit.js`
**Fichiers de référence lus** : `store-data/products.md`

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, images < 3
- **Nb entités concernées** : 0 (à recalculer)

## Action

- **Type** : audit
- **Champ modifié** : —
- **Valeur** : —

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [ ] Afficher les changements prévus avant d'appliquer (non applicable, audit)
- [ ] Demander confirmation `o/N` avant la mutation (non applicable, audit)

## Critères de succès

- Liste exhaustive des produits actifs avec moins de 3 images
- Aucune mutation Shopify déclenchée
- Permet de planifier une tâche `images/image-generate.js` ou un shooting photo

## Résultats
