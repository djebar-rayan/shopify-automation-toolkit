# Injection du bloc livraison en début de description

> Cette recette est conceptuelle : elle s'appuie sur `lib/builders/livraison.js`.
> Pour appliquer, il suffit d'écrire un petit script qui appelle
> `injectLivraison` ou `repositionLivraison` sur la description courante,
> puis de pousser le résultat via `productUpdate`.
>
> Le bloc livraison est lu depuis `.env` (`SHOP_LIVRAISON_HTML`).
> La règle métier : il doit toujours **ouvrir** la description.

## Cible

- **Scope** : products
- **Filtre** : status ACTIVE
- **Nb entités concernées** : 0

## Action

- **Type** : update
- **Champ modifié** : descriptionHtml
- **Valeur** : utiliser `lib/builders/livraison.js::injectLivraison(currentHtml)`

## Validation avant application

- [x] Vérifier que les entités cibles sont bien dans `store-data/products.md`
- [x] Afficher les changements prévus avant d'appliquer
- [x] Demander confirmation `o/N` avant la mutation

## Critères de succès

- Toutes les descriptions ciblées commencent par le bloc livraison
- Aucune duplication du bloc

## Résultats
