# Audit — Descriptions inférieures à 150 mots

**Script utilisé** : `audit/audit.js`
**Fichiers de référence lus** : `store-data/products.md`

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, desc_words < 150
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

- Liste des produits dont la description fait moins de 150 mots
- Préparation pour une tâche `content/update-products.js` qui réécrira les descriptions via Gemini

## Résultats
