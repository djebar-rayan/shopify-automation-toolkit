# Audit — Produits avec meta SEO manquant

**Script utilisé** : `audit/audit.js`
**Fichiers de référence lus** : `store-data/products.md`

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE, seo_title manquant
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

- Liste exhaustive des produits sans meta title SEO
- Permet de préparer une tâche `seo/seo-update.js`

## Résultats
