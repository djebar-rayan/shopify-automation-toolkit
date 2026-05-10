# Audit — Produits avec moins de 3 images

**Script utilisé** : `audit/audit.js`
**Fichiers de référence lus** : `store-data/products.md`

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, images < 3
- **Nb entités concernées** : 0 (recalculé par le script)

## Action

- **Type** : audit
- **Champ modifié** : —
- **Valeur** : —

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [ ] Afficher les changements prévus avant d'appliquer (non applicable)
- [ ] Demander confirmation `o/N` avant la mutation (non applicable)

## Critères de succès

- Un compte des produits actifs avec moins de 3 images est restitué
- Aucune mutation Shopify déclenchée

## Résultats
